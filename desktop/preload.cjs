/** File: desktop/preload.cjs
 * Author: Jason Stys
 * Purpose: Expose only five owned-window campaign operations, never raw IPC, Node, paths or capabilities.
 * Functions/state: frozen mqttStudio bridge; exact sender/arguments are verified by the main owner.
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'mqttStudio',
  Object.freeze({
    load: () => ipcRenderer.invoke('mlw:load'),
    save: (request) => ipcRenderer.invoke('mlw:save', request),
    import: () => ipcRenderer.invoke('mlw:import'),
    export: (request) => ipcRenderer.invoke('mlw:export', request),
    quit: () => ipcRenderer.invoke('mlw:quit'),
  }),
);
