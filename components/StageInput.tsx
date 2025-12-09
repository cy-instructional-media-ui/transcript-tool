import React, { useState } from 'react';

interface Props {
  onNext: (text: string) => void;
  isValidating: boolean;
}

const StageInput: React.FC<Props> = ({ onNext, isValidating }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onNext(text);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="mb-6 text-center">
        <h2 id="input-heading" className="text-2xl font-bold text-gray-900 mb-2">Step 1: Paste Transcript</h2>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900 text-left mx-auto max-w-xl">
          <p className="font-bold mb-2">Option 1: YouTube (Free & Built-in)</p>
          <ul className="list-disc pl-5 space-y-1 mb-4 text-blue-800">
            <li>Go to the YouTube video.</li>
            <li>Click <strong>...More</strong> (or description) → <strong>Show transcript</strong>.</li>
            <li>Click <strong>Toggle timestamps</strong> (ensure times are visible).</li>
            <li>Copy the entire list and paste it below.</li>
          </ul>

          <p className="font-bold mb-1">Option 2: 3rd Party Tools</p>
          <p className="mb-3 text-blue-800">
            You can use tools like <a href="https://tactiq.io/tools/youtube-transcript" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">Tactiq.io</a> to quickly capture transcripts from YouTube videos using the video url.
          </p>

          <p className="mt-2 text-xs text-blue-700 italic border-t border-blue-200 pt-2">
            Note: We cannot accept YouTube URLs directly due to YouTube's privacy and security settings.
            <br>For best results, please avoid pasting transcripts longer than 5 minutes at this time. Longer transcripts may cause timing drift or formatting errors in the generated SRT file. We’re actively working on a fix.</br>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label htmlFor="transcript-text" className="sr-only">Paste your transcript here</label>
          <textarea
            id="transcript-text"
            className="w-full h-64 p-4 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors resize-none font-mono text-sm text-gray-900 placeholder-gray-500"
            placeholder={`0:00 Hi everyone, today we are discussing...
0:05 The importance of subtitles...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isValidating}
            aria-describedby="input-heading"
          />
          {text.length === 0 && (
            <div className="absolute top-4 right-4 pointer-events-none text-gray-500 text-xs" aria-hidden="true">
              Waiting for text...
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!text.trim() || isValidating}
            className={`px-6 py-3 rounded-lg font-bold text-white transition-all transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600
              ${!text.trim() || isValidating 
                ? 'bg-gray-500 cursor-not-allowed opacity-70' 
                : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 shadow-md'
              }`}
            aria-live="polite"
          >
            {isValidating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking timestamps...
              </span>
            ) : (
              'Next: Choose Settings'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StageInput;
