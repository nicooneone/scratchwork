// Owner: D. POST { text } → audio/mpeg spoken by the ElevenLabs tutor voice.
// The browser plays it; on any error the client falls back to the built-in speechSynthesis.
import { badRequest } from "@/lib/ai/respond";

export const maxDuration = 30;

const MAX_CHARS = 300; // hints are short; this also caps credit use
const cache = new Map<string, ArrayBuffer>(); // per server instance; repeated demo hints are instant

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return badRequest("Send { text }.");
  if (text.length > MAX_CHARS) return badRequest(`Text is limited to ${MAX_CHARS} characters.`);

  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return Response.json({ error: "Voice isn't configured" }, { status: 501 });

  const headers = { "content-type": "audio/mpeg", "cache-control": "no-store" };
  const hit = cache.get(text);
  if (hit) return new Response(hit, { headers });

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("[speak] ElevenLabs", res.status, (await res.text()).slice(0, 200));
      return Response.json({ error: "Voice is unavailable right now" }, { status: 502 });
    }
    const audio = await res.arrayBuffer();
    if (cache.size > 100) cache.clear();
    cache.set(text, audio);
    return new Response(audio, { headers });
  } catch (err) {
    console.error("[speak] failed:", err);
    return Response.json({ error: "Voice is unavailable right now" }, { status: 502 });
  }
}
