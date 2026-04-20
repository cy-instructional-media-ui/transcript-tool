import { CorrectionMode, SpellingCorrection, SupportedLanguage } from "../types";

const MODEL_NAME = "gemini-2.5-flash";

/* ================================
   SYSTEM INSTRUCTIONS
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
CAPITALIZATION RULES
====================
- The **first word of every subtitle block** MUST be capitalized.
- Do NOT change the capitalization of any other word in the block.
- This applies even when the source transcript is all-lowercase.

====================
MUSIC / BRACKET BOUNDARY RULES
====================
- [Music] and other bracketed cues (e.g. [Applause]) are their own isolated block.
- NEVER merge a speech line into a [Music] block or vice versa.
- If a sentence is interrupted by [Music], keep the speech BEFORE [Music] in its own block
  and any speech that resumes AFTER [Music] in its own separate block.
- The word immediately following a [Music] block starts a NEW subtitle block —
  do NOT attach it to the end of the [Music] block.

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
"NADH", "NAD+", "FADH₂", "ATP", "ADP", "CO₂", "acetyl-CoA", "oxaloacetate", "citric acid", etc.
Never alter or "improve" these terms.
Preserve capitalization.

2. Preserve Subscripts Using Unicode
H₂ → use ₂
CO₂ → CO₂
FADH₂ → FADH₂

3. Never Add Missing Atoms
❌ Don't turn "NADH" → "NADH₂"
❌ Don't turn "CO₂" → "carbon CO₂" unless explicitly written.

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

export const proposeCorrections = async (text: string): Promise<SpellingCorrection[]> => {
  const prompt = `
Analyze this transcript for clear spelling mistakes only.

CRITICAL:
- Do NOT suggest grammar improvements.
- Do NOT rephrase spoken language.
- Do NOT fix informal speech.
- Only flag obvious typos that are clearly incorrect words.
- If uncertain, do NOT suggest a correction.

Return a JSON array with objects:
{ original, correction, context, timestamp }

Transcript:
${text}
`;

  try {
    const result = await callGemini({
      contents: prompt,
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
      },
    });

    const raw = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "[]");

    const filtered = raw.filter((c: any) => {
      if (!c.original || !c.correction) return false;
      const distance = Math.abs(c.original.length - c.correction.length);
      if (distance > 3) return false;
      return true;
    });

    return filtered.map((c: any, index: number) => ({
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
  let prompt = "";

  if (mode === CorrectionMode.NONE) {
    prompt = `Convert the following transcript into a valid SRT file.

CRITICAL RULES:
- Preserve spoken wording exactly as written.
- Do NOT change punctuation.
- Do NOT rephrase sentences.
- Only format into valid SRT structure.
- Only adjust line breaks and merging for readability.
- Do NOT alter timestamps.
- Capitalize the first word of every subtitle block (see system instructions).

Transcript:
${text}`;
  } else {
    prompt = `Convert the following transcript into a valid SRT file.

CRITICAL RULES:
- Preserve spoken wording exactly as written.
- Do NOT rephrase sentences.
- Do NOT rewrite wording.
- Do NOT change meaning.
- You MAY add missing terminal punctuation (., ?, !).
- You MAY add minimal commas only when clearly needed.
- Do NOT improve grammar beyond punctuation.
- Only format into valid SRT structure.
- Only adjust line breaks and merging for readability.
- Do NOT alter timestamps.
- Capitalize the first word of every subtitle block (see system instructions).

Transcript:
${text}`;
  }

  const result = await callGemini({
    contents: prompt,
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION,
      temperature: 0.0,
    },
  });

  let cleanText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  cleanText = cleanText
    .replace(/^```srt\n/, "")
    .replace(/^```\n/, "")
    .replace(/^```/, "")
    .replace(/```$/, "");

  return normalizeSrtTiming(cleanText.trim());
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

  let translated = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  translated = translated
    .replace(/^```srt\n/, "")
    .replace(/^```\n/, "")
    .replace(/^```/, "")
    .replace(/```$/, "");

  return translated.trim();
};

/* ================================
   SRT Timing Normalization
   
   Architecture: Three strict, ordered passes.
   
   Pass 1 — MERGE: Combine short/incomplete blocks into readable units.
             Never touch timestamps here — only collapse text.
   Pass 2 — ENFORCE MINIMUMS: Expand blocks that are too short to read,
             working only forward from each block's own start time.
   Pass 3 — RESOLVE OVERLAPS: Walk forward in order, clipping any block
             whose end exceeds the next block's start. Drift-free by design
             since we never shift start times.
================================ */

type SrtBlock = {
  index: number;
  start: number;  // seconds (float)
  end: number;    // seconds (float)
  text: string[];
};

/* -------- Time helpers -------- */

const parseTime = (time: string): number => {
  // Accepts "HH:MM:SS,mmm" or "MM:SS,mmm"
  const [hms, msPart] = time.trim().split(",");
  const parts = hms.split(":").map(Number);
  const ms = parseInt(msPart || "0", 10);

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0) + ms / 1000;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return (m ?? 0) * 60 + (s ?? 0) + ms / 1000;
  }
  return 0;
};

const formatTime = (totalSeconds: number): string => {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);

  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "," +
    String(ms).padStart(3, "0")
  );
};

/* -------- Parser -------- */

const parseSrt = (srt: string): SrtBlock[] => {
  const blocks = srt.split(/\n\s*\n/);
  const parsed: SrtBlock[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const firstLine = lines[0] ?? "";
    const timingLine = lines[1] ?? "";
    const index = parseInt(firstLine, 10);
    if (isNaN(index)) continue;

    const arrowIdx = timingLine.indexOf(" --> ");
    if (arrowIdx === -1) continue;

    const startStr = timingLine.slice(0, arrowIdx);
    const endStr = timingLine.slice(arrowIdx + 5);
    const start = parseTime(startStr);
    const end = parseTime(endStr);

    if (isNaN(start) || isNaN(end) || end <= start) continue;

    parsed.push({
      index,
      start,
      end,
      text: lines.slice(2),
    });
  }

  // Sort by start time — defensive guard against out-of-order LLM output
  return parsed.sort((a, b) => a.start - b.start);
};

/* -------- Serializer -------- */

const serializeSrt = (blocks: SrtBlock[]): string =>
  blocks
    .map((b, idx) => {
      const timing = `${formatTime(b.start)} --> ${formatTime(b.end)}`;
      return `${idx + 1}\n${timing}\n${b.text.join("\n")}`;
    })
    .join("\n\n");

/* -------- Pass 1: Merge short / incomplete blocks -------- */

const BRACKET_RE = /^\[.*\]$/;

const isBracket = (block: SrtBlock): boolean =>
  BRACKET_RE.test(block.text.join(" ").trim());

const endsWithTerminalPunctuation = (block: SrtBlock): boolean =>
  /[.?!]$/.test(block.text.join(" ").trim());

const mergePass = (blocks: SrtBlock[]): SrtBlock[] => {
  // Thresholds
  const MAX_COMBINED_CHARS = 90;
  const MAX_MERGE_CPS = 17;

  let i = 0;
  while (i < blocks.length - 1) {
    const current = blocks[i]!;
    const next = blocks[i + 1]!;

    // Never merge across bracket boundaries
    if (isBracket(current) || isBracket(next)) {
      i++;
      continue;
    }

    // Don't merge over a sentence boundary
    if (endsWithTerminalPunctuation(current)) {
      i++;
      continue;
    }

    const currentText = current.text.join(" ").trim();
    const nextText = next.text.join(" ").trim();
    const combinedText = `${currentText} ${nextText}`;
    const combinedDuration = next.end - current.start;

    // Guard against degenerate durations
    if (combinedDuration <= 0) {
      i++;
      continue;
    }

    const combinedCps = combinedText.length / combinedDuration;

    if (
      combinedText.length <= MAX_COMBINED_CHARS &&
      combinedCps <= MAX_MERGE_CPS
    ) {
      current.text = [combinedText];
      current.end = next.end;
      blocks.splice(i + 1, 1);
      // Re-examine current block — maybe it can absorb the new next too
    } else {
      i++;
    }
  }

  return blocks;
};

/* -------- Pass 2: Enforce minimum duration and readable CPS -------- */

const durationPass = (blocks: SrtBlock[]): SrtBlock[] => {
  const MIN_DURATION = 1.5;   // seconds — absolute floor
  const MIN_DISPLAY = 2.0;    // seconds — comfortable reading minimum
  const MAX_CPS = 15;         // characters per second ceiling

  for (const block of blocks) {
    if (isBracket(block)) continue;

    const charCount = block.text.join(" ").length;
    const rawDuration = block.end - block.start;

    // How long does this block actually need?
    const neededForCps = charCount / MAX_CPS;
    const needed = Math.max(MIN_DURATION, MIN_DISPLAY, neededForCps);

    if (rawDuration < needed) {
      // Extend end — never touch start
      block.end = block.start + needed;
    }
  }

  return blocks;
};

/* -------- Pass 3: Resolve overlaps (forward-only, no drift) -------- */

const overlapPass = (blocks: SrtBlock[]): SrtBlock[] => {
  const MIN_GAP = 0.001; // 1 ms — blocks must not touch exactly

  for (let i = 0; i < blocks.length - 1; i++) {
    const current = blocks[i]!;
    const next = blocks[i + 1]!;

    if (current.end >= next.start) {
      // Clip current's end to just before next starts.
      // Never move current.start or next.start — that's what kills drift.
      const clipped = next.start - MIN_GAP;

      // Only apply clip if it still leaves a visible block (>= 0.5s)
      if (clipped - current.start >= 0.5) {
        current.end = clipped;
      } else {
        // Block is too short to salvage; collapse it forward
        current.end = next.start - MIN_GAP;
      }
    }
  }

  return blocks;
};

/* -------- Main entry point -------- */

const normalizeSrtTiming = (srt: string): string => {
  let blocks = parseSrt(srt);
  if (blocks.length === 0) return srt; // Nothing parseable — return as-is

  blocks = mergePass(blocks);
  blocks = durationPass(blocks);
  blocks = overlapPass(blocks);

  return serializeSrt(blocks);
};
