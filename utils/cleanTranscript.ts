/**
 * cleanTranscript.ts
 *
 * Pre-processes a raw YouTube transcript before sending to Gemini.
 * Removes chapter headings, orphaned timestamps, and other YouTube
 * artifacts that are not spoken words.
 */

/**
 * Returns true if a line looks like a YouTube timestamp (e.g. "0:11", "1:08", "1:23:45")
 */
const isTimestamp = (line: string): boolean =>
  /^\d{1,2}:\d{2}(:\d{2})?$/.test(line.trim());

/**
 * Returns true if a line looks like a YouTube chapter heading —
 * i.e. plain text that is NOT preceded by a timestamp in the transcript.
 * We detect these as lines that appear directly after another non-timestamp,
 * non-speech line, or at the top level with title-case / no lowercase words.
 *
 * Strategy: a line is treated as a chapter heading if it:
 *   - Is not a timestamp
 *   - Is not empty
 *   - Does not follow a timestamp line (so it has no speech context)
 *   - Consists only of title-cased or all-caps words (typical of chapter labels)
 */
const isChapterHeading = (line: string, prevLineWasTimestamp: boolean): boolean => {
  const trimmed = line.trim();
  if (!trimmed || isTimestamp(trimmed)) return false;

  // If the previous line was a timestamp, this is speech — not a heading
  if (prevLineWasTimestamp) return false;

  // If it looks like all title-case words (each word starts with uppercase or is a number)
  // e.g. "Compatibility Mode Conversion", "The problem", "File Save"
  const words = trimmed.split(/\s+/);
  const titleCaseRatio =
    words.filter((w) => /^[A-Z0-9]/.test(w)).length / words.length;

  return titleCaseRatio >= 0.6;
};

/**
 * Main export. Takes raw YouTube transcript text and returns a cleaned
 * version with chapter headings and artifacts removed.
 */
export const cleanTranscript = (raw: string): string => {
  const lines = raw.split("\n");
  const output: string[] = [];
  let prevLineWasTimestamp = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Always drop empty lines from consideration (we'll re-join cleanly)
    if (!trimmed) {
      prevLineWasTimestamp = false;
      continue;
    }

    if (isTimestamp(trimmed)) {
      // Look ahead: if the very next non-empty line is ALSO a timestamp,
      // this timestamp is orphaned (no speech follows it before the next cue)
      // — skip it to avoid Gemini seeing consecutive timestamps with no text.
      let nextContentLine = "";
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) {
          nextContentLine = lines[j].trim();
          break;
        }
      }

      if (isTimestamp(nextContentLine)) {
        // Orphaned timestamp — skip
        prevLineWasTimestamp = false;
        continue;
      }

      output.push(trimmed);
      prevLineWasTimestamp = true;
    } else if (isChapterHeading(trimmed, prevLineWasTimestamp)) {
      // Chapter heading — drop it
      prevLineWasTimestamp = false;
    } else {
      // Regular speech line
      output.push(trimmed);
      prevLineWasTimestamp = false;
    }
  }

  return output.join("\n");
};
