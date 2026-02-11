import { CorrectionMode, SpellingCorrection, SupportedLanguage } from "../types";

const MODEL_NAME = "gemini-2.5-flash";

/* ================================
   SYSTEM INSTRUCTIONS (UNCHANGED)
================================ */

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


/* ================================
   HELPER: Gemini Proxy Call
================================ */

async function callGemini({
  contents,
  config,
  model = MODEL_NAME,
}: {
  contents: any;
  config?: any;
  model?: string;
}) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      contents,
      config,
    }),
  });

  if (!response.ok) {
    throw new Error("Gemini request failed");
  }

  return response.json();
}

/* ================================
   Timestamp Validation
================================ */

export const validateTimestamps = async (text: string): Promise<boolean> => {
  try {
    const result = await callGemini({
      contents: `Analyze the following text. Does it contain timestamps (like 0:00, 01:23, 1:02:45)? 
Reply with strict JSON: { "hasTimestamps": boolean }

Text:
${text.substring(0, 1000)}... (truncated)`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return parsed.hasTimestamps === true;
  } catch {
    return /\d{1,2}:\d{2}/.test(text);
  }
};

/* ================================
   Spelling Corrections
================================ */

export const proposeCorrections = async (
  text: string
): Promise<SpellingCorrection[]> => {
  const prompt = `
Analyze this transcript for TRANSCRIPTION ERRORS (Spelling, Homophones, and Misheard Words).
Return a JSON array with objects:
{ original, correction, context, timestamp }

Transcript:
${text}
`;

  try {
    const result = await callGemini({
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const raw = JSON.parse(
      result.candidates?.[0]?.content?.parts?.[0]?.text || "[]"
    );

    return raw.map((c: any, index: number) => ({
      ...c,
      id: `corr-${index}`,
      isSelected: true,
    }));
  } catch (e) {
    console.error("Error proposing corrections", e);
    return [];
  }
};

/* ================================
   SRT Generation
================================ */

export const generateSrt = async (
  text: string,
  mode: CorrectionMode,
  approvedCorrections: SpellingCorrection[] = []
): Promise<string> => {
  let prompt = `Convert the following transcript into a valid SRT file.\n\n${text}`;

  const result = await callGemini({
    contents: prompt,
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION,
      temperature: 0.0,
    },
  });

  let cleanText =
    result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  cleanText = cleanText
    .replace(/^```srt\n/, "")
    .replace(/^```\n/, "")
    .replace(/^```/, "")
    .replace(/```$/, "");

  return cleanText.trim();
};

/* ================================
   Translation
================================ */

export const translateSrt = async (
  srtContent: string,
  targetLanguage: SupportedLanguage
): Promise<string> => {
  const prompt = `Translate this transcript into ${targetLanguage}:

${srtContent}`;

  const result = await callGemini({
    contents: prompt,
    config: {
      systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
      temperature: 0.1,
    },
  });

  let translated =
    result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  translated = translated
    .replace(/^```srt\n/, "")
    .replace(/^```\n/, "")
    .replace(/^```/, "")
    .replace(/```$/, "");

  return translated.trim();
};
