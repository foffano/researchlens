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
  analysis?: AnalysisResult;
  file?: File; // Browser runtime only (not persistent)
  base64?: string; // Persistent storage of file content
  folderId?: string;
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
      saveData: (data: any) => Promise<{ success: boolean; error?: string }>;
      loadData: () => Promise<any>;
    };
  }
}