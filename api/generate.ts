import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const { model, contents, config } = req.body;

    if (!contents) {
      return res.status(400).json({ error: "Missing contents payload" });
    }

    // Hard 10-minute transcript ceiling (~20,000 characters)
    const MAX_CHARS = 20000;

    if (typeof contents === "string" && contents.length > MAX_CHARS) {
      return res.status(413).json({
        error:
          "Transcript too long. Maximum supported length is 10 minutes (~20,000 characters).",
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
