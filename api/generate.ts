import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log("ENV KEY EXISTS:", !!process.env.GEMINI_API_KEY);

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

    const selectedModel = model || "gemini-2.5-flash";

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents,
          ...(config ? { config } : {}),
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
