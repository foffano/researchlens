import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { FileRow } from './components/FileRow';
import { SettingsModal, AppSettings } from './components/SettingsModal';
import { analyzePdf, fileToBase64 } from './services/gemini';
import { FileEntry, ColumnConfig, Folder } from './types';
import { Upload, Plus, Download, Search, Filter, Info, Menu } from 'lucide-react';
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
  onToggleVisibility: (id: string) => void;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ id, label, prompt, onToggleVisibility }) => {
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
      className="flex-none w-[350px] p-3 border-r border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between bg-gray-50 dark:bg-gray-800 select-none group/header"
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
      
      <button 
        onClick={(e) => {
            e.stopPropagation(); // Prevent drag start when clicking close
            onToggleVisibility(id);
        }} 
        className="text-gray-400 hover:text-red-500 cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()} // Important to stop drag initiation
      >
        ×
      </button>
    </div>
  );
};

const App: React.FC = () => {
  // --- State: Data ---
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // --- State: Settings ---
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Initialize from localStorage
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
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system changes if theme is system
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
  };

  const handleClearData = () => {
     setFiles([]);
     setFolders([]);
     setSelectedFolderId(null);
     setColumnConfigs({ 'root': DEFAULT_COLUMNS });
     // Note: We deliberately do NOT clear the API key settings here
  };

  // Store column config per folder. Key 'root' is for "All Files".
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnConfig[]>>({
    'root': DEFAULT_COLUMNS
  });

  // Store user-defined custom columns for reuse
  const [savedCustomColumns, setSavedCustomColumns] = useState<{id: string, label: string, prompt: string}[]>([]);

  // --- Persistence Logic ---
  // 1. Load Data on Mount
  useEffect(() => {
    const load = async () => {
      if (window.electron?.loadData) {
        const data = await window.electron.loadData();
        if (data) {
          setFiles(data.files || []);
          setFolders(data.folders || []);
          if (data.columnConfigs) {
            setColumnConfigs(data.columnConfigs);
          }
          if (data.customColumns) {
            setSavedCustomColumns(data.customColumns);
          }
        }
      }
    };
    load();
  }, []);

  // 1.5 Sync Root Columns (Ensure "All Files" sees all available columns)
  useEffect(() => {
      setColumnConfigs(prev => {
          // Construct the ideal 'root' configuration:
          // Start with all DEFAULT_COLUMNS, ensuring they are visible.
          // Then append all savedCustomColumns, also ensuring they are visible.
          const idealRootColumns: ColumnConfig[] = [
              ...DEFAULT_COLUMNS.map(col => ({ ...col, visible: true })),
              ...savedCustomColumns.map(customCol => ({
                  id: customCol.id,
                  label: customCol.label,
                  visible: true,
                  width: '350px', // Default width for custom columns
                  prompt: customCol.prompt
              }))
          ];

          // Filter out any potential duplicates by ID, prioritizing the order as defined (defaults then custom)
          const uniqueIdealRootColumns: ColumnConfig[] = [];
          const seenIds = new Set<string>();
          idealRootColumns.forEach(col => {
              if (!seenIds.has(col.id)) {
                  uniqueIdealRootColumns.push(col);
                  seenIds.add(col.id);
              }
          });

          // Get the current 'root' config to compare
          const currentRootConfig = prev['root'] || [];

          // Compare the ideal configuration with the current one
          // Check if lengths are the same and if all items match in ID and visibility status
          const isSameConfig = uniqueIdealRootColumns.length === currentRootConfig.length &&
                               uniqueIdealRootColumns.every((col, index) => 
                                   col.id === currentRootConfig[index]?.id && col.visible === currentRootConfig[index]?.visible
                               );

          // Only update if the configuration is genuinely different to avoid unnecessary re-renders
          if (!isSameConfig) {
              return {
                  ...prev,
                  'root': uniqueIdealRootColumns
              };
          }
          return prev;
      });
  }, [savedCustomColumns]); // This effect depends on savedCustomColumns to react to new custom columns

  // 2. Save Data on Change (Debounced could be better, but simple effect for now)
  // We skip saving if files is empty to avoid overwriting with initial empty state before load completes
  // BUT we need to handle the case where user genuinely deletes everything.
  // A simple way is to use a "loaded" flag, but for now we'll assume if window.electron exists, we save.
  useEffect(() => {
    if (window.electron?.saveData) {
      const dataToSave = {
        files,
        folders,
        columnConfigs,
        customColumns: savedCustomColumns
      };
      // Timeout to debounce slightly
      const timer = setTimeout(() => {
        window.electron!.saveData(dataToSave);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [files, folders, columnConfigs, savedCustomColumns]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get columns for current view
  const activeFolderKey = selectedFolderId || 'root';
  const activeColumns = columnConfigs[activeFolderKey] || DEFAULT_COLUMNS;

  // --- DnD Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags on clicks)
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
  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = {
      id: Math.random().toString(36).substring(2, 9),
      name: name
    };
    setFolders(prev => [...prev, newFolder]);
    
    // Initialize columns for new folder with ONLY the 'Files' column
    setColumnConfigs(prev => ({
        ...prev,
        [newFolder.id]: [{ id: 'fileInfo', label: 'Files', visible: true, width: '400px' }]
    }));
    
    setSelectedFolderId(newFolder.id); // Auto-select new folder
  };

  const handleDeleteFolder = (folderId: string) => {
    if (confirm("Are you sure you want to delete this folder? Files inside will be moved to 'All Files'.")) {
      // 1. Move files out of folder
      setFiles(prev => prev.map(f => 
        f.folderId === folderId ? { ...f, folderId: undefined } : f
      ));

      // 2. Remove folder
      setFolders(prev => prev.filter(f => f.id !== folderId));

      // 3. Cleanup configs
      setColumnConfigs(prev => {
        const newConfigs = { ...prev };
        delete newConfigs[folderId];
        return newConfigs;
      });

      // 4. Reset selection if needed
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
    }
  };

  const handleMoveFile = (fileId: string, folderId: string | undefined) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, folderId } : f
    ));
  };

  const handleDeleteFile = (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  const filteredFiles = files.filter(f => {
    // 1. Folder Filter
    if (selectedFolderId !== null && f.folderId !== selectedFolderId) return false;

    // 2. Search Query (Global Text Match)
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const meta = f.analysis?.metadata;
      const title = meta?.title?.toLowerCase() || '';
      const authors = meta?.authors?.join(' ').toLowerCase() || '';
      const name = f.name.toLowerCase();
      
      // Also check content in dynamic columns
      const dynamicContent = activeColumns.map(c => {
         const val = f.analysis?.[c.id];
         return typeof val === 'string' ? val.toLowerCase() : ''; 
      }).join(' ');

      if (!title.includes(q) && !authors.includes(q) && !name.includes(q) && !dynamicContent.includes(q)) {
        return false;
      }
    }

    // 3. Date Range Filter (Upload Date)
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

    // 4. Article Type Filter
    if (filters.articleTypes.length > 0) {
      const type = f.analysis?.metadata?.articleType;
      if (!type || !filters.articleTypes.includes(type)) return false;
    }

    return true;
  });

  const getPageTitle = () => {
    if (selectedFolderId === null) return "All Files";
    const folder = folders.find(f => f.id === selectedFolderId);
    return folder ? folder.name : "Unknown Folder";
  };
  // --------------------

  // Reusable function to trigger analysis for a single file
  // columnsToAnalyze: List of {id, prompt} objects to send to Gemini
  // merge: If true, we keep existing analysis and only update the specified columns.
  const processFileAnalysis = async (
    fileEntry: FileEntry, 
    columnsToAnalyze: { id: string, prompt: string }[], 
    merge: boolean = false,
    overrideModelId?: string
  ) => {
      // We need either a File object or Base64 string
      const input = fileEntry.base64 || fileEntry.file;
      if (!input) return;

      if (!settings.apiKey) {
        alert("Please set your Gemini API Key in Settings first.");
        setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: 'error' } : f));
        return;
      }

      // Update status to analyzing AND clear content for target columns to trigger animation
      setFiles(prev => prev.map(f => {
          if (f.id !== fileEntry.id) return f;

          // If merging (re-analyzing), we clear the specific columns so the UI shows the skeleton/loading state
          let newAnalysis = f.analysis;
          if (merge && newAnalysis) {
              newAnalysis = { ...newAnalysis };
              columnsToAnalyze.forEach(c => {
                  delete newAnalysis![c.id];
              });
          }
          
          // Track which columns are being analyzed
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
                  // Preserve existing analysis and merge ONLY the requested columns
                  finalAnalysis = { ...f.analysis };
                  
                  // Initialize _models and _responses if they don't exist
                  if (!finalAnalysis._models) finalAnalysis._models = {};
                  if (!finalAnalysis._responses) finalAnalysis._responses = {};

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
      } catch (error) {
          console.error(`Error analyzing file ${fileEntry.id}:`, error);
          setFiles(prev => prev.map(f => {
              if (f.id !== fileEntry.id) return f;
              // Remove processed columns on error too
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

    // Convert all files to FileEntry with Base64
    // We do this concurrently
    const newFilesPromises = (Array.from(uploadedFiles) as File[]).map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          uploadDate: new Date().toISOString(),
          status: 'uploading' as const,
          // We don't store the raw 'file' object anymore for persistence, just base64
          base64: base64, 
          folderId: selectedFolderId || undefined
        };
    });

    const newFiles = await Promise.all(newFilesPromises);

    setFiles(prev => [...newFiles, ...prev]);

    // Only trigger Metadata Analysis (empty columns list)
    // Users must click "Analyze" manually for specific columns
    if (settings.apiKey) {
      for (const fileEntry of newFiles) {
          processFileAnalysis(fileEntry, [], false);
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddColumn = (key: string, customPrompt?: string) => {
    let newColConfig: ColumnConfig | undefined;
    let colPrompt = customPrompt;

    // 1. Update columns state for the CURRENT view (folder or root)
    setColumnConfigs(prev => {
        const currentConfig = prev[activeFolderKey] || DEFAULT_COLUMNS;
        
        // Check if column already exists (e.g. toggling visibility of a suggested one)
        const exists = currentConfig.find(c => c.id === key);

        let newConfig;
        if (exists) {
            // Just toggle visibility
            newColConfig = { ...exists, visible: true }; // for immediate use below
            colPrompt = exists.prompt; // grab existing prompt

            newConfig = currentConfig.map(c => {
                 if (c.id === key) return { ...c, visible: true };
                 return c;
            });
        } else {
            // Create new column (Custom or Suggested that wasn't in config yet)
            // For suggested columns from sidebar that aren't in DEFAULT (if any), we need prompt lookup
            // But currently DEFAULT_COLUMNS covers all suggested ones. 
            // So this branch is primarily for BRAND NEW CUSTOM columns.
            
            // Format label: Replace underscores with spaces and capitalize
            const rawLabel = customPrompt ? key.replace('custom_', '').replace(/_[0-9]+$/, '') : key;
            const formattedLabel = rawLabel.replace(/_/g, ' ')
                                        .split(' ')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');

            // Try to find label from default if it's a known key but somehow missing
            const defaultMatch = DEFAULT_COLUMNS.find(d => d.id === key);
            const finalLabel = defaultMatch ? defaultMatch.label : formattedLabel;

            newColConfig = {
                id: key,
                label: finalLabel,
                visible: true,
                width: '350px',
                prompt: customPrompt || defaultMatch?.prompt
            };
            
            colPrompt = newColConfig.prompt;
            newConfig = [...currentConfig, newColConfig];
        }

        return { ...prev, [activeFolderKey]: newConfig };
    });

    // 1b. Save to "My Columns" if it's a new custom column
    if (customPrompt && !DEFAULT_COLUMNS.find(c => c.id === key)) {
       setSavedCustomColumns(prev => {
          if (prev.find(c => c.id === key)) return prev;
          // Format label same as above
          const rawLabel = key.replace('custom_', '').replace(/_[0-9]+$/, ''); 
          const formattedLabel = rawLabel.replace(/_/g, ' ')
                                        .split(' ')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
          
          return [...prev, { 
             id: key, 
             label: formattedLabel, 
             prompt: customPrompt 
          }];
       });
    }

    // 2. Identify existing completed files that are in the CURRENT view
    // REMOVED: Automatic analysis trigger. Users must now click "Analyze" manually.
  };

  const handleDeleteCustomColumn = (colId: string) => {
      // Optional: Confirm before delete
      if (window.confirm("Are you sure you want to remove this column from your saved list?")) {
        setSavedCustomColumns(prev => prev.filter(c => c.id !== colId));
      }
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

  // handleRestoreHistory removed as per requirements

  const toggleColumnVisibility = (id: string) => {
      // Toggling off doesn't require re-analysis, just hiding.
      setColumnConfigs(prev => {
        const currentConfig = prev[activeFolderKey] || DEFAULT_COLUMNS;
        const newConfig = currentConfig.map(c => c.id === id ? {...c, visible: !c.visible} : c);
        return { ...prev, [activeFolderKey]: newConfig };
    });
  }

  const handleExportCSV = () => {
    if (filteredFiles.length === 0) {
      alert("No files to export in current view.");
      return;
    }

    // 1. Headers: Include standard metadata columns before dynamic ones
    const headers = [
      'File Name', 
      'Title', 
      'Authors', 
      'Publication Year', 
      'DOI/URL', 
      'Article Type',
      'Upload Date'
    ];
    
    const dynamicCols = activeColumns.filter(c => c.id !== 'fileInfo' && c.visible);
    dynamicCols.forEach(col => headers.push(col.label));

    // 2. Rows
    const rows = filteredFiles.map(file => {
        // Safe access helper
        const meta = file.analysis?.metadata || {};
        
        // Format authors array to string
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
            
            if (Array.isArray(val)) {
                val = val.join('; ');
            } else if (typeof val === 'object' && val !== null) {
                 val = JSON.stringify(val);
            }
            
            if (val === undefined || val === null) {
                val = '';
            } else {
                val = String(val);
            }
            
            // Escape quotes and wrap in quotes for CSV
            val = `"${val.replace(/"/g, '""')}"`;
            rowData.push(val);
        });
        
        return rowData.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // 3. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `research_lens_export_${selectedFolderId || 'all'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 overflow-hidden">
      <Sidebar 
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onOpenSettings={() => setShowSettings(true)}
        isOpen={isLeftSidebarOpen}
        onToggle={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
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
                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{getPageTitle()}</h1>
                {selectedFolderId && (
                    <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                        Folder
                    </span>
                )}
            </div>
            
            <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search files..." 
                    value={filters.searchQuery}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="pl-9 pr-4 py-2 w-64 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all dark:placeholder-gray-500"
                  />
                </div>

                {/* Filter Button */}
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
                    {/* Active Filter Indicator Dot */}
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

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                    title="Export current view to CSV"
                >
                    <Download size={16} />
                    Export CSV
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                    <Upload size={16} />
                    Upload PDFs
                </button>
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
                          Files ({filteredFiles.length})
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
                              onToggleVisibility={toggleColumnVisibility}
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
                    {filteredFiles.length === 0 ? (
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
                                fontSize={settings.fontSize || 'medium'}
                            />
                        ))
                    )}
                </div>
             </div>
        </div>
      </div>

      <RightSidebar 
        onAddColumn={handleAddColumn} 
        activeColumns={activeColumns} 
        savedCustomColumns={savedCustomColumns}
        onDeleteCustomColumn={handleDeleteCustomColumn}
        isOpen={isRightSidebarOpen}
        onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
      />
    </div>
  );
};

export default App;