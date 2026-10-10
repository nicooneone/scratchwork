"use client";
// Owner: D. Tutor voice in the browser.
//
// iPad Safari only plays audio that starts inside a user tap. So call `unlockAudio()`
// SYNCHRONOUSLY at the start of the tap handler (before any await), then `speak()` later.

let player: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

// 0.1 s of silence (WAV), used to unlock the audio element during a tap.
const SILENCE =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

/** Call synchronously in a tap/click handler, before any `await`. */
export function unlockAudio(): void {
  const p = getPlayer();
  p.src = SILENCE;
  p.play().catch(() => {});
}

/** Stop whatever the tutor is saying. */
export function stopSpeaking(): void {
  player?.pause();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/**
 * Speak `text` with the ElevenLabs tutor voice; falls back to the device voice if that fails.
 * Resolves when playback has started (not when it ends).
 */
export async function speak(text: string, opts: { device?: boolean } = {}): Promise<void> {
  stopSpeaking();
  if (!opts.device) {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 300) }),
      });
      if (res.ok) {
        const blob = await res.blob();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        const p = getPlayer();
        p.src = objectUrl;
        await p.play();
        return;
      }
    } catch {
      // fall through to the device voice
    }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
};

/** True if this browser can listen for a spoken reply (Chrome, Safari). */
export function canListen(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Listen for one spoken reply. Rejects if unsupported or nothing was heard. */
export function listen(): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return reject(new Error("Voice replies aren't supported in this browser. Type your answer instead."));
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = "";
    rec.onresult = (e) => {
      heard = e.results[0]?.[0]?.transcript ?? "";
    };
    rec.onerror = (e) => reject(new Error(e.error === "not-allowed" ? "Microphone access was blocked." : "I didn't catch that. Try again."));
    rec.onend = () => (heard ? resolve(heard) : reject(new Error("I didn't catch that. Try again.")));
    rec.start();
  });
}
