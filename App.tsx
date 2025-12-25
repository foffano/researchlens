import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { FileRow } from './components/FileRow';
import { DatasetRowItem } from './components/DatasetRow';
import { SettingsModal, AppSettings } from './components/SettingsModal';
import { analyzePdf, analyzeRow, fileToBase64 } from './services/gemini';
import { FileEntry, ColumnConfig, Folder, FilterState, Dataset, DatasetRow } from './types';
import { Upload, Plus, Download, Search, Filter, Info, Menu, ArrowLeft, Database, FileText, Pin } from 'lucide-react';
import { FilterMenu } from './components/FilterMenu';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Include prompts in default config so they are self-contained
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'fileInfo', label: 'Files', visible: true, width: '400px' },
  {
    id: 'problemStatement', 
    label: 'Problem Statement', 
    visible: true, 
    width: '350px',
    prompt: "The core problem statement, research question, or hypothesis."
  },
  {
    id: 'results', 
    label: 'Results', 
    visible: true, 
    width: '350px',
    prompt: "Key results, statistical findings, or main takeaways (as a list)."
  },
  {
    id: 'methods', 
    label: 'Methods', 
    visible: false, 
    width: '350px',
    prompt: "The methodology, study design, or datasets used."
  },
  {
    id: 'summary', 
    label: 'Summary', 
    visible: false, 
    width: '350px',
    prompt: "A brief, high-level summary of the paper."
  },
  {
    id: 'limitations', 
    label: 'Limitations', 
    visible: false, 
    width: '350px',
    prompt: "Any limitations, future work, or weaknesses mentioned."
  },
];

interface SortableHeaderProps {
  id: string;
  label: string;
  prompt?: string;
  isPinned?: boolean;
  onToggleVisibility: (id: string) => void;
  onPin?: (id: string) => void;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ id, label, prompt, isPinned, onToggleVisibility, onPin }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`flex-none w-[350px] p-3 border-r border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider flex items-center justify-between select-none group/header ${isPinned ? 'bg-orange-50/50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
    >
      <div className="flex items-center gap-2 min-w-0 relative">
        <span className="truncate">{label}</span>
        {prompt && (
          <div className="group/tooltip relative shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            <Info size={14} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-[11px] leading-relaxed font-medium rounded-md shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[100] pointer-events-none text-left whitespace-normal border border-gray-700 dark:border-gray-600">
              <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold block mb-1">Instruction</span>
              {prompt}
              {/* Arrow */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
        {onPin && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onPin(id);
                }}
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isPinned ? 'text-orange-600' : 'text-gray-400'}`}
                title={isPinned ? "Unpin column" : "Pin to first column"}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <Pin size={12} className={isPinned ? "fill-current" : ""} />
            </button>
        )}
        <button 
            onClick={(e) => {
                e.stopPropagation(); // Prevent drag start when clicking close
                onToggleVisibility(id);
            }} 
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()} // Important to stop drag initiation
        >
            ×
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- State: Data ---
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [datasetRows, setDatasetRows] = useState<DatasetRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
  const [exportStatus, setExportStatus] = useState<{ status: 'idle' | 'exporting' | 'success' | 'error', filePath?: string, fileName?: string, error?: string }>({ status: 'idle' });
  const [pinnedColumns, setPinnedColumns] = useState<Record<string, string>>({}); // datasetId -> columnId

  // --- State: Settings ---
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Initialize from localStorage (fallback, mainly for web)
    const saved = localStorage.getItem('researchlens_settings');
    const defaults: AppSettings = { 
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || '', 
      modelId: 'gemini-3-flash-preview',
      fontSize: 'medium',
      theme: 'system'
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // --- Theme Effect ---
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const isDark = settings.theme === 'dark' || 
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [settings.theme]);

  // --- State: Filters ---
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    dateRange: { start: null, end: null },
    articleTypes: [],
    publicationYears: []
  });

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('researchlens_settings', JSON.stringify(newSettings));
    window.electron?.saveSettings(newSettings);
  };

  const handleClearData = async () => {
     if (window.electron?.clearAllData) {
         await window.electron.clearAllData();
     }
     setFiles([]);
     setFolders([]);
     setDatasets([]);
     setDatasetRows([]);
     setSelectedFolderId(null);
     setSelectedDatasetId(null);
     setPinnedColumns({});
     setColumnConfigs({ 'root': DEFAULT_COLUMNS });
     // Note: We deliberately do NOT clear the API key settings here
  };

  // Store column config per folder. Key 'root' is for "All Files".
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnConfig[]>>({
    'root': DEFAULT_COLUMNS
  });

  // Store user-defined custom columns for reuse
  const [savedCustomColumns, setSavedCustomColumns] = useState<{id: string, label: string, prompt: string}[]>([]);

  // --- Deletion State ---
  const [itemToDelete, setItemToDelete] = useState<{ type: 'file' | 'column' | 'dataset', id: string } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // --- Persistence Logic ---
  // 1. Load Data on Mount
  useEffect(() => {
    const load = async () => {
      if (window.electron?.getInitialData) {
        try {
          const data = await window.electron.getInitialData();
          if (data) {
            setFiles(data.files || []);
            setFolders(data.folders || []);
            setDatasets(data.datasets || []);
            if (data.columnConfigs && Object.keys(data.columnConfigs).length > 0) {
              setColumnConfigs(data.columnConfigs);
            }
            if (data.customColumns) {
              setSavedCustomColumns(data.customColumns);
            }
            if (data.settings && Object.keys(data.settings).length > 0) {
              setSettings(prev => ({ ...prev, ...data.settings }));
            }
            // Load pinned columns from settings? Or separate store? 
            // For now, in-memory is fine or we could attach to settings. 
            // Let's attach to settings for persistence if we wanted, but not critical for prototype.
            // Actually, let's use localStorage for pinned columns for now
            const savedPinned = localStorage.getItem('researchlens_pinned_cols');
            if (savedPinned) setPinnedColumns(JSON.parse(savedPinned));
          }
        } catch (e) {
          console.error("Failed to load initial data", e);
        }
      }
    };
    load();
  }, []);

  const handleSidebarReorder = (newOrder: string[]) => {
      const newSettings = { ...settings, sidebarOrder: newOrder };
      setSettings(newSettings);
      // Persist immediately
      window.electron?.saveSettings({ sidebarOrder: newOrder });
  };

  const handleRenameFolder = async (id: string, name: string) => {
      // Optimistic UI Update
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
      
      // Backend Sync
      if (window.electron?.renameFolder) {
          try {
              await window.electron.renameFolder(id, name);
          } catch (error) {
              console.error("Failed to rename folder:", error);
              // Optional: Revert state here if needed
          }
      }
  };

  const handleRenameDataset = async (id: string, name: string) => {
      // Optimistic UI Update
      setDatasets(prev => prev.map(d => d.id === id ? { ...d, name } : d));
      
      // Backend Sync
      if (window.electron?.renameDataset) {
           try {
              await window.electron.renameDataset(id, name);
           } catch (error) {
              console.error("Failed to rename dataset:", error);
           }
      }
  };

  // 1.5 Sync Root Columns
  useEffect(() => {
      setColumnConfigs(prev => {
          const idealRootColumns: ColumnConfig[] = [
              ...DEFAULT_COLUMNS.map(col => ({ ...col, visible: true })),
              ...savedCustomColumns.map(customCol => ({
                  id: customCol.id,
                  label: customCol.label,
                  visible: true,
                  width: '350px',
                  prompt: customCol.prompt
              }))
          ];

          const uniqueIdealRootColumns: ColumnConfig[] = [];
          const seenIds = new Set<string>();
          idealRootColumns.forEach(col => {
              if (!seenIds.has(col.id)) {
                  uniqueIdealRootColumns.push(col);
                  seenIds.add(col.id);
              }
          });

          const currentRootConfig = prev['root'] || [];
          const isSameConfig = uniqueIdealRootColumns.length === currentRootConfig.length &&
                               uniqueIdealRootColumns.every((col, index) => 
                                   col.id === currentRootConfig[index]?.id && col.visible === currentRootConfig[index]?.visible
                               );

          if (!isSameConfig) {
              return { ...prev, 'root': uniqueIdealRootColumns };
          }
          return prev;
      });
  }, [savedCustomColumns]);

  // Persist Column Configs when they change
  const activeFolderKey = selectedDatasetId || selectedFolderId || 'root';
  useEffect(() => {
    if (window.electron?.saveColumnConfig) {
      // Save ONLY the active folder config to avoid spamming
      const config = columnConfigs[activeFolderKey];
      if (config) {
        window.electron.saveColumnConfig(activeFolderKey, config);
      }
    }
  }, [columnConfigs, activeFolderKey]);

  // Persist Pinned Columns
  useEffect(() => {
      localStorage.setItem('researchlens_pinned_cols', JSON.stringify(pinnedColumns));
  }, [pinnedColumns]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const datasetInputRef = useRef<HTMLInputElement>(null);

  // Helper to get columns for current view
  const activeColumns = columnConfigs[activeFolderKey] || DEFAULT_COLUMNS;

  // --- DnD Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setColumnConfigs((prev) => {
        const currentConfig = prev[activeFolderKey] || DEFAULT_COLUMNS;
        const oldIndex = currentConfig.findIndex((col) => col.id === active.id);
        const newIndex = currentConfig.findIndex((col) => col.id === over?.id);

        const newConfig = arrayMove(currentConfig, oldIndex, newIndex);
        
        return {
          ...prev,
          [activeFolderKey]: newConfig,
        };
      });
    }
  };
  
  // --- Folder Logic ---
  const handleCreateFolder = async (name: string) => {
    if (window.electron?.addFolder) {
      const newFolder = await window.electron.addFolder(name);
      setFolders(prev => [...prev, newFolder]);
      
      // Initialize columns
      const initialCols = [{ id: 'fileInfo', label: 'Files', visible: true, width: '400px' }];
      setColumnConfigs(prev => ({
          ...prev,
          [newFolder.id]: initialCols
      }));
      if (window.electron?.saveColumnConfig) {
        window.electron.saveColumnConfig(newFolder.id, initialCols);
      }
      
      setSelectedFolderId(newFolder.id);
      setSelectedDatasetId(null);
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    // Check if folder has files
    const hasFiles = files.some(f => f.folderId === folderId);
    
    if (hasFiles) {
        setFolderToDelete(folderId);
    } else {
        // Empty folder, just delete
        if (window.electron?.deleteFolder) {
            window.electron.deleteFolder(folderId);
        }
        setFolders(prev => prev.filter(f => f.id !== folderId));
        setColumnConfigs(prev => {
            const newConfigs = { ...prev };
            delete newConfigs[folderId];
            return newConfigs;
        });
        if (selectedFolderId === folderId) setSelectedFolderId(null);
    }
  };

  const confirmDeleteFolder = async (mode: 'keep-files' | 'delete-all') => {
      if (!folderToDelete) return;

      if (mode === 'delete-all') {
          // 1. Delete Folder AND Files
          if (window.electron?.deleteFolderAndFiles) {
              await window.electron.deleteFolderAndFiles(folderToDelete);
          }
          // UI Updates
          setFiles(prev => prev.filter(f => f.folderId !== folderToDelete));
      } else {
          // 2. Delete Folder ONLY (Keep files -> move to root)
          if (window.electron?.deleteFolder) {
              window.electron.deleteFolder(folderToDelete);
          }
          // UI Updates
          setFiles(prev => prev.map(f => 
            f.folderId === folderToDelete ? { ...f, folderId: undefined } : f
          ));
          // Move logic handles the DB update for files implicitly? 
          // Wait, 'deleteFolder' in DB sets files to NULL via FK ON DELETE SET NULL.
          // So no extra call needed for files if FK works.
          // BUT, we should update local state correctly.
      }

      setFolders(prev => prev.filter(f => f.id !== folderToDelete));
      setColumnConfigs(prev => {
        const newConfigs = { ...prev };
        delete newConfigs[folderToDelete];
        return newConfigs;
      });

      if (selectedFolderId === folderToDelete) {
        setSelectedFolderId(null);
      }
      
      setFolderToDelete(null);
  };

  const handleMoveFile = (fileId: string, folderId: string | undefined) => {
    const newFolderId = folderId || null;
    if (window.electron?.updateFileFolder) {
      window.electron.updateFileFolder(fileId, newFolderId || '');
    }
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, folderId: newFolderId } : f
    ));
  };

  const handleDeleteFile = (fileId: string) => {
    setItemToDelete({ type: 'file', id: fileId });
  };

  // --- DATASET LOGIC ---
  const handleImportDataset = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || !window.electron?.importDatasets) return;

      const fileList = Array.from(files).map(f => {
          const realPath = window.electron?.getFilePath ? window.electron.getFilePath(f) : (f as any).path;
          return { name: f.name, path: realPath };
      });

      const newDatasets = await window.electron.importDatasets(fileList);
      setDatasets(prev => [...newDatasets, ...prev]);
      
      // Auto-select first new dataset
      if (newDatasets.length > 0) {
          handleSelectDataset(newDatasets[0].id);
      }
      
      if (datasetInputRef.current) datasetInputRef.current.value = '';
  };

  const fetchDatasetPage = async (id: string, page: number, search: string) => {
      setIsLoadingRows(true);
      if (window.electron?.getDatasetRows) {
          const { rows, total } = await window.electron.getDatasetRows(id, page, 50, search);
          setDatasetRows(rows);
          setPagination({ page, pageSize: 50, total });
          
          // Header Logic (moved here to ensure it runs on first load)
          if (page === 1) {
             const currentDataset = datasets.find(d => d.id === id);
             let keys: string[] = [];
             if (currentDataset && currentDataset.headers && currentDataset.headers.length > 0) {
                 keys = currentDataset.headers;
             } else if (rows.length > 0) {
                 keys = Object.keys(rows[0].data);
             }
             
             setColumnConfigs(prev => {
                  if (prev[id] && prev[id].length > 1) return prev; 
                  if (keys.length === 0) return prev;
                  
                  const newCols: ColumnConfig[] = [
                      { id: 'fileInfo', label: 'Identity', visible: true, width: '400px' },
                      ...keys.map((key, idx) => ({
                          id: key,
                          label: key.charAt(0).toUpperCase() + key.slice(1),
                          visible: true,
                          width: '350px'
                      }))
                  ];
                  return { ...prev, [id]: newCols };
             });
          }
      }
      setIsLoadingRows(false);
  };

  // --- Server Side Search Effect ---
  // Only trigger when the search query specifically changes, not on dataset switch
  useEffect(() => {
      if (!selectedDatasetId) return;
      
      // Skip if query is empty (initial load handled by handleSelectDataset handles this)
      // Actually, if user clears search, we DO want to fetch.
      // But we want to avoid double-fetching when handleSelectDataset resets the search to ''.
      
      const timeoutId = setTimeout(() => {
          fetchDatasetPage(selectedDatasetId, 1, filters.searchQuery);
      }, 300);

      return () => clearTimeout(timeoutId);
  }, [filters.searchQuery]); // Removed selectedDatasetId dependency to avoid double-fetch on switch

  const handleSelectDataset = async (id: string) => {
      // 1. Stop any pending operations/loading
      setIsLoadingRows(true);
      
      // 2. Set State
      setSelectedDatasetId(id);
      setSelectedFolderId(null);
      setDatasetRows([]); // Clear old rows immediately to prevent "ghost" edits
      
      // 3. Reset Search silently (without triggering the effect if possible, but React state updates trigger effects)
      // Since we removed selectedDatasetId from effect deps, we just need to be careful.
      // If we set search to '', the effect fires.
      // We can batch this or just accept one fetch.
      // Ideally: Manual Fetch Page 1 here.
      
      setFilters(prev => {
          if (prev.searchQuery === '') return prev; // No change, no effect trigger
          return { ...prev, searchQuery: '' };
      });

      // 4. Fetch Data immediately
      await fetchDatasetPage(id, 1, '');
      setIsLoadingRows(false);
  };

  const handleDeleteDataset = (id: string) => {
      setItemToDelete({ type: 'dataset', id: id });
  };
  
  const handlePinColumn = (colId: string) => {
      if (!selectedDatasetId) return;
      setPinnedColumns(prev => ({
          ...prev,
          [selectedDatasetId]: colId
      }));
  };

  const handleAnalyzeDatasetRow = async (rowId: string, colId: string, prompt: string, modelId?: string) => {
      const row = datasetRows.find(r => r.id === rowId);
      if (!row) return;

      if (!settings.apiKey) {
          setShowSettings(true);
          return;
      }
      
      // Check cache
      if (modelId && row.analysis?._responses?.[colId]?.[modelId]) {
          setDatasetRows(prev => prev.map(r => {
             if (r.id !== rowId) return r;
             const newAnalysis = { ...r.analysis! };
             newAnalysis[colId] = newAnalysis._responses![colId][modelId];
             if (!newAnalysis._models) newAnalysis._models = {};
             newAnalysis._models[colId] = modelId;
             return { ...r, analysis: newAnalysis };
          }));
          return;
      }
      
      // Update Status
      setDatasetRows(prev => prev.map(r => {
          if (r.id !== rowId) return r;
          const currentAnalyzing = r.analyzingColumns || [];
          return {
              ...r,
              status: 'analyzing',
              analyzingColumns: [...currentAnalyzing, colId]
          };
      }));

      const modelToUse = modelId || settings.modelId;

      try {
          const result = await analyzeRow(
              row.data, 
              [{ id: colId, prompt }], 
              settings.apiKey, 
              modelToUse
          );

          setDatasetRows(prev => prev.map(r => {
              if (r.id !== rowId) return r;
              
              // Merge Logic (Similar to processFileAnalysis)
              let finalAnalysis = result;
              if (r.analysis) {
                  finalAnalysis = { ...r.analysis };
                  // Merge Usage
                  if (result._usage && finalAnalysis._usage) {
                      finalAnalysis._usage.promptTokens += result._usage.promptTokens;
                      finalAnalysis._usage.responseTokens += result._usage.responseTokens;
                      // Cost calc
                      const isPro = modelToUse.includes('pro');
                      const cost = (result._usage.promptTokens / 1000000 * (isPro ? 1.25 : 0.1)) + (result._usage.responseTokens / 1000000 * (isPro ? 5.0 : 0.4));
                      finalAnalysis._usage.estimatedCost = (finalAnalysis._usage.estimatedCost || 0) + cost;
                  }
                  
                  // Update Field
                  if (result[colId] !== undefined) {
                      finalAnalysis[colId] = result[colId];
                      if (!finalAnalysis._models) finalAnalysis._models = {};
                      finalAnalysis._models[colId] = modelToUse;
                      if (!finalAnalysis._responses) finalAnalysis._responses = {};
                      if (!finalAnalysis._responses[colId]) finalAnalysis._responses[colId] = {};
                      finalAnalysis._responses[colId][modelToUse] = result[colId];
                  }
              }

              const remainingAnalyzing = (r.analyzingColumns || []).filter(c => c !== colId);
              return {
                  ...r,
                  status: remainingAnalyzing.length > 0 ? 'analyzing' : 'completed',
                  analyzingColumns: remainingAnalyzing,
                  analysis: finalAnalysis
              };
          }));

          // Save
          if (window.electron?.saveAnalysis) {
              window.electron.saveAnalysis(rowId, result);
          }

      } catch (error) {
          console.error("Error analyzing row:", error);
           setDatasetRows(prev => prev.map(r => {
              if (r.id !== rowId) return r;
              const remainingAnalyzing = (r.analyzingColumns || []).filter(c => c !== colId);
              return {
                  ...r,
                  status: remainingAnalyzing.length > 0 ? 'analyzing' : 'error',
                  analyzingColumns: remainingAnalyzing
              };
          }));
      }
  };

  const handleUpdateRow = (rowId: string, newData: Record<string, any>) => {
      // 1. Optimistic update (Only if row is visible to avoid state errors)
      const rowExists = datasetRows.some(r => r.id === rowId);
      if (rowExists) {
          setDatasetRows(prev => prev.map(r => r.id === rowId ? { ...r, data: newData } : r));
      }

      // 2. Persist (ALWAYS save to DB, even if row is no longer in view)
      if (window.electron?.updateDatasetRow) {
          window.electron.updateDatasetRow(rowId, newData).catch(err => {
              console.error("Failed to save row update:", err);
          });
      }
  };

  // --- Filter & Search Logic ---
  const filteredFiles = files.filter(f => {
    // 1. Folder Filter
    if (selectedFolderId !== null && f.folderId !== selectedFolderId) return false;

    // 2. Search Query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const meta = f.analysis?.metadata;
      const title = meta?.title?.toLowerCase() || '';
      const authors = meta?.authors?.join(' ').toLowerCase() || '';
      const name = f.name.toLowerCase();
      
      const dynamicContent = activeColumns.map(c => {
         const val = f.analysis?.[c.id];
         return typeof val === 'string' ? val.toLowerCase() : ''; 
      }).join(' ');

      if (!title.includes(q) && !authors.includes(q) && !name.includes(q) && !dynamicContent.includes(q)) {
        return false;
      }
    }

    // 3. Date Range
    if (filters.dateRange.start) {
       const fileDate = new Date(f.uploadDate).setHours(0,0,0,0);
       const startDate = new Date(filters.dateRange.start).setHours(0,0,0,0);
       if (fileDate < startDate) return false;
    }
    if (filters.dateRange.end) {
       const fileDate = new Date(f.uploadDate).setHours(0,0,0,0);
       const endDate = new Date(filters.dateRange.end).setHours(0,0,0,0);
       if (fileDate > endDate) return false;
    }

    // 4. Article Type
    if (filters.articleTypes.length > 0) {
      const type = f.analysis?.metadata?.articleType;
      if (!type || !filters.articleTypes.includes(type)) return false;
    }

    return true;
  });

  const filteredRows = datasetRows; // Server-side filtered

  const getPageTitle = () => {
    if (selectedDatasetId) {
        const ds = datasets.find(d => d.id === selectedDatasetId);
        return ds ? ds.name : "Unknown Dataset";
    }
    if (selectedFolderId === null) return "All Files";
    const folder = folders.find(f => f.id === selectedFolderId);
    return folder ? folder.name : "Unknown Folder";
  };
  
  // Reusable function to trigger analysis
  const processFileAnalysis = async (
    fileEntry: FileEntry, 
    columnsToAnalyze: { id: string, prompt: string }[], 
    merge: boolean = false,
    overrideModelId?: string
  ) => {
      // 1. Get Base64 if missing (On-Demand Loading)
      let input = fileEntry.base64;
      if (!input && fileEntry.file) {
        // Fallback for browser-only mode or just uploaded object
        input = await fileToBase64(fileEntry.file);
      } else if (!input && window.electron?.getFileContent) {
        // Fetch from Backend
        const loaded = await window.electron.getFileContent(fileEntry.id);
        if (loaded) input = loaded;
      }

      if (!input) {
        console.error("Could not load file content for analysis");
        setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: 'error' } : f));
        return;
      }

      if (!settings.apiKey) {
        alert("Please set your Gemini API Key in Settings first.");
        return;
      }

      // UI Update: Analyzing
      setFiles(prev => prev.map(f => {
          if (f.id !== fileEntry.id) return f;
          
          let newAnalysis = f.analysis;
          if (merge && newAnalysis) {
              newAnalysis = { ...newAnalysis };
              columnsToAnalyze.forEach(c => {
                  delete newAnalysis![c.id];
              });
          }
          
          const currentAnalyzing = f.analyzingColumns || [];
          const newAnalyzing = [...currentAnalyzing];
          columnsToAnalyze.forEach(c => {
              if (!newAnalyzing.includes(c.id)) {
                  newAnalyzing.push(c.id);
              }
          });

          return { 
              ...f, 
              status: 'analyzing', 
              analyzingColumns: newAnalyzing,
              analysis: newAnalysis 
          };
      }));
      
      const modelToUse = overrideModelId || settings.modelId;

      try {
          const result = await analyzePdf(
            input, 
            columnsToAnalyze, 
            settings.apiKey, 
            modelToUse
          );
          
          setFiles(prev => prev.map(f => {
              if (f.id !== fileEntry.id) return f;
              
              let finalAnalysis = result;

              if (merge && f.analysis) {
                  finalAnalysis = { ...f.analysis };
                  
                  if (!finalAnalysis._models) finalAnalysis._models = {};
                  if (!finalAnalysis._responses) finalAnalysis._responses = {};

                  // Accumulate Usage Tokens & Cost
                  if (result._usage) {
                      const prevUsage = finalAnalysis._usage || { promptTokens: 0, responseTokens: 0, estimatedCost: 0 };
                      
                      // Calculate new cost
                      const isPro = modelToUse.includes('pro');
                      const inputRate = isPro ? 1.25 : 0.10;
                      const outputRate = isPro ? 5.00 : 0.40;
                      const newCost = (result._usage.promptTokens / 1000000 * inputRate) + (result._usage.responseTokens / 1000000 * outputRate);

                      finalAnalysis._usage = {
                          promptTokens: prevUsage.promptTokens + result._usage.promptTokens,
                          responseTokens: prevUsage.responseTokens + result._usage.responseTokens,
                          estimatedCost: (prevUsage.estimatedCost || 0) + newCost
                      };
                  }

                  columnsToAnalyze.forEach(col => {
                      // Only update if Gemini returned data for this column
                      if (result[col.id] !== undefined) {
                          // 1. Update Main Display
                          finalAnalysis[col.id] = result[col.id];
                          
                          // 2. Update Model Tracker
                          // Use the specific model we requested, or the one returned (which should match)
                          const usedModel = result._models?.[col.id] || modelToUse;
                          finalAnalysis._models![col.id] = usedModel;

                          // 3. Store in _responses Map (Cache)
                          if (!finalAnalysis._responses![col.id]) finalAnalysis._responses![col.id] = {};
                          finalAnalysis._responses![col.id][usedModel] = result[col.id];
                      }
                  });
              } else {
                  // For a fresh analysis, also populate _responses
                  if (!finalAnalysis._responses) finalAnalysis._responses = {};
                  
                  // Calculate initial cost
                  if (result._usage) {
                      const isPro = modelToUse.includes('pro');
                      const inputRate = isPro ? 1.25 : 0.10;
                      const outputRate = isPro ? 5.00 : 0.40;
                      const initialCost = (result._usage.promptTokens / 1000000 * inputRate) + (result._usage.responseTokens / 1000000 * outputRate);
                      
                      finalAnalysis._usage = {
                          ...result._usage,
                          estimatedCost: initialCost
                      };
                  }

                  columnsToAnalyze.forEach(col => {
                      if (result[col.id] !== undefined) {
                           const usedModel = result._models?.[col.id] || modelToUse;
                           if (!finalAnalysis._responses![col.id]) finalAnalysis._responses![col.id] = {};
                           finalAnalysis._responses![col.id][usedModel] = result[col.id];
                      }
                  });
              }

              // Remove processed columns from analyzing list
              const remainingAnalyzing = (f.analyzingColumns || []).filter(
                  colId => !columnsToAnalyze.find(c => c.id === colId)
              );

              return { 
                  ...f, 
                  status: remainingAnalyzing.length > 0 ? 'analyzing' : 'completed', 
                  analyzingColumns: remainingAnalyzing,
                  analysis: finalAnalysis 
              };
          }));

          // Save to DB (Save just the new result, DB handles merging/upserting)
          if (window.electron?.saveAnalysis) {
             await window.electron.saveAnalysis(fileEntry.id, result);
          }

      } catch (error) {
          console.error(`Error analyzing file ${fileEntry.id}:`, error);
          setFiles(prev => prev.map(f => {
              if (f.id !== fileEntry.id) return f;
              const remainingAnalyzing = (f.analyzingColumns || []).filter(
                  colId => !columnsToAnalyze.find(c => c.id === colId)
              );
              return { 
                  ...f, 
                  status: remainingAnalyzing.length > 0 ? 'analyzing' : 'error',
                  analyzingColumns: remainingAnalyzing
              };
          }));
      }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    if (!settings.apiKey) {
      setShowSettings(true);
      alert("Please configure your Gemini API Key in Settings to start analyzing files.");
    }

    // Backend Upload
    if (window.electron?.uploadFiles) {
       // Convert FileList to array of simple objects with path
       const fileList = Array.from(uploadedFiles).map(f => {
          // Use helper to get real path securely
          const realPath = window.electron?.getFilePath ? window.electron.getFilePath(f) : (f as any).path;
          return {
            name: f.name,
            path: realPath,
            folderId: selectedFolderId || undefined
          };
       });
       
       const newFiles = await window.electron.uploadFiles(fileList);
       setFiles(prev => [...newFiles, ...prev]);
       
       // Trigger Analysis if key is present
       if (settings.apiKey) {
           for (const fileEntry of newFiles) {
              processFileAnalysis(fileEntry, [], false);
           }
       }
    } else {
        // Fallback for Web (non-electron) - Keeps Base64 in memory
        const newFilesPromises = (Array.from(uploadedFiles) as File[]).map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              uploadDate: new Date().toISOString(),
              status: 'uploading' as const,
              base64: base64, 
              folderId: selectedFolderId || undefined
            };
        });
        const newFiles = await Promise.all(newFilesPromises);
        setFiles(prev => [...newFiles, ...prev]);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddColumn = (key: string, customPrompt?: string) => {
    let newColConfig: ColumnConfig | undefined;
    
    // 1. Update columns state
    setColumnConfigs(prev => {
        const currentConfig = prev[activeFolderKey] || DEFAULT_COLUMNS;
        const exists = currentConfig.find(c => c.id === key);

        let newConfig;
        if (exists) {
            newConfig = currentConfig.map(c => {
                 if (c.id === key) return { ...c, visible: true };
                 return c;
            });
        } else {
            // Logic for Custom Columns (AI or Manual)
            let finalLabel = key;
            
            // Only do magic formatting if it looks like an internal ID (starts with custom_)
            if (key.startsWith('custom_')) {
                 // Remove custom_ prefix and the timestamp suffix
                 const rawLabel = key.replace('custom_', '').replace(/_[0-9]+$/, '');
                 // Format: replace underscores with spaces and capitalize words
                 finalLabel = rawLabel.replace(/_/g, ' ')
                                      .split(' ')
                                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                      .join(' ');
            } else if (!customPrompt) {
                 // Fallback for other keys: just capitalize first letter
                 finalLabel = key.charAt(0).toUpperCase() + key.slice(1);
            }

            const defaultMatch = DEFAULT_COLUMNS.find(d => d.id === key);
            // If default match exists, prefer its label, otherwise use ours
            finalLabel = defaultMatch ? defaultMatch.label : finalLabel;

            newColConfig = {
                id: key,
                label: finalLabel,
                visible: true,
                width: '350px',
                prompt: customPrompt || defaultMatch?.prompt
            };
            newConfig = [...currentConfig, newColConfig];
        }
        return { ...prev, [activeFolderKey]: newConfig };
    });

    // 1b. Save to "My Columns" ONLY if it's a custom column
    if (!DEFAULT_COLUMNS.find(c => c.id === key)) {
       // Correct Label for storage
       let finalLabel = key;
       if (key.startsWith('custom_')) {
            const rawLabel = key.replace('custom_', '').replace(/_[0-9]+$/, '');
            finalLabel = rawLabel.replace(/_/g, ' ')
                                 .split(' ')
                                 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                 .join(' ');
       }

       const newCustomCol = { 
          id: key, 
          label: finalLabel, 
          prompt: customPrompt || ''
       };
       setSavedCustomColumns(prev => {
          if (prev.find(c => c.id === key)) return prev;
          return [...prev, newCustomCol];
       });
       if (window.electron?.saveCustomColumn) {
          window.electron.saveCustomColumn(newCustomCol);
       }
    }
  };

  const handleDeleteCustomColumn = (colId: string) => {
      setItemToDelete({ type: 'column', id: colId });
  };

  const handleAnalyzeColumn = (fileId: string, colId: string, prompt: string, modelId?: string) => {
      const file = files.find(f => f.id === fileId);
      if (!file) return;
      
      if (!settings.apiKey) {
          setShowSettings(true);
          return;
      }

      // 1. Check if we already have a response for this model in cache
      if (modelId && file.analysis?._responses?.[colId]?.[modelId]) {
          // SWITCH VIEW ONLY (No API Call)
          setFiles(prev => prev.map(f => {
              if (f.id !== fileId) return f;
              
              const newAnalysis = { ...f.analysis! };
              
              // Swap content
              newAnalysis[colId] = newAnalysis._responses![colId][modelId];
              
              // Swap badge
              if (!newAnalysis._models) newAnalysis._models = {};
              newAnalysis._models[colId] = modelId;
              
              return { ...f, analysis: newAnalysis };
          }));
          return;
      }

      // 2. If not found, trigger API analysis
      processFileAnalysis(file, [{ id: colId, prompt }], true, modelId);
  };

  const handleRetryAnalysis = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
        // Retry initial metadata analysis
        processFileAnalysis(file, [], false);
    }
  };

  // handleRestoreHistory removed as per requirements

  const toggleColumnVisibility = (id: string) => {
      setColumnConfigs(prev => {
        const currentConfig = prev[activeFolderKey] || DEFAULT_COLUMNS;
        const newConfig = currentConfig.map(c => c.id === id ? {...c, visible: !c.visible} : c);
        return { ...prev, [activeFolderKey]: newConfig };
    });
  }

  const handleExportCSV = async () => {
    if (selectedDatasetId) {
        // Export Dataset (Server-Side Streaming)
        const dynamicCols = activeColumns.filter(c => c.id !== 'fileInfo' && c.visible);
        const exportColumns = dynamicCols.map(c => ({ id: c.id, label: c.label }));
        
        if (window.electron?.exportDatasetCSV) {
            setExportStatus({ status: 'exporting' });
            const result = await window.electron.exportDatasetCSV(selectedDatasetId, filters.searchQuery, exportColumns);
            if (result.success) {
                setExportStatus({ 
                    status: 'success', 
                    filePath: result.filePath, 
                    fileName: result.fileName 
                });
            } else if (result.error) {
                setExportStatus({ status: 'error', error: result.error });
            } else {
                setExportStatus({ status: 'idle' });
            }
        }
        return;
    }

    // Export PDFs
    if (filteredFiles.length === 0) {
      alert("No files to export in current view.");
      return;
    }

    setExportStatus({ status: 'exporting' });

    // Yield to UI thread so spinner appears
    setTimeout(async () => {
        try {
            const headers = [
              'File Name', 'Title', 'Authors', 'Publication Year', 'DOI/URL', 'Article Type', 'Upload Date'
            ];
            const dynamicCols = activeColumns.filter(c => c.id !== 'fileInfo' && c.visible);
            dynamicCols.forEach(col => headers.push(col.label));

            const rows = filteredFiles.map(file => {
                const meta = file.analysis?.metadata || {};
                const authorsStr = Array.isArray(meta.authors) ? meta.authors.join('; ') : (meta.authors || '');

                const rowData = [
                    `"${file.name.replace(/"/g, '""')}"`,
                    `"${(meta.title || '').replace(/"/g, '""')}"`,
                    `"${authorsStr.replace(/"/g, '""')}"`,
                    `"${(meta.publicationYear || '').replace(/"/g, '""')}"`,
                    `"${(meta.doi || '').replace(/"/g, '""')}"`,
                    `"${(meta.articleType || '').replace(/"/g, '""')}"`,
                    `"${new Date(file.uploadDate).toLocaleDateString()}"`
                ];

                dynamicCols.forEach(col => {
                    let val: any = file.analysis?.[col.id];
                    if (Array.isArray(val)) val = val.join('; ');
                    else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                    if (val === undefined || val === null) val = '';
                    else val = String(val);
                    val = `"${val.replace(/"/g, '""')}"`;
                    rowData.push(val);
                });
                return rowData.join(',');
            });

            const csvContent = [headers.join(','), ...rows].join('\n');
            const prefix = `research_lens_export_${selectedFolderId || 'all'}`;

            if (window.electron?.saveCSV) {
                const result = await window.electron.saveCSV(csvContent, prefix);
                if (result.success) {
                    setExportStatus({ 
                        status: 'success', 
                        filePath: result.filePath, 
                        fileName: result.fileName 
                    });
                } else {
                    setExportStatus({ status: 'error', error: result.error });
                }
            } else {
                 // Fallback for web
                 downloadCSV(csvContent, prefix);
                 setExportStatus({ status: 'idle' });
            }
        } catch (e: any) {
            setExportStatus({ status: 'error', error: e.message });
        }
    }, 100);
  };

  const downloadCSV = (content: string, prefix: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${prefix}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'file') {
      if (window.electron?.deleteFile) window.electron.deleteFile(itemToDelete.id);
      setFiles(prev => prev.filter(f => f.id !== itemToDelete.id));
    } else if (itemToDelete.type === 'column') {
      if (window.electron?.deleteCustomColumn) window.electron.deleteCustomColumn(itemToDelete.id);
      setSavedCustomColumns(prev => prev.filter(c => c.id !== itemToDelete.id));
    } else if (itemToDelete.type === 'dataset') {
        if (window.electron?.deleteDataset) window.electron.deleteDataset(itemToDelete.id);
        setDatasets(prev => prev.filter(d => d.id !== itemToDelete.id));
        if (selectedDatasetId === itemToDelete.id) {
            setSelectedDatasetId(null);
        }
    }
    setItemToDelete(null);
  };

  // ... (JSX is same structure, just verifying handlers are passed correctly)
  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 overflow-hidden">
      <Sidebar 
        files={files}
        folders={folders}
        datasets={datasets}
        selectedFolderId={selectedFolderId}
        selectedDatasetId={selectedDatasetId}
        sidebarOrder={settings.sidebarOrder}
        onSelectFolder={(id) => { setSelectedFolderId(id); setSelectedDatasetId(null); }}
        onSelectDataset={handleSelectDataset}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteDataset={handleDeleteDataset}
        onImportDataset={() => datasetInputRef.current?.click()}
        onOpenSettings={() => setShowSettings(true)}
        onReorder={handleSidebarReorder}
        onRenameFolder={handleRenameFolder}
        onRenameDataset={handleRenameDataset}
        isOpen={isLeftSidebarOpen}
        onToggle={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
      />

      <input 
         type="file" 
         ref={datasetInputRef} 
         className="hidden" 
         accept=".csv,.xlsx,.xls" 
         multiple 
         onChange={handleImportDataset} 
      />

      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialSettings={settings}
        onSave={handleSaveSettings}
        onClearData={handleClearData}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        
        {/* Top Header */}
        <div className="h-16 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 bg-white dark:bg-gray-900 shrink-0 relative z-20">
            <div className="flex items-center gap-3">
                {!isLeftSidebarOpen && (
                  <button 
                    onClick={() => setIsLeftSidebarOpen(true)} 
                    className="p-2 -ml-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  >
                    <Menu size={20} />
                  </button>
                )}
                
                {selectedDatasetId ? (
                   <button 
                     onClick={() => { setSelectedDatasetId(null); setSelectedFolderId(null); }}
                     className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mr-1"
                     title="Back to Library"
                   >
                       <ArrowLeft size={18} />
                   </button>
                ) : null}

                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{getPageTitle()}</h1>
                {selectedFolderId && (
                    <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                        Folder
                    </span>
                )}
                {selectedDatasetId && (
                    <span className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                        <Database size={12} /> Dataset
                    </span>
                )}
            </div>
            
            <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder={selectedDatasetId ? "Search rows..." : "Search files..."}
                    value={filters.searchQuery}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="pl-9 pr-4 py-2 w-64 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all dark:placeholder-gray-500"
                  />
                </div>

                {!selectedDatasetId && (
                  <div className="relative">
                    <button 
                      onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                      className={`p-2 rounded-lg border transition-colors relative ${
                        isFilterMenuOpen || filters.articleTypes.length > 0 || filters.dateRange.start 
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Filter size={20} />
                      {(filters.articleTypes.length > 0 || filters.dateRange.start || filters.dateRange.end) && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-orange-600 rounded-full border border-white dark:border-gray-800"></span>
                      )}
                    </button>

                    <FilterMenu 
                      isOpen={isFilterMenuOpen}
                      onClose={() => setIsFilterMenuOpen(false)}
                      filters={filters}
                      onFilterChange={setFilters}
                    />
                  </div>
                )}

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                    title="Export current view to CSV"
                >
                    <Download size={16} />
                    Export CSV
                </button>
                
                {!selectedDatasetId && (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                    >
                        <Upload size={16} />
                        Upload PDFs
                    </button>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf" 
                    multiple 
                    onChange={handleFileUpload} 
                />
            </div>
        </div>

        {/* Table/Grid Area */}
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 relative">
             <div className="min-w-max">
                {/* Table Header */}
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-30">
                      <div className="flex-none w-[400px] p-3 pl-6 border-r border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-gray-900/50">
                          {selectedDatasetId ? `Rows (${filteredRows.length})` : `Files (${filteredFiles.length})`}
                      </div>
                      
                      <SortableContext 
                        items={activeColumns.filter(c => c.id !== 'fileInfo' && c.visible).map(c => c.id)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {activeColumns.filter(c => c.id !== 'fileInfo' && c.visible).map(col => (
                            <SortableHeader 
                              key={col.id} 
                              id={col.id} 
                              label={col.label}
                              prompt={col.prompt}
                              isPinned={selectedDatasetId ? (pinnedColumns[selectedDatasetId] === col.id) : false}
                              onToggleVisibility={toggleColumnVisibility}
                              onPin={selectedDatasetId ? handlePinColumn : undefined}
                            />
                        ))}
                      </SortableContext>

                      {/* Add Column Placeholder in Header */}
                      <div className="flex-none w-[100px] p-3 flex items-center justify-center">
                          <button 
                            onClick={() => setIsRightSidebarOpen(true)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                          >
                            <Plus size={16}/>
                          </button>
                      </div>
                  </div>
                </DndContext>

                {/* Table Body */}
                <div className="bg-white dark:bg-gray-900">
                    {selectedDatasetId ? (
                         isLoadingRows ? (
                             <div className="p-10 text-center text-gray-500">Loading rows...</div>
                         ) : (
                             filteredRows.map(row => (
                                 <DatasetRowItem 
                                     key={row.id}
                                     row={row}
                                     columns={activeColumns}
                                     onAnalyzeColumn={handleAnalyzeDatasetRow}
                                     onUpdateRow={handleUpdateRow}
                                     fontSize={settings.fontSize || 'medium'}
                                     pinnedColumnId={pinnedColumns[selectedDatasetId]}
                                 />
                             ))
                         )
                    ) : (
                        filteredFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                                <Upload size={48} className="mb-4 text-gray-200 dark:text-gray-700" />
                                <p className="text-lg font-medium text-gray-500 dark:text-gray-400">No files in {selectedFolderId ? 'this folder' : 'library'}</p>
                                <p className="text-sm mb-6 text-gray-400 dark:text-gray-500">Upload a research PDF to start analyzing.</p>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium"
                                >
                                    Browse files
                                </button>
                            </div>
                        ) : (
                            filteredFiles.map(file => (
                                <FileRow 
                                    key={file.id} 
                                    file={file} 
                                    columns={activeColumns} 
                                    folders={folders}
                                    onMoveFile={handleMoveFile}
                                    onDelete={handleDeleteFile}
                                    onAnalyzeColumn={handleAnalyzeColumn}
                                    onRetry={handleRetryAnalysis}
                                    fontSize={settings.fontSize || 'medium'}
                                />
                            ))
                        )
                    )}
                </div>
             </div>
        </div>
        
        {selectedDatasetId && (
            <div className="h-12 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between px-6 shrink-0 z-20 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} rows
                </span>
                <div className="flex items-center gap-2">
                    <button 
                        disabled={pagination.page === 1}
                        onClick={() => fetchDatasetPage(selectedDatasetId, pagination.page - 1, filters.searchQuery)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                        Previous
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Page {pagination.page}
                    </span>
                    <button 
                        disabled={pagination.page * pagination.pageSize >= pagination.total}
                        onClick={() => fetchDatasetPage(selectedDatasetId, pagination.page + 1, filters.searchQuery)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                        Next
                    </button>
                </div>
            </div>
        )}
      </div>

      <RightSidebar 
        onAddColumn={handleAddColumn} 
        activeColumns={activeColumns} 
        savedCustomColumns={savedCustomColumns}
        onDeleteCustomColumn={handleDeleteCustomColumn}
        isOpen={isRightSidebarOpen}
        onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        isDatasetView={!!selectedDatasetId}
      />

      {/* Folder Delete Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-96 p-5 animate-in fade-in zoom-in duration-100">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Delete Folder
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              This folder contains files. How would you like to proceed?
            </p>
            
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => confirmDeleteFolder('keep-files')}
                    className="w-full px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors flex items-center justify-center"
                >
                    Delete Folder Only (Keep Files)
                </button>
                <button
                    onClick={() => confirmDeleteFolder('delete-all')}
                    className="w-full px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors flex items-center justify-center"
                >
                    Delete Folder & All Files
                </button>
                <button
                    onClick={() => setFolderToDelete(null)}
                    className="w-full mt-2 px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                    Cancel
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Items) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80 p-4 animate-in fade-in zoom-in duration-100">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {itemToDelete.type === 'file' ? 'Delete File?' : (itemToDelete.type === 'dataset' ? 'Delete Dataset?' : 'Remove Column?')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {itemToDelete.type === 'file' 
                ? "Are you sure you want to delete this file?" 
                : (itemToDelete.type === 'dataset' 
                    ? "Are you sure? This will delete the dataset and all generated analysis." 
                    : "Remove this column from your saved list?")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                {itemToDelete.type === 'column' ? 'Remove' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportStatus.status !== 'idle' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-96 p-6 animate-in fade-in zoom-in duration-100 text-center">
            {exportStatus.status === 'exporting' && (
               <>
                 <div className="mx-auto w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                 <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Exporting Dataset...</h3>
                 <p className="text-xs text-gray-500 dark:text-gray-400">Please wait while we process the entire database.</p>
               </>
            )}

            {exportStatus.status === 'success' && (
               <>
                 <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                    <Download size={24} />
                 </div>
                 <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Export Complete!</h3>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 px-2">
                    File saved to Downloads:<br/>
                    <span className="font-mono mt-2 block bg-gray-50 dark:bg-gray-900/50 p-2 rounded border border-gray-100 dark:border-gray-700 break-all">
                        {exportStatus.fileName}
                    </span>
                 </p>
                 <div className="flex flex-col gap-2">
                    <button
                        onClick={() => {
                            if (exportStatus.filePath && window.electron?.openExplorer) {
                                window.electron.openExplorer(exportStatus.filePath);
                            }
                        }}
                        className="w-full px-4 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                    >
                        Show in Folder
                    </button>
                    <button
                        onClick={() => setExportStatus({ status: 'idle' })}
                        className="w-full px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                        Close
                    </button>
                 </div>
               </>
            )}

            {exportStatus.status === 'error' && (
               <>
                 <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                    ×
                 </div>
                 <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Export Failed</h3>
                 <p className="text-xs text-red-500 mb-6">{exportStatus.error}</p>
                 <button
                    onClick={() => setExportStatus({ status: 'idle' })}
                    className="w-full px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                 >
                    Dismiss
                 </button>
               </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;