import React from 'react';
import { CorrectionMode } from '../types';

interface Props {
  onProcess: (mode: CorrectionMode) => void;
  onBack: () => void;
  isProcessing: boolean;
}

const StageOptions: React.FC<Props> = ({ onProcess, onBack, isProcessing }) => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="mb-8 text-center">
        <h2 id="options-heading" className="text-2xl font-bold text-gray-900 mb-2">Step 2: Cleaning Options</h2>
        <p className="text-gray-700">
          How would you like the AI to handle the text in your transcript?
        </p>
      </div>

      <div role="group" aria-labelledby="options-heading" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Option 1: No Changes */}
        <button
          onClick={() => onProcess(CorrectionMode.NONE)}
          disabled={isProcessing}
          className="group relative p-6 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition-all text-left disabled:opacity-50"
          aria-label="No Changes. Keep text exactly as it is. Best if your transcript is already perfect."
        >
          <div className="mb-3 text-3xl" aria-hidden="true">🚫</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Changes</h3>
          <p className="text-sm text-gray-700">
            Keep text exactly as it is. Best if your transcript is already perfect.
          </p>
        </button>

        {/* Option 2: Punctuation Only */}
        <button
          onClick={() => onProcess(CorrectionMode.PUNCTUATION)}
          disabled={isProcessing}
          className="group relative p-6 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition-all text-left disabled:opacity-50"
          aria-label="Fix Punctuation. Add periods, commas, and fix capitalization. Keeps the words exactly the same."
        >
          <div className="mb-3 text-3xl" aria-hidden="true">✨</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Fix Punctuation</h3>
          <p className="text-sm text-gray-700">
            Add periods, commas, and fix capitalization. Keeps the words exactly the same.
          </p>
        </button>

        {/* Option 3: Spelling Only */}
        <button
          onClick={() => onProcess(CorrectionMode.SPELLING)}
          disabled={isProcessing}
          className="group relative p-6 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition-all text-left disabled:opacity-50"
          aria-label="Fix Spelling Only. Correct typos and spelling errors. Maintains original punctuation style."
        >
          <div className="mb-3 text-3xl" aria-hidden="true">📝</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Fix Spelling Only</h3>
          <p className="text-sm text-gray-700">
            Correct typos and spelling errors. Maintains original punctuation style.
          </p>
        </button>

        {/* Option 4: Both */}
        <button
          onClick={() => onProcess(CorrectionMode.BOTH)}
          disabled={isProcessing}
          className="group relative p-6 border-2 border-blue-300 bg-blue-50 rounded-xl hover:border-blue-600 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition-all text-left disabled:opacity-50 shadow-sm"
          aria-label="Fix Everything. Correct spelling, punctuation, and capitalization all at once."
        >
          <div className="mb-3 text-3xl" aria-hidden="true">🪄</div>
          <h3 className="text-lg font-bold text-blue-900 mb-1">Fix Everything</h3>
          <p className="text-sm text-blue-900">
            Correct spelling, punctuation, and capitalization all at once.
          </p>
        </button>
      </div>

      {isProcessing ? (
        <div className="text-center py-8" role="status" aria-live="polite">
           <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium text-gray-900">Converting to SRT...</p>
            <p className="text-sm text-gray-600">This usually takes about 10-20 seconds.</p>
        </div>
      ) : (
        <div className="flex justify-start">
           <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            aria-label="Back to previous step"
          >
            ← Back to Transcript
          </button>
        </div>
      )}
    </div>
  );
};

export default StageOptions;