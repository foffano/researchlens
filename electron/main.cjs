const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const db = require('./database.cjs');

// Initialize DB early
db.initDatabase();

const PDF_STORAGE_DIR = path.join(app.getPath('userData'), 'pdfs');
fs.ensureDirSync(PDF_STORAGE_DIR);

function createWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 800,
    minWidth: 1350,
    minHeight: 800,
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Sometimes needed for local file access in dev, but generally safe to keep true if we use IPC. keeping false for now to avoid local resource blocks if any.
    },
    autoHideMenuBar: true,
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// --- IPC HANDLERS ---

ipcMain.handle('get-initial-data', async () => {
  return {
    files: db.getAllFiles(),
    folders: db.getFolders(),
    settings: db.loadSettings(),
    columnConfigs: db.getColumnConfigs(),
    customColumns: db.getCustomColumns()
  };
});

ipcMain.handle('upload-files', async (event, files) => {
  // files is array of { name, path, folderId }
  const results = [];
  
  for (const file of files) {
    const fileId = uuidv4();
    const ext = path.extname(file.name);
    const storageName = `${fileId}${ext}`;
    const storagePath = path.join(PDF_STORAGE_DIR, storageName);
    
    try {
      // Copy file to internal storage
      await fs.copy(file.path, storagePath);
      
      const fileEntry = {
        id: fileId,
        name: file.name,
        storagePath: storagePath,
        originalPath: file.path,
        folderId: file.folderId || null,
        uploadDate: new Date().toISOString(),
        status: 'completed' // or 'uploading' if we want async processing
      };
      
      db.addFile(fileEntry);
      
      // Return the entry compatible with frontend
      results.push({
        ...fileEntry,
        analysis: {} // Empty analysis initially
      });
    } catch (err) {
      console.error('Failed to save file:', file.name, err);
      // We could return an error state here
    }
  }
  return results;
});

ipcMain.handle('delete-file', async (event, id) => {
  db.deleteFile(id);
  return { success: true };
});

ipcMain.handle('update-file-folder', async (event, { fileId, folderId }) => {
  db.updateFileFolder(fileId, folderId);
  return { success: true };
});

ipcMain.handle('get-file-content', async (event, id) => {
  const file = db.getFile(id);
  if (!file || !file.storagePath) return null;
  
  try {
    const buffer = await fs.readFile(file.storagePath);
    return buffer.toString('base64');
  } catch (err) {
    console.error('Failed to read file content:', err);
    return null;
  }
});

ipcMain.handle('add-folder', (event, name) => {
  const id = uuidv4();
  db.addFolder({ id, name });
  return { id, name };
});

ipcMain.handle('delete-folder', (event, id) => {
  db.deleteFolder(id);
  return { success: true };
});

ipcMain.handle('delete-folder-and-files', (event, id) => {
  db.deleteFolderAndFiles(id);
  return { success: true };
});

ipcMain.handle('save-analysis', (event, { fileId, results }) => {
  db.saveAnalysis(fileId, results);
  return { success: true };
});

ipcMain.handle('save-column-config', (event, { folderId, config }) => {
  db.saveColumnConfig(folderId, config);
  return { success: true };
});

ipcMain.handle('save-custom-column', (event, col) => {
  db.saveCustomColumn(col);
  return { success: true };
});

ipcMain.handle('delete-custom-column', (event, id) => {
  db.deleteCustomColumn(id);
  return { success: true };
});

ipcMain.handle('save-settings', (event, settings) => {
  for (const [key, value] of Object.entries(settings)) {
    db.saveSetting(key, value);
  }
  return { success: true };
});

ipcMain.handle('search-files', (event, query) => {
  return db.searchFiles(query);
});

ipcMain.handle('get-usage-stats', () => {
  return db.getUsageStats();
});

ipcMain.handle('clear-all-data', async () => {
  try {
    db.clearDatabase();
    await fs.emptyDir(PDF_STORAGE_DIR); // Wipes all PDFs from disk
    return { success: true };
  } catch (error) {
    console.error('Failed to clear data:', error);
    return { success: false, error: error.message };
  }
});

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