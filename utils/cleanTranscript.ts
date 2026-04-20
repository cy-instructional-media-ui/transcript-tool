/**
 * cleanTranscript.ts — FINAL
 *
 * Normalizes YouTube transcript text before it reaches Gemini.
 *
 * YouTube transcripts use several timestamp formats depending on the
 * transcript panel UI and copy method:
 *
 *   "0:22"          →  22 seconds        (M:SS)
 *   "1:06"          →  1 min 6 sec       (M:SS)
 *   "1:02:45"       →  1 hr 2 min 45 sec (H:MM:SS)
 *   "0:22\n text"   →  timestamp on its own line
 *   "0:022 seconds" →  the "seconds" label variant (some locales)
 *
 * The critical bug this fixes: "0:22" must be read as M:SS (= 00:00:22),
 * NOT as minutes:milliseconds. Previously the SRT generator was treating
 * the second segment as milliseconds, compressing the entire video into
 * the first few seconds.
 */

// Matches YouTube transcript chapter headings like "Chapter 2: Glycolysis"
const CHAPTER_RE = /^Chapter\s+\d+[:\s].*/i;

// Matches YouTube's "X seconds" / "X minutes, Y seconds" label lines
const LABEL_RE = /^\d+\s+(second|minute|hour)/i;

// Matches inline timestamp formats: "0:22", "1:06", "1:02:45"
// Optionally followed by junk like " seconds" or " secondsas"
const INLINE_TS_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:seconds?.*)?$/i;

/**
 * Convert a YouTube M:SS or H:MM:SS timestamp string into HH:MM:SS,000
 * so the SRT generator receives an unambiguous format.
 */
const normalizeTimestamp = (raw: string): string => {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw;

  const [, a, b, c] = match;

  let h = 0, m = 0, s = 0;

  if (c !== undefined) {
    // H:MM:SS
    h = parseInt(a ?? "0", 10);
    m = parseInt(b ?? "0", 10);
    s = parseInt(c, 10);
  } else {
    // M:SS
    m = parseInt(a ?? "0", 10);
    s = parseInt(b ?? "0", 10);
  }

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");

  return `${hh}:${mm}:${ss},000`;
};

/**
 * Main export. Cleans a raw YouTube transcript paste:
 * - Removes chapter headings
 * - Removes standalone label lines ("22 seconds", "1 minute, 6 seconds")
 * - Normalizes inline timestamps from M:SS → HH:MM:SS,000
 * - Strips leading/trailing whitespace per line
 * - Collapses multiple blank lines
 */
export const cleanTranscript = (raw: string): string => {
  const lines = raw.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Drop empty lines (we'll re-add controlled spacing)
    if (!trimmed) continue;

    // Drop chapter headings
    if (CHAPTER_RE.test(trimmed)) continue;

    // Drop standalone label lines ("22 seconds", "1 minute, 6 seconds")
    if (LABEL_RE.test(trimmed)) continue;

    // Normalize inline timestamps that appear at the start of a line.
    // YouTube often pastes as: "0:22 text continues here"
    // We split timestamp from text and normalize the timestamp portion.
    const inlineMatch = trimmed.match(
      /^(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:seconds?\S*\s*)?(.*)/i
    );

    if (inlineMatch) {
      const [, ts, rest] = inlineMatch;
      const normalizedTs = normalizeTimestamp(ts ?? "");
      const textPart = (rest ?? "").trim();

      if (textPart) {
        cleaned.push(`${normalizedTs} ${textPart}`);
      } else {
        cleaned.push(normalizedTs);
      }
      continue;
    }

    // Plain text line — keep as-is
    cleaned.push(trimmed);
  }

  return cleaned.join("\n");
};
