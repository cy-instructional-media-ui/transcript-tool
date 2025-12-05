import React from 'react';

interface Props {
  srtContent: string;
  onRestart: () => void;
}

const StageResult: React.FC<Props> = ({ srtContent, onRestart }) => {
  
  const handleDownload = () => {
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subtitles.srt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row">
      
      {/* Left Side: Preview */}
      <div className="w-full md:w-2/3 p-6 border-r border-gray-100 flex flex-col h-[600px]">
        <h3 id="preview-heading" className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="bg-green-100 text-green-800 py-1 px-2 rounded text-xs" aria-hidden="true">PREVIEW</span>
          Generated File Content
        </h3>
        {/* Added tabIndex to allow keyboard scrolling */}
        <div 
          className="flex-grow bg-gray-50 rounded-lg border border-gray-300 p-4 overflow-y-auto font-mono text-sm leading-relaxed text-gray-900 whitespace-pre-wrap focus:ring-2 focus:ring-blue-500 focus:outline-none"
          tabIndex={0}
          role="region"
          aria-labelledby="preview-heading"
        >
          {srtContent}
        </div>
      </div>

      {/* Right Side: Actions */}
      <div className="w-full md:w-1/3 p-8 bg-gray-50 flex flex-col justify-center">
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
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mb-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          Download .srt File
        </button>
        
        <p className="text-xs text-gray-600 text-center mb-8">
          Ready to upload to Canvas Studio, YouTube, or Premiere Pro.
        </p>

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