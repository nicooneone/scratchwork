"use client";
// Owner: C. The tutor's note for the first wrong line: Socratic hint ladder (1 -> 3), spoken aloud,
// "Another hint", "I fixed it". Never shows the corrected line; the server's leak guard enforces that.
import { useCallback, useEffect, useRef, useState } from "react";
import { canListen, listen, speak, stopSpeaking, unlockAudio } from "@/lib/voice";
import type { CheckedLine, HintRequest, HintResponse } from "@/lib/types";
import { Icon } from "@/components/ui/icons";
import { Squiggle } from "@/components/ui/Squiggle";

export function HintCard({
  line,
  context,
  mock,
  onFixed,
  onClose,
}: {
  line: CheckedLine;
  context: CheckedLine[];
  mock?: boolean;
  onFixed(): void;
  onClose(): void;
}) {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [hints, setHints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micOk] = useState(() => canListen());
  const autoSpeak = useRef(true);

  const fetchHint = useCallback(
    async (lvl: 1 | 2 | 3, studentReply?: string) => {
      setLoading(true);
      setError(null);
      try {
        const body: HintRequest = { line, context, level: lvl, studentReply };
        const res = await fetch(`/api/hint${mock ? "?mock=1" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "The tutor is unavailable right now.");
        const data = (await res.json()) as HintResponse;
        setHints((h) => [...h.slice(0, lvl - 1), data.text]);
        if (autoSpeak.current) {
          setSpeaking(true);
          speak(data.text).finally(() => setSpeaking(false));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "The tutor is unavailable right now.");
      } finally {
        setLoading(false);
      }
    },
    [line, context, mock],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchHint(1), 0);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [fetchHint]);

  const current = hints[level - 1];

  return (
    <div className="chrome absolute bottom-4 right-4 z-30 w-[min(360px,calc(100%-2rem))] rounded-2xl border-2 border-mark/70 bg-paper p-4 shadow-2xl animate-[panel-in_.2s_ease-out]" data-ui="">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-hand text-2xl font-bold leading-none text-mark">Line {line.index}</div>
          <Badge math={line.verifiedBy === "math"} />
        </div>
        <button aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-desk">
          <Icon.close size={18} />
        </button>
      </div>

      <div className="min-h-[64px] font-hand text-[22px] leading-snug">
        {loading && !current ? <Squiggle label="Thinking of a good question…" /> : error ? <p className="text-base text-ink-soft">{error}</p> : current}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          aria-label={speaking ? "Stop" : "Play hint aloud"}
          disabled={!current}
          onClick={() => {
            if (speaking) {
              stopSpeaking();
              setSpeaking(false);
              return;
            }
            unlockAudio(); // must run synchronously inside the tap on iPad Safari
            setSpeaking(true);
            speak(current!).finally(() => setSpeaking(false));
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-40"
        >
          {speaking ? <Icon.stop size={16} /> : <Icon.play size={16} />}
        </button>
        {micOk && (
          <button
            aria-label={listening ? "Listening" : "Answer out loud"}
            disabled={!current || loading || listening}
            onClick={() => {
              unlockAudio(); // inside the tap, so the tutor's spoken reply can play on iPad
              stopSpeaking();
              setListening(true);
              listen()
                .then((reply) => fetchHint(level, reply))
                .catch((e: Error) => setError(e.message))
                .finally(() => setListening(false));
            }}
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-rule disabled:opacity-40 ${listening ? "animate-pulse border-mark text-mark" : ""}`}
          >
            <MicIcon />
          </button>
        )}
        <button
          disabled={level === 3 || loading}
          onClick={() => {
            unlockAudio();
            const next = (level + 1) as 2 | 3;
            setLevel(next);
            if (!hints[next - 1]) fetchHint(next);
          }}
          className="h-11 flex-1 rounded-full border border-rule px-3 text-sm font-medium disabled:opacity-40"
        >
          {level === 3 ? "That's all my hints" : "Another hint"}
        </button>
        <button onClick={onFixed} className="flex h-11 items-center gap-1 rounded-full bg-ok px-4 text-sm font-medium text-white">
          <Icon.check size={16} /> I fixed it
        </button>
      </div>
      <div className="mt-2 flex gap-1" aria-label={`Hint ${level} of 3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full ${n <= level ? "bg-mark" : "bg-rule"}`} />
        ))}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function Badge({ math }: { math: boolean }) {
  return math ? (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok">
      <Icon.check size={12} /> verified by math
    </span>
  ) : (
    <span className="mt-1 inline-flex items-center rounded-full bg-desk px-2 py-0.5 text-[11px] font-semibold text-ink-soft">AI judgement</span>
  );
}
