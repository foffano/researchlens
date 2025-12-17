import React, { useState } from 'react';
import { ArrowRight, Plus, Sparkles, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ColumnConfig, SuggestedColumn } from '../types';

interface RightSidebarProps {
  onAddColumn: (key: string, prompt?: string) => void;
  activeColumns: ColumnConfig[];
  savedCustomColumns?: { id: string, label: string, prompt: string }[];
  onDeleteCustomColumn?: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Only show columns that are actually implemented in the Gemini service/Types
const SUGGESTIONS: SuggestedColumn[] = [
  { id: 'summary', label: 'Summary', key: 'summary' },
  { id: 'methods', label: 'Methodology', key: 'methods' },
  { id: 'limitations', label: 'Limitations', key: 'limitations' },
  { id: 'results', label: 'Key Results', key: 'results' },
  { id: 'problemStatement', label: 'Problem Statement', key: 'problemStatement' },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({ onAddColumn, activeColumns, savedCustomColumns = [], onDeleteCustomColumn, isOpen, onToggle }) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPrompt.trim()) return;

    // Create a key based on name, simplified
    const key = 'custom_' + customName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    
    onAddColumn(key, customPrompt);
    
    // Reset
    setCustomName('');
    setCustomPrompt('');
    setIsCustomMode(false);
  };

  return (
    <div className={`
      relative border-l border-gray-200 bg-white h-screen flex flex-col transition-all duration-300 ease-in-out z-30
      ${isOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-0 border-l-0'} 
    `}>
       {/* Toggle Button visible even when closed */}
       <button
          onClick={onToggle}
          className={`
            absolute top-20 -left-8
            w-8 h-10 bg-white border border-gray-200 border-r-0 rounded-l-md 
            flex items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-500
            shadow-sm z-50
            transition-transform duration-300
          `}
          title={isOpen ? "Close sidebar" : "Open sidebar"}
       >
          {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
       </button>

      {/* Content Container - Fixed width to prevent squashing during transition */}
      <div className={`flex flex-col h-full w-80 overflow-hidden ${!isOpen && 'opacity-0 invisible transition-opacity duration-200'}`}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
             <span className="font-semibold text-gray-700">Analysis Columns</span>
             <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <X size={18} />
             </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {/* Standard Suggestions */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Suggested</h3>
            <div className="space-y-2 mb-8">
              {SUGGESTIONS.map((col) => {
                const isActive = activeColumns.find(c => c.id === col.key && c.visible);
                return (
                  <button
                    key={col.id}
                    onClick={() => onAddColumn(col.key)}
                    disabled={!!isActive}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-colors ${
                      isActive 
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50' 
                        : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700 border border-transparent hover:border-orange-100'
                    }`}
                  >
                    <Plus size={14} />
                    {col.label}
                  </button>
                );
              })}
            </div>

            {/* Saved Custom Columns */}
            {savedCustomColumns.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">My Columns</h3>
                <div className="space-y-2">
                  {savedCustomColumns.map((col) => {
                    const isActive = activeColumns.find(c => c.id === col.id && c.visible);
                    return (
                      <div key={col.id} className="group flex items-center gap-1">
                        <button
                          onClick={() => onAddColumn(col.id, col.prompt)}
                          disabled={!!isActive}
                          className={`grow flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-colors ${
                            isActive 
                              ? 'text-gray-400 cursor-not-allowed bg-gray-50' 
                              : 'text-purple-700 hover:bg-purple-50 hover:text-purple-800 border border-transparent hover:border-purple-100'
                          }`}
                        >
                          <Plus size={14} />
                      {col.label}
                    </button>
                    {onDeleteCustomColumn && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCustomColumn(col.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete saved column"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Column Builder */}
        <div className="border-t border-gray-100 pt-6">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custom Column</h3>
           </div>

           {!isCustomMode ? (
              <button 
                onClick={() => setIsCustomMode(true)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Create New Column
              </button>
           ) : (
             <form onSubmit={handleAddCustom} className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Column Name</label>
                  <input 
                    type="text" 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Funding Source"
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instruction (Prompt)</label>
                  <textarea 
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Extract the funding agencies mentioned..."
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 min-h-[80px]"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setIsCustomMode(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={!customName || !customPrompt}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50"
                  >
                    Add Column
                  </button>
                </div>
             </form>
           )}
        </div>
      </div>
      </div>
    </div>
  );
};