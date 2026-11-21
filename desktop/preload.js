// Puntea dintre aplicație și Windows: doar salvarea fișierelor generate.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicColor', {
  /** files: [{ name, bytes: Uint8Array }] → căile scrise (gol dacă s-a anulat). */
  saveFiles: files => ipcRenderer.invoke('save-files', files.map(f => ({ name: f.name, bytes: f.bytes }))),
  showInFolder: p => ipcRenderer.invoke('show-in-folder', p),
});
