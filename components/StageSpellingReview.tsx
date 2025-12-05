import React from 'react';
import { SpellingCorrection } from '../types';

interface Props {
  corrections: SpellingCorrection[];
  onToggleCorrection: (id: string) => void;
  onEditCorrection: (id: string, newText: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const StageSpellingReview: React.FC<Props> = ({ 
  corrections, 
  onToggleCorrection, 
  onEditCorrection,
  onConfirm, 
  onCancel,
  isProcessing 
}) => {
  
  const selectedCount = corrections.filter(c => c.isSelected).length;

  if (corrections.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-green-600 text-5xl mb-4" aria-hidden="true">✨</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Errors Found</h2>
        <p className="text-gray-700 mb-8">
          The AI didn't find any obvious spelling errors in your transcript.
        </p>
        <button
          onClick={onConfirm}
          disabled={isProcessing}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors"
        >
          {isProcessing ? 'Generating SRT...' : 'Continue to SRT Generation'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg flex flex-col h-[80vh]">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Review Spelling Changes</h2>
        <p className="text-sm text-gray-700">
          The AI found {corrections.length} potential improvements. You can edit the corrections or uncheck to ignore them.
        </p>
      </div>

      <div className="flex-grow overflow-y-auto p-6 bg-gray-50 space-y-3" role="list" aria-label="List of proposed corrections">
        {corrections.map((item, index) => (
          <div 
            key={item.id} 
            role="listitem"
            className={`p-4 rounded-lg border transition-all ${
              item.isSelected ? 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-100' : 'bg-gray-100 border-gray-300 opacity-80'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="pt-1.5">
                <label htmlFor={`check-${item.id}`} className="sr-only">Select correction for {item.original}</label>
                <input 
                  id={`check-${item.id}`}
                  type="checkbox" 
                  checked={item.isSelected}
                  onChange={() => onToggleCorrection(item.id)}
                  className="w-5 h-5 text-blue-600 rounded border-gray-400 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              
              <div className="flex-grow">
                {/* Header: Timestamp and Context */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                  <span className="text-xs font-mono bg-gray-200 text-gray-800 px-2 py-0.5 rounded w-fit">
                    {item.timestamp}
                  </span>
                  <div className="text-xs text-gray-600 italic truncate max-w-md">
                     "...{item.context}..."
                  </div>
                </div>

                {/* Edit Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  
                  {/* Original */}
                  <div className="flex flex-col">
                    <span id={`label-orig-${item.id}`} className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Original</span>
                    <div aria-labelledby={`label-orig-${item.id}`} className="text-red-800 bg-red-50 px-3 py-2 rounded-md border border-red-200 font-medium">
                      {item.original}
                    </div>
                  </div>

                  {/* Correction (Editable) */}
                  <div className="flex flex-col">
                    <label htmlFor={`edit-${item.id}`} className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Correction</label>
                    <input
                      id={`edit-${item.id}`}
                      type="text"
                      value={item.correction}
                      onChange={(e) => onEditCorrection(item.id, e.target.value)}
                      placeholder="Type correction here..."
                      className={`px-3 py-2 rounded-md border text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        item.isSelected 
                          ? 'border-green-300 bg-green-50 text-green-900' 
                          : 'border-gray-400 bg-white text-gray-600'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">
            Applying {selectedCount} of {corrections.length} fixes
          </span>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
          >
            {isProcessing ? (
               <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
               </>
            ) : (
              'Generate .srt File'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageSpellingReview;