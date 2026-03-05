import React from "react";
import { CorrectionMode, SUPPORTED_LANGUAGES } from "../types";

interface Props {
  onProcess: (mode: CorrectionMode, languages: string[]) => void;
  onBack: () => void;
  isProcessing: boolean;
}

const StageOptions: React.FC<Props> = ({ onProcess, onBack, isProcessing }) => {
  const [selectedLanguage, setSelectedLanguage] = React.useState<string | null>(null);

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="mb-8 text-center">
        <h2 id="options-heading" className="text-2xl font-bold text-gray-900 mb-2">
          Step 2: Output Options
        </h2>
        <p className="text-gray-700">Choose how the transcript should be processed.</p>
      </div>

      {/* Language Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Output Languages</h3>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked disabled className="h-4 w-4" />
            <span>English</span>
          </div>

          <div>
            <select
              value={selectedLanguage ?? ""}
              onChange={(e) => setSelectedLanguage(e.target.value === "" ? null : e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">No additional language</option>
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          English is included by default. You may select one additional language.
        </p>
      </div>

      {/* Correction Options */}
      <div
        role="group"
        aria-labelledby="options-heading"
        className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
      >
        <button
          onClick={() =>
            onProcess(
              CorrectionMode.NONE,
              selectedLanguage ? ["English", selectedLanguage] : ["English"]
            )
          }
          disabled={isProcessing}
          className="p-6 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
        >
          <div className="mb-3 text-3xl">🚫</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Changes</h3>
          <p className="text-sm text-gray-700">Convert transcript to SRT without altering text.</p>
        </button>

        <button
          onClick={() =>
            onProcess(
              CorrectionMode.CLEAN,
              selectedLanguage ? ["English", selectedLanguage] : ["English"]
            )
          }
          disabled={isProcessing}
          className="p-6 border-2 border-blue-300 bg-blue-50 rounded-xl hover:border-blue-600 hover:bg-blue-100 transition-all text-left disabled:opacity-50 shadow-sm"
        >
          <div className="mb-3 text-3xl">✨</div>
          <h3 className="text-lg font-bold text-blue-900 mb-1">Clean & Correct</h3>
          <p className="text-sm text-blue-900">
            Correct spelling, punctuation, and capitalization.
          </p>
        </button>
      </div>

      {isProcessing ? (
        <div className="text-center py-8">
          <p className="text-lg font-medium text-gray-900">Converting to SRT...</p>
        </div>
      ) : (
        <div className="flex justify-start">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded"
          >
            ← Back to Transcript
          </button>
        </div>
      )}
    </div>
  );
};

export default StageOptions;
