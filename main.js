const path = require('path');
const { app, BrowserWindow } = require('electron');
const QRCode = require('qrcode');
const { startServer } = require('./server');

let mainWindow;
let serverHandle;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 760,
    backgroundColor: '#0b1020',
    title: 'LibreDrop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function boot() {
  serverHandle = await startServer();

  createWindow();

  const receiveQrUrl = serverHandle.receiveUrl;
  const sendQrUrl = serverHandle.sendUrl;

  const receiveQrCodeDataUrl = await QRCode.toDataURL(receiveQrUrl, {
    margin: 1,
    width: 400,
    errorCorrectionLevel: 'M',
  });

  const sendQrCodeDataUrl = await QRCode.toDataURL(sendQrUrl, {
    margin: 1,
    width: 400,
    errorCorrectionLevel: 'M',
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('server-state', {
      ip: serverHandle.ip,
      port: serverHandle.port,
      baseUrl: serverHandle.baseUrl,
      receiveUrl: serverHandle.receiveUrl,
      sendUrl: serverHandle.sendUrl,
      receiveQrCodeDataUrl,
      sendQrCodeDataUrl,
    });
  });
}

app.whenReady().then(() => {
  boot().catch((error) => {
    console.error('Unable to start LibreDrop:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (serverHandle) {
    await serverHandle.stop();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
