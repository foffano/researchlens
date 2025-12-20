import React, { useState, useRef, useEffect } from 'react';
import { FileText, Link as LinkIcon, ExternalLink, Eye, Folder as FolderIcon, ChevronDown, Play, Check, CloudLightning, Trash2 } from 'lucide-react';
import { FileEntry, ColumnConfig, Folder, AVAILABLE_MODELS_CONFIG } from '../types';

interface FileRowProps {
  file: FileEntry;
  columns: ColumnConfig[];
  folders: Folder[];
  onMoveFile: (fileId: string, folderId: string | undefined) => void;
  onDelete: (fileId: string) => void;
  onAnalyzeColumn: (fileId: string, colId: string, prompt: string, modelId?: string) => void;
}

const formatModelName = (modelId?: string) => {
    if (!modelId) return 'Unknown';
    return modelId.replace('gemini-', '').replace('pro', 'Pro').replace('flash', 'Flash').replace('preview', '(Pre)');
};

export const FileRow: React.FC<FileRowProps> = ({ file, columns, folders, onMoveFile, onDelete, onAnalyzeColumn }) => {
  // Use extracted metadata if available, otherwise fallback to filename
  const displayTitle = file.analysis?.metadata?.title || file.name;
  const displayAuthors = file.analysis?.metadata?.authors?.join(", ");
  const displayYear = file.analysis?.metadata?.publicationYear;
  const displayDoi = file.analysis?.metadata?.doi;
  const displayType = file.analysis?.metadata?.articleType;

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

  const handleOpenPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    let url = '';
    
    if (file.file) {
        url = URL.createObjectURL(file.file);
    } else if (file.base64) {
        // Convert Base64 back to Blob
        const byteCharacters = atob(file.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        url = URL.createObjectURL(blob);
    }

    if (url) {
        window.open(url, '_blank');
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      onMoveFile(file.id, val === "root" ? undefined : val);
  };

  const canViewPdf = !!(file.file || file.base64);

  return (
    <div className="group border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex">
        {/* File Info Column */}
        <div className={`flex-none w-[400px] p-4 border-r border-gray-100 flex flex-col gap-2 relative group/info ${
            (file.status === 'analyzing' && !file.analysis?.metadata)
                ? 'bg-orange-50 animate-pulse ring-1 ring-inset ring-orange-200'
                : 'bg-white group-hover:bg-gray-50'
        }`}>
          {/* Delete Button - Absolute positioned, visible on hover */}
          <button 
              onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
              }}
              className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/info:opacity-100 transition-all z-10"
              title="Delete file"
          >
              <Trash2 size={14} />
          </button>

          <div className="flex items-start gap-3">
             <div className="mt-1 flex-shrink-0">
                <div className="w-8 h-8 rounded bg-orange-50 flex items-center justify-center text-orange-600">
                    <FileText size={18} />
                </div>
             </div>
             <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 leading-snug pr-2">
                    {displayTitle}
                </h4>
                
                {file.analysis?.metadata ? (
                    <div className="flex flex-col gap-1 mt-1.5">
                         {/* Badges Row */}
                         <div className="flex flex-wrap items-center gap-2">
                             {displayType && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                    {displayType}
                                </span>
                             )}
                             {displayYear && displayYear !== 'n/d' && (
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                    {displayYear}
                                 </span>
                             )}
                         </div>

                         {displayAuthors && (
                            <p className="text-xs text-gray-500 truncate mt-0.5" title={displayAuthors}>
                                {displayAuthors}
                            </p>
                         )}
                         
                         <div className="flex items-center gap-3 mt-2 flex-wrap">
                             {displayDoi && (
                                 <a 
                                   href={displayDoi.startsWith('http') ? displayDoi : `https://doi.org/${displayDoi}`} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="text-[11px] text-gray-400 hover:text-orange-600 hover:underline flex items-center gap-1 truncate transition-colors max-w-[120px]"
                                   onClick={(e) => e.stopPropagation()}
                                   title={displayDoi}
                                 >
                                   <ExternalLink size={10} />
                                   DOI Source
                                 </a>
                             )}
                             
                             {canViewPdf && (
                                 <button 
                                     onClick={handleOpenPdf}
                                     className="text-[11px] text-gray-400 hover:text-orange-600 hover:underline flex items-center gap-1 transition-colors"
                                 >
                                     <Eye size={10} />
                                     View PDF
                                 </button>
                             )}

                             {/* Folder Selector */}
                             <div className="relative inline-flex items-center group/folder">
                                <FolderIcon size={10} className="text-gray-400 absolute left-0" />
                                <select 
                                    value={file.folderId || "root"}
                                    onChange={handleFolderChange}
                                    className="text-[11px] text-gray-400 hover:text-gray-600 bg-transparent border-none py-0 pl-4 pr-0 focus:ring-0 cursor-pointer appearance-none w-[80px] truncate"
                                >
                                    <option value="root">No Folder</option>
                                    {folders.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                             </div>
                         </div>
                    </div>
                ) : (
                    <div className="mt-1">
                        <p className="text-xs text-gray-500 mt-0.5">
                        {file.status === 'uploading' && 'Uploading...'}
                        {file.status === 'error' && <span className="text-red-500">Analysis Failed</span>}
                        </p>
                        {canViewPdf && (
                            <button 
                                onClick={handleOpenPdf}
                                className="mt-1 text-[11px] text-gray-400 hover:text-orange-600 hover:underline flex items-center gap-1 transition-colors"
                            >
                                <Eye size={10} />
                                View PDF
                            </button>
                        )}
                    </div>
                )}
             </div>
          </div>
        </div>

        {/* Dynamic Columns */}
        {columns.filter(c => c.id !== 'fileInfo' && c.visible).map((col) => {
            const content = file.analysis ? (file.analysis as any)[col.id] : null;
            const modelUsed = file.analysis?._models?.[col.id];
            const responses = file.analysis?._responses?.[col.id] || {};
            const isMenuOpen = activeMenuCol === col.id;
            // Check if THIS specific column is currently being analyzed
            const isAnalyzingColumn = file.analyzingColumns?.includes(col.id);

            return (
                <div key={col.id} className={`flex-none w-[350px] min-h-[150px] border-r border-gray-100 relative group/cell ${
                    isAnalyzingColumn
                        ? 'bg-orange-50 animate-pulse ring-1 ring-inset ring-orange-200'
                        : 'bg-white'
                }`}>
                    <div className="p-4 text-sm text-gray-600 leading-relaxed break-words">
                        {isAnalyzingColumn ? (
                            <div className="space-y-2 opacity-50">
                                <div className="h-2 bg-orange-200 rounded w-3/4"></div>
                                <div className="h-2 bg-orange-200 rounded w-1/2"></div>
                            </div>
                        ) : (
                            content ? (
                                <>
                                    {Array.isArray(content) ? (
                                        <ul className="list-disc pl-4 space-y-1 mb-8">
                                            {content.map((item: string, idx: number) => <li key={idx}>{item}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="mb-8">{content}</p>
                                    )}
                                </>
                            ) : (
                                col.prompt ? (
                                   <div className="flex h-full items-center justify-center min-h-[118px]">
                                       <button 
                                           onClick={() => onAnalyzeColumn(file.id, col.id, col.prompt!)}
                                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded transition-colors shadow-sm"
                                           title="Analyze this specific column"
                                       >
                                           <Play size={10} className="fill-current" />
                                           Analyze
                                       </button>
                                   </div>
                               ) : (
                                   <span className="text-gray-300 text-xs italic">
                                       (No prompt)
                                   </span>
                               )
                            )
                        )}
                    </div>
                    
                    {/* Badge / Interactive Menu */}
                    {(modelUsed || content) && file.status !== 'analyzing' && (
                        <div className="absolute bottom-2 right-2 z-10">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuCol(isMenuOpen ? null : col.id);
                                }}
                                className={`
                                    flex items-center gap-1.5 text-[9px] font-mono 
                                    bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded border shadow-sm transition-all cursor-pointer select-none
                                    ${isMenuOpen ? 'opacity-100 border-orange-300 text-orange-600 ring-2 ring-orange-100' : 'text-gray-500 border-gray-200 opacity-0 group-hover/cell:opacity-100'}
                                `}
                                title="Switch model response"
                            >
                                {modelUsed ? formatModelName(modelUsed) : 'Analyze'}
                                <ChevronDown size={8} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div 
                                    ref={menuRef}
                                    className="absolute bottom-full right-0 mb-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                                >
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Model</p>
                                    </div>
                                    <div className="py-1 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                                        {AVAILABLE_MODELS_CONFIG.map(model => {
                                            const isCached = !!responses[model.id];
                                            const isActive = modelUsed === model.id;
                                            
                                            return (
                                                <button
                                                    key={model.id}
                                                    onClick={() => {
                                                        if(col.prompt) onAnalyzeColumn(file.id, col.id, col.prompt, model.id);
                                                        setActiveMenuCol(null);
                                                    }}
                                                    className={`
                                                        w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between group/item
                                                        ${isActive ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'}
                                                    `}
                                                >
                                                    <span>{model.label}</span>
                                                    
                                                    {isActive ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Active</span>
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