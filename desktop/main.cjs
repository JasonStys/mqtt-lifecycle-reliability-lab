/** File: desktop/main.cjs
 * Author: Jason Stys
 * Purpose: Launch the full original lifecycle engine/workbench with bounded local project operations.
 * Functions: sender binds IPC to the owned main frame; operation retains file dialogs/work through Quit.
 * State: one explicit durable OS-owner profile and temporary Chromium cache; no accounts/network integrations.
 */
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { join, dirname, resolve, isAbsolute } = require('node:path');
const { pathToFileURL } = require('node:url');
const { readUtf8, newFile } = require('./files.cjs');
const { openProfile } = require('./profile.cjs');
const { verifiedAssets, assetServer } = require('./assets.cjs');
const VERSION = '1.1.0';
let window,
  profile,
  server,
  startup,
  closing,
  exiting = false;
const pending = new Set();
const explicitIndex = process.argv.indexOf('--profile');
const acceptance = process.env.MLW_NATIVE_ACCEPTANCE_ROOT;
const shellRoot = fs.mkdtempSync(join(os.tmpdir(), 'mqtt-lifecycle-shell-'));
app.setPath('userData', shellRoot);
fs.mkdirSync(join(shellRoot, 'session'));
app.setPath('sessionData', join(shellRoot, 'session'));

/** Never expose IPC to an iframe, another window, an external navigation or a closing owner. */
function sender(event, allowClosing = false) {
  if (
    (!allowClosing && closing) ||
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !server ||
    event.senderFrame.url !== server.origin + '/'
  )
    throw new Error('The active lifecycle workspace is required.');
}
/** Track accepted local work before awaiting; menu/window close waits for its actual completion. */
async function operation(event, work) {
  sender(event);
  const promise = Promise.resolve().then(work);
  pending.add(promise);
  try {
    return await promise;
  } finally {
    pending.delete(promise);
  }
}
function closeOwned() {
  if (!closing)
    closing = (async () => {
      try {
        if (window && !window.isDestroyed())
          window.setTitle('MQTT Lifecycle Workbench — finishing local file work');
        await startup.catch(() => {
          process.exitCode = 1;
        });
        const results = await Promise.allSettled([...pending]);
        if (server) await server.close();
        if (profile) profile.close();
        if (results.some((result) => result.status === 'rejected')) {
          process.exitCode = 1;
          dialog.showErrorBox(
            'A local file operation failed',
            'Accepted file work finished with an error. The workspace was not reset; preserve its files and review the export destination.',
          );
        }
        exiting = true;
        app.quit();
      } catch {
        process.exitCode = 1;
        dialog.showErrorBox(
          'Lifecycle workspace needs review',
          'Local work or ownership did not finish normally. Preserve the workspace; no lock or project was reset.',
        );
        exiting = true;
        app.quit();
      }
    })();
  return closing;
}
app.on('before-quit', (event) => {
  if (!exiting) {
    event.preventDefault();
    void closeOwned();
  }
});
app.on('window-all-closed', () => {
  if (!exiting) void closeOwned();
});

async function start() {
  const resources = app.isPackaged
    ? join(process.resourcesPath, 'native')
    : resolve(process.env.MLW_NATIVE_RESOURCES ?? '');
  if (!app.isPackaged && !process.env.MLW_NATIVE_RESOURCES)
    throw new Error('Use the explicit packaged application or a known source build resource root.');
  const { metadata, assets } = verifiedAssets(resources);
  for (const name of ['main.cjs', 'preload.cjs', 'files.cjs', 'profile.cjs', 'assets.cjs']) {
    // ASAR module stats describe virtual entries, not the physical extracted file descriptor.
    // These fixed already-executing package modules are trusted code, never user-selected inputs.
    const content = fs.readFileSync(join(__dirname, name));
    if (
      content.length > 1_000_000 ||
      createHash('sha256').update(content).digest('hex') !== metadata.owner[name]
    )
      throw new Error('Packaged owner bytes changed.');
  }
  const model = await import(pathToFileURL(join(resources, 'project-model.mjs')).href);
  let directory;
  if (acceptance) {
    if (
      !isAbsolute(acceptance) ||
      readUtf8(join(acceptance, 'acceptance.marker'), 100) !== 'mlw-owned-native-test\n'
    )
      throw new Error('Native acceptance needs a fresh marked synthetic root.');
    directory = join(acceptance, 'workspace');
  } else if (explicitIndex !== -1) {
    if (explicitIndex !== process.argv.length - 2)
      throw new Error('Provide exactly one final absolute --profile directory.');
    directory = process.argv[explicitIndex + 1];
  } else {
    if (!process.env.LOCALAPPDATA)
      throw new Error(
        'Local app data is unavailable. Choose an explicit absolute --profile directory.',
      );
    directory = join(
      process.env.LOCALAPPDATA,
      'JasonStysPortfolio',
      'mqtt-lifecycle-reliability-lab',
      'workspace',
    );
  }
  const forbidden = app.isPackaged
    ? [dirname(process.execPath), process.resourcesPath]
    : [resources];
  profile = openProfile(directory, model.parseProject, forbidden);
  server = await assetServer(assets);
  window = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 480,
    minHeight: 550,
    title: `MQTT Lifecycle Workbench ${VERSION}`,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: Boolean(acceptance),
    },
  });
  const session = window.webContents.session;
  await session.setProxy({ mode: 'direct' });
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !details.url.startsWith(server.origin + '/') }),
  );
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (![server.origin + '/'].includes(url)) event.preventDefault();
  });
  window.on('close', (event) => {
    if (!exiting) {
      event.preventDefault();
      void closeOwned();
    }
  });
  ipcMain.handle('mlw:load', (event) => operation(event, () => profile.load()));
  ipcMain.handle('mlw:save', (event, request) => operation(event, () => profile.save(request)));
  ipcMain.handle('mlw:import', (event) =>
    operation(event, async () => {
      const selected = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [{ name: 'Lifecycle campaign JSON', extensions: ['json'] }],
      });
      if (selected.canceled) return null;
      const text = readUtf8(selected.filePaths[0], model.MAX_PROJECT_BYTES);
      model.parseProject(text);
      return text;
    }),
  );
  ipcMain.handle('mlw:export', (event, request) =>
    operation(event, async () => {
      if (
        !request ||
        Object.keys(request).sort().join('|') !== 'cursor|kind|serialized' ||
        !['project', 'report', 'checkpoint'].includes(request.kind) ||
        typeof request.serialized !== 'string' ||
        !Number.isSafeInteger(request.cursor)
      )
        throw new Error('Unknown campaign export request.');
      const project = model.parseProject(request.serialized);
      const replay = model.replayProject(project, request.cursor);
      const kind = request.kind;
      const content =
        kind === 'project'
          ? JSON.stringify(project, null, 2) + '\n'
          : kind === 'report'
            ? JSON.stringify({ project, replay }, null, 2) + '\n'
            : replay.checkpoint;
      if (content === null) throw new Error('Replay a disconnected checkpoint event first.');
      if (Buffer.byteLength(content) > 16 * 1024 * 1024)
        throw new Error('Generated report exceeds its 16 MiB bound.');
      const selected = await dialog.showSaveDialog(window, {
        defaultPath: 'mqtt-' + kind + '.json',
      });
      if (selected.canceled) return false;
      try {
        newFile(selected.filePath, content);
      } catch (failure) {
        if (failure.code === 'EEXIST')
          throw new Error(
            'Destination already exists. Choose a new file; nothing was overwritten.',
            { cause: failure },
          );
        throw failure;
      }
      return true;
    }),
  );
  ipcMain.handle('mlw:quit', (event) => {
    sender(event, true);
    void closeOwned();
    return true;
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Application',
        submenu: [{ label: 'Quit after local work', click: () => void closeOwned() }],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Using MQTT Lifecycle Workbench',
            click: () =>
              dialog.showMessageBox(window, {
                type: 'info',
                title: 'MQTT Lifecycle Workbench',
                message:
                  'Create and validate an offline campaign, replay exact event prefixes with the original lifecycle engine, inspect source-bound queue/state evidence and explicitly load/save/export. Prepared cases are editable inputs inside the full application.',
                detail:
                  'By Jason Stys · github.com/JasonStys. Single trusted OS owner; plaintext files; no accounts or network integration. Offline simulation is not MQTT or Sparkplug conformance. Unsigned Windows portable application 1.1.0.',
              }),
          },
        ],
      },
    ]),
  );
  await window.loadURL(server.origin + '/');
}

app.whenReady().then(() => {
  startup = start();
  startup.catch((failure) => {
    process.exitCode = 1;
    dialog.showErrorBox('Lifecycle workspace startup needs review', failure.message);
    void closeOwned();
  });
});
