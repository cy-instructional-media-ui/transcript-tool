export enum AppStage {
  INPUT = 'INPUT',
  OPTIONS = 'OPTIONS',
  SPELLING_REVIEW = 'SPELLING_REVIEW',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

export enum CorrectionMode {
  NONE = 'NONE',
  PUNCTUATION = 'PUNCTUATION',
  SPELLING = 'SPELLING',
  BOTH = 'BOTH'
}

export interface SpellingCorrection {
  id: string;
  original: string;
  correction: string;
  context: string;
  timestamp: string;
  isSelected: boolean;
}

export interface ProcessingResult {
  srtContent: string;
  originalText?: string;
}

export interface ApiError {
  message: string;
  isTimestampError: boolean;
}