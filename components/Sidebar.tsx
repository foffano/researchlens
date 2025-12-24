import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,  Folder as FolderIcon,
  Plus,
  FolderOpen,
  Settings,
  Trash2,
  PanelLeftClose,
  Database,
  Table
} from 'lucide-react';
import { Folder, FileEntry, Dataset } from '../types';

interface SidebarProps {
  files: FileEntry[];
  folders: Folder[];
  datasets: Dataset[];
  selectedFolderId: string | null;
  selectedDatasetId: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectDataset: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteDataset: (id: string) => void;
  onImportDataset: () => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  files,
  folders,
  datasets,
  selectedFolderId,
  selectedDatasetId, 
  onSelectFolder,
  onSelectDataset,
  onCreateFolder,
  onDeleteFolder,
  onDeleteDataset,
  onImportDataset,
  onOpenSettings,
  isOpen,
  onToggle
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [usageStats, setUsageStats] = useState<{ model: string; totalPrompt: number; totalResponse: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch usage stats
  useEffect(() => {
    const fetchUsage = async () => {
        if (window.electron?.getUsageStats) {
            const stats = await window.electron.getUsageStats();
            setUsageStats(stats);
        }
    };
    fetchUsage();
    // Refresh stats when files change (approximation)
    const interval = setInterval(fetchUsage, 5000); 
    return () => clearInterval(interval);
  }, []);

  const globalTokens = usageStats.reduce((acc, s) => acc + s.totalPrompt + s.totalResponse, 0);
  
  // Selection Stats
  const selectionFiles = selectedFolderId 
    ? files.filter(f => f.folderId === selectedFolderId)
    : files;
  
  const selectionTokens = selectionFiles.reduce((acc, f) => acc + (f.analysis?._usage?.promptTokens || 0) + (f.analysis?._usage?.responseTokens || 0), 0);
  const selectionCost = selectionFiles.reduce((acc, f) => acc + (f.analysis?._usage?.estimatedCost || 0), 0);

  // Focus input when creation mode starts
  useEffect(() => {
    if (isCreating && inputRef.current) {
      // Use a small timeout to allow the DOM to settle
      const timer = setTimeout(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCreating]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  return (
    <>
      <div 
        className={`
          border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-screen flex flex-col transition-all duration-300 ease-in-out relative
          ${isOpen ? 'w-64' : 'w-0 border-r-0'}
          hidden md:flex
        `}
      >
        {/* Fixed width container to prevent content squishing during transition */}
        <div className={`w-64 flex flex-col h-full ${!isOpen && 'invisible'}`}>
          
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <img src="logo.png" alt="ResearchLens Logo" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">Research<span className="text-orange-500">Lens</span></span>
            </div>
            <button 
              onClick={onToggle}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Collapse Sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          {/* Main Nav */}
          <div className="flex-1 overflow-y-auto py-4 flex flex-col justify-between">
            <div className="px-4">
              <nav className="space-y-1">
                <button 
                  onClick={() => onSelectFolder(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedFolderId === null && selectedDatasetId === null
                      ? 'text-gray-900 bg-gray-100 dark:bg-gray-800 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <FileText size={18} />
                  All files
                </button>
              </nav>

              {/* DATASETS SECTION */}
              <div className="mt-8">
                <div className="flex items-center justify-between px-3 mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    Datasets
                  </span>
                  <button 
                    onClick={onImportDataset}
                    className="text-gray-400 hover:text-orange-600 transition-colors"
                    title="Import Dataset (CSV, Excel)"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                
                <nav className="space-y-1">
                  {datasets.length === 0 && (
                     <div className="px-3 py-2 text-xs text-gray-400 italic">
                        No datasets
                     </div>
                  )}
                  {datasets.map(ds => (
                    <div key={ds.id} className="group flex items-center gap-1 pr-2 rounded-md transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                      <button
                        onClick={() => onSelectDataset(ds.id)}
                        className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md truncate ${
                          selectedDatasetId === ds.id
                            ? 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <Table size={16} />
                        <span className="truncate">{ds.name}</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDataset(ds.id);
                        }}
                        className="hidden group-hover:flex p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"
                        title="Delete Dataset"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </nav>
              </div>

              {/* FOLDERS SECTION */}
              <div className="mt-8">
                <div className="flex items-center justify-between px-3 mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    Folders
                  </span>
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="text-gray-400 hover:text-orange-600 transition-colors"
                    title="Create Folder"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <nav className="space-y-1">
                  {folders.map(folder => (
                    <div key={folder.id} className="group flex items-center gap-1 pr-2 rounded-md transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                      <button
                        onClick={() => onSelectFolder(folder.id)}
                        className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md truncate ${
                          selectedFolderId === folder.id
                            ? 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {selectedFolderId === folder.id ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                        <span className="truncate">{folder.name}</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Directly pass to parent handler which now has the smart logic
                          onDeleteFolder(folder.id);
                        }}
                        className="hidden group-hover:flex p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"
                        title="Delete Folder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </nav>

                {isCreating && (
                  <form onSubmit={handleCreateSubmit} className="mt-2 px-2">
                    <input
                      ref={inputRef}
                      key="folder-input" 
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setIsCreating(false);
                          setNewFolderName("");
                        }
                      }}
                      placeholder="Folder name... (Esc to cancel)"
                      className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-orange-500/50"
                    />
                  </form>
                )}
                
                {folders.length === 0 && !isCreating && (
                  <div className="px-3 py-2 text-xs text-gray-400 italic">
                    No folders yet
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 space-y-4">
                {/* Cost Monitor */}
                {globalTokens > 0 && (
                    <div className="p-3 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-lg space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Library Total</span>
                                <span className="text-[10px] font-mono font-bold text-orange-700 dark:text-orange-300">
                                    ${(usageStats.reduce((acc, s) => {
                                        const isPro = s.model.includes('pro');
                                        return acc + (s.totalPrompt / 1000000 * (isPro ? 1.25 : 0.10)) + (s.totalResponse / 1000000 * (isPro ? 5.00 : 0.40));
                                    }, 0)).toFixed(4)}
                                </span>
                            </div>
                            <p className="text-[9px] text-orange-500/70 dark:text-orange-400/50">
                                {globalTokens.toLocaleString()} total tokens
                            </p>
                        </div>

                        {selectedFolderId && selectionTokens > 0 && (
                            <div className="pt-2 border-t border-orange-100/50 dark:border-orange-900/20">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate max-w-[80px]">Folder Cost</span>
                                    <span className="text-[10px] font-mono text-gray-600 dark:text-gray-300">
                                        ${selectionCost.toFixed(4)}
                                    </span>
                                </div>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500">
                                    {selectionTokens.toLocaleString()} tokens
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Button */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <button 
                    onClick={onOpenSettings}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 rounded-md transition-colors"
                  >
                    <Settings size={18} />
                    Settings
                  </button>
                </div>
            </div>
          </div>
          
          {/* Disclaimer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">
              AI-generated content can be inaccurate. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
