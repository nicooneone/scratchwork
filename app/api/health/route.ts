// Owner: D. GET /api/health — is the AI wired up on THIS deployment?
// Shows which keys are set (never their values) and live-pings both providers, so a "503 from
// the tutor" can be diagnosed from a phone in ten seconds instead of guessing at Vercel settings.
import { FALLBACK_MODEL, MODEL, ai } from "@/lib/ai/gemini";

export const maxDuration = 30;

const snip = (s: unknown) => String(s).replace(/[A-Za-z0-9_.-]{24,}/g, "…").slice(0, 160); // strips anything key-shaped

async function pingGemini(model: string) {
  const t = Date.now();
  try {
    const r = await ai().models.generateContent({ model, contents: "Reply with exactly: ok", config: { abortSignal: AbortSignal.timeout(12_000) } });
    return { ok: (r.text ?? "").trim().toLowerCase().startsWith("ok"), ms: Date.now() - t };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: snip((e as Error)?.message ?? e) };
  }
}

async function pingElevenLabs() {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return { ok: false, error: "key or voice id not set" };
  const t = Date.now();
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_22050_32`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: "ok", model_id: "eleven_flash_v2_5" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (r.ok) return { ok: true, ms: Date.now() - t };
    return { ok: false, ms: Date.now() - t, status: r.status, error: snip(await r.text()) };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: snip((e as Error)?.message ?? e) };
  }
}

export async function GET() {
  const [gemini, geminiFallback, elevenlabs] = await Promise.all([pingGemini(MODEL), pingGemini(FALLBACK_MODEL), pingElevenLabs()]);
  const body = {
    env: {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
      ELEVENLABS_VOICE_ID: !!process.env.ELEVENLABS_VOICE_ID,
      GEMINI_MODEL: MODEL,
      GEMINI_FALLBACK_MODEL: FALLBACK_MODEL,
    },
    gemini: { [MODEL]: gemini, [FALLBACK_MODEL]: geminiFallback },
    elevenlabs,
    // What the app will actually do right now:
    liveCheck: gemini.ok || geminiFallback.ok ? "working" : "DOWN — Live Check, Ask, Quiz and hints will fail",
    voice: elevenlabs.ok ? "ElevenLabs" : "falling back to the device voice (speechSynthesis)",
    checkedAt: new Date().toISOString(),
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
