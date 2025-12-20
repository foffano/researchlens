import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,  Folder as FolderIcon,
  Plus,
  FolderOpen,
  Settings,
  Trash2,
  PanelLeftClose
} from 'lucide-react';
import { Folder } from '../types';

interface SidebarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  folders, 
  selectedFolderId, 
  onSelectFolder, 
  onCreateFolder,
  onDeleteFolder,
  onOpenSettings,
  isOpen,
  onToggle
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const confirmDelete = () => {
    if (folderToDelete) {
      onDeleteFolder(folderToDelete);
      setFolderToDelete(null);
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
                    selectedFolderId === null 
                      ? 'text-gray-900 bg-gray-100 dark:bg-gray-800 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <FileText size={18} />
                  All files
                </button>
              </nav>

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
                          setFolderToDelete(folder.id);
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

            {/* Settings Button (Bottom) */}
            <div className="px-4 mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
              <button 
                onClick={onOpenSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 rounded-md transition-colors"
              >
                <Settings size={18} />
                Settings
              </button>
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

      {/* Delete Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80 p-4 animate-in fade-in zoom-in duration-100">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Delete Folder?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Files inside will be moved to 'All Files'. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};