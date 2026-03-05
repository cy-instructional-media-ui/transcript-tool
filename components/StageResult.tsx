import React from "react";

interface Props {
  srtContent: string;
  onRestart: () => void;
}

const StageResult: React.FC<Props> = ({ srtContent, onRestart }) => {
  const results: Record<string, string> = JSON.parse(srtContent);

  const downloadFile = (content: string, lang: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const langCode = lang.toLowerCase().replace(/[^a-z]/g, "");
    link.href = url;
    link.download = `subtitles_${langCode}.srt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row">
      {/* LEFT SIDE — PREVIEW */}
      <div className="w-full md:w-2/3 p-6 border-r border-gray-100 flex flex-col h-[700px]">
        <h3 className="text-lg font-bold text-gray-900 mb-4">PREVIEW — English Subtitles</h3>

        <div className="flex-grow bg-gray-50 rounded-lg border border-gray-300 p-4 overflow-y-auto font-mono text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
          {results["English"]}
        </div>
      </div>

      {/* RIGHT SIDE — DOWNLOADS */}
      <div className="w-full md:w-1/3 p-8 bg-gray-50 flex flex-col justify-center overflow-y-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-gray-700 text-sm">Your subtitles are ready for download.</p>
        </div>

        {Object.entries(results).map(([lang, content]) => (
          <button
            key={lang}
            onClick={() => downloadFile(content, lang)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mb-4"
          >
            Download .srt ({lang})
          </button>
        ))}

        <div className="border-t border-gray-200 pt-6 mt-4">
          <button
            onClick={onRestart}
            className="w-full bg-white border border-gray-400 hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageResult;
