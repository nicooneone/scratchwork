// Owner: D. Client-side voice helpers. STUB: browser speech only until Step 4 wires ElevenLabs.
"use client";

/** Speak text aloud. Must be started from a user tap on iPad Safari (see plan Step 5.4). */
export async function speak(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
