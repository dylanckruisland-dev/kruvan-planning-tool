/**
 * AI content ideation via Google Gemini. Set `GEMINI_API_KEY` in the Convex dashboard
 * (Settings → Environment Variables) for this deployment. Key: https://aistudio.google.com/apikey
 */
declare const process: { env: Record<string, string | undefined> };

import { action } from "./_generated/server";
import { v } from "convex/values";

const MAX_FIELD = 800;
/** https://ai.google.dev/gemini-api/docs/models — 1.5/2.0 names are deprecated/removed; use current Flash. */
const GEMINI_MODEL = "gemini-2.5-flash";

type Idea = { title: string; notes: string };

function trimField(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function parseIdeasJson(text: string): Idea[] {
  const trimmed = text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid AI response shape.");
  }
  const ideas = (parsed as { ideas?: unknown }).ideas;
  if (!Array.isArray(ideas)) {
    throw new Error("AI response missing ideas array.");
  }
  const out: Idea[] = [];
  for (const item of ideas) {
    if (!item || typeof item !== "object") continue;
    const title = typeof (item as { title?: unknown }).title === "string"
      ? (item as { title: string }).title.trim()
      : "";
    const notes = typeof (item as { notes?: unknown }).notes === "string"
      ? (item as { notes: string }).notes.trim()
      : "";
    if (!title) continue;
    out.push({
      title: title.slice(0, 200),
      notes: notes.slice(0, 4000),
    });
    if (out.length >= 12) break;
  }
  if (out.length === 0) {
    throw new Error("No usable ideas in the AI response.");
  }
  return out;
}

function formatGeminiHttpError(status: number, apiMessage: string): string {
  const m = apiMessage.toLowerCase();
  if (
    m.includes("quota") ||
    m.includes("resource_exhausted") ||
    m.includes("billing") ||
    m.includes("exceeded")
  ) {
    const hint =
      m.includes("limit: 0") || m.includes("free_tier")
        ? " Tip: zet in Google Cloud / AI Studio billing aan of wacht tot je quotum vernieuwt; sommige modellen hebben geen gratis quotum meer."
        : "";
    return (
      "Gemini-limiet of tegoed bereikt. Controleer quota in Google AI Studio (ai.dev/rate-limit)." +
      hint +
      " (Details: " +
      apiMessage +
      ")"
    );
  }
  // Do not use m.includes("rate") — it matches "gene**rate**Content".
  if (
    status === 429 ||
    m.includes("rate limit") ||
    m.includes("rate_limit") ||
    m.includes("too many requests")
  ) {
    return (
      "Te veel Gemini-verzoeken. Probeer het over een paar minuten opnieuw. (" +
      apiMessage +
      ")"
    );
  }
  if (m.includes("not found") || m.includes("not supported for generatecontent")) {
    return (
      "Dit Gemini-model bestaat niet meer of is niet beschikbaar voor je key. " +
      "Controleer ai.google.dev/api/models — model in de code: " +
      GEMINI_MODEL +
      ". (" +
      apiMessage +
      ")"
    );
  }
  if (
    m.includes("api key") ||
    m.includes("permission") ||
    m.includes("invalid") ||
    status === 401 ||
    status === 403
  ) {
    return (
      "Ongeldige of ontbrekende Gemini API-key. Controleer GEMINI_API_KEY in Convex. (" +
      apiMessage +
      ")"
    );
  }
  return apiMessage;
}

function extractGeminiText(data: {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}): string {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("Geen antwoord van Gemini (geen candidates).");
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(
      `Gemini stopte vroeg (${candidate.finishReason}). Probeer andere invoer.`,
    );
  }
  const parts = candidate.content?.parts;
  const text = parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Leeg antwoord van Gemini.");
  }
  return text;
}

/** Generate social content ideas via Google Gemini. Requires GEMINI_API_KEY in Convex env. */
export const generateContentIdeas = action({
  args: {
    businessType: v.string(),
    contentFocus: v.string(),
    background: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error(
        "Gemini is niet geconfigureerd. Zet GEMINI_API_KEY voor deze deployment (Convex dashboard → Environment Variables), of: npx convex env set GEMINI_API_KEY '…' — key: https://aistudio.google.com/apikey",
      );
    }

    const businessType = trimField(args.businessType, MAX_FIELD);
    const contentFocus = trimField(args.contentFocus, MAX_FIELD);
    const background = trimField(args.background, MAX_FIELD);

    if (!businessType || !contentFocus) {
      throw new Error("Business type and content focus are required.");
    }

    const userPrompt = `You are a social media content strategist.

Business / industry:
${businessType}

Type of content to create:
${contentFocus}

Background and context (audience, brand voice, constraints):
${background || "(none)"}

Return a JSON object with this exact shape:
{"ideas":[{"title":"short working title for one post idea","notes":"1-3 sentences: hook, angle, or caption direction"}]}

Rules:
- Provide between 5 and 8 ideas in the "ideas" array.
- Titles must be distinct and specific.
- Write in the same language as the user input when possible.
- Output ONLY valid JSON, no markdown or explanation outside the JSON.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You reply only with a single JSON object matching the user’s requested schema.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    });

    const raw = await res.text();
    let data: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      error?: { message?: string; code?: number; status?: string };
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error(`Gemini response was not JSON (${res.status}).`);
    }

    if (!res.ok) {
      const msg =
        data.error?.message ??
        (raw.length < 400 ? raw : `HTTP ${res.status}`);
      throw new Error(formatGeminiHttpError(res.status, msg));
    }

    const content = extractGeminiText(data);
    const ideas = parseIdeasJson(content);
    return { ideas };
  },
});
