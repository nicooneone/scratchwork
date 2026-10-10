// Owner: D. Server-only Gemini client. Append-only after Step 0.
import { GoogleGenAI } from "@google/genai";

/** Model ids are configurable so we can switch if one is rate-limited. Check AI Studio for the latest Flash. */
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite";

let client: GoogleGenAI | null = null;

/** Created lazily so `next build` works without a key. Throws if the key is missing at request time. */
export function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set (add it to .env.local)");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
