import { CorrectionMode, SpellingCorrection, SupportedLanguage } from "../types";

const MODEL_NAME = "gemini-2.5-flash";

const BASE_SYSTEM_INSTRUCTION = `
You are a deterministic SRT formatting engine. You follow rules, not preferences.

**CRITICAL: Clean up the ending.**
Transcripts often end with hallucinated garbage like "You.", "Subtitles by...", single orphan words. REMOVE THESE.

====================
CHEMISTRY CONSISTENCY RULES (STRICT)
====================
• Do NOT convert written chemical words into formulas.
• Only convert explicit chemical formulas found in the transcript:
  - CO2 → CO₂, FADH2 → FADH₂, H2O → H₂O
  - NADH must ALWAYS remain exactly "NADH". Never rewrite as NADH₂.
• NEVER infer or guess chemical formulas.

====================
REPETITION RULES
====================
- NO HALLUCINATED REPETITION. Do not duplicate clauses or sentences.
- If two identical back-to-back phrases appear, DELETE ONE.

====================
MERGING RULES (STRICT)
====================
Merge two consecutive buckets into ONE block when ALL are true:
1. Combined text is 50 characters or fewer.
2. No more than 2 lines after merge.
3. First bucket does NOT end in ".", "?", "!".
4. Second bucket continues the same phrase.

====================
LINE FORMAT RULES
====================
- Max 2 lines per block.
- Max 50 characters per line.
- Prefer ONE line whenever possible.
- NEVER leave a trailing orphan word on its own line.
- NEVER start a line with a comma, period, or other punctuation mark.
  If a split would put punctuation at the start of a line, move the
  split point so punctuation stays at the end of the previous line.

====================
CAPITALIZATION RULES
====================
- Only capitalize the first word of a block when it genuinely starts
  a NEW sentence (previous block ended with ".", "?", or "!", or it is
  the very first block).
- Do NOT capitalize the first word of a block that continues a sentence
  mid-stream from the previous block.
- Do NOT change capitalization of any other word.

====================
MUSIC / BRACKET BOUNDARY RULES
====================
- [Music] and other bracketed cues are their own isolated block.
- NEVER merge speech into a [Music] block or vice versa.

====================
TIMING RULES
====================
- Start time of each block MUST match the first timestamp in the bucket.
- Do not move text to earlier timestamps.

====================
OUTPUT
====================
Produce valid SRT:
1
00:00:00,000 --> 00:00:02,000
text line 1
text line 2

(Blank line between blocks)
`;

const TRANSLATION_SYSTEM_INSTRUCTION = `
You are a professional caption translator. Follow these rules:

1. Preserve Scientific Terms Exactly — never alter "NADH", "NAD+", "FADH₂", "ATP", "CO₂", etc.
2. Preserve Subscripts Using Unicode — CO₂, FADH₂, H₂O.
3. Never Add Missing Atoms — don't turn "NADH" into "NADH₂".
4. Maintain Meaning, Not Literal Word Order.
5. Maintain Titles, Music Notes, and Brackets in target language.
6. DO NOT change timing or subtitle numbers.
7. Max 50 characters per line. Max 2 lines per block.
8. Never paraphrase scientific sequences.

OUTPUT FORMAT: Return ONLY the translated SRT. No backticks, no explanations.
`;

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, contents, config }),
  });
  if (!response.ok) throw new Error("Gemini request failed");
  return response.json();
}

export const validateTimestamps = async (text: string): Promise<boolean> => {
  try {
    const result = await callGemini({
      contents: `Analyze the following text. Does it contain timestamps (like 0:00, 01:23, 1:02:45)? 
Reply with strict JSON: { "hasTimestamps": boolean }

Text:
${text.substring(0, 1000)}... (truncated)`,
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return parsed.hasTimestamps === true;
  } catch {
    return /\d{1,2}:\d{2}/.test(text);
  }
};

export const proposeCorrections = async (text: string): Promise<SpellingCorrection[]> => {
  const prompt = `
Analyze this transcript for clear spelling mistakes only.
- Do NOT suggest grammar improvements.
- Do NOT rephrase spoken language.
- Do NOT fix informal speech.
- Only flag obvious typos that are clearly incorrect words.
- If uncertain, do NOT suggest a correction.

Return a JSON array: { original, correction, context, timestamp }

Transcript:
${text}
`;
  try {
    const result = await callGemini({
      contents: prompt,
      config: { temperature: 0.0, responseMimeType: "application/json" },
    });
    const raw = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
    const filtered = raw.filter((c: any) => {
      if (!c.original || !c.correction) return false;
      if (Math.abs(c.original.length - c.correction.length) > 3) return false;
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

export const generateSrt = async (
  text: string,
  mode: CorrectionMode,
  approvedCorrections: SpellingCorrection[] = []
): Promise<string> => {
  let prompt = "";

  if (mode === CorrectionMode.NONE) {
    prompt = `Convert the following transcript into a valid SRT file.

CRITICAL RULES:
- Preserve ALL spoken wording EXACTLY as written. Do not change a single word.
- Do NOT fix spelling, grammar, or punctuation — not even obvious errors.
- Do NOT rephrase, add, or remove any words.
- Only task: format into valid SRT blocks with correct line breaks.
- Only capitalize the first word of a block when it genuinely starts a new sentence.
  Do NOT capitalize mid-sentence continuations from the previous block.
- NEVER start a subtitle line with a punctuation mark.

Transcript:
${text}`;
  } else {
    prompt = `Convert the following transcript into a valid SRT file.

CRITICAL RULES:
- Preserve spoken wording and meaning exactly.
- Do NOT rephrase or rewrite sentences.
- You MAY fix clear spelling errors.
- You MAY add missing terminal punctuation (., ?, !).
- You MAY add minimal commas only when clearly needed.
- Do NOT improve grammar beyond punctuation.
- Only capitalize the first word of a block when it genuinely starts a new sentence.
  Do NOT capitalize mid-sentence continuations from the previous block.
- NEVER start a subtitle line with a punctuation mark.

Transcript:
${text}`;
  }

  const result = await callGemini({
    contents: prompt,
    config: { systemInstruction: BASE_SYSTEM_INSTRUCTION, temperature: 0.0 },
  });

  let cleanText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  cleanText = cleanText
    .replace(/^```srt\n/, "").replace(/^```\n/, "")
    .replace(/^```/, "").replace(/```$/, "");

  return normalizeSrtTiming(cleanText.trim());
};

export const translateSrt = async (
  srtContent: string,
  targetLanguage: SupportedLanguage
): Promise<string> => {
  const result = await callGemini({
    contents: `Translate this transcript into ${targetLanguage}:\n\n${srtContent}`,
    config: { systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION, temperature: 0.1 },
  });

  let translated = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  translated = translated
    .replace(/^```srt\n/, "").replace(/^```\n/, "")
    .replace(/^```/, "").replace(/```$/, "");

  return translated.trim();
};

/* ================================
   SRT Timing Normalization
   Pass 1 — MERGE incomplete blocks forward
   Pass 2 — ABSORB orphan fragments backward
   Pass 3 — ENFORCE minimum display duration
   Pass 4 — RESOLVE overlaps (never shift start times)
================================ */

type SrtBlock = {
  index: number;
  start: number;
  end: number;
  text: string[];
};

const parseTime = (time: string): number => {
  const [hms, msPart] = time.trim().split(",");
  const parts = hms.split(":").map(Number);
  const ms = parseInt(msPart || "0", 10);
  if (parts.length === 3)
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0) + ms / 1000;
  if (parts.length === 2)
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + ms / 1000;
  return 0;
};

const formatTime = (totalSeconds: number): string => {
  const c = Math.max(0, totalSeconds);
  const h = Math.floor(c / 3600);
  const m = Math.floor((c % 3600) / 60);
  const s = Math.floor(c % 60);
  const ms = Math.round((c - Math.floor(c)) * 1000);
  return (
    String(h).padStart(2, "0") + ":" +
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0") + "," +
    String(ms).padStart(3, "0")
  );
};

const parseSrt = (srt: string): SrtBlock[] => {
  const parsed: SrtBlock[] = [];
  for (const block of srt.split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const index = parseInt(lines[0] ?? "", 10);
    if (isNaN(index)) continue;
    const timingLine = lines[1] ?? "";
    const arrowIdx = timingLine.indexOf(" --> ");
    if (arrowIdx === -1) continue;
    const start = parseTime(timingLine.slice(0, arrowIdx));
    const end = parseTime(timingLine.slice(arrowIdx + 5));
    if (isNaN(start) || isNaN(end) || end <= start) continue;
    parsed.push({ index, start, end, text: lines.slice(2) });
  }
  return parsed.sort((a, b) => a.start - b.start);
};

const splitIntoLines = (text: string): string[] => {
  const MAX = 50;
  if (text.length <= MAX) return [text];

  const mid = Math.floor(text.length / 2);
  for (let r = 0; r < mid; r++) {
    for (const dir of [1, -1]) {
      const pos = mid + dir * r;
      if (pos <= 0 || pos >= text.length) continue;
      if (text[pos] === " ") {
        const l1 = text.slice(0, pos).trimEnd();
        const l2 = text.slice(pos + 1).trimStart();
        if (/^[.,;:!?]/.test(l2)) continue;
        if (l1.length <= MAX && l2.length <= MAX) return [l1, l2];
      }
    }
  }
  const lastSpace = text.lastIndexOf(" ", MAX);
  if (lastSpace > 0) return [text.slice(0, lastSpace), text.slice(lastSpace + 1)];
  return [text.slice(0, MAX), text.slice(MAX).trim()];
};

const serializeSrt = (blocks: SrtBlock[]): string =>
  blocks.map((b, idx) => {
    const raw = b.text.join(" ").trim();
    const lines = splitIntoLines(raw);
    const final = lines.length > 2 ? [lines[0]!, lines.slice(1).join(" ")] : lines;
    return `${idx + 1}\n${formatTime(b.start)} --> ${formatTime(b.end)}\n${final.join("\n")}`;
  }).join("\n\n");

const BRACKET_RE = /^\[.*\]$/;
const isBracket = (b: SrtBlock) => BRACKET_RE.test(b.text.join(" ").trim());
const endsTerminal = (b: SrtBlock) => /[.?!]$/.test(b.text.join(" ").trim());
const wc = (b: SrtBlock) => b.text.join(" ").trim().split(/\s+/).length;

const mergePass = (blocks: SrtBlock[]): SrtBlock[] => {
  let i = 0;
  while (i < blocks.length - 1) {
    const cur = blocks[i]!;
    const nxt = blocks[i + 1]!;
    if (isBracket(cur) || isBracket(nxt) || endsTerminal(cur)) { i++; continue; }
    const combined = `${cur.text.join(" ").trim()} ${nxt.text.join(" ").trim()}`;
    const dur = nxt.end - cur.start;
    if (dur <= 0) { i++; continue; }
    if (combined.length <= 90 && combined.length / dur <= 17) {
      cur.text = [combined]; cur.end = nxt.end;
      blocks.splice(i + 1, 1);
    } else { i++; }
  }
  return blocks;
};

const orphanPass = (blocks: SrtBlock[]): SrtBlock[] => {
  let i = 1;
  while (i < blocks.length) {
    const cur = blocks[i]!;
    const prev = blocks[i - 1]!;
    if (isBracket(cur) || isBracket(prev) || wc(cur) >= 4) { i++; continue; }
    const combined = `${prev.text.join(" ").trim()} ${cur.text.join(" ").trim()}`;
    const dur = cur.end - prev.start;
    if (dur <= 0) { i++; continue; }
    if (combined.length <= 100 && combined.length / dur <= 18) {
      prev.text = [combined]; prev.end = cur.end;
      blocks.splice(i, 1);
    } else { i++; }
  }
  return blocks;
};

const durationPass = (blocks: SrtBlock[]): SrtBlock[] => {
  for (const b of blocks) {
    if (isBracket(b)) continue;
    const needed = Math.max(1.5, 2.0, b.text.join(" ").length / 15);
    if (b.end - b.start < needed) b.end = b.start + needed;
  }
  return blocks;
};

const overlapPass = (blocks: SrtBlock[]): SrtBlock[] => {
  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i]!;
    const nxt = blocks[i + 1]!;
    if (cur.end >= nxt.start) {
      const clipped = nxt.start - 0.001;
      cur.end = clipped - cur.start >= 0.5 ? clipped : nxt.start - 0.001;
    }
  }
  return blocks;
};

const normalizeSrtTiming = (srt: string): string => {
  let blocks = parseSrt(srt);
  if (blocks.length === 0) return srt;
  blocks = mergePass(blocks);
  blocks = orphanPass(blocks);
  blocks = durationPass(blocks);
  blocks = overlapPass(blocks);
  return serializeSrt(blocks);
};
