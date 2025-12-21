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

  // --- MIGRATION: Check Analysis Table Schema ---
  // We need Primary Key to be (fileId, columnId, model) to support multiple responses.
  // Old schema was (fileId, columnId).
  
  const tableInfo = db.pragma('table_info(analysis)');
  // Check if 'analysis' table exists
  if (tableInfo.length > 0) {
      // Check number of PK columns. If < 3, we need to migrate.
      const pkCount = tableInfo.filter(col => col.pk > 0).length;
      
      if (pkCount < 3) {
          console.log("Migrating 'analysis' table to support multiple models...");
          db.transaction(() => {
              // 1. Rename old table
              db.exec("ALTER TABLE analysis RENAME TO analysis_old");
              
              // 2. Create new table
              db.exec(`
                CREATE TABLE analysis (
                  fileId TEXT,
                  columnId TEXT,
                  content TEXT,
                  model TEXT,
                  timestamp TEXT,
                  promptTokens INTEGER DEFAULT 0,
                  responseTokens INTEGER DEFAULT 0,
                  PRIMARY KEY (fileId, columnId, model),
                  FOREIGN KEY(fileId) REFERENCES files(id) ON DELETE CASCADE
                )
              `);
              
              // 3. Copy data
              db.exec(`
                INSERT OR REPLACE INTO analysis (fileId, columnId, content, model, timestamp)
                SELECT fileId, columnId, content, model, timestamp FROM analysis_old
              `);
              
              // 4. Drop old table
              db.exec("DROP TABLE analysis_old");
          })();
          console.log("Migration complete.");
      } else {
          // Check for missing columns (token columns) in existing table and add them if missing
          const cols = db.pragma('table_info(analysis)').map(c => c.name);
          if (!cols.includes('promptTokens')) {
              console.log("Adding token columns to analysis table...");
              db.exec("ALTER TABLE analysis ADD COLUMN promptTokens INTEGER DEFAULT 0");
              db.exec("ALTER TABLE analysis ADD COLUMN responseTokens INTEGER DEFAULT 0");
          }
      }
  } else {
      // Create fresh if doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS analysis (
          fileId TEXT,
          columnId TEXT,
          content TEXT,
          model TEXT,
          timestamp TEXT,
          promptTokens INTEGER DEFAULT 0,
          responseTokens INTEGER DEFAULT 0,
          PRIMARY KEY (fileId, columnId, model),
          FOREIGN KEY(fileId) REFERENCES files(id) ON DELETE CASCADE
        )
      `);
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
  
  // 2. Get ALL analysis rows
  const allAnalysis = db.prepare('SELECT * FROM analysis ORDER BY timestamp ASC').all();

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
  const deleteStmt = db.prepare('DELETE FROM files WHERE id = ?');
  deleteStmt.run(id);

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

// --- FOLDER OPERATIONS ---

function getFolders() {
  return db.prepare('SELECT * FROM folders').all();
}

function addFolder(folder) {
  const stmt = db.prepare('INSERT INTO folders (id, name) VALUES (@id, @name)');
  stmt.run(folder);
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
  searchFiles
};