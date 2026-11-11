/** File: desktop/tests/assets.test.cjs
 * Author: Jason Stys
 * Purpose: Verify actual fixed public resource hashes and numeric-loopback HTTP refusal behavior.
 * State: inert temporary public bytes and an owned port-zero listener only; no profiles or external requests.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { verifiedAssets, assetServer, CSP } = require('../assets.cjs');

function fixture() {
  const root = fs.mkdtempSync(join(os.tmpdir(), 'mlw-resource-contract-'));
  fs.mkdirSync(join(root, 'site'));
  const rows = {
    'site/index.html': '<!doctype html><p>Public catalog only</p>',
    'site/vanilla.html': '<!doctype html><p>Vanilla</p>',
    'project-model.mjs': 'export const schema=1;',
  };
  const files = {};
  for (const [name, data] of Object.entries(rows)) {
    fs.writeFileSync(join(root, name), data);
    files[name] = createHash('sha256').update(data).digest('hex');
  }
  const metadata = {
    schema: 1,
    product: 'mqtt-lifecycle-reliability-lab',
    version: '1.1.0',
    source: 'a'.repeat(40),
    sourceDirty: false,
    files,
    owner: {},
  };
  fs.writeFileSync(join(root, 'SOURCE.json'), JSON.stringify(metadata));
  return { root, metadata };
}
function get(origin, path, options = {}) {
  return new Promise((resolve, reject) => {
    const agent = new http.Agent({ keepAlive: false, proxyEnv: {} });
    const request = http.request(origin + path, { ...options, agent }, (response) => {
      let body = '';
      response.on('data', (data) => {
        body += data;
      });
      response.on('end', () => {
        agent.destroy();
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body,
        });
      });
    });
    request.once('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('Owned test response deadline')));
    request.end();
  });
}
test('actual immutable verified bytes expose only fixed public paths and restrictive browser headers', async () => {
  const { root } = fixture();
  const { assets } = verifiedAssets(root);
  const server = await assetServer(assets);
  try {
    const okay = await get(server.origin, '/');
    assert.equal(okay.status, 200);
    assert.equal(okay.body, '<!doctype html><p>Public catalog only</p>');
    assert.equal(okay.headers['content-security-policy'], CSP);
    assert.equal(okay.headers['cache-control'], 'no-store');
    assert.equal((await get(server.origin, '/vanilla.html', { method: 'HEAD' })).body, '');
    fs.writeFileSync(join(root, 'site/index.html'), 'changed after admission');
    assert.equal((await get(server.origin, '/')).body, okay.body);
    for (const path of [
      '/SOURCE.json',
      '/project-model.mjs',
      '/project.json',
      '/api/save',
      '/index.html?unknown=1',
      '/%2e%2e/private',
    ])
      assert.equal((await get(server.origin, path)).status, 404);
    assert.equal((await get(server.origin, '/', { method: 'POST' })).status, 404);
    assert.equal(
      (await get(server.origin, '/', { headers: { Host: 'foreign.invalid' } })).status,
      404,
    );
  } finally {
    await server.close();
  }
});
test('actual changed resource is refused before any server or private profile is initialized', () => {
  const { root } = fixture();
  fs.writeFileSync(join(root, 'site/index.html'), 'tampered');
  assert.throws(() => verifiedAssets(root), /bytes changed/);
});
test('actual missing and linked files cannot satisfy the fixed asset inventory', () => {
  for (const kind of ['missing', 'hardlinked']) {
    const { root } = fixture(),
      file = join(root, 'site/index.html');
    if (kind === 'missing') fs.unlinkSync(file);
    else fs.linkSync(file, join(root, 'outside-copy.html'));
    assert.throws(() => verifiedAssets(root));
  }
});
for (const [name, mutate] of [
  [
    'foreign product',
    (value) => {
      value.product = 'another-product';
    },
  ],
  [
    'wrong version',
    (value) => {
      value.version = '9.9.9';
    },
  ],
  [
    'traversal',
    (value) => {
      value.files['site/../private.txt'] = 'a'.repeat(64);
    },
  ],
  [
    'malformed digest',
    (value) => {
      value.files['site/index.html'] = 'not-a-digest';
    },
  ],
])
  test('reject ' + name + ' resource claims', () => {
    const { root, metadata } = fixture();
    mutate(metadata);
    fs.writeFileSync(join(root, 'SOURCE.json'), JSON.stringify(metadata));
    assert.throws(() => verifiedAssets(root));
  });
