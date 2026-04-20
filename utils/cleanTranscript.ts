/**
 * cleanTranscript.ts
 *
 * Pre-processes a raw YouTube transcript before sending to Gemini.
 * Removes chapter headings, orphaned timestamps, and other YouTube
 * artifacts that are not spoken words.
 */

const isTimestamp = (line: string): boolean =>
  /^\d{1,2}:\d{2}(:\d{2})?$/.test(line.trim());

const isChapterHeading = (line: string, prevLineWasTimestamp: boolean): boolean => {
  const trimmed = line.trim();
  if (!trimmed || isTimestamp(trimmed)) return false;
  if (prevLineWasTimestamp) return false;
  const words = trimmed.split(/\s+/);
  const titleCaseRatio =
    words.filter((w) => /^[A-Z0-9]/.test(w)).length / words.length;
  return titleCaseRatio >= 0.6;
};

export const cleanTranscript = (raw: string): string => {
  const lines = raw.split("\n");
  const output: string[] = [];
  let prevLineWasTimestamp = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      prevLineWasTimestamp = false;
      continue;
    }

    if (isTimestamp(trimmed)) {
      let nextContentLine = "";
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) {
          nextContentLine = lines[j].trim();
          break;
        }
      }

      if (isTimestamp(nextContentLine)) {
        prevLineWasTimestamp = false;
        continue;
      }

      output.push(trimmed);
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
