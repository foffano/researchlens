import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { AVAILABLE_MODELS_CONFIG } from '../types';

export interface AppSettings {
  apiKey: string;
  modelId: string;
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(initialSettings.apiKey);
      setModelId(initialSettings.modelId);
      setShowClearConfirm(false);
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ apiKey, modelId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-4">
            {/* API Key Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Key size={16} className="text-orange-500" />
                Gemini API Key
              </label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your AI Studio API Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your key is stored locally on your device.
              </p>
            </div>

            {/* Model Selection Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Cpu size={16} className="text-blue-500" />
                AI Model
              </label>
              <select 
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
              >
                {AVAILABLE_MODELS_CONFIG.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </form>

          {/* Danger Zone */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3">Danger Zone</h3>
            
            {!showClearConfirm ? (
              <button 
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Clear All Data
              </button>
            ) : (
              <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Are you sure?</p>
                    <p className="text-xs text-red-600 mt-1">
                      This will delete all files, folders, and settings. This action cannot be undone.
                    </p>
                    <div className="flex gap-2 mt-3">
                       <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-1.5 px-3 bg-white border border-red-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          onClearData();
                          setShowClearConfirm(false);
                          onClose();
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
          <div className="pt-4 border-t border-gray-100 text-center">
             <p className="text-xs text-gray-400">ResearchLens AI v0.1.0</p>
             <p className="text-[10px] text-gray-400 mt-1">Copyright © 2025 Marlon Oliveira Alves Foffano</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="settings-form"
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <CheckCircle size={16} />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
};