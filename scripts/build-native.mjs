/** File: scripts/build-native.mjs
 * Author: Jason Stys
 * Purpose: Bundle the genuine original-engine lifecycle application into a fresh Windows portable directory.
 * Functions: checked bounds fixed build tools; fingerprint binds authored bytes; inventory closes web resources.
 * State: ignored fresh staging/output only, no installation, user profile or release publication.
 */
import { execFile } from 'node:child_process';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, cp, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build as viteBuild } from 'vite';
import { lockedNotice } from './locked-notice.mjs';
const { readRegular } = createRequire(import.meta.url)('../desktop/files.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const output = resolve(root, process.env.MLW_NATIVE_OUTPUT ?? 'release/pilot-001');
const staging = join(root, '.runtime', 'native-resources-' + randomBytes(8).toString('hex'));
const version = '1.1.0';

async function checked(executable, args, options = {}) {
  return (
    await run(executable, args, {
      cwd: root,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
      ...options,
    })
  ).stdout;
}
async function git(...args) {
  return (
    await checked('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args])
  ).trim();
}
/** Only Git-authored/nonignored paths; never scan ignored private developer configuration. */
async function fingerprint() {
  const names = (
    await checked('git', [
      '-c',
      `safe.directory=${root.replaceAll('\\', '/')}`,
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
    ])
  )
    .split('\0')
    .filter(Boolean);
  if (names.length > 5000) throw new Error('Authored inventory exceeds its bound.');
  return Object.fromEntries(
    names.sort().map((name) => {
      const path = resolve(root, name);
      if (!path.startsWith(root + sep)) throw new Error('Authored path escaped.');
      return [
        name.replaceAll('\\', '/'),
        createHash('sha256')
          .update(readRegular(path, 32 * 1024 * 1024))
          .digest('hex'),
      ];
    }),
  );
}
async function inventory(directory, prefix = '') {
  const files = [];
  for (const row of await readdir(directory, { withFileTypes: true })) {
    if (row.isSymbolicLink()) throw new Error('Linked staged resources refused.');
    const name = prefix ? prefix + '/' + row.name : row.name;
    if (row.isDirectory()) files.push(...(await inventory(join(directory, row.name), name)));
    else if (row.isFile()) files.push(name);
    else throw new Error('Special staged resource refused.');
    if (files.length > 100) throw new Error('Staged website inventory exceeded its bound.');
  }
  return files;
}
/** Distinct original component-grid icon; no downloaded/third-party branding. */
async function icon(path) {
  const side = 256,
    pixels = Buffer.alloc(side * side * 4),
    mask = Buffer.alloc((side * side) / 8),
    bitmap = Buffer.alloc(40);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const radius = Math.hypot(x - 42, y - 210),
        inside =
          radius < 13 ||
          (x >= 42 && y <= 210 && [55, 105, 155].some((arc) => Math.abs(radius - arc) < 8));
      const offset = ((side - 1 - y) * side + x) * 4;
      const color = inside ? [20, 182, 166] : [15, 26, 45];
      pixels[offset] = color[2];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[0];
      pixels[offset + 3] = 255;
    }
  bitmap.writeUInt32LE(40, 0);
  bitmap.writeInt32LE(side, 4);
  bitmap.writeInt32LE(side * 2, 8);
  bitmap.writeUInt16LE(1, 12);
  bitmap.writeUInt16LE(32, 14);
  bitmap.writeUInt32LE(pixels.length, 20);
  const image = Buffer.concat([bitmap, pixels, mask]),
    header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile(path, Buffer.concat([header, image]), { flag: 'wx' });
}

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Current native candidate targets Windows x64.');
if (!output.startsWith(join(root, 'release') + sep))
  throw new Error('Fresh output must stay below release/.');
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const source = await git('rev-parse', 'HEAD'),
  sourceDirty = Boolean(await git('status', '--porcelain'));
if (
  !/^[0-9a-f]{40}$/.test(source) ||
  (process.env.GITHUB_ACTIONS === 'true' && (sourceDirty || process.env.GITHUB_SHA !== source))
)
  throw new Error('Hosted build requires exact clean source.');
const before = await fingerprint();
if (
  JSON.parse(readRegular(join(root, 'package.json'), 1_000_000)).version !== version ||
  JSON.parse(readRegular(join(root, 'desktop/package.json'), 1_000_000)).version !== version
)
  throw new Error('Application/library metadata versions differ.');
await checked(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
await viteBuild({ build: { sourcemap: false } });
await mkdir(staging, { recursive: true });
await cp(join(root, 'dist/dashboard'), join(staging, 'site'), {
  recursive: true,
  errorOnExist: true,
  force: false,
});
await viteBuild({
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: staging,
    emptyOutDir: false,
    lib: {
      entry: join(root, 'src/workbench/campaign.ts'),
      formats: ['es'],
      fileName: () => 'project-model.mjs',
    },
  },
});
const files = {};
for (const name of await inventory(staging))
  files[name] = createHash('sha256')
    .update(readRegular(join(staging, ...name.split('/')), 16 * 1024 * 1024))
    .digest('hex');
const owner = {};
for (const name of ['main.cjs', 'preload.cjs', 'files.cjs', 'profile.cjs', 'assets.cjs'])
  owner[name] = createHash('sha256')
    .update(readRegular(join(root, 'desktop', name), 1_000_000))
    .digest('hex');
await writeFile(
  join(staging, 'SOURCE.json'),
  JSON.stringify(
    {
      schema: 1,
      product: 'mqtt-lifecycle-reliability-lab',
      version,
      source,
      sourceDirty,
      files,
      owner,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
const notices = join(staging, 'notices');
await mkdir(notices);
await cp(join(root, 'LICENSE'), join(notices, 'PROJECT-LICENSE.txt'), {
  errorOnExist: true,
  force: false,
});
for (const name of ['zod']) {
  const file = lockedNotice(root, name);
  await writeFile(join(notices, name + '-LICENSE.txt'), file, { flag: 'wx' });
}
const ico = join(staging, 'lifecycle.ico');
await icon(ico);
const configuration = JSON.parse(readRegular(join(root, 'desktop/package.json'), 1_000_000)).build;
configuration.directories.output = output;
configuration.win.icon = ico;
configuration.extraResources = [{ from: staging, to: 'native' }];
const configurationPath = staging + '-builder.json';
await writeFile(configurationPath, JSON.stringify(configuration, null, 2), {
  flag: 'wx',
});
await checked(
  process.execPath,
  [
    join(root, 'desktop/node_modules/electron-builder/cli.js'),
    '--projectDir',
    join(root, 'desktop'),
    '--win',
    'dir',
    '--publish',
    'never',
    '--config',
    configurationPath,
  ],
  {
    timeout: 300_000,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  },
);
if (
  !readRegular(join(output, 'win-unpacked/resources/native/SOURCE.json'), 512 * 1024).equals(
    readRegular(join(staging, 'SOURCE.json'), 512 * 1024),
  )
)
  throw new Error('The packaged resource identity was not actually copied.');
readRegular(join(output, 'win-unpacked/MqttLifecycleWorkbench.exe'), 512 * 1024 * 1024);
if (JSON.stringify(await fingerprint()) !== JSON.stringify(before))
  throw new Error('Source changed during native packaging; output is not accepted.');
console.log(JSON.stringify({ built: true, version, source, sourceDirty, output }));
