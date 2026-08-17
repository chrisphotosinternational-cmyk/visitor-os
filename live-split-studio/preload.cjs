const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studio', {
  openProject: () => ipcRenderer.invoke('project:open'),
  openHtmlFile: () => ipcRenderer.invoke('project:open-html-file'),
  getTree: () => ipcRenderer.invoke('project:tree'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('file:write', path, content),
  minifyFile: (path) => ipcRenderer.invoke('minify:file', path),
  minifySite: () => ipcRenderer.invoke('minify:site'),
  restoreLastMinify: () => ipcRenderer.invoke('minify:restore-last')
});