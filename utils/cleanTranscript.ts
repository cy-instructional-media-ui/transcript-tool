/**
 * cleanTranscript.ts
 *
 * Pre-processes a raw YouTube transcript before sending to Gemini.
 *
 * YouTube's transcript panel produces two distinct formats:
 *
 * FORMAT A — Separate lines (standard copy):
 *   0:22
 *   some spoken text here
 *
 * FORMAT B — Fused lines (some browsers / locales):
 *   0:00Johnny Somali went from being...
 *   0:088 secondshim. The max penalty...
 *   1:061 minute, 6 secondsatoms from...
 *
 * Both are normalized to: "00:MM:SS,000 text"
 */

/* -------- Format B: fused lines -------- */

const FUSED_RE =
  /^(\d{1,2}):(\d{2})\d*\s*(?:\d+\s*(?:minute|hour)s?,?\s*)?(?:\d+\s*)?seconds?\s*(.*)/i;

const isFusedLine = (line: string): boolean => FUSED_RE.test(line.trim());

const parseFusedLine = (line: string): { ts: string; text: string } | null => {
  const m = line.trim().match(FUSED_RE);
  if (!m) return null;
  const [, mins, secs, rest] = m;
  const mm = String(parseInt(mins ?? "0", 10)).padStart(2, "0");
  const ss = String(parseInt(secs ?? "0", 10)).padStart(2, "0");
  return { ts: `00:${mm}:${ss},000`, text: (rest ?? "").trim() };
};

/* -------- Format A: separate lines -------- */

const STANDALONE_TS_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;

const isStandaloneTimestamp = (line: string): boolean =>
  STANDALONE_TS_RE.test(line.trim());

const normalizeStandaloneTimestamp = (ts: string): string => {
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (
      String(parseInt(h ?? "0", 10)).padStart(2, "0") + ":" +
      String(parseInt(m ?? "0", 10)).padStart(2, "0") + ":" +
      String(parseInt(s ?? "0", 10)).padStart(2, "0") + ",000"
    );
  }
  const [m, s] = parts;
  return (
    "00:" +
    String(parseInt(m ?? "0", 10)).padStart(2, "0") + ":" +
    String(parseInt(s ?? "0", 10)).padStart(2, "0") + ",000"
  );
};

/* -------- Chapter heading detection -------- */

const CHAPTER_RE = /^Chapter\s+\d+[:\s]/i;

const isChapterHeading = (line: string, prevLineWasTimestamp: boolean): boolean => {
  const trimmed = line.trim();
  if (!trimmed || isStandaloneTimestamp(trimmed)) return false;
  if (prevLineWasTimestamp) return false;
  if (CHAPTER_RE.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  const titleCaseRatio =
    words.filter((w) => /^[A-Z0-9]/.test(w)).length / words.length;
  return titleCaseRatio >= 0.6 && words.length <= 8;
};

/* -------- Main export -------- */

export const cleanTranscript = (raw: string): string => {
  const lines = raw.split("\n");

  // Auto-detect format by sampling first 10 non-empty lines
  const nonEmpty = lines.filter((l) => l.trim()).slice(0, 10);
  const fusedCount = nonEmpty.filter((l) => isFusedLine(l)).length;
  const isFusedFormat = fusedCount >= Math.ceil(nonEmpty.length * 0.5);

  return isFusedFormat
    ? cleanFusedFormat(lines)
    : cleanSeparateFormat(lines);
};

/* -------- Format B cleaner -------- */

const cleanFusedFormat = (lines: string[]): string => {
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (CHAPTER_RE.test(trimmed)) continue;

    const parsed = parseFusedLine(trimmed);
    if (parsed) {
      output.push(parsed.text ? `${parsed.ts} ${parsed.text}` : parsed.ts);
    } else {
      output.push(trimmed);
    }
  }

  return output.join("\n");
};

/* -------- Format A cleaner -------- */

const cleanSeparateFormat = (lines: string[]): string => {
  const output: string[] = [];
  let prevLineWasTimestamp = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? "").trim();
    if (!trimmed) { prevLineWasTimestamp = false; continue; }

    if (isStandaloneTimestamp(trimmed)) {
      // Skip orphaned timestamps (two timestamps in a row with no text)
      let nextContentLine = "";
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j]?.trim()) { nextContentLine = lines[j]!.trim(); break; }
      }
      if (isStandaloneTimestamp(nextContentLine)) { prevLineWasTimestamp = false; continue; }
      output.push(normalizeStandaloneTimestamp(trimmed));
      prevLineWasTimestamp = true;
    } else if (isChapterHeading(trimmed, prevLineWasTimestamp)) {
      prevLineWasTimestamp = false;
    } else {
      output.push(trimmed);
      prevLineWasTimestamp = false;
    }
  }

  return output.join("\n");
};
