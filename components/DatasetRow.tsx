import React, { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown, Check, CloudLightning } from 'lucide-react';
import { DatasetRow, ColumnConfig, AVAILABLE_MODELS_CONFIG } from '../types';

interface DatasetRowProps {
  row: DatasetRow;
  columns: ColumnConfig[];
  onAnalyzeColumn: (rowId: string, colId: string, prompt: string, modelId?: string) => void;
  onUpdateRow?: (rowId: string, newData: Record<string, any>) => void;
  fontSize: 'small' | 'medium' | 'large';
  pinnedColumnId?: string; // ID of the column to show in the sticky left area
}

const formatModelName = (modelId?: string) => {
    if (!modelId) return 'Unknown';
    return modelId.replace('gemini-', '').replace('pro', 'Pro').replace('flash', 'Flash').replace('preview', '(Pre)');
};

export const DatasetRowItem: React.FC<DatasetRowProps> = ({ row, columns, onAnalyzeColumn, onUpdateRow, fontSize = 'medium', pinnedColumnId }) => {
  // Font Size Mapping
  const textSizeClass = {
      'small': 'text-xs',
      'medium': 'text-sm',
      'large': 'text-base'
  }[fontSize];

  // Menu State
  const [activeMenuCol, setActiveMenuCol] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setActiveMenuCol(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine Main Display Content (Left Column)
  // Default to first data key if pinnedColumnId not found
  const firstKey = Object.keys(row.data)[0];
  const primaryKey = pinnedColumnId && row.data[pinnedColumnId] !== undefined ? pinnedColumnId : firstKey;
  const primaryValue = row.data[primaryKey];

  const handleCellUpdate = (colId: string, newValue: string) => {
      if (row.data[colId] === newValue) return; // No change
      
      const newData = { ...row.data, [colId]: newValue };
      if (onUpdateRow) {
          onUpdateRow(row.id, newData);
      }
  };

  return (
    <div className="group border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex">
        {/* Identity Column (Sticky Left) */}
        <div className={`flex-none w-[400px] p-4 border-r border-gray-100 dark:border-gray-700 flex flex-col gap-2 relative group/info sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-black/50 ${
             row.status === 'analyzing'
                ? 'bg-orange-50 dark:bg-gray-800 ring-1 ring-inset ring-orange-200 dark:ring-orange-800'
                : 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800'
        }`}>
             <div className="flex items-start gap-3">
                 <div className="mt-1 flex-shrink-0">
                    <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-mono text-xs font-bold">
                        {row.rowIndex + 1}
                    </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <h4 className={`${textSizeClass} font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words`}>
                        {primaryValue ? String(primaryValue) : <span className="text-gray-400 italic">Empty</span>}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                        Row #{row.rowIndex + 1} • {Object.keys(row.data).length} columns
                    </p>
                    {/* Usage Stats Badge */}
                    {row.analysis?._usage && (row.analysis._usage.promptTokens > 0) && (
                         <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1 bg-gray-50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 w-fit" title="Tokens used for this row">
                             <CloudLightning size={10} className="text-orange-400" />
                             <span>
                                 {(row.analysis._usage.promptTokens + row.analysis._usage.responseTokens).toLocaleString()} tokens
                             </span>
                         </div>
                    )}
                 </div>
             </div>
        </div>

        {/* Dynamic Columns */}
        {columns.filter(c => c.visible && c.id !== 'fileInfo').map((col) => {
            // Priority: Analysis Result > Original Data > Empty
            const analysisVal = row.analysis ? (row.analysis as any)[col.id] : undefined;
            const originalVal = row.data[col.id];
            
            // Check if this is an AI column (has prompt)
            const isAIColumn = !!col.prompt;
            const content = analysisVal !== undefined ? analysisVal : originalVal;
            
            const modelUsed = row.analysis?._models?.[col.id];
            const responses = row.analysis?._responses?.[col.id] || {};
            const isMenuOpen = activeMenuCol === col.id;
            const isAnalyzingColumn = row.analyzingColumns?.includes(col.id);

            return (
                <div key={col.id} className={`flex-none w-[350px] min-h-[100px] border-r border-gray-100 dark:border-gray-700 relative group/cell ${
                    isAnalyzingColumn
                        ? 'bg-orange-50 dark:bg-orange-900/20 animate-pulse ring-1 ring-inset ring-orange-200 dark:ring-orange-800'
                        : 'bg-white dark:bg-gray-900'
                }`}>
                    <div className={`p-4 h-full ${textSizeClass} text-gray-600 dark:text-gray-300 leading-relaxed break-words`}>
                        {isAnalyzingColumn ? (
                            <div className="space-y-2 opacity-50">
                                <div className="h-2 bg-orange-200 dark:bg-orange-800 rounded w-3/4"></div>
                                <div className="h-2 bg-orange-200 dark:bg-orange-800 rounded w-1/2"></div>
                            </div>
                        ) : (
                            isAIColumn ? (
                                content !== undefined && content !== null ? (
                                    <>
                                        {Array.isArray(content) ? (
                                            <ul className="list-disc pl-4 space-y-1 mb-8">
                                                {content.map((item: string, idx: number) => <li key={idx}>{item}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="mb-8 whitespace-pre-wrap">{String(content)}</p>
                                        )}
                                    </>
                                ) : (
                                   <div className="flex h-full items-center justify-center min-h-[80px]">
                                       <button 
                                           onClick={() => onAnalyzeColumn(row.id, col.id, col.prompt!)}
                                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded transition-colors shadow-sm"
                                           title="Analyze this specific column"
                                       >
                                           <Play size={10} className="fill-current" />
                                           Analyze
                                       </button>
                                   </div>
                                )
                            ) : (
                                // Editable Data Cell
                                <textarea
                                    className="w-full h-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none p-0 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600"
                                    defaultValue={String(content || "")}
                                    placeholder="Empty"
                                    onBlur={(e) => handleCellUpdate(col.id, e.target.value)}
                                    rows={3}
                                />
                            )
                        )}
                    </div>
                    
                    {/* Badge / Interactive Menu (Only for AI columns or if analysis exists) */}
                    {(modelUsed || (isAIColumn && content !== undefined)) && row.status !== 'analyzing' && (
                        <div className="absolute bottom-2 right-2 z-10">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuCol(isMenuOpen ? null : col.id);
                                }}
                                className={`
                                    flex items-center gap-1.5 text-[9px] font-mono 
                                    bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded border shadow-sm transition-all cursor-pointer select-none
                                    ${isMenuOpen ? 'opacity-100 border-orange-300 dark:border-orange-500 text-orange-600 dark:text-orange-400 ring-2 ring-orange-100 dark:ring-orange-900' : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 opacity-0 group-hover/cell:opacity-100'}
                                `}
                                title={modelUsed ? `Generated by ${modelUsed}` : 'Analyze'}
                            >
                                {modelUsed ? formatModelName(modelUsed) : 'Analyze'}
                                <ChevronDown size={8} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div 
                                    ref={menuRef}
                                    className="absolute bottom-full right-0 mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                                >
                                    <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 border-b border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Select Model</p>
                                    </div>
                                    <div className="py-1 max-h-40 overflow-y-auto">
                                        {AVAILABLE_MODELS_CONFIG.map(model => {
                                            const isCached = !!responses[model.id];
                                            const isActive = modelUsed === model.id;
                                            
                                            return (
                                                <button
                                                    key={model.id}
                                                    onClick={() => {
                                                        if(col.prompt) onAnalyzeColumn(row.id, col.id, col.prompt, model.id);
                                                        setActiveMenuCol(null);
                                                    }}
                                                    className={`
                                                        w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between group/item
                                                        ${isActive ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}
                                                    `}
                                                >
                                                    <span>{model.label}</span>
                                                    
                                                    {isActive ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">Active</span>
                                                    ) : isCached ? (
                                                        <span className="flex items-center gap-1 text-[9px] text-gray-400" title="Cached response">
                                                            <Check size={10} /> Saved
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[9px] text-orange-400 opacity-0 group-hover/item:opacity-100" title="Click to generate">
                                                            <CloudLightning size={10} /> Run
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};
