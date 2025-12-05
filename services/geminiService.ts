import { GoogleGenAI, Type } from "@google/genai";
import { CorrectionMode, SpellingCorrection } from "../types";

// Using Gemini 2.5 Flash
const MODEL_NAME = "gemini-2.5-flash";

// --- SECURITY CONFIGURATION FOR CLOUD DEPLOYMENT ---
// Since you are hosting this on Vercel/Netlify/Cloud:
// 1. Go to Google Cloud Console > APIs & Services > Credentials.
// 2. Click your API Key.
// 3. Under "Application restrictions", select "Websites".
// 4. Add your domain (e.g., https://my-captions.vercel.app/*).
// 5. This makes the key useless to anyone else, even if they copy it.

// If you still want to obfuscate for basic deterrence:
const OBFUSCATED_KEY = ""; 

const getApiKey = (): string => {
  // Priority 1: Environment Variable (Vercel/Netlify Environment Variables)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    // @ts-ignore
    return process.env.API_KEY;
  }

  // Priority 2: Obfuscated Key (Client-side fallback)
  if (OBFUSCATED_KEY) {
    try {
      return atob(OBFUSCATED_KEY);
    } catch (e) {
      console.error("Failed to decode obfuscated API key");
    }
  }

  // Priority 3: Global Window Variable (Legacy/Injection)
  // @ts-ignore
  if (typeof window !== 'undefined' && window.GOOGLE_API_KEY) {
    // @ts-ignore
    return window.GOOGLE_API_KEY;
  }

  console.warn("API Key missing. Please set API_KEY in your Vercel/Netlify settings.");
  return "";
};

const BASE_SYSTEM_INSTRUCTION = `
You are a strict SRT formatting engine. You are NOT a creative writer.

**CORE TASK:**
Convert the provided transcript into valid SRT format.

**CRITICAL RULE: SYNCHRONIZATION OVER SENTENCE STRUCTURE**
- Your #1 priority is matching text to its specific timestamp.
- **NEVER** fix a broken sentence by moving text from a later timestamp to an earlier one.
- It is better to have a sentence fragment than to have the audio out of sync.
- **ANTI-DRIFT:** If the transcript says a phrase starts at 0:10, you MUST NOT start it at 0:05 just because it fits the previous sentence better.

**THE BUCKET RULE (DO NOT IGNORE):**
The transcript provides "buckets" of text starting at specific times.
- IF Input is: "0:10 I am going to" and "0:15 the store."
- OUTPUT MUST BE: 
   1 (00:00:10 --> ...) "I am going to"
   2 (00:00:15 --> ...) "the store."
- **WRONG OUTPUT:** 1 (00:00:10 --> ...) "I am going to the store." (This is INCORRECT because you stole text from 0:15).
- **NEVER** move text backwards to a previous timestamp block to fix grammar.

**TIMING RULES:**
1. **Hard Anchors:** The start time of a subtitle block MUST MATCH the source timestamp exactly.
2. **Splitting:** If a text segment is too long (>42 chars/line or >2 lines), you must split it.
   - Part 1 starts at the anchor time.
   - Part 2 starts immediately after Part 1 (interpolated).
   - ALL parts must finish before the *next* anchor timestamp starts.

**FORMATTING:**
1. Max 2 lines per block.
2. ~42 characters per line.
3. Remove junk endings (e.g., "You.", "Copyright").

**SRT Output Format:**
1
00:00:00,000 --> 00:00:04,000
Line 1 text
Line 2 text

2
00:00:04,050 --> 00:00:08,000
Next text
`;

// Helper to determine if a correction is significant (word change) or just punctuation/case
const isSignificantChange = (original: string, correction: string): boolean => {
  // Normalize: lowercase and remove all non-alphanumeric characters (letters/numbers/unicode)
  const normalize = (str: string) => str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  
  // If the normalized strings are different, it means a letter or number changed.
  return normalize(original) !== normalize(correction);
};

export const validateTimestamps = async (text: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze the following text. Does it contain timestamps (like 0:00, 01:23, 1:02:45)? 
      Reply with strict JSON: { "hasTimestamps": boolean }
      
      Text:
      ${text.substring(0, 1000)}... (truncated)`,
       config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.hasTimestamps === true;
  } catch (e) {
    console.error("Validation error", e);
    return /\d{1,2}:\d{2}/.test(text);
  }
};

export const proposeCorrections = async (text: string): Promise<SpellingCorrection[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const prompt = `
    Analyze this transcript for **TRANSCRIPTION ERRORS** (Spelling, Homophones, and Misheard Words).
    
    **YOUR TASK:**
    Identify words or phrases that are likely mis-transcribed by auto-captions and provide the corrected version based on context.

    **LOOK FOR:**
    1. **Homophones:** (e.g., "their" vs "there", "see" vs "sea").
    2. **Misheard Proper Nouns:** Auto-captions often butcher names. (e.g., "lulu map" -> "MooMooMath", "khan academy" -> "con academy"). Use context to infer the correct entity.
    3. **Phonetic Mix-ups:** Words that sound similar but don't make sense in context.
    4. **Split/Merged Words:** (e.g., "all right" vs "alright", "login" vs "log in").
    5. **Phrase correction:** If a whole phrase is wrong, correct the whole phrase (Original: "lulu map", Correction: "MooMooMath").

    **STRICT CONSTRAINTS:**
    - **NO STYLE CHANGES:** Do not rephrase sentences or change vocabulary choices (e.g., do not change "kids" to "children").
    - **IGNORE PUNCTUATION:** Do not list changes that are purely commas/periods unless they change the word itself.

    Return a list of proposed corrections as valid JSON.

    Transcript:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              correction: { type: Type.STRING },
              context: { type: Type.STRING, description: "Small snippet of text surrounding the error" },
              timestamp: { type: Type.STRING, description: "The nearest timestamp to this error" }
            },
            required: ["original", "correction", "context", "timestamp"]
          }
        }
      }
    });

    const rawCorrections = JSON.parse(response.text || "[]");
    
    // Filter out insignificant changes (punctuation/case only) in code to be safe
    const significantCorrections = rawCorrections.filter((c: any) => 
      isSignificantChange(c.original, c.correction)
    );
    
    // Add IDs and default selected state
    return significantCorrections.map((c: any, index: number) => ({
      ...c,
      id: `corr-${index}`,
      isSelected: true
    }));

  } catch (e) {
    console.error("Error proposing corrections", e);
    return [];
  }
};

// Post-processing to ensure valid SRT structure and continuous timing
const refineSrtTiming = (srt: string): string => {
  const blocks = srt.trim().split(/\n\s*\n/);
  
  // Robust timestamp parser
  const toMs = (ts: string) => {
    const parts = ts.split(/[:,\.]/); 
    if (parts.length < 3) return 0;
    
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    const ms = parseInt(parts[3]) || 0;
    
    return h * 3600000 + m * 60000 + s * 1000 + ms;
  };

  // Ms to string HH:MM:SS,mmm
  const toStr = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const msec = ms % 1000;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${msec.toString().padStart(3, '0')}`;
  };

  const parsedBlocks = blocks.map(block => {
    const lines = block.split('\n');
    if (lines.length < 3) return null; // Invalid block
    
    const index = lines[0];
    const timeLine = lines[1];
    const text = lines.slice(2).join('\n');
    
    const [startStr, endStr] = timeLine.split(' --> ');
    if (!startStr || !endStr) return null;

    return {
      index,
      startMs: toMs(startStr.trim()),
      endMs: toMs(endStr.trim()), 
      text
    };
  }).filter(Boolean);

  let output = '';

  parsedBlocks.forEach((block: any, i) => {
    if (!block) return;

    // Start time is Anchored to transcript (trust the AI/Source)
    const newStart = block.startMs;
    let newEnd: number;

    if (i < parsedBlocks.length - 1) {
      const nextBlock = parsedBlocks[i + 1];
      const nextStart = nextBlock.startMs;
      
      // Strict Flicker-Free Logic:
      // Extend current block to exactly 1ms before the next block starts.
      newEnd = nextStart - 1;

      // Sanity check: ensure we didn't go backwards
      if (newEnd <= newStart) {
        newEnd = newStart + 1000; // Minimum fallback
      }

    } else {
      // Last block
      newEnd = newStart + 4000;
    }

    output += `${block.index}\n${toStr(newStart)} --> ${toStr(newEnd)}\n${block.text}\n\n`;
  });

  return output.trim();
};

export const generateSrt = async (
  text: string, 
  mode: CorrectionMode,
  approvedCorrections: SpellingCorrection[] = []
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  let prompt = `Convert the following transcript into a valid SRT file. `;

  if (mode === CorrectionMode.NONE) {
    prompt += `Do NOT change punctuation or capitalization at all. Preserve the text exactly as is.`;
  } else if (mode === CorrectionMode.PUNCTUATION) {
    prompt += `Correct ONLY basic punctuation and capitalization. 
    IMPORTANT: Do not treat each line as a complete sentence. If a line clearly continues a sentence from the previous line, leave it in lowercase (unless proper noun).
    Preserve mid-sentence line breaks.`;
  } else if (mode === CorrectionMode.SPELLING) {
    prompt += `Apply the following specific spelling corrections ONLY. 
    Do not change the general punctuation style unless it is part of the specific correction.
    
    Corrections to apply:
    ${approvedCorrections.map(c => `- Change "${c.original}" to "${c.correction}" near ${c.timestamp}`).join('\n')}
    
    If a correction is not in this list, do not make it.`;
  } else if (mode === CorrectionMode.BOTH) {
    prompt += `Apply the following specific spelling corrections. 
    Additionally, correct all basic punctuation and capitalization throughout the entire text.
    IMPORTANT: Do not treat each line as a complete sentence. If a line clearly continues a sentence from the previous line, leave it in lowercase (unless proper noun).
    
    Specific corrections to apply:
    ${approvedCorrections.map(c => `- Change "${c.original}" to "${c.correction}" near ${c.timestamp}`).join('\n')}`;
  }

  prompt += `\n\nREMINDER: Strict max 42 chars per line, max 2 lines per block. Split blocks if necessary. START TIMES MUST MATCH SOURCE TIMESTAMPS EXACTLY. DO NOT MOVE TEXT BETWEEN TIMESTAMP BUCKETS.`;
  prompt += `\n\nTranscript:\n${text}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION,
      temperature: 0.0, // Strict, non-creative
    },
    contents: prompt,
  });

  let cleanText = response.text || "";
  cleanText = cleanText.replace(/^```srt\n/, '').replace(/^```\n/, '').replace(/^```/, '').replace(/```$/, '');
  
  // Run timing refinement
  return refineSrtTiming(cleanText.trim());
};