import React, { useState } from 'react';
import { Filter, X, Check } from 'lucide-react';
import { FilterState } from '../types';
import { ARTICLE_TYPES } from '../services/gemini';

interface FilterMenuProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({ filters, onFilterChange, isOpen, onClose }) => {
  if (!isOpen) return null;

  const toggleArticleType = (type: string) => {
    const newTypes = filters.articleTypes.includes(type)
      ? filters.articleTypes.filter(t => t !== type)
      : [...filters.articleTypes, type];
    
    onFilterChange({ ...filters, articleTypes: newTypes });
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    onFilterChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: value || null }
    });
  };

  const clearFilters = () => {
    onFilterChange({
      searchQuery: filters.searchQuery, // Preserve search query
      dateRange: { start: null, end: null },
      articleTypes: [],
      publicationYears: []
    });
  };

  const activeFilterCount = 
    (filters.dateRange.start ? 1 : 0) + 
    (filters.dateRange.end ? 1 : 0) + 
    filters.articleTypes.length;

  return (
    <div className="absolute top-16 right-6 z-50 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Filter size={16} className="text-orange-600 dark:text-orange-400" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        
        {/* Date Range Section */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Upload Date
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input 
                type="date" 
                value={filters.dateRange.start || ''}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-orange-500 outline-none dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <input 
                type="date" 
                value={filters.dateRange.end || ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-orange-500 outline-none dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Article Types Section */}
        <div>
           <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Article Type
            </label>
            {filters.articleTypes.length > 0 && (
                <button 
                    onClick={() => onFilterChange({...filters, articleTypes: []})}
                    className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline"
                >
                    Clear
                </button>
            )}
           </div>
           
           <div className="space-y-1">
             {ARTICLE_TYPES.map(type => (
               <label key={type} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded cursor-pointer">
                 <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    filters.articleTypes.includes(type) 
                      ? 'bg-orange-600 border-orange-600 text-white' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                 }`}>
                    {filters.articleTypes.includes(type) && <Check size={10} />}
                 </div>
                 <input 
                   type="checkbox" 
                   className="hidden"
                   checked={filters.articleTypes.includes(type)}
                   onChange={() => toggleArticleType(type)}
                 />
                 {type}
               </label>
             ))}
           </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex justify-between">
         <button 
           onClick={clearFilters}
           disabled={activeFilterCount === 0}
           className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-50 px-3 py-1.5"
         >
           Reset All
         </button>
         <button 
           onClick={onClose}
           className="text-xs bg-gray-900 dark:bg-black text-white px-3 py-1.5 rounded hover:bg-black dark:hover:bg-gray-900 transition-colors border border-transparent dark:border-gray-600"
         >
           Done
         </button>
      </div>
    </div>
  );
};