import React, { useState, useCallback } from "react";
import { AppStage, CorrectionMode, ApiError } from "./types";
import StageInput from "./components/StageInput";
import StageOptions from "./components/StageOptions";
import StageResult from "./components/StageResult";
import ErrorMessage from "./components/ErrorMessage";
import { validateTimestamps, generateSrt, translateSrt } from "./services/geminiService";
import { cleanTranscript } from "./utils/cleanTranscript";
import type { SupportedLanguage } from "./types";

const DAILY_LIMIT = 1000;
const STORAGE_KEY = "srt_app_daily_usage";
const MAX_TRANSCRIPT_CHARS = 20_000; // ~10-minute transcript limit

const checkLocalDailyLimit = (): boolean => {
  try {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(STORAGE_KEY);

    let usage = { date: today, count: 0 };

    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        usage = parsed;
      }
    }

    return usage.count < DAILY_LIMIT;
  } catch (e) {
    console.error("Storage error", e);
    return true;
  }
};

const incrementLocalDailyLimit = () => {
  try {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(STORAGE_KEY);

    let usage = { date: today, count: 0 };

    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        usage = parsed;
      }
    }

    usage.count += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch (e) {
    console.error("Storage error", e);
  }
};

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.INPUT);
  const [transcript, setTranscript] = useState<string>("");
  const [srtResult, setSrtResult] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [selectedMode, setSelectedMode] = useState<CorrectionMode>(CorrectionMode.NONE);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English"]);

  const isLikelyNonEnglish = (text: string): boolean => {
    if (!text || text.length < 20) return false;

    const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) || []).length / text.length;

    const commonNonEnglishWords =
      /\b(le|la|les|des|que|qui|est|pas|une|dans|avec|pour|vous|mais|como|para|con|una|las|los|und|der|die|das|nicht|mit|auf)\b/i;

    return nonAsciiRatio > 0.02 || commonNonEnglishWords.test(text);
  };

  const handleTranscriptSubmit = useCallback(async (text: string) => {
    if (!checkLocalDailyLimit()) {
      setError({
        message: `Daily limit reached. This device has processed ${DAILY_LIMIT} videos today. Please try again tomorrow.`,
        isTimestampError: false,
      });
      setStage(AppStage.ERROR);
      return;
    }

    // Strip YouTube chapter headings and artifacts before any processing
    const cleaned = cleanTranscript(text);

    // English-only guard (frontend)
    if (isLikelyNonEnglish(cleaned)) {
      setError({
        message: "This tool currently supports English transcripts only.",
        isTimestampError: false,
      });
      setStage(AppStage.ERROR);
      return;
    }

    // 🔒 Hard ~10-minute transcript limit (20,000 characters)
    if (cleaned.trim().length > MAX_TRANSCRIPT_CHARS) {
      setError({
        message:
          "Transcript exceeds the 10-minute limit (20,000 characters). Please shorten the transcript and try again.",
        isTimestampError: false,
      });
      setStage(AppStage.ERROR);
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const hasTimestamps = await validateTimestamps(cleaned);

      if (hasTimestamps) {
        setTranscript(cleaned);
        setStage(AppStage.OPTIONS);
      } else {
        setError({
          message:
            "It looks like I don't see timestamps in this transcript. Please go back to YouTube, make sure the transcript shows timestamps (e.g. 0:00 or 1:23), copy it again, and paste it here.",
          isTimestampError: true,
        });
        setStage(AppStage.ERROR);
      }
    } catch (e) {
      console.error(e);
      setError({
        message: "An error occurred while validating the transcript. Please try again.",
        isTimestampError: false,
      });
      setStage(AppStage.ERROR);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleFinalProcessing = useCallback(
    async (mode: CorrectionMode, languages: string[]) => {
      setIsProcessing(true);
      const resolvedLanguages = languages.length === 0 ? ["English"] : languages;

      try {
        // Always generate English first
        const englishResult = await generateSrt(transcript, mode, []);

        incrementLocalDailyLimit();

        const results: Record<string, string> = {
          English: englishResult,
        };

        // If additional language selected, translate
        if (resolvedLanguages.length > 1) {
          const targetLanguage = resolvedLanguages.find((l) => l !== "English") as
            | SupportedLanguage
            | undefined;

          if (targetLanguage) {
            const translated = await translateSrt(englishResult, targetLanguage);
            results[targetLanguage] = translated;
          }
        }

        setSrtResult(JSON.stringify(results));
        setStage(AppStage.RESULT);
      } catch (e) {
        console.error(e);
        setError({
          message:
            "Failed to convert the transcript. The AI service might be busy. Please try again.",
          isTimestampError: false,
        });
        setStage(AppStage.ERROR);
      } finally {
        setIsProcessing(false);
      }
    },
    [transcript]
  );

  const handleOptionSelect = useCallback(
    async (mode: CorrectionMode, languages: string[]) => {
      setError(null);
      setSelectedMode(mode);
      setSelectedLanguages(languages);

      if (!checkLocalDailyLimit()) {
        setError({
          message: `Daily limit reached. This device has processed ${DAILY_LIMIT} videos today.`,
          isTimestampError: false,
        });
        setStage(AppStage.ERROR);
        return;
      }

      handleFinalProcessing(mode, languages);
    },
    [handleFinalProcessing]
  );

  const handleRestart = () => {
    setStage(AppStage.INPUT);
    setTranscript("");
    setSrtResult("");
    setSelectedMode(CorrectionMode.NONE);
    setError(null);
  };

  const handleBackToInput = () => {
    setStage(AppStage.INPUT);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold"
              aria-hidden="true"
            >
              CC
            </div>
            <h1 className="text-xl font-bold text-gray-900">Transcript to SRT</h1>
          </div>
          <div className="text-sm text-gray-600 hidden sm:block">Powered by Gemini 2.5</div>
        </div>
      </header>

      <main className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          {stage !== AppStage.ERROR && (
            <nav aria-label="Progress" className="flex justify-center mb-8">
              <ol className="flex items-center space-x-4">
                <li>
                  <div
                    className={`flex items-center gap-2 ${stage === AppStage.INPUT ? "text-blue-700 font-bold" : "text-gray-500"}`}
                    aria-current={stage === AppStage.INPUT ? "step" : undefined}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${stage === AppStage.INPUT ? "bg-blue-100 text-blue-800" : "bg-gray-200 text-gray-600"}`}
                    >
                      1
                    </span>
                    Input
                  </div>
                </li>
                <li aria-hidden="true" className="w-8 h-px bg-gray-300"></li>
                <li>
                  <div
                    className={`flex items-center gap-2 ${stage === AppStage.OPTIONS ? "text-blue-700 font-bold" : "text-gray-500"}`}
                    aria-current={stage === AppStage.OPTIONS ? "step" : undefined}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${stage === AppStage.OPTIONS ? "bg-blue-100 text-blue-800" : "bg-gray-200 text-gray-600"}`}
                    >
                      2
                    </span>
                    Options
                  </div>
                </li>
                <li aria-hidden="true" className="w-8 h-px bg-gray-300"></li>
                <li>
                  <div
                    className={`flex items-center gap-2 ${stage === AppStage.RESULT ? "text-green-700 font-bold" : "text-gray-500"}`}
                    aria-current={stage === AppStage.RESULT ? "step" : undefined}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${stage === AppStage.RESULT ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}
                    >
                      3
                    </span>
                    Download
                  </div>
                </li>
              </ol>
            </nav>
          )}

          {stage === AppStage.INPUT && (
            <StageInput onNext={handleTranscriptSubmit} isValidating={isValidating} />
          )}

          {stage === AppStage.OPTIONS && (
            <StageOptions
              onProcess={handleOptionSelect}
              onBack={handleBackToInput}
              isProcessing={isProcessing}
            />
          )}

          {stage === AppStage.RESULT && (
            <StageResult srtContent={srtResult} onRestart={handleRestart} />
          )}

          {stage === AppStage.ERROR && error && (
            <ErrorMessage
              message={error.message}
              onRetry={error.isTimestampError ? handleRestart : handleBackToInput}
            />
          )}
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-300 py-6 text-center text-sm">
        <p>MIT License © Cy-Instructional-Media</p>
        <p className="mt-2 text-xs text-gray-400">
          This tool processes text locally and via secure AI APIs. No data is stored permanently.
        </p>
      </footer>
    </div>
  );
};

export default App;
