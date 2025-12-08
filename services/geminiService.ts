
import { GoogleGenAI, Type } from "@google/genai";
import { CorrectionMode, SpellingCorrection, SupportedLanguage } from "../types";

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
  // Priority 1: Vite Environment Variable (Standard for Vercel+Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }

  // Priority 2: Standard Process Environment (Legacy)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    // @ts-ignore
    return process.env.API_KEY;
  }

  // Priority 3: Obfuscated Key (Client-side fallback)
  if (OBFUSCATED_KEY) {
    try {
      return atob(OBFUSCATED_KEY);
    } catch (e) {
      console.error("Failed to decode obfuscated API key");
    }
  }

  // Priority 4: Global Window Variable (Legacy/Injection)
  // @ts-ignore
  if (typeof window !== 'undefined' && window.GOOGLE_API_KEY) {
    // @ts-ignore
    return window.GOOGLE_API_KEY;
  }

  console.warn("API Key missing. Please set VITE_API_KEY in your Vercel/Netlify settings.");
  return "";
};

const BASE_SYSTEM_INSTRUCTION = `
You are a deterministic SRT formatting engine. You follow rules, not preferences.

**CRITICAL: Clean up the ending.**
Transcripts often contain hallucinated or auto-generated garbage at the very end like "You.", "Subtitles by...", or single words that do not match the audio. REMOVE THESE.

====================
CHEMISTRY CONSISTENCY RULES (STRICT)
====================
• Do NOT convert written chemical words into formulas.
  - "carbon dioxide" must remain "carbon dioxide".
  - "nicotinamide adenine dinucleotide" must remain as written.
  
• Only convert **explicit chemical formulas** found in the transcript:
  - CO2 → CO₂
  - FADH2 → FADH₂
  - FADH-2 → FADH₂
  - H2O → H₂O
  - NADH must ALWAYS remain exactly "NADH".
  - Never rewrite NADH as NADH₂ or any variant.

• NEVER rewrite "dioxide" as "CO₂".
• NEVER rewrite "oxygen" as "O₂".
• NEVER rewrite "hydrogen" as "H₂".
• NEVER infer or guess chemical formulas.

If the transcript uses words, keep words.
If the transcript uses formulas, keep formulas.

====================
REPETITION RULES
====================
- **NO HALLUCINATED REPETITION:** Do not duplicate clauses or sentences (e.g. "So if you are doing / if you are doing").
- If the output contains two identical back-to-back lines/phrases, **DELETE ONE**.
- Ensure clean flow without accidental stammers unless they are explicitly in the source text.

====================
MERGING RULES (STRICT)
====================
You MUST merge two consecutive timestamp buckets into ONE subtitle block when ALL conditions are true:
1. The combined text is **50 characters or fewer**.
2. The merged block contains no more than 2 lines.
3. The first bucket does NOT end in ".", "?", "!".
4. The second bucket continues the same phrase (not a new idea).
5. Merging does NOT create a tall block that obstructs the video.

When these rules are met, merging is **REQUIRED**, not optional.

====================
WHEN NOT TO MERGE
====================
Do NOT merge when:
- The merged text exceeds 50 characters.
- The first bucket ends in ".", "?", or "!".
- The two lines form separate ideas.
- Merging creates more than 2 lines.

====================
LINE FORMAT RULES
====================
- **Max 2 lines per block.**
- **Max 50 characters per line.**
- Prefer ONE line whenever possible.
- NEVER leave a trailing orphan word on its own line.
- Split long lines according to natural phrase boundaries.

====================
TIMING RULES
====================
- **Start time of each block MUST match the first timestamp in the bucket.**
- Do not move text to earlier timestamps, even if grammatically tempting.
- Splitting creates new blocks with interpolated start times.

====================
OUTPUT
====================
Produce valid SRT blocks:
1
00:00:00,000 --> 00:00:02,000
text line 1
text line 2

(Blank line between blocks)
`;

const TRANSLATION_SYSTEM_INSTRUCTION = `
You are a professional caption translator. Follow these rules:

1. Preserve Scientific Terms Exactly
Do NOT change biochemical names:
“NADH”, “NAD+”, “FADH₂”, “ATP”, “ADP”, “CO₂”, “acetyl-CoA”, “oxaloacetate”, “citric acid”, etc.
Never alter or “improve” these terms.
Preserve capitalization.

2. Preserve Subscripts Using Unicode
H₂ → use ₂
CO₂ → CO₂
FADH₂ → FADH₂

3. Never Add Missing Atoms
❌ Don’t turn “NADH” → “NADH₂”
❌ Don’t turn “CO₂” → “carbon CO₂” unless explicitly written.

4. Maintain Meaning, Not Literal Word Order
Translate for natural reading in each target language.

5. Maintain Titles, Music Notes, and Brackets
If transcript includes:
[Music]
[음악]
[laughs]
Preserve the meaning in the target language.

6. DO NOT change timing or subtitle numbers
Input timestamps must remain exactly the same.

7. Follow Subtitle Line-Length Rules
Prefer one-line captions.
Max 50 characters per line.
Only use two lines if absolutely necessary.
Never merge across timestamp buckets.

8. Never paraphrase scientific sequences
When describing processes (e.g., Krebs cycle), maintain precise causality.

==========================
OUTPUT FORMAT
==========================
Return ONLY the translated SRT file.
No backticks (e.g. no \`\`\`srt).
No explanations.
No commentary.
`;

// Helper to determine if a correction is significant (word change) or just punctuation/case
const isSignificantChange = (original: string, correction: string): boolean => {
  // Normalize: lowercase and remove all non-alphanumeric characters (letters/numbers/unicode)
  const normalize = (str: string) => str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  
  // If the normalized strings are different, it means a letter or number changed.
  return normalize(original) !== normalize(correction);
};

export const validateTimestamps = async (text: string): Promise<boolean> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });
  
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

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

// services/geminiService.ts

// Normalizes timestamps to HH:MM:SS,mmm format
export function normalizeTimestamps(srt: string): string {
  return srt
    .replace(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})/g,
      (_, h, m, s, ms) => {
        const milliseconds = ms.padStart(3, "0");
        return `${h}:${m}:${s},${milliseconds}`;
      }
    )
    .replace(
      /(\d{2}):(\d{2}):(\d{2})(\d{3})/g,
      (_, h, m, s, ms) => `${h}:${m}:${s},${ms}`
    );
}

// Splits raw transcript into safe, non-breaking chunks for Gemini.
// Each chunk ~6K chars (well under token limits).
export function chunkTranscript(text: string, maxLen = 6000): string[] {
  const chunks: string[] = [];
  let current = "";

  const lines = text.split("\n");

  for (const line of lines) {
    // If adding this line would exceed limit, finalize current chunk
    if ((current + "\n" + line).length > maxLen) {
      chunks.push(current.trim());
      current = line;
    } else {
      current += "\n" + line;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

// Merges multiple SRT files (from chunks) into one continuous SRT
export function mergeSrtChunks(srts: string[]): string {
  let merged = "";
  let indexOffset = 0;

  for (const srt of srts) {
    const blocks = srt.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split("\n");
      if (lines.length < 2) continue;

      const timeLine = lines[1];
      const text = lines.slice(2).join("\n");

      merged += `${indexOffset + 1}\n${timeLine}\n${text}\n\n`;
      indexOffset++;
    }
  }

  return merged.trim();
}

export const generateSrt = async (
  text: string, 
  mode: CorrectionMode,
  approvedCorrections: SpellingCorrection[] = []
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

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

  // Strong reinforcement of the strict merging rules
  prompt += `\n\n**CRITICAL INSTRUCTIONS:**
  1. Apply the **strict merging rules** from the system instruction.
  2. If two consecutive buckets meet the merge conditions (<=50 chars, flow together), you **MUST** merge them.
  3. START TIMES MUST MATCH SOURCE TIMESTAMPS EXACTLY (for the first word of the block).
  4. Ensure no phrases are accidentally repeated (deduplicate back-to-back phrases).`;
  
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
  
  // Safety patch for hallucinated chemistry and cleanup
  cleanText = cleanText
    .replace(/\bcarbon CO₂\b/gi, "carbon dioxide")
    .replace(/\bCO₂ dioxide\b/gi, "carbon dioxide")
    .replace(/\bNADH₂\b/gi, "NADH")  // undo hallucination
    .replace(/\bNADH2\b/gi, "NADH");

  // Run timing refinement
  return refineSrtTiming(cleanText.trim());
};

// High-level function: handles chunking and merging for long transcripts
export async function generateFullSrt(
  fullTranscript: string,
  mode: CorrectionMode,
  approvedCorrections: SpellingCorrection[] = []
): Promise<string> {
  const chunks = chunkTranscript(fullTranscript);

  const results: string[] = [];

  for (const chunk of chunks) {
    const srt = await generateSrt(chunk, mode, approvedCorrections);
    const fixed = normalizeTimestamps(srt);
    results.push(fixed);
  }

  // Merge all partial SRTs
  const merged = mergeSrtChunks(results);

  return merged;
}

export const translateSrt = async (
  srtContent: string,
  targetLanguage: SupportedLanguage
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Translate this transcript into ${targetLanguage} while following all system rules:

${srtContent}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    config: {
      systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
      temperature: 0.1, // Very low temperature for strict formatting compliance
    },
    contents: prompt,
  });

  let translatedText = response.text || "";
  translatedText = translatedText.replace(/^```srt\n/, '').replace(/^```\n/, '').replace(/^```/, '').replace(/```$/, '');

  return translatedText.trim();
};

