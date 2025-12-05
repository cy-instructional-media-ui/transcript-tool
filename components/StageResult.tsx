
import React, { useState } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types';
import { translateSrt } from '../services/geminiService';
import AccessibleSelect from '../components/AccessibleSelect';

interface Props {
  srtContent: string;
  onRestart: () => void;
}

const StageResult: React.FC<Props> = ({ srtContent: initialSrtContent, onRestart }) => {
  const [displayedSrt, setDisplayedSrt] = useState(initialSrtContent);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('English');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('Spanish');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Store original English version to revert back easily
  const [originalSrt] = useState(initialSrtContent);

  const handleDownload = () => {
    const blob = new Blob([displayedSrt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Create a filename based on language
    const langCode = currentLanguage === 'English' ? '' : `_${currentLanguage.toLowerCase().replace(/[^a-z]/g, '')}`;
    link.download = `subtitles${langCode}.srt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTranslate = async () => {
    if (selectedLanguage === 'English') {
      setDisplayedSrt(originalSrt);
      setCurrentLanguage('English');
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const result = await translateSrt(originalSrt, selectedLanguage);
      setDisplayedSrt(result);
      setCurrentLanguage(selectedLanguage);
    } catch (e) {
      console.error(e);
      setTranslationError("Failed to translate. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row">
      
      {/* Left Side: Preview */}
      <div className="w-full md:w-2/3 p-6 border-r border-gray-100 flex flex-col h-[700px]">
        <div className="flex justify-between items-center mb-4">
          <h3 id="preview-heading" className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="bg-green-100 text-green-800 py-1 px-2 rounded text-xs" aria-hidden="true">PREVIEW</span>
            {currentLanguage} Subtitles
          </h3>
          {currentLanguage !== 'English' && (
            <button 
              onClick={() => {
                setDisplayedSrt(originalSrt);
                setCurrentLanguage('English');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            >
              Revert to English
            </button>
          )}
        </div>

        {/* Added tabIndex to allow keyboard scrolling */}
        <div 
          className="flex-grow bg-gray-50 rounded-lg border border-gray-300 p-4 overflow-y-auto font-mono text-sm leading-relaxed text-gray-900 whitespace-pre-wrap focus:ring-2 focus:ring-blue-500 focus:outline-none"
          tabIndex={0}
          role="region"
          aria-labelledby="preview-heading"
          dir={currentLanguage === 'Farsi (Persian)' ? 'rtl' : 'ltr'}
        >
          {displayedSrt}
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="w-full md:w-1/3 p-8 bg-gray-50 flex flex-col justify-center overflow-y-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl" aria-hidden="true">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-gray-700 text-sm">
            Your transcript has been converted to the SRT standard format.
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mb-8 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          Download .srt ({currentLanguage})
        </button>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-3 text-sm">Translate Subtitles</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="language-select" className="sr-only">Select Language</label>
              <AccessibleSelect
                id="language-select"
                label="Select Language"
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                options={SUPPORTED_LANGUAGES}
                disabled={isTranslating}
              />
            </div>
            
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className={`w-full font-semibold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isTranslating 
                  ? 'bg-blue-100 text-blue-800 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              {isTranslating ? (
                 <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Translating...
                 </span>
              ) : (
                'Translate'
              )}
            </button>
            
            {translationError && (
              <p className="text-red-600 text-xs mt-1">{translationError}</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
           <button
            onClick={onRestart}
            className="w-full bg-white border border-gray-400 hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageResult;
