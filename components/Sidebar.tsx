import React, { useState } from 'react';
import {
  FileText,  Folder as FolderIcon,
  Plus,
  FolderOpen,
  Settings,
  Trash2
} from 'lucide-react';
import { Folder } from '../types';

interface SidebarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  folders, 
  selectedFolderId, 
  onSelectFolder, 
  onCreateFolder,
  onDeleteFolder,
  onOpenSettings
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-white h-screen flex flex-col hidden md:flex">
      {/* Header */}
      <div className="p-4 flex items-center gap-2 border-b border-gray-100">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold">
          R
        </div>
        <span className="font-semibold text-gray-800">ResearchLens</span>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col justify-between">
        <div className="px-4">
          <nav className="space-y-1">
            <button 
              onClick={() => onSelectFolder(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedFolderId === null 
                  ? 'text-gray-900 bg-gray-100' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} />
              All files
            </button>
          </nav>

          <div className="mt-8">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                <div key={folder.id} className="group flex items-center gap-1 pr-2 rounded-md transition-colors hover:bg-gray-50">
                  <button
                    onClick={() => onSelectFolder(folder.id)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md truncate ${
                      selectedFolderId === folder.id
                        ? 'text-orange-700 bg-orange-50' 
                        : 'text-gray-600'
                    }`}
                  >
                    {selectedFolderId === folder.id ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                    <span className="truncate">{folder.name}</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder.id);
                    }}
                    className="hidden group-hover:flex p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
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
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => { if(!newFolderName) setIsCreating(false); }}
                  placeholder="Folder name..."
                  className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
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
        <div className="px-4 mt-4 border-t border-gray-100 pt-4">
          <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
          >
            <Settings size={18} />
            Settings
          </button>
        </div>
      </div>
      
      {/* Disclaimer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-[10px] text-gray-400 text-center leading-tight">
          AI-generated content can be inaccurate. Please verify important information.
        </p>
      </div>
    </div>
  );
};