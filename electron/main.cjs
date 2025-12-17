const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(app.getPath('userData'), 'researchlens_data.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 800,
    minWidth: 1350,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handlers para persistência
  ipcMain.handle('save-data', async (event, data) => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data));
      return { success: true };
    } catch (error) {
      console.error('Failed to save data:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-data', async () => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Failed to load data:', error);
      return null;
    }
  });

  // Verifica se estamos em modo de desenvolvimento via argumento
  const isDev = process.argv.includes('--dev');

  if (isDev) {
    // Carrega o servidor Vite local
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools();
  } else {
    // Carrega o arquivo buildado em produção
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
