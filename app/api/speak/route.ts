// Owner: D. POST { text } → audio/mpeg from ElevenLabs. STUB until Step 4:
// the client falls back to the browser's built-in speechSynthesis on 501.
export const maxDuration = 30;

export async function POST() {
  return Response.json({ error: "Voice isn't set up yet" }, { status: 501 });
}
