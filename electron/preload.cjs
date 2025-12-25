const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Helpers
  getFilePath: (file) => {
    try {
        return webUtils.getPathForFile(file);
    } catch (e) {
        // Fallback for older electron versions or if webUtils fails, though usually path property works
        return file.path; 
    }
  },

  // Database / State Sync
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  
  // File Ops
  uploadFiles: (files) => ipcRenderer.invoke('upload-files', files), // files: { name, path }[]
  deleteFile: (id) => ipcRenderer.invoke('delete-file', id),
  updateFileFolder: (fileId, folderId) => ipcRenderer.invoke('update-file-folder', { fileId, folderId }),
  getFileContent: (id) => ipcRenderer.invoke('get-file-content', id), // Returns Base64
  
  // Dataset Ops
  importDatasets: (files) => ipcRenderer.invoke('import-dataset', files),
  getDatasetRows: (datasetId, page, pageSize, search) => ipcRenderer.invoke('get-dataset-rows', { datasetId, page, pageSize, search }),
  getDatasetStats: (datasetId) => ipcRenderer.invoke('get-dataset-stats', datasetId),
  exportDatasetCSV: (datasetId, search, columns) => ipcRenderer.invoke('export-dataset-csv', { datasetId, search, columns }),
  saveCSV: (content, prefix) => ipcRenderer.invoke('save-csv', { content, prefix }),
  updateDatasetRow: (id, data) => ipcRenderer.invoke('update-dataset-row', { id, data }),
  deleteDataset: (id) => ipcRenderer.invoke('delete-dataset', id),
  
  // Folder Ops
  addFolder: (name) => ipcRenderer.invoke('add-folder', name),
  deleteFolder: (id) => ipcRenderer.invoke('delete-folder', id),
  deleteFolderAndFiles: (id) => ipcRenderer.invoke('delete-folder-and-files', id),
  
  // Analysis & Columns
  saveAnalysis: (fileId, results) => ipcRenderer.invoke('save-analysis', { fileId, results }),
  saveColumnConfig: (folderId, config) => ipcRenderer.invoke('save-column-config', { folderId, config }),
  saveCustomColumn: (col) => ipcRenderer.invoke('save-custom-column', col),
  deleteCustomColumn: (id) => ipcRenderer.invoke('delete-custom-column', id),
  
  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Search
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  getUsageStats: () => ipcRenderer.invoke('get-usage-stats'),
  openExplorer: (filePath) => ipcRenderer.invoke('open-explorer', filePath),
  
  // Maintenance
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
});
