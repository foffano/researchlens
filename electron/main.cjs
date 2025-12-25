const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const db = require('./database.cjs');
const XLSX = require('xlsx');
const chardet = require('chardet');
const iconv = require('iconv-lite');

// Initialize DB early
db.initDatabase();

const PDF_STORAGE_DIR = path.join(app.getPath('userData'), 'pdfs');
const DATASET_STORAGE_DIR = path.join(app.getPath('userData'), 'datasets');
fs.ensureDirSync(PDF_STORAGE_DIR);
fs.ensureDirSync(DATASET_STORAGE_DIR);

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
    datasets: db.getDatasets(),
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

ipcMain.handle('import-dataset', async (event, files) => {
    // files: array of { name, path }
    const results = [];
    
    for (const file of files) {
        const datasetId = uuidv4();
        const ext = path.extname(file.name);
        const storageName = `${datasetId}${ext}`;
        const storagePath = path.join(DATASET_STORAGE_DIR, storageName);
        
        try {
            await fs.copy(file.path, storagePath);
            
            // Handle Encoding
            let buffer = await fs.readFile(storagePath);
            let workbook;

            if (ext.toLowerCase() === '.csv') {
                // Strategy: Convert everything to a generic JS string first, then parse.
                
                let contentString = '';
                
                // 1. Try treating as UTF-8 first
                const utf8Str = buffer.toString('utf-8');
                const looksLikeValidUtf8 = !utf8Str.includes('\ufffd');

                if (looksLikeValidUtf8) {
                     contentString = utf8Str;
                } else {
                     // 2. Fallback: Detect encoding
                     const detected = chardet.detect(buffer);
                     try {
                         contentString = iconv.decode(buffer, detected || 'windows-1252');
                     } catch (e) {
                         contentString = utf8Str;
                     }
                }

                // 3. MOJIBAKE CHECK (The "GonÃ§alves" Fix)
                // If the string contains patterns typical of UTF-8 read as Latin1, repair it.
                // Common artifacts: Ã§ (ç), Ã£ (ã), Ã© (é), Ã³ (ó), Ã­ (í)
                // We check for 'Ã' followed by specific chars.
                const mojibakePatterns = ['Ã§', 'Ã£', 'Ã©', 'Ã³', 'Ã­', 'Ãª', 'Ã¡', 'Ãº'];
                if (mojibakePatterns.some(p => contentString.includes(p))) {
                    console.log(`File ${file.name} appears to have Mojibake (UTF-8 read as Latin1). Attempting repair...`);
                    try {
                        // "Repair" by reversing the damage: 
                        // Treat the current characters as single bytes (binary/latin1) to get back the original UTF-8 bytes
                        const rawBuffer = Buffer.from(contentString, 'binary');
                        const repaired = iconv.decode(rawBuffer, 'utf-8');
                        
                        // Only accept repair if it didn't create NEW errors and actually removed the artifacts
                        if (!repaired.includes('\ufffd') && !mojibakePatterns.some(p => repaired.includes(p))) {
                            console.log('Mojibake repair successful.');
                            contentString = repaired;
                        }
                    } catch (e) {
                        console.warn('Mojibake repair failed, keeping original.', e);
                    }
                }

                // Parse string content directly
                workbook = XLSX.read(contentString, { type: 'string' });

            } else {
                // For Excel (.xlsx, .xls), binary parsing is usually robust
                workbook = XLSX.read(buffer, { type: 'buffer' });
            }
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 1. Extract Headers explicitly (row 1)
            const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
            const headers = headerRow.map(h => String(h)); // Ensure strings

            // 2. Extract Data (forcing raw to avoid skipping empty keys, but sheet_to_json might still be sparse)
            // Better: use raw: false to get formatted strings, but defval: "" to ensure keys exist? 
            // sheet_to_json with 'header' option can map to specific keys, but we want dynamic.
            // Best approach: Parse as array of arrays, then map to object using known headers.
            
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            // Remove header row
            rawRows.shift();
            
            const jsonData = rawRows.map(row => {
                const obj = {};
                headers.forEach((h, index) => {
                    obj[h] = row[index] !== undefined ? row[index] : ""; // Default to empty string
                });
                return obj;
            });
            
            // Create Dataset Entry
            const datasetEntry = {
                id: datasetId,
                name: file.name,
                storagePath: storagePath,
                uploadDate: new Date().toISOString(),
                rowCount: jsonData.length,
                headers: JSON.stringify(headers)
            };
            
            db.addDataset(datasetEntry);
            
            // Create Row Entries
            const rowEntries = jsonData.map((row, index) => ({
                id: uuidv4(),
                datasetId: datasetId,
                rowIndex: index,
                data: JSON.stringify(row)
            }));
            
            db.addDatasetRows(rowEntries);
            
            // Parse headers back for frontend
            results.push({ ...datasetEntry, headers: headers });
            
        } catch (err) {
            console.error('Failed to import dataset:', file.name, err);
        }
    }
    return results;
});

ipcMain.handle('get-dataset-rows', (event, { datasetId, page = 1, pageSize = 50, search = '' }) => {
    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    return db.getDatasetRows(datasetId, { limit, offset, search });
});

ipcMain.handle('get-dataset-stats', (event, datasetId) => {
    return db.getDatasetStats(datasetId);
});

ipcMain.handle('export-dataset-csv', async (event, { datasetId, search, columns }) => {
    // Save to Downloads automatically
    const downloadsPath = app.getPath('downloads');
    const fileName = `dataset_export_${datasetId}_${Date.now()}.csv`;
    const filePath = path.join(downloadsPath, fileName);

    try {
        const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
        
        const esc = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val);
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ['Index', ...columns.map(c => c.label)];
        writeStream.write(headers.map(esc).join(',') + '\n');

        const iterator = db.getDatasetRowsCursor(datasetId, search);
        let chunk = [];
        const CHUNK_SIZE = 500;
        
        const processChunk = (rows) => {
            const ids = rows.map(r => r.id);
            const analysisMap = db.getAnalysisForRows(ids);
            
            let chunkCsv = '';
            for (const row of rows) {
                let data = {};
                try { data = JSON.parse(row.data); } catch(e) {}
                const analysis = analysisMap[row.id] || {};
                const rowValues = [String(row.rowIndex + 1)];
                
                columns.forEach(col => {
                    let val = analysis[col.id];
                    if (val === undefined) val = data[col.id];
                    rowValues.push(esc(val));
                });
                chunkCsv += rowValues.join(',') + '\n';
            }
            writeStream.write(chunkCsv);
        };

        for (const row of iterator) {
            chunk.push(row);
            if (chunk.length >= CHUNK_SIZE) {
                processChunk(chunk);
                chunk = [];
            }
        }
        
        if (chunk.length > 0) processChunk(chunk);

        writeStream.end();
        
        return { success: true, filePath, fileName };

    } catch (error) {
        console.error('Export failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-dataset-row', (event, { id, data }) => {
    db.updateDatasetRow(id, data);
    return { success: true };
});

ipcMain.handle('delete-dataset', (event, id) => {
    db.deleteDataset(id);
    return { success: true };
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

ipcMain.handle('rename-folder', (event, { id, name }) => {
  db.renameFolder(id, name);
  return { success: true };
});

ipcMain.handle('delete-folder', (event, id) => {
  db.deleteFolder(id);
  return { success: true };
});

ipcMain.handle('rename-dataset', (event, { id, name }) => {
    db.renameDataset(id, name);
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

ipcMain.handle('save-csv', async (event, { content, prefix }) => {
    const downloadsPath = app.getPath('downloads');
    const fileName = `${prefix}_${Date.now()}.csv`;
    const filePath = path.join(downloadsPath, fileName);

    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { success: true, filePath, fileName };
    } catch (error) {
        console.error('Save CSV failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-explorer', (event, filePath) => {
    shell.showItemInFolder(filePath);
    return { success: true };
});

ipcMain.handle('clear-all-data', async () => {
  try {
    db.clearDatabase();
    await fs.emptyDir(PDF_STORAGE_DIR); // Wipes all PDFs from disk
    await fs.emptyDir(DATASET_STORAGE_DIR);
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