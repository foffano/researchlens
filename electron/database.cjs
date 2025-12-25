const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');

let db;

function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'researchlens.db');
  
  fs.ensureDirSync(userDataPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      storagePath TEXT,
      originalPath TEXT,
      folderId TEXT,
      uploadDate TEXT,
      status TEXT,
      error TEXT,
      FOREIGN KEY(folderId) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      storagePath TEXT,
      uploadDate TEXT,
      rowCount INTEGER,
      headers TEXT -- JSON array of column headers
    );

    CREATE TABLE IF NOT EXISTS dataset_rows (
      id TEXT PRIMARY KEY,
      datasetId TEXT NOT NULL,
      rowIndex INTEGER,
      data TEXT, -- JSON content of the row
      FOREIGN KEY(datasetId) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS column_configs (
      folderId TEXT PRIMARY KEY,
      config TEXT
    );
    
    CREATE TABLE IF NOT EXISTS custom_columns (
      id TEXT PRIMARY KEY,
      label TEXT,
      prompt TEXT
    );
  `);

  // --- MIGRATION: Check Datasets Table for 'headers' column ---
  try {
      const dsCols = db.pragma('table_info(datasets)').map(c => c.name);
      if (!dsCols.includes('headers')) {
          console.log("Migrating 'datasets' table: Adding 'headers' column...");
          db.exec("ALTER TABLE datasets ADD COLUMN headers TEXT");
      }
  } catch (e) {
      console.error("Migration error checking datasets table:", e);
  }

  // --- MIGRATION: Check Analysis Table Schema ---
  // We need Primary Key to be (fileId, columnId, model).
  // We also need to REMOVE the FK constraint on fileId so it can point to dataset_rows.
  
  const tableInfo = db.pragma('table_info(analysis)');
  let needsMigration = false;
  let migrationReason = "";

  if (tableInfo.length > 0) {
      // 1. Check PK
      const pkCount = tableInfo.filter(col => col.pk > 0).length;
      if (pkCount < 3) {
          needsMigration = true;
          migrationReason = "PK Update";
      }

      // 2. Check FK (We can't easily query FK existence in simple PRAGMA, but we can check SQL)
      // We'll assume if we haven't run THIS migration yet, we should.
      // We can check if 'promptTokens' exists as a proxy for "recent version", 
      // but for the FK removal specifically, let's just force migration if we suspect it's the old one.
      // Actually, simplest way is to rename and recreate if we want to be sure.
      
      // Let's rely on a specific column or just re-run migration if we want to ensure FK is gone.
      // But re-running on every start is bad.
      // Let's check if 'targetId' column exists? No, we keep 'fileId' name to avoid massive code refactor, just change semantics.
      
      // We can check `sqlite_master` for the table definition to see if "REFERENCES files" is present.
      const sqlDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='analysis'").get();
      if (sqlDef && sqlDef.sql.includes('REFERENCES files')) {
          needsMigration = true;
          migrationReason = "Remove FK";
      }
  } else {
      // Create fresh
      db.exec(`
        CREATE TABLE IF NOT EXISTS analysis (
          fileId TEXT,
          columnId TEXT,
          content TEXT,
          model TEXT,
          timestamp TEXT,
          promptTokens INTEGER DEFAULT 0,
          responseTokens INTEGER DEFAULT 0,
          PRIMARY KEY (fileId, columnId, model)
        )
      `);
  }

  if (needsMigration) {
      console.log(`Migrating 'analysis' table (${migrationReason})...`);
      db.transaction(() => {
          // 1. Rename old table
          db.exec("ALTER TABLE analysis RENAME TO analysis_old");
          
          // 2. Create new table WITHOUT FK to files
          db.exec(`
            CREATE TABLE analysis (
              fileId TEXT,
              columnId TEXT,
              content TEXT,
              model TEXT,
              timestamp TEXT,
              promptTokens INTEGER DEFAULT 0,
              responseTokens INTEGER DEFAULT 0,
              PRIMARY KEY (fileId, columnId, model)
            )
          `);
          
          // 3. Copy data
          // Handle potential missing columns in source if coming from very old version
          const oldCols = db.pragma('table_info(analysis_old)').map(c => c.name);
          const hasTokens = oldCols.includes('promptTokens');
          
          if (hasTokens) {
             db.exec(`
                INSERT OR IGNORE INTO analysis (fileId, columnId, content, model, timestamp, promptTokens, responseTokens)
                SELECT fileId, columnId, content, model, timestamp, promptTokens, responseTokens FROM analysis_old
             `);
          } else {
             db.exec(`
                INSERT OR IGNORE INTO analysis (fileId, columnId, content, model, timestamp)
                SELECT fileId, columnId, content, model, timestamp FROM analysis_old
             `);
          }
          
          // 4. Drop old table
          db.exec("DROP TABLE analysis_old");
      })();
      console.log("Migration complete.");
  }

  console.log('Database initialized at:', dbPath);
}

// --- FILE OPERATIONS ---

function getFile(id) {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

function getAllFiles() {
  // 1. Get all basic file info
  const files = db.prepare('SELECT * FROM files').all();
  
  // 2. Get ALL analysis rows (This might get huge if we have thousands of dataset rows, 
  // so we should probably optimize to only fetch analysis for FILES here, or filter by ID set.
  // But for now, assuming dataset row IDs don't clash with file IDs and we filter later is risky for perf.
  // BETTER: Join or filter.)
  
  // Actually, 'getAllFiles' is for the PDF view. We should only fetch analysis for these files.
  // SQLite `IN` clause with many IDs is okay.
  
  if (files.length === 0) return [];

  const fileIds = files.map(f => f.id);
  const placeholders = fileIds.map(() => '?').join(',');
  const allAnalysis = db.prepare(`SELECT * FROM analysis WHERE fileId IN (${placeholders}) ORDER BY timestamp ASC`).all(...fileIds);

  // 3. Map analysis to files
  const analysisMap = {};

  allAnalysis.forEach(row => {
      if (!analysisMap[row.fileId]) {
          analysisMap[row.fileId] = { 
              _models: {}, 
              _responses: {} 
          };
      }
      
      const fileAnalysis = analysisMap[row.fileId];
      let content = row.content;

      // Parse JSON content if it looks like JSON
      try {
          if (content && (content.startsWith('{') || content.startsWith('['))) {
             content = JSON.parse(content);
          }
      } catch (e) { /* ignore */ }

      // Handle Metadata specifically
      if (row.columnId === 'metadata') {
          fileAnalysis.metadata = content;
      } else {
          // Add to _responses (History)
          if (!fileAnalysis._responses[row.columnId]) {
              fileAnalysis._responses[row.columnId] = {};
          }
          const modelKey = row.model || 'default';
          fileAnalysis._responses[row.columnId][modelKey] = content;

          fileAnalysis[row.columnId] = content;
          fileAnalysis._models[row.columnId] = modelKey;
      }

      // Track tokens per file
      if (!fileAnalysis._usage) fileAnalysis._usage = { promptTokens: 0, responseTokens: 0, estimatedCost: 0 };
      
      const pTokens = row.promptTokens || 0;
      const rTokens = row.responseTokens || 0;
      fileAnalysis._usage.promptTokens += pTokens;
      fileAnalysis._usage.responseTokens += rTokens;

      // Calculate Cost
      const isPro = (row.model || '').includes('pro');
      const inputRate = isPro ? 1.25 : 0.10;
      const outputRate = isPro ? 5.00 : 0.40;
      
      const cost = (pTokens / 1000000 * inputRate) + (rTokens / 1000000 * outputRate);
      fileAnalysis._usage.estimatedCost += cost;
  });

  // 4. Merge into files
  return files.map(f => {
    return {
      id: f.id,
      name: f.name,
      uploadDate: f.uploadDate,
      folderId: f.folderId,
      status: f.status,
      analysis: analysisMap[f.id] || {}
    };
  });
}

function addFile(fileData) {
  const stmt = db.prepare(`
    INSERT INTO files (id, name, storagePath, originalPath, folderId, uploadDate, status)
    VALUES (@id, @name, @storagePath, @originalPath, @folderId, @uploadDate, @status)
  `);
  stmt.run(fileData);
}

function updateFileStatus(id, status, error = null) {
  const stmt = db.prepare('UPDATE files SET status = ?, error = ? WHERE id = ?');
  stmt.run(status, error, id);
}

function updateFileFolder(fileId, folderId) {
    const stmt = db.prepare('UPDATE files SET folderId = ? WHERE id = ?');
    stmt.run(folderId, fileId);
}

function deleteFile(id) {
  const file = db.prepare('SELECT storagePath FROM files WHERE id = ?').get(id);
  const transaction = db.transaction(() => {
      db.prepare('DELETE FROM files WHERE id = ?').run(id);
      db.prepare('DELETE FROM analysis WHERE fileId = ?').run(id); // Manual cascade since we removed FK
  });
  transaction();

  if (file && file.storagePath) {
    try {
      if (fs.existsSync(file.storagePath)) {
        fs.unlinkSync(file.storagePath);
      }
    } catch (err) {
      console.error('Error deleting physical file:', err);
    }
  }
}

// --- DATASET OPERATIONS ---

function getDatasets() {
    return db.prepare('SELECT * FROM datasets ORDER BY uploadDate DESC').all();
}

function addDataset(dataset) {
    // dataset: { id, name, storagePath, uploadDate, rowCount, headers }
    const stmt = db.prepare(`
        INSERT INTO datasets (id, name, storagePath, uploadDate, rowCount, headers)
        VALUES (@id, @name, @storagePath, @uploadDate, @rowCount, @headers)
    `);
    
    // Ensure headers is stringified if array
    const data = { ...dataset };
    if (Array.isArray(data.headers)) data.headers = JSON.stringify(data.headers);
    
    stmt.run(data);
}

function renameDataset(id, name) {
    const stmt = db.prepare('UPDATE datasets SET name = ? WHERE id = ?');
    stmt.run(name, id);
}

function updateDatasetRow(id, data) {
    // data: object (will be stringified)
    const stmt = db.prepare('UPDATE dataset_rows SET data = ? WHERE id = ?');
    stmt.run(JSON.stringify(data), id);
}

function deleteDataset(id) {
    const dataset = db.prepare('SELECT storagePath FROM datasets WHERE id = ?').get(id);
    const transaction = db.transaction(() => {
        // 1. Get all row IDs to delete analysis
        const rows = db.prepare('SELECT id FROM dataset_rows WHERE datasetId = ?').all(id);
        const rowIds = rows.map(r => r.id);
        
        // 2. Delete Analysis for these rows
        if (rowIds.length > 0) {
            const placeholders = rowIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM analysis WHERE fileId IN (${placeholders})`).run(...rowIds);
        }

        // 3. Delete Rows (Cascade handles this usually if enabled, but we do explicitly)
        db.prepare('DELETE FROM dataset_rows WHERE datasetId = ?').run(id);
        
        // 4. Delete Dataset
        db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
    });
    transaction();
    
    // 5. Delete File
    if (dataset && dataset.storagePath) {
        try {
            if (fs.existsSync(dataset.storagePath)) {
                fs.unlinkSync(dataset.storagePath);
            }
        } catch (e) { console.error("Error deleting dataset file", e); }
    }
}

function addDatasetRows(rows) {
    // rows: array of { id, datasetId, rowIndex, data }
    const insert = db.prepare(`
        INSERT INTO dataset_rows (id, datasetId, rowIndex, data)
        VALUES (@id, @datasetId, @rowIndex, @data)
    `);
    
    const transaction = db.transaction((rows) => {
        for (const row of rows) insert.run(row);
    });
    transaction(rows);
}

function getDatasetRows(datasetId, options = {}) {
    const { limit = 50, offset = 0, search = '' } = options;
    
    // 1. Base Query Conditions
    let query = 'SELECT * FROM dataset_rows WHERE datasetId = ?';
    const params = [datasetId];

    // 2. Search Logic (Search in 'data' JSON or 'analysis' content if needed, but keeping it simple to 'data' for now)
    // Searching inside JSON with LIKE is tricky but works for simple text match.
    // Ideally we'd use FTS5 but that requires schema changes. 
    // We'll search in the raw JSON string.
    if (search) {
        query += ' AND data LIKE ?';
        params.push(`%${search}%`);
    }

    // 3. Count Total (for Pagination)
    const countStmt = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total'));
    const total = countStmt.get(...params).total;

    // 4. Fetch Paginated Rows
    query += ' ORDER BY rowIndex ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const rows = db.prepare(query).all(...params);
    
    // Fetch analysis for these rows ONLY
    if (rows.length === 0) return { rows: [], total: 0 };
    
    const rowIds = rows.map(r => r.id);
    const placeholders = rowIds.map(() => '?').join(',');
    const allAnalysis = db.prepare(`SELECT * FROM analysis WHERE fileId IN (${placeholders})`).all(...rowIds);
    
    // Map analysis
    const analysisMap = {};
    allAnalysis.forEach(rec => {
        if (!analysisMap[rec.fileId]) analysisMap[rec.fileId] = {};
        
        if (!analysisMap[rec.fileId]._models) analysisMap[rec.fileId]._models = {};
        if (!analysisMap[rec.fileId]._responses) analysisMap[rec.fileId]._responses = {}; // Ensure _responses structure exists
        
        let content = rec.content;
        try { if (content && (content.startsWith('{') || content.startsWith('['))) content = JSON.parse(content); } catch(e){}
        
        analysisMap[rec.fileId][rec.columnId] = content;
        analysisMap[rec.fileId]._models[rec.columnId] = rec.model;
        
        // Map into _responses for cache consistency
        if (!analysisMap[rec.fileId]._responses[rec.columnId]) {
            analysisMap[rec.fileId]._responses[rec.columnId] = {};
        }
        analysisMap[rec.fileId]._responses[rec.columnId][rec.model] = content;
    });
    
    const formattedRows = rows.map(row => {
        let data = {};
        try { data = JSON.parse(row.data); } catch(e) {}
        
        return {
            id: row.id,
            datasetId: row.datasetId,
            rowIndex: row.rowIndex,
            data: data,
            analysis: analysisMap[row.id] || {}
        };
    });

    return { rows: formattedRows, total };
}

function getDatasetRowsCursor(datasetId, search = '') {
    let query = 'SELECT * FROM dataset_rows WHERE datasetId = ?';
    const params = [datasetId];

    if (search) {
        query += ' AND data LIKE ?';
        params.push(`%${search}%`);
    }
    
    query += ' ORDER BY rowIndex ASC';
    return db.prepare(query).iterate(...params);
}

function getDatasetStats(datasetId) {
    // Sum tokens from analysis table for all rows in this dataset
    // We join dataset_rows to find the row IDs belonging to this dataset
    const stmt = db.prepare(`
        SELECT 
            SUM(a.promptTokens) as totalPrompt, 
            SUM(a.responseTokens) as totalResponse,
            SUM(
                (a.promptTokens / 1000000.0 * CASE WHEN a.model LIKE '%pro%' THEN 1.25 ELSE 0.10 END) +
                (a.responseTokens / 1000000.0 * CASE WHEN a.model LIKE '%pro%' THEN 5.00 ELSE 0.40 END)
            ) as estimatedCost
        FROM analysis a
        INNER JOIN dataset_rows r ON a.fileId = r.id
        WHERE r.datasetId = ?
    `);
    
    const result = stmt.get(datasetId);
    return result || { totalPrompt: 0, totalResponse: 0, estimatedCost: 0 };
}

function getAnalysisForRows(rowIds) {
    if (rowIds.length === 0) return {};
    const placeholders = rowIds.map(() => '?').join(',');
    const allAnalysis = db.prepare(`SELECT * FROM analysis WHERE fileId IN (${placeholders})`).all(...rowIds);
    
    const analysisMap = {};
    allAnalysis.forEach(rec => {
        if (!analysisMap[rec.fileId]) analysisMap[rec.fileId] = {};
        
        let content = rec.content;
        try { if (content && (content.startsWith('{') || content.startsWith('['))) content = JSON.parse(content); } catch(e){}
        
        analysisMap[rec.fileId][rec.columnId] = content;
    });
    return analysisMap;
}

// --- FOLDER OPERATIONS ---

function getFolders() {
  return db.prepare('SELECT * FROM folders').all();
}

function addFolder(folder) {
  const stmt = db.prepare('INSERT INTO folders (id, name) VALUES (@id, @name)');
  stmt.run(folder);
}

function renameFolder(id, name) {
  const stmt = db.prepare('UPDATE folders SET name = ? WHERE id = ?');
  stmt.run(name, id);
}

function deleteFolder(id) {
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  db.prepare('DELETE FROM column_configs WHERE folderId = ?').run(id);
}

function deleteFolderAndFiles(folderId) {
  const files = db.prepare('SELECT storagePath FROM files WHERE folderId = ?').all(folderId);
  
  // 1. Delete physical files
  files.forEach(f => {
    if (f.storagePath) {
      try {
        if (fs.existsSync(f.storagePath)) {
          fs.unlinkSync(f.storagePath);
        }
      } catch (err) {
        console.error('Error deleting physical file during folder nuke:', err);
      }
    }
  });

  // 2. Delete DB records
  // Analysis will cascade delete because of FK, but we should be clean
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM files WHERE folderId = ?').run(folderId);
    db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    db.prepare('DELETE FROM column_configs WHERE folderId = ?').run(folderId);
  });
  
  transaction();
}

// --- ANALYSIS OPERATIONS ---

function saveAnalysis(fileId, results) {
  // results: { summary: "...", _models: { summary: "gemini-pro"}, _responses: { summary: { "gemini-pro": "..." } }, _usage: { promptTokens, responseTokens } }
  
  const insert = db.prepare(`
    INSERT INTO analysis (fileId, columnId, content, model, timestamp, promptTokens, responseTokens)
    VALUES (@fileId, @columnId, @content, @model, @timestamp, @promptTokens, @responseTokens)
    ON CONFLICT(fileId, columnId, model) DO UPDATE SET
      content = excluded.content,
      timestamp = excluded.timestamp,
      promptTokens = analysis.promptTokens + excluded.promptTokens,
      responseTokens = analysis.responseTokens + excluded.responseTokens
  `);

  const timestamp = new Date().toISOString();
  const usage = results._usage || { promptTokens: 0, responseTokens: 0 };
  const models = results._models || {};
  let tokensCharged = false;
  
  const transaction = db.transaction(() => {
    // 1. Save Metadata if present
    if (results.metadata) {
        insert.run({
            fileId,
            columnId: 'metadata',
            content: JSON.stringify(results.metadata),
            model: models['metadata'] || 'system',
            timestamp,
            promptTokens: usage.promptTokens,
            responseTokens: usage.responseTokens
        });
        tokensCharged = true;
    }

    // 2. Save Responses
    if (results._responses) {
        for (const [colId, modelMap] of Object.entries(results._responses)) {
            for (const [modelId, content] of Object.entries(modelMap)) {
                let contentToSave = content;
                if (typeof content === 'object') contentToSave = JSON.stringify(content);
                
                const pTokens = !tokensCharged ? usage.promptTokens : 0;
                const rTokens = !tokensCharged ? usage.responseTokens : 0;
                if (!tokensCharged && (usage.promptTokens > 0)) tokensCharged = true;

                insert.run({
                    fileId,
                    columnId: colId,
                    content: contentToSave,
                    model: modelId,
                    timestamp,
                    promptTokens: pTokens,
                    responseTokens: rTokens
                });
            }
        }
    } else {
        // Fallback
        const models = results._models || {};
        for (const [key, value] of Object.entries(results)) {
             if (key === '_models' || key === '_responses' || key === 'metadata' || key === '_usage') continue;
             
             let contentToSave = value;
             if (typeof value === 'object') contentToSave = JSON.stringify(value);

             const pTokens = !tokensCharged ? usage.promptTokens : 0;
             const rTokens = !tokensCharged ? usage.responseTokens : 0;
             if (!tokensCharged && (usage.promptTokens > 0)) tokensCharged = true;

             insert.run({
                 fileId,
                 columnId: key,
                 content: contentToSave,
                 model: models[key] || 'default',
                 timestamp,
                 promptTokens: pTokens,
                 responseTokens: rTokens
             });
        }
    }
  });

  transaction();
}

// --- SETTINGS & CONFIGS ---

function loadSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch (e) {
      settings[r.key] = r.value;
    }
  });
  return settings;
}

function saveSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, JSON.stringify(value));
}

function getColumnConfigs() {
  const rows = db.prepare('SELECT * FROM column_configs').all();
  const configs = {};
  rows.forEach(r => {
    configs[r.folderId] = JSON.parse(r.config);
  });
  return configs;
}

function saveColumnConfig(folderId, config) {
  const stmt = db.prepare(`
    INSERT INTO column_configs (folderId, config) VALUES (?, ?)
    ON CONFLICT(folderId) DO UPDATE SET config = excluded.config
  `);
  stmt.run(folderId, JSON.stringify(config));
}

function getCustomColumns() {
  return db.prepare('SELECT * FROM custom_columns').all();
}

function saveCustomColumn(col) {
  const stmt = db.prepare(`
    INSERT INTO custom_columns (id, label, prompt) VALUES (@id, @label, @prompt)
    ON CONFLICT(id) DO UPDATE SET label = excluded.label, prompt = excluded.prompt
  `);
  stmt.run(col);
}

function deleteCustomColumn(id) {
    db.prepare('DELETE FROM custom_columns WHERE id = ?').run(id);
}

function clearDatabase() {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM analysis').run();
    db.prepare('DELETE FROM files').run();
    db.prepare('DELETE FROM folders').run();
    db.prepare('DELETE FROM column_configs').run();
    // We optionally keep settings and custom_columns, or nuke them too? 
    // Usually "Clear Data" implies content, not preferences. Keeping settings/custom_columns for now.
  });
  transaction();
  
  // Return the storage path so main process can clean up files
  return true;
}

function getUsageStats() {
    return db.prepare(`
        SELECT 
            model, 
            SUM(promptTokens) as totalPrompt, 
            SUM(responseTokens) as totalResponse 
        FROM analysis 
        GROUP BY model
    `).all();
}

// --- SEARCH ---
function searchFiles(query) {
    const likeQuery = `%${query}%`;
    const stmt = db.prepare(`
        SELECT DISTINCT f.id 
        FROM files f
        LEFT JOIN analysis a ON f.id = a.fileId
        WHERE f.name LIKE ? OR a.content LIKE ?
    `);
    const rows = stmt.all(likeQuery, likeQuery);
    return rows.map(r => r.id);
}

module.exports = {
  initDatabase,
  getAllFiles,
  getFile,
  addFile,
  updateFileStatus,
  updateFileFolder,
  deleteFile,
  getFolders,
  addFolder,
  renameFolder,
  deleteFolder,
  deleteFolderAndFiles,
  saveAnalysis,
  loadSettings,
  saveSetting,
  getColumnConfigs,
  saveColumnConfig,
  getCustomColumns,
  saveCustomColumn,
  deleteCustomColumn,
  clearDatabase,
  getUsageStats,
  searchFiles,
  getDatasets,
  addDataset,
  renameDataset,
  deleteDataset,
  addDatasetRows,
  getDatasetRows,
  updateDatasetRow,
  getDatasetRowsCursor,
  getDatasetStats,
  getAnalysisForRows
};