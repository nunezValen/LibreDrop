const path = require('path');
const { app, BrowserWindow, nativeImage, screen } = require('electron');
const QRCode = require('qrcode');
const { startServer } = require('./server');

let mainWindow;
let serverHandle;

const appIconPath = path.join(__dirname, 'logo libredrop.png');

function getWindowBounds() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.max(960, Math.round(width * 0.7));
  const windowHeight = Math.max(760, Math.round(height * 0.86));

  return {
    width: Math.min(windowWidth, width),
    height: Math.min(windowHeight, height),
  };
}

function createWindow() {
  const icon = nativeImage.createFromPath(appIconPath);

  mainWindow = new BrowserWindow({
    ...getWindowBounds(),
    backgroundColor: '#0b1020',
    title: 'LibreDrop',
    icon,
    center: true,
    minWidth: 960,
    minHeight: 720,
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
  app.setAppUserModelId('com.libredrop.desktop');
  serverHandle = await startServer({ storageRoot: app.getPath('userData') });

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
