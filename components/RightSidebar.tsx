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
  isDatasetView?: boolean;
}

// Only show columns that are actually implemented in the Gemini service/Types
const SUGGESTIONS: SuggestedColumn[] = [
  { id: 'summary', label: 'Summary', key: 'summary' },
  { id: 'methods', label: 'Methodology', key: 'methods' },
  { id: 'limitations', label: 'Limitations', key: 'limitations' },
  { id: 'results', label: 'Key Results', key: 'results' },
  { id: 'problemStatement', label: 'Problem Statement', key: 'problemStatement' },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({ onAddColumn, activeColumns, savedCustomColumns = [], onDeleteCustomColumn, isOpen, onToggle, isDatasetView = false }) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isManual, setIsManual] = useState(false);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    // Prompt required only if not manual
    if (!customName.trim() || (!isManual && !customPrompt.trim())) return;

    // Create a key based on name, simplified
    // For manual columns, we might want a different prefix or just 'custom_' is fine as App.tsx handles it based on prompt existence
    const key = 'custom_' + customName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    
    // Pass undefined prompt if manual
    onAddColumn(key, isManual ? undefined : customPrompt);
    
    // Reset
    setCustomName('');
    setCustomPrompt('');
    setIsManual(false);
    setIsCustomMode(false);
  };

  const insertColumnRef = (label: string) => {
      setCustomPrompt(prev => prev + ` {{${label}}} `);
  };

  return (
    <div className={`
      relative border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-screen flex flex-col transition-all duration-300 ease-in-out z-30
      ${isOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-0 border-l-0'} 
    `}>
       {/* Toggle Button visible even when closed */}
       <button
          onClick={onToggle}
          className={`
            absolute top-20 -left-8
            w-8 h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-md 
            flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400
            shadow-sm z-50
            transition-transform duration-300
          `}
          title={isOpen ? "Close sidebar" : "Open sidebar"}
       >
          {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
       </button>

      {/* Content Container - Fixed width to prevent squashing during transition */}
      <div className={`flex flex-col h-full w-80 overflow-hidden ${!isOpen && 'opacity-0 invisible transition-opacity duration-200'}`}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
             <span className="font-semibold text-gray-700 dark:text-gray-200">Analysis Columns</span>
             <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={18} />
             </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {/* Standard Suggestions - Hidden in Dataset View */}
            {!isDatasetView && (
                <>
                    <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Suggested</h3>
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
                                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-gray-800' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-400 border border-transparent hover:border-orange-100 dark:hover:border-orange-800'
                            }`}
                        >
                            <Plus size={14} />
                            {col.label}
                        </button>
                        );
                    })}
                    </div>
                </>
            )}

            {/* Saved Custom Columns */}
            {savedCustomColumns.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">My Columns</h3>
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
                              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-gray-800' 
                              : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-800 dark:hover:text-purple-300 border border-transparent hover:border-purple-100 dark:hover:border-purple-800'
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
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-all"
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
        <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Custom Column</h3>
           </div>

           {!isCustomMode ? (
              <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => { setIsCustomMode(true); setIsManual(false); }}
                    className="w-full py-2.5 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Sparkles size={16} />
                    AI Analysis Column
                  </button>
                  <button 
                    onClick={() => { setIsCustomMode(true); setIsManual(true); }}
                    className="w-full py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus size={16} />
                    Manual Data Column
                  </button>
              </div>
           ) : (
             <form onSubmit={handleAddCustom} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {isManual ? 'New Data Column' : 'New AI Column'}
                    </span>
                    <button type="button" onClick={() => setIsCustomMode(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column Name</label>
                  <input 
                    type="text" 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={isManual ? "e.g. Notes" : "e.g. Sentiment"}
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                    autoFocus
                  />
                </div>
                
                {!isManual && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instruction (Prompt)</label>
                      <textarea 
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Extract the funding agencies mentioned..."
                        className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 min-h-[80px] dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                      
                      {/* Column Reference Badges */}
                      {isDatasetView && activeColumns.length > 0 && (
                          <div className="mt-2">
                              <p className="text-[10px] text-gray-400 mb-1">Click to reference column:</p>
                              <div className="flex flex-wrap gap-1">
                                  {activeColumns.filter(c => c.visible && c.id !== 'fileInfo').map(col => (
                                      <button
                                          key={col.id}
                                          type="button"
                                          onClick={() => insertColumnRef(col.label)}
                                          className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                      >
                                          {col.label}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setIsCustomMode(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={!customName || (!isManual && !customPrompt)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium text-white rounded disabled:opacity-50 ${isManual ? 'bg-gray-600 hover:bg-gray-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                  >
                    Create
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