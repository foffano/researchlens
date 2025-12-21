export interface PdfMetadata {
  title: string;
  authors: string[];
  publicationYear?: string;
  journal?: string;
  doi?: string;
  articleType?: string;
}

export interface AnalysisResult {
  metadata: PdfMetadata;
  _models?: Record<string, string>; // Maps field key to CURRENT model ID
  _responses?: Record<string, Record<string, any>>; // Maps field key -> model ID -> content
  _usage?: {
      promptTokens: number;
      responseTokens: number;
      estimatedCost?: number;
  };
  [key: string]: any; 
}

export const AVAILABLE_MODELS_CONFIG = [
  { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Preview)' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export interface Folder {
  id: string;
  name: string;
}

export interface FileEntry {
  id: string;
  name: string;
  uploadDate: string;
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  analyzingColumns?: string[]; // List of column IDs currently being analyzed
  analysis?: AnalysisResult;
  file?: File; // Browser runtime only (not persistent)
  base64?: string; // Loaded On-Demand
  folderId?: string | null;
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: string;
  prompt?: string;
}

export type SuggestedColumn = {
  id: string;
  label: string;
  key: string;
  prompt?: string;
};

export interface FilterState {
  searchQuery: string;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  articleTypes: string[];
  publicationYears: string[];
}

// Extend global window interface for Electron
declare global {
  interface Window {
    electron?: {
      // Data Sync
      getInitialData: () => Promise<{
        files: FileEntry[];
        folders: Folder[];
        settings: any;
        columnConfigs: Record<string, ColumnConfig[]>;
        customColumns: any[];
      }>;
      
      // File Ops
      getFilePath: (file: File) => string;
      uploadFiles: (files: { name: string; path: string; folderId?: string }[]) => Promise<FileEntry[]>;
      deleteFile: (id: string) => Promise<void>;
      updateFileFolder: (fileId: string, folderId: string) => Promise<void>;
      getFileContent: (id: string) => Promise<string | null>;
      
      // Folder Ops
      addFolder: (name: string) => Promise<Folder>;
      deleteFolder: (id: string) => Promise<void>;
      deleteFolderAndFiles: (id: string) => Promise<void>;
      
      // Analysis & Data
      saveAnalysis: (fileId: string, results: any) => Promise<void>;
      saveColumnConfig: (folderId: string, config: ColumnConfig[]) => Promise<void>;
      saveCustomColumn: (col: any) => Promise<void>;
      deleteCustomColumn: (id: string) => Promise<void>;
      saveSettings: (settings: any) => Promise<void>;
      
      // Search
      searchFiles: (query: string) => Promise<string[]>; // Returns IDs
      getUsageStats: () => Promise<{ model: string; totalPrompt: number; totalResponse: number }[]>;
      
      // Maintenance
      clearAllData: () => Promise<void>;
      
      // Legacy (to be removed safely or kept for compatibility if needed)
      saveData?: (data: any) => Promise<any>;
      loadData?: () => Promise<any>;
    };
  }
}
