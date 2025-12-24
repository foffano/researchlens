import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,  Folder as FolderIcon,
  Plus,
  FolderOpen,
  Settings,
  Trash2,
  PanelLeftClose,
  Table,
  Edit2,
  GripVertical
} from 'lucide-react';
import { Folder, FileEntry, Dataset } from '../types';
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SidebarProps {
  files: FileEntry[];
  folders: Folder[];
  datasets: Dataset[];
  selectedFolderId: string | null;
  selectedDatasetId: string | null;
  sidebarOrder?: string[];
  onSelectFolder: (id: string | null) => void;
  onSelectDataset: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteDataset: (id: string) => void;
  onImportDataset: () => void;
  onOpenSettings: () => void;
  onReorder: (newOrder: string[]) => void;
  onRenameFolder: (id: string, name: string) => void;
  onRenameDataset: (id: string, name: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

type SidebarItem = 
  | { type: 'folder'; data: Folder; id: string }
  | { type: 'dataset'; data: Dataset; id: string };

const SortableSidebarItem = ({ 
    item, 
    isSelected, 
    onSelect, 
    onDelete, 
    onRename 
}: { 
    item: SidebarItem, 
    isSelected: boolean, 
    onSelect: () => void, 
    onDelete: (e: React.MouseEvent) => void,
    onRename: (newName: string) => void
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.data.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 'auto',
        position: 'relative' as const
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editName.trim() && editName !== item.data.name) {
            onRename(editName.trim());
        } else {
            setEditName(item.data.name); // Revert
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            handleSave();
        } else if (e.key === 'Escape') {
            e.stopPropagation();
            setEditName(item.data.name);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div 
                ref={setNodeRef} 
                style={style} 
                className="px-3 py-1 mb-1"
                {...attributes} 
            >
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-500 rounded-md p-1 shadow-sm">
                    {item.type === 'folder' ? <FolderIcon size={14} className="text-gray-400" /> : <Table size={14} className="text-gray-400" />}
                    <input
                        ref={inputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="flex-1 text-sm bg-transparent border-none outline-none min-w-0 text-gray-800 dark:text-gray-200"
                    />
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes} 
            className="group flex items-center gap-1 pr-2 mb-1 rounded-md transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
             {/* Drag Handle */}
            <div 
                {...listeners} 
                className="p-1.5 cursor-grab text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <GripVertical size={12} />
            </div>

            <button
                onClick={onSelect}
                className={`flex-1 flex items-center gap-2 py-2 pr-2 text-sm font-medium rounded-md truncate ${
                    isSelected
                    ? 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title={item.data.name}
            >
                {item.type === 'folder' 
                    ? (isSelected ? <FolderOpen size={16} className="shrink-0" /> : <FolderIcon size={16} className="shrink-0" />)
                    : <Table size={16} className="shrink-0" />
                }
                <span className="truncate">{item.data.name}</span>
            </button>
            
            <div className="hidden group-hover:flex items-center gap-0.5">
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-all"
                    title="Rename"
                >
                    <Edit2 size={12} />
                </button>
                <button
                    onClick={onDelete}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"
                    title="Delete"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  files,
  folders,
  datasets,
  selectedFolderId,
  selectedDatasetId, 
  sidebarOrder = [],
  onSelectFolder,
  onSelectDataset,
  onCreateFolder,
  onDeleteFolder,
  onDeleteDataset,
  onImportDataset,
  onOpenSettings,
  onReorder,
  onRenameFolder,
  onRenameDataset,
  isOpen,
  onToggle
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [usageStats, setUsageStats] = useState<{ model: string; totalPrompt: number; totalResponse: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch usage stats
  useEffect(() => {
    const fetchUsage = async () => {
        if (window.electron?.getUsageStats) {
            const stats = await window.electron.getUsageStats();
            setUsageStats(stats);
        }
    };
    fetchUsage();
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

  // Combine and Sort Items
  // 1. Map all to common structure
  const allItems: SidebarItem[] = [
      ...folders.map(f => ({ type: 'folder' as const, data: f, id: f.id })),
      ...datasets.map(d => ({ type: 'dataset' as const, data: d, id: d.id }))
  ];

  // 2. Sort based on sidebarOrder
  const sortedItems = [...allItems].sort((a, b) => {
      const idxA = sidebarOrder.indexOf(a.id);
      const idxB = sidebarOrder.indexOf(b.id);
      
      // If both are in order list, sort by index
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      
      // If only A is in list, A comes first (or last? usually new items at bottom)
      // Let's put new items (not in list) at the TOP or BOTTOM? 
      // Typically bottom is safer for "new".
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      // If neither in list, sort by name or creation?
      // Fallback to name for stability
      return a.data.name.localeCompare(b.data.name);
  });

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.id !== over?.id) {
          const oldIndex = sortedItems.findIndex(i => i.id === active.id);
          const newIndex = sortedItems.findIndex(i => i.id === over?.id);
          
          const newSorted = arrayMove(sortedItems, oldIndex, newIndex);
          // Extract new order of IDs
          onReorder(newSorted.map(i => i.id));
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
              <nav className="space-y-1 mb-6">
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

              {/* UNIFIED LIBRARY SECTION */}
              <div>
                <div className="flex items-center justify-between px-3 mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    Library
                  </span>
                  <div className="flex items-center gap-1">
                      <button 
                        onClick={onImportDataset}
                        className="text-gray-400 hover:text-orange-600 transition-colors p-1"
                        title="Import Dataset"
                      >
                        <Table size={14} />
                      </button>
                      <button 
                        onClick={() => setIsCreating(true)}
                        className="text-gray-400 hover:text-orange-600 transition-colors p-1"
                        title="Create Folder"
                      >
                        <Plus size={14} />
                      </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {isCreating && (
                    <form onSubmit={handleCreateSubmit} className="mb-2 px-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsCreating(false);
                            setNewFolderName("");
                          }
                        }}
                        placeholder="Folder name..."
                        className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-orange-500/50"
                      />
                    </form>
                  )}

                  <DndContext 
                      sensors={sensors} 
                      collisionDetection={closestCenter} 
                      onDragEnd={handleDragEnd}
                  >
                      <SortableContext 
                          items={sortedItems.map(i => i.id)} 
                          strategy={verticalListSortingStrategy}
                      >
                          {sortedItems.map(item => (
                              <SortableSidebarItem
                                  key={item.id}
                                  item={item}
                                  isSelected={item.type === 'folder' ? selectedFolderId === item.id : selectedDatasetId === item.id}
                                  onSelect={() => item.type === 'folder' ? onSelectFolder(item.id) : onSelectDataset(item.id)}
                                  onDelete={(e) => {
                                      e.stopPropagation();
                                      item.type === 'folder' ? onDeleteFolder(item.id) : onDeleteDataset(item.id);
                                  }}
                                  onRename={(newName) => {
                                      item.type === 'folder' ? onRenameFolder(item.id, newName) : onRenameDataset(item.id, newName);
                                  }}
                              />
                          ))}
                      </SortableContext>
                  </DndContext>

                  {sortedItems.length === 0 && !isCreating && (
                    <div className="px-3 py-4 text-xs text-gray-400 italic text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                      No items
                    </div>
                  )}
                </div>
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