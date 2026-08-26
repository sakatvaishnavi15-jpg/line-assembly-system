// Currently no privileged APIs are exposed to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Silently prints a PDF at the given URL on the default printer.
  // Returns { success: boolean, error: string|null }
  printLabel: (url) => ipcRenderer.invoke('print-label', url)
});
// Currently no privileged APIs are exposed to the renderer.
// The renderer talks to the backend directly over HTTP (http://localhost:4000).
