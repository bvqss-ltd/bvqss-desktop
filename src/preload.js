// Runs in the page before the site's own code. Only exposes a "try again" for the offline page and lets the
// sites know they are inside the desktop app (window.BVQSSDesktop), nothing else.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('BVQSSDesktop', { app: true, retry: (to) => ipcRenderer.send('bvq:retry', to) });
