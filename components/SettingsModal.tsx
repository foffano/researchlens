import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Trash2, CheckCircle, AlertCircle, Type, Moon, Sun, Monitor } from 'lucide-react';
import { AVAILABLE_MODELS_CONFIG } from '../types';

export interface AppSettings {
  apiKey: string;
  modelId: string;
  fontSize: 'small' | 'medium' | 'large';
  theme: 'light' | 'dark' | 'system';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  initialSettings: AppSettings;
  onClearData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialSettings,
  onClearData
}) => {
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [modelId, setModelId] = useState(initialSettings.modelId);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(initialSettings.fontSize || 'medium');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialSettings.theme || 'system');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(initialSettings.apiKey);
      setModelId(initialSettings.modelId);
      setFontSize(initialSettings.fontSize || 'medium');
      setTheme(initialSettings.theme || 'system');
      setShowClearConfirm(false);
    }
  }, [isOpen, initialSettings]);

  // Helper to apply theme to DOM
  const applyTheme = (themeValue: 'light' | 'dark' | 'system') => {
    const root = window.document.documentElement;
    const isDark = themeValue === 'dark' || 
      (themeValue === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  };

  // Preview theme immediately when changed
  useEffect(() => {
    if (isOpen) {
      applyTheme(theme);
    }
  }, [theme, isOpen]);

  // Handle cancel (restore original theme)
  const handleCancel = () => {
    if (initialSettings.theme) {
      applyTheme(initialSettings.theme);
    }
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ apiKey, modelId, fontSize, theme });
    // Theme is already applied by useEffect, and App will re-apply on save
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
          <button 
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Theme Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Monitor size={16} className="text-gray-500 dark:text-gray-400" />
                Appearance
              </label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                  <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-all flex items-center justify-center gap-2 ${
                          theme === 'light' 
                              ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' 
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                      <Sun size={14} /> Light
                  </button>
                  <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-all flex items-center justify-center gap-2 ${
                          theme === 'dark' 
                              ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' 
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                      <Moon size={14} /> Dark
                  </button>
                  <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-all flex items-center justify-center gap-2 ${
                          theme === 'system' 
                              ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' 
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                      <Monitor size={14} /> System
                  </button>
              </div>
            </div>

            {/* API Key Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Key size={16} className="text-orange-500" />
                Gemini API Key
              </label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your AI Studio API Key"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Your key is stored locally on your device.
              </p>
            </div>

            {/* Model Selection Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Cpu size={16} className="text-blue-500 dark:text-blue-400" />
                AI Model
              </label>
              <select 
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white dark:bg-gray-700 dark:text-white"
              >
                {AVAILABLE_MODELS_CONFIG.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Accessibility Section: Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Type size={16} className="text-purple-500 dark:text-purple-400" />
                Font Size
              </label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                          key={size}
                          type="button"
                          onClick={() => setFontSize(size)}
                          className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-all capitalize ${
                              fontSize === size 
                                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' 
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                      >
                          {size}
                      </button>
                  ))}
              </div>
            </div>

          </form>

          {/* Danger Zone */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3">Danger Zone</h3>
            
            {!showClearConfirm ? (
              <button 
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 px-4 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Clear All Data
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium">Are you sure?</p>
                    <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">
                      This will delete all files, folders, and settings. This action cannot be undone.
                    </p>
                    <div className="flex gap-2 mt-3">
                       <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-1.5 px-3 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 text-gray-600 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          onClearData();
                          setShowClearConfirm(false);
                          handleCancel(); // Close properly
                        }}
                        className="flex-1 py-1.5 px-3 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* About Section */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
             <p className="text-xs text-gray-400">Research<span className="text-orange-500">Lens</span> v1.1.0</p>
             <p className="text-[10px] text-gray-400 mt-1">Copyright © 2025 Marlon Oliveira Alves Foffano</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
          <button 
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="settings-form"
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <CheckCircle size={16} />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
};