import type { VercelRequest, VercelResponse } from "@vercel/node";

const isLikelyNonEnglish = (text: string): boolean => {
  if (!text || text.length < 20) return false;

  const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) || []).length / text.length;

  const commonNonEnglishWords =
    /\b(le|la|les|des|que|qui|est|pas|une|dans|avec|pour|vous|mais|como|para|con|una|las|los|und|der|die|das|nicht|mit|auf)\b/i;

  return nonAsciiRatio > 0.02 || commonNonEnglishWords.test(text);
};

const usageMap = new Map<string, { date: string; count: number }>();
const lastRequestMap = new Map<string, number>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const DAILY_LIMIT = 2;

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "unknown";

  const today = new Date().toDateString();

  // Burst protection (5 seconds between requests)
  const now = Date.now();
  const last = lastRequestMap.get(ip);
  if (last && now - last < 5000) {
    return res.status(429).json({
      error: "Please wait a few seconds before trying again.",
    });
  }
  lastRequestMap.set(ip, now);

  // Daily limit protection
  const record = usageMap.get(ip);

  if (record && record.date === today && record.count >= DAILY_LIMIT) {
    return res.status(429).json({
      error: "Daily limit reached. Please try again tomorrow.",
    });
  }

  if (!record || record.date !== today) {
    usageMap.set(ip, { date: today, count: 1 });
  } else {
    record.count++;
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const { model, contents, config } = req.body;

    // English-only guard
    if (typeof contents === "string" && isLikelyNonEnglish(contents)) {
      return res.status(400).json({
        error: "This tool currently supports English transcripts only.",
      });
    }

    if (!contents) {
      return res.status(400).json({ error: "Missing contents payload" });
    }

    // Hard 10-minute transcript ceiling (~20,000 characters)
    const MAX_CHARS = 45000;

    if (typeof contents === "string" && contents.length > MAX_CHARS) {
      return res.status(413).json({
        error: "Transcript too long. Maximum supported length is 10 minutes (~20,000 characters).",
      });
    }

    const selectedModel = model || "gemini-2.5-flash";

    // Ensure valid Gemini contents format
    const formattedContents = Array.isArray(contents)
      ? contents
      : [
          {
            role: "user",
            parts: [{ text: contents }],
          },
        ];

    // Map SDK-style config to REST API format
    const generationConfig = config
      ? {
          ...(config.temperature !== undefined && {
            temperature: config.temperature,
          }),
          ...(config.responseMimeType && {
            responseMimeType: config.responseMimeType,
          }),
        }
      : undefined;

    const systemInstruction = config?.systemInstruction
      ? {
          role: "system",
          parts: [{ text: config.systemInstruction }],
        }
      : undefined;

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY as string,
        },
        body: JSON.stringify({
          contents: formattedContents,
          ...(generationConfig ? { generationConfig } : {}),
          ...(systemInstruction ? { systemInstruction } : {}),
        }),
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      console.error("Google API error:", data);
      return res.status(googleResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Gemini proxy runtime error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
