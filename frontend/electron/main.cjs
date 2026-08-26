const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#14161a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL('https://line-assembly-system.onrender.com');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Silently print a build label PDF (no print dialog) on the system's default
// printer. Loads the PDF in a hidden window using Electron's built-in PDF
// viewer, then triggers a native print of it.
ipcMain.handle('print-label', async (event, url) => {
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({ show: false });

    const cleanupAndResolve = (result) => {
      if (!printWin.isDestroyed()) printWin.close();
      resolve(result);
    };

    printWin.webContents.on('did-finish-load', () => {
      printWin.webContents.print({ silent: true, printBackground: true }, (success, errorType) => {
        cleanupAndResolve({ success, error: success ? null : errorType });
      });
    });

    printWin.webContents.on('did-fail-load', (_event, _code, description) => {
      cleanupAndResolve({ success: false, error: description });
    });

    printWin.loadURL(url);
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
