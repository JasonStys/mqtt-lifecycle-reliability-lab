/** File: desktop/assets.cjs
 * Author: Jason Stys
 * Purpose: Verify bounded public package bytes once and serve only the immutable website asset allowlist.
 * Functions: verifiedAssets binds descriptor bytes to source hashes; assetServer owns an ephemeral loopback listener.
 * State: no user files, RPC, credentials, redirects, proxy client or imported HTML ever enter this public service.
 */
'use strict';
const http = require('node:http');
const { join, extname } = require('node:path');
const { createHash } = require('node:crypto');
const { readRegular, readUtf8 } = require('./files.cjs');
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

/** Every served byte is an immutable verified buffer; package hashes are provenance, not signatures. */
function verifiedAssets(resources) {
  const metadata = JSON.parse(readUtf8(join(resources, 'SOURCE.json'), 512 * 1024));
  if (
    metadata.schema !== 1 ||
    metadata.product !== 'mqtt-lifecycle-reliability-lab' ||
    metadata.version !== '1.1.0' ||
    !/^[0-9a-f]{40}$/.test(metadata.source) ||
    typeof metadata.sourceDirty !== 'boolean' ||
    !metadata.files ||
    !metadata.owner
  )
    throw new Error('Packaged lifecycle application identity is invalid.');
  const assets = new Map();
  let total = 0;
  if (Object.keys(metadata.files).length > 100 || Object.keys(metadata.files).length < 3)
    throw new Error('Packaged lifecycle inventory is outside its bound.');
  for (const [name, digest] of Object.entries(metadata.files)) {
    if (
      !/^(?:site\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+|project-model\.mjs)$/.test(name) ||
      name.split('/').some((part) => part === '.' || part === '..') ||
      !/^[0-9a-f]{64}$/.test(digest)
    )
      throw new Error('Invalid packaged asset path/hash.');
    const data = readRegular(join(resources, ...name.split('/')), 16 * 1024 * 1024);
    total += data.length;
    if (total > 32 * 1024 * 1024) throw new Error('Packaged website exceeds32MiB.');
    if (createHash('sha256').update(data).digest('hex') !== digest)
      throw new Error('Packaged asset bytes changed.');
    if (name.startsWith('site/')) {
      const type = types[extname(name)];
      if (!type) throw new Error('Unknown packaged web asset type.');
      assets.set('/' + name.slice(5), { data, type });
    }
  }
  if (!assets.has('/index.html') || !('project-model.mjs' in metadata.files))
    throw new Error('Complete lifecycle/model resources are required.');
  return { metadata, assets };
}

/** Exact public GET/HEAD routes only, with no private profile data or request-derived file access. */
async function assetServer(assets) {
  let authority;
  const server = http.createServer((request, response) => {
    const name = request.url === '/' ? '/index.html' : request.url;
    const asset = assets.get(name);
    if (
      request.headers.host !== authority ||
      !['GET', 'HEAD'].includes(request.method) ||
      !asset ||
      request.headers['transfer-encoding'] ||
      (request.headers['content-length'] && request.headers['content-length'] !== '0')
    ) {
      response.writeHead(404, { Connection: 'close' });
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': asset.type,
      'Content-Length': asset.data.length,
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'Cross-Origin-Resource-Policy': 'same-origin',
      Connection: 'close',
    });
    response.end(request.method === 'HEAD' ? undefined : asset.data);
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.setTimeout(5000);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  authority = `127.0.0.1:${server.address().port}`;
  return {
    origin: `http://${authority}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

module.exports = { verifiedAssets, assetServer, CSP };
