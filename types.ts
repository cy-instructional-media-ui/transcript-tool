
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

export type SupportedLanguage = 
  | 'English' 
  | 'Spanish' 
  | 'Chinese (Simplified)' 
  | 'Chinese (Traditional)' 
  | 'Tagalog (Filipino)' 
  | 'Korean' 
  | 'Armenian' 
  | 'Vietnamese' 
  | 'Farsi (Persian)' 
  | 'Japanese';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'Spanish',
  'Chinese (Simplified)',
  'Chinese (Traditional)',
  'Tagalog (Filipino)',
  'Korean',
  'Armenian',
  'Vietnamese',
  'Farsi (Persian)',
  'Japanese'
];

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
