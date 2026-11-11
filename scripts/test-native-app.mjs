/** File: scripts/test-native-app.mjs
 * Author: Jason Stys
 * Purpose: Use the actual compiled full authoring app twice with realistic edits, public components and durable state.
 * Functions: launch/finish own a marked synthetic profile; imports/exports use genuine new-file IO and fixed dialogs.
 * State: this harness never opens normal AppData, installs an app, changes a shortcut or forces a successful exit.
 */
import { _electron as electron, expect } from '../desktop/node_modules/@playwright/test/index.mjs';
import { mkdir, mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
import { preparedProject } from '../src/workbench/campaign.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = resolve(
  process.env.MLW_NATIVE_EXECUTABLE ??
    join(root, 'release/pilot-001/win-unpacked/MqttLifecycleWorkbench.exe'),
);
const output = resolve(root, process.env.MLW_NATIVE_PROOF ?? 'artifacts/native/pilot-001');
if (!output.startsWith(join(root, 'artifacts/native') + sep))
  throw new Error('Use a fresh project-native proof directory.');
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const scratch = await mkdtemp(join(tmpdir(), 'mqtt-native-consumer-'));
await writeFile(join(scratch, 'acceptance.marker'), 'mlw-owned-native-test\n', {
  flag: 'wx',
  mode: 0o600,
});
const metadata = JSON.parse(
  await readFile(join(dirname(executable), 'resources/native/SOURCE.json'), 'utf8'),
);
expect(metadata.version).toBe('1.1.0');
expect(metadata.source).toBe(
  execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
);
for (const name of ['main.cjs', 'preload.cjs', 'files.cjs', 'profile.cjs', 'assets.cjs'])
  expect(metadata.owner[name]).toBe(
    createHash('sha256')
      .update(await readFile(join(root, 'desktop', name)))
      .digest('hex'),
  );
if (process.env.CI) expect(metadata.sourceDirty).toBe(false);
const environment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(key.toUpperCase()),
  ),
);
environment.PATH = join(process.env.SYSTEMROOT ?? 'C:/Windows', 'System32');
environment.MLW_NATIVE_ACCEPTANCE_ROOT = scratch;
const outsideRequests = [],
  pageErrors = [];
let proxyRequests = 0,
  current;
const proxy = http.createServer((_request, response) => {
  proxyRequests++;
  response.writeHead(502);
  response.end();
});
proxy.listen(0, '127.0.0.1');
await once(proxy, 'listening');

async function launch() {
  const application = await electron.launch({
    executablePath: executable,
    args: [
      `--proxy-server=http://127.0.0.1:${proxy.address().port}`,
      '--proxy-bypass-list=<-loopback>',
    ],
    env: environment,
    timeout: 60_000,
  });
  current = application;
  const page = await application.firstWindow({ timeout: 30_000 });
  page.setDefaultTimeout(5_000);
  page.setDefaultNavigationTimeout(10_000);
  await expect(page.getByRole('heading', { name: 'MQTT lifecycle workbench' })).toBeVisible();
  await expect(page.getByText('MQTT Lifecycle Workbench 1.1.0', { exact: false })).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  expect(
    await application.evaluate(
      ({ BrowserWindow }, url) =>
        BrowserWindow.getAllWindows()[0].webContents.session.resolveProxy(url),
      origin,
    ),
  ).toBe('DIRECT');
  expect(
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
  ).toBe(true);
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) outsideRequests.push(request.url());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { application, page };
}
async function finish(application, page) {
  const exit = once(application.process(), 'exit');
  await page.getByRole('button', { name: 'Quit application', exact: true }).click();
  let timer;
  const result = await Promise.race([
    exit,
    new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Native owner did not exit normally after accepted file work')),
        20_000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  expect(result).toEqual([0, null]);
  await expect
    .poll(() =>
      stat(join(scratch, 'workspace/workspace.lock')).then(
        () => true,
        (failure) => {
          if (failure.code === 'ENOENT') return false;
          throw failure;
        },
      ),
    )
    .toBe(false);
  current = undefined;
}

/** A genuine accepted asynchronous file choice must finish its actual new-file write before repeated Close exits. */
async function finishAfterHeldExport(application, page, project) {
  const target = join(scratch, 'quit-retained-project.json');
  await application.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = () =>
      new Promise((resolve) => {
        globalThis.releaseOwnedDesignExport = () => resolve({ canceled: false, filePath: file });
      });
  }, target);
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  await expect
    .poll(() => application.evaluate(() => typeof globalThis.releaseOwnedDesignExport))
    .toBe('function');
  const exit = once(application.process(), 'exit');
  await application.evaluate(({ BrowserWindow }) => {
    const owner = BrowserWindow.getAllWindows()[0];
    owner.close();
    owner.close();
  });
  expect(application.process().exitCode).toBeNull();
  expect(
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
  ).toBe(true);
  expect(
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()),
  ).toContain('finishing local file work');
  expect((await stat(join(scratch, 'workspace/workspace.lock'))).isFile()).toBe(true);
  await application.evaluate(() => globalThis.releaseOwnedDesignExport());
  let timer;
  const result = await Promise.race([
    exit,
    new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Retained export did not complete before normal native exit')),
        20_000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  expect(result).toEqual([0, null]);
  expect(await readFile(target, 'utf8')).toBe(JSON.stringify(project, null, 2) + '\n');
  await expect
    .poll(() =>
      stat(join(scratch, 'workspace/workspace.lock')).then(
        () => true,
        (failure) => {
          if (failure.code === 'ENOENT') return false;
          throw failure;
        },
      ),
    )
    .toBe(false);
  current = undefined;
}

try {
  const first = await launch(),
    { application, page } = first;
  await page.getByRole('button', { name: 'Workspace help', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Using the lifecycle workbench' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Workspace help', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save project', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Load saved project', exact: true }).click();
  await expect(page.locator('#campaign-message')).toContainText('No saved project');
  await page
    .getByLabel('Campaign title', { exact: true })
    .fill('Fictional cooler 7 restart analysis');
  await expect(page.getByRole('button', { name: 'Replay all events', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save project', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Apply form settings', exact: true }).click();
  await page.getByRole('button', { name: 'Next event', exact: true }).click();
  await expect(page.locator('#campaign-position')).toContainText('Event 1 of 10');
  await page.getByRole('button', { name: 'Previous event', exact: true }).click();
  await expect(page.locator('#campaign-position')).toContainText('Event 0 of 10');
  await page.getByRole('button', { name: 'Replay all events', exact: true }).click();
  await expect(page.locator('#campaign-summary')).toContainText(
    'birth 2 | buffered 0 | expired 1 | dropped 1 | rejected newest 0 | replayed 2',
  );
  await page.getByRole('button', { name: 'Inspect event 9', exact: true }).click();
  await expect(page.locator('#campaign-detail')).toContainText('"restored": 2');
  await expect(page.locator('#campaign-detail')).toContainText('"capacityDropped": 1');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('#campaign-message')).toContainText('Current project saved locally');
  const currentFile = join(scratch, 'workspace/project.json');
  const coldBytes = await readFile(currentFile);
  const cold = JSON.parse(coldBytes.toString());
  expect(cold.title).toBe('Fictional cooler 7 restart analysis');
  expect(cold.events).toHaveLength(10);
  await page
    .locator('.workbench')
    .screenshot({ path: join(output, 'native-cold-chain-recovery.png') });
  await page.getByLabel('Outcome', { exact: true }).selectOption('rejected');
  await expect(page.locator('#campaign-filter-count')).toContainText('0 of 10');
  await page.getByLabel('Outcome', { exact: true }).selectOption('all');
  await page.getByLabel('Literal event search', { exact: true }).fill('restore');
  await expect(page.locator('#campaign-filter-count')).toContainText('1 of 10');
  const exports = {};
  for (const [kind, label] of [
    ['project', 'Export project'],
    ['report', 'Export complete prefix report'],
    ['checkpoint', 'Export checkpoint'],
  ]) {
    const target = join(scratch, kind + '.json');
    await application.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, target);
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(() => readFile(target, 'utf8').catch(() => '')).not.toBe('');
    exports[kind] = JSON.parse(await readFile(target, 'utf8'));
    const original = await readFile(target);
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('#campaign-error')).toContainText('Destination already exists');
    expect(await readFile(target)).toEqual(original);
  }
  expect(exports.project).toEqual(cold);
  expect(exports.report.replay.rows).toHaveLength(10);
  expect(exports.report.replay.rejectedOperations).toBe(0);
  expect(exports.report.replay.snapshot[0].metrics['cargo.temperature'].value).toBe(4.4);
  expect(exports.report.replay.rows[8].detail).toEqual({
    restored: 2,
    expired: 1,
    capacityDropped: 1,
  });
  expect(exports.checkpoint.entries).toHaveLength(4);
  expect(exports.checkpoint.entries[2].metrics[0].sourceTimestamp).toBe('2026-01-15T12:00:00.800Z');
  const editor = page.getByLabel('Complete project JSON', { exact: true });
  await editor.fill(JSON.stringify({ ...cold, ttlMs: 0 }));
  await page.getByRole('button', { name: 'Validate and apply JSON', exact: true }).click();
  await expect(page.locator('#campaign-error')).not.toHaveText('');
  await expect(page.locator('#campaign-summary')).toContainText('expired 1');
  expect(await readFile(currentFile)).toEqual(coldBytes);
  await page.getByRole('button', { name: 'Discard unapplied input edits', exact: true }).click();
  await page.getByLabel('Literal event search', { exact: true }).fill('');
  const factory = preparedProject('factory'),
    factoryFile = join(scratch, 'factory.json');
  await writeFile(factoryFile, JSON.stringify(factory), { flag: 'wx' });
  await application.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, factoryFile);
  await page.getByRole('button', { name: 'Import project', exact: true }).click();
  await expect(editor).toHaveValue(/Factory late subscriber/);
  await page.getByRole('button', { name: 'Replay all events', exact: true }).click();
  await expect(page.locator('#campaign-summary')).toContainText('birth 2');
  await page.getByText('Current consumer state and counters', { exact: true }).click();
  await expect(page.locator('#campaign-snapshot')).toContainText('"duplicateMessages": 1');
  await expect(page.locator('#campaign-snapshot')).toContainText('"value": 45');
  expect(await readFile(currentFile)).toEqual(coldBytes);
  const invalid = {
    ...factory,
    events: [
      { type: 'restore', atMs: 0 },
      { type: 'connect', atMs: 1 },
      { type: 'checkpoint', atMs: 2 },
    ],
  };
  await editor.fill(JSON.stringify(invalid));
  await page.getByRole('button', { name: 'Validate and apply JSON', exact: true }).click();
  await page.getByRole('button', { name: 'Replay all events', exact: true }).click();
  await expect(page.locator('#campaign-position')).toContainText('2 rejected operation(s)');
  await page.getByLabel('Prepared input', { exact: true }).selectOption('utility');
  await page.getByRole('button', { name: 'Replay all events', exact: true }).click();
  await expect(page.locator('#campaign-summary')).toContainText('birth 3');
  await expect(page.locator('#campaign-summary')).toContainText('rejected newest 1');
  await expect(page.locator('#campaign-snapshot')).toContainText('"value": 202');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('#campaign-message')).toContainText('Current project saved locally');
  const saved = await readFile(currentFile),
    finalProject = JSON.parse(saved.toString());
  expect(await readFile(join(scratch, 'workspace/project.previous.json'))).toEqual(coldBytes);
  const malformed = join(scratch, 'invalid-utf8.json');
  await writeFile(malformed, Buffer.from([255]), { flag: 'wx' });
  await application.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, malformed);
  await page.getByRole('button', { name: 'Import project', exact: true }).click();
  await expect(page.locator('#campaign-error')).not.toHaveText('');
  expect(await readFile(currentFile)).toEqual(saved);
  await page.getByRole('button', { name: 'Load saved project', exact: true }).click();
  await expect(page.locator('#campaign-message')).toContainText('Saved project loaded');
  await page.getByRole('button', { name: 'Replay all events', exact: true }).click();
  await page
    .getByRole('button', { name: 'Run original seven reliability scenarios', exact: true })
    .click();
  await expect(page.locator('#overall-status')).toContainText('7 / 7');
  await page
    .locator('.workbench')
    .screenshot({ path: join(output, 'native-utility-evidence.png') });
  await finishAfterHeldExport(application, page, finalProject);
  const second = await launch();
  await second.page.getByRole('button', { name: 'Load saved project', exact: true }).click();
  await expect(second.page.getByLabel('Campaign title', { exact: true })).toHaveValue(
    'Utility reject-newest outage and broker restart',
  );
  expect(await readFile(currentFile)).toEqual(saved);
  await second.page.getByRole('button', { name: 'Replay all events', exact: true }).click();
  await expect(second.page.locator('#campaign-summary')).toContainText('rejected newest 1');
  await finish(second.application, second.page);
  expect(outsideRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(proxyRequests).toBe(0);
  const receipt = {
    schema: 1,
    passed: true,
    product: 'mqtt-lifecycle-reliability-lab',
    version: metadata.version,
    source: metadata.source,
    sourceDirty: metadata.sourceDirty,
    actualLaunches: 2,
    normalExitCodes: [0, 0],
    visibleNativeWindow: true,
    realOriginalLifecycleEngine: true,
    preparedIndustries: ['cold-chain', 'factory', 'utility'],
    originalIndependentScenarios: 7,
    actualExports: ['project JSON', 'complete exact-prefix report', 'actual checkpoint'],
    invalidAndImportPreserveSavedBytes: true,
    retainedAcceptedExportBeforeRepeatedClose: true,
    persistedProjectSha256: createHash('sha256').update(saved).digest('hex'),
    outsideRequests: 0,
    inheritedProxyRequests: 0,
    normalUserProfileOpened: false,
  };
  await writeFile(join(output, 'acceptance.json'), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(JSON.stringify(receipt));
} catch (failure) {
  await writeFile(
    join(output, 'failure.json'),
    JSON.stringify({ message: String(failure), outsideRequests, pageErrors }) + '\n',
    { flag: 'wx' },
  );
  if (current) await current.evaluate(({ app }) => app.quit()).catch(() => undefined);
  throw failure;
} finally {
  await new Promise((resolve, reject) =>
    proxy.close((failure) => (failure ? reject(failure) : resolve())),
  );
}
