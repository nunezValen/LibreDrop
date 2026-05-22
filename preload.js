const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('libredrop', {
  onServerState(callback) {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('server-state', handler);

    return () => {
      ipcRenderer.removeListener('server-state', handler);
    };
  },
});
