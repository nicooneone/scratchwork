// Owner: D. Server-only Gemini client. Append-only after Step 0.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

/** Model ids are configurable. Tested 10 Oct 2026: gemini-2.5-* is closed to new keys (404); gemini-3.8-flash and gemini-flash-latest hang > 40 s on the free tier. */
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";

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

const THINKING = { minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM } as const;

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface JsonCall {
  system: string;
  parts: Part[];
  /** JSON Schema for the response. */
  schema: object;
  /** "minimal" for reading/transcribing, "low" for tutoring and Q&A. */
  thinking?: "minimal" | "low" | "medium";
  temperature?: number;
  timeoutMs?: number;
  /** "fast" tries the Lite model first (reading handwriting, indexing: frequent, simple).
   *  "smart" tries the full model first (hints, Q&A, quizzes: rarer, need more reasoning). */
  prefer?: "fast" | "smart";
}

// After a rate-limit (429) or overload (503), skip that model for a while instead of
// paying for a failed round-trip on every request.
const cooldownUntil = new Map<string, number>();
function noteFailure(model: string, err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  if (msg.includes('"code":429') || msg.includes("RESOURCE_EXHAUSTED")) cooldownUntil.set(model, Date.now() + 60_000);
  else if (msg.includes('"code":503') || msg.includes("UNAVAILABLE")) cooldownUntil.set(model, Date.now() + 15_000);
}

/**
 * Ask Gemini for JSON matching `schema`. Tries MODEL, then FALLBACK_MODEL if the first one
 * fails (rate limit, overload, timeout). Throws only if both fail.
 */
export async function generateJson<T>(call: JsonCall): Promise<{ data: T; model: string; ms: number }> {
  let lastError: unknown;
  const order = call.prefer === "fast" ? [FALLBACK_MODEL, MODEL] : [MODEL, FALLBACK_MODEL];
  // Models cooling down go last (still tried if nothing else works).
  const models = [...order].sort((a, b) => Number((cooldownUntil.get(a) ?? 0) > Date.now()) - Number((cooldownUntil.get(b) ?? 0) > Date.now()));
  for (const model of models) {
    const start = Date.now();
    try {
      const res = await ai().models.generateContent({
        model,
        contents: [{ role: "user", parts: call.parts }],
        config: {
          systemInstruction: call.system,
          responseMimeType: "application/json",
          responseJsonSchema: call.schema,
          temperature: call.temperature ?? 0,
          thinkingConfig: { thinkingLevel: THINKING[call.thinking ?? "minimal"] },
          abortSignal: AbortSignal.timeout(call.timeoutMs ?? 20_000),
        },
      });
      const text = res.text;
      if (!text) throw new Error("Gemini returned an empty response");
      return { data: JSON.parse(text) as T, model, ms: Date.now() - start };
    } catch (err) {
      lastError = err;
      noteFailure(model, err);
      console.warn(`[gemini] ${model} failed after ${Date.now() - start} ms:`, String((err as Error)?.message ?? err).slice(0, 200));
    }
  }
  throw lastError;
}

export const png = (data: string): Part => ({ inlineData: { mimeType: "image/png", data } });
