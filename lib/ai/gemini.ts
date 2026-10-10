// Owner: D. Server-only Gemini client. Append-only after Step 0.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

/** Model ids are configurable. Tested 10 Oct 2026: gemini-2.5-* is closed to new keys (404); gemini-3.8-flash and gemini-flash-latest hang > 40 s on the free tier. */
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";

// GEMINI_API_KEY may hold several keys separated by commas (e.g. one free key per teammate).
// Free-tier quotas are per key, so when one key runs out the next request uses another.
let clients: GoogleGenAI[] | null = null;

function allClients(): GoogleGenAI[] {
  if (!clients) {
    const keys = (process.env.GEMINI_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean);
    if (!keys.length) throw new Error("GEMINI_API_KEY is not set (add it to .env.local)");
    clients = keys.map((apiKey) => new GoogleGenAI({ apiKey }));
  }
  return clients;
}

/** How many Gemini keys are configured (shown on /api/health). */
export function keyCount(): number {
  try {
    return allClients().length;
  } catch {
    return 0;
  }
}

/** Created lazily so `next build` works without a key. Throws if the key is missing at request time. */
export function ai(keyIndex = 0): GoogleGenAI {
  const all = allClients();
  return all[keyIndex % all.length];
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

// After a failure, skip that key+model for a while instead of paying for a failed round-trip on
// every request. A quota error (429) belongs to one key; an overload (503) or timeout is the
// model's, so it cools the model on every key.
const cooldownUntil = new Map<string, number>();
const cooled = (key: number, model: string) =>
  Math.max(cooldownUntil.get(`${key}|${model}`) ?? 0, cooldownUntil.get(`*|${model}`) ?? 0, cooldownUntil.get(`${key}|*`) ?? 0) > Date.now();
function noteFailure(key: number, model: string, err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  const name = (err as Error)?.name ?? "";
  // A mistyped or revoked key is useless for every model: skip it for 10 minutes.
  if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || msg.includes('"code":403')) cooldownUntil.set(`${key}|*`, Date.now() + 600_000);
  else if (msg.includes('"code":429') || msg.includes("RESOURCE_EXHAUSTED")) cooldownUntil.set(`${key}|${model}`, Date.now() + 60_000);
  else if (msg.includes('"code":503') || msg.includes("UNAVAILABLE") || name === "TimeoutError" || name === "AbortError")
    cooldownUntil.set(`*|${model}`, Date.now() + 15_000);
}

const MAX_ATTEMPTS = 4; // keeps the worst case bounded when everything is failing

/**
 * Ask Gemini for JSON matching `schema`. Tries the preferred model on every key, then the other
 * model, skipping key+model pairs that are cooling down (they go last, still tried if nothing else
 * works). Throws only if every attempt fails.
 */
export async function generateJson<T>(call: JsonCall): Promise<{ data: T; model: string; ms: number }> {
  let lastError: unknown;
  const order = call.prefer === "fast" ? [FALLBACK_MODEL, MODEL] : [MODEL, FALLBACK_MODEL];
  const keys = allClients().map((_, i) => i);
  const pairs = order.flatMap((model) => keys.map((key) => ({ key, model })));
  const attempts = [...pairs.filter((p) => !cooled(p.key, p.model)), ...pairs.filter((p) => cooled(p.key, p.model))].slice(0, MAX_ATTEMPTS);
  for (const { key, model } of attempts) {
    const start = Date.now();
    try {
      const res = await ai(key).models.generateContent({
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
      noteFailure(key, model, err);
      console.warn(`[gemini] ${model} (key ${key + 1}/${keys.length}) failed after ${Date.now() - start} ms:`, String((err as Error)?.message ?? err).slice(0, 200));
    }
  }
  throw lastError;
}

export const png = (data: string): Part => ({ inlineData: { mimeType: "image/png", data } });
