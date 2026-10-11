// Owner: C. Customizable quizzes: settings, presets, and generating questions from the notebooks.
import { allStruggles } from "@/lib/db";
import { masteryFromEvents } from "@/lib/math/mastery";
import type { Page, QuizQuestion, QuizRequest, QuizSettings, QuizStyle, QuizDifficulty } from "@/lib/types";
import { indexStalePages, loadAllPages, toContexts } from "./indexing";

export const DEFAULT_SETTINGS: QuizSettings = {
  count: 5,
  difficulty: "standard",
  focus: "weak",
  topics: [],
  styles: [],
  notebookIds: [],
  timerMin: 0,
  hints: true,
  instructions: "",
};

export const PRESETS: { id: string; label: string; blurb: string; settings: Partial<QuizSettings> }[] = [
  { id: "quick", label: "Quick check", blurb: "3 warm-ups, no timer", settings: { count: 3, difficulty: "warm-up", focus: "mixed", timerMin: 0, hints: true } },
  { id: "weak", label: "Weak spots", blurb: "5 on your hardest topics", settings: { count: 5, difficulty: "standard", focus: "weak", timerMin: 0, hints: true } },
  { id: "exam", label: "Exam prep", blurb: "8 exam-level, 20 min, no hints", settings: { count: 8, difficulty: "exam", focus: "mixed", timerMin: 20, hints: false } },
  { id: "challenge", label: "Challenge", blurb: "3 hard ones, 10 min", settings: { count: 3, difficulty: "challenge", focus: "weak", timerMin: 10, hints: false } },
];

export const DIFFICULTIES: { id: QuizDifficulty; label: string }[] = [
  { id: "warm-up", label: "Warm-up" },
  { id: "standard", label: "Standard" },
  { id: "challenge", label: "Challenge" },
  { id: "exam", label: "Exam" },
];

export const STYLES: { id: QuizStyle; label: string }[] = [
  { id: "solve", label: "Solve equations" },
  { id: "simplify", label: "Simplify" },
  { id: "derivative", label: "Derivatives" },
  { id: "integral", label: "Integrals" },
  { id: "word", label: "Word problems" },
];

export const COUNTS = [3, 5, 8, 10];
export const TIMERS = [0, 5, 10, 15, 20, 30];
export const PER_PAGE = 5;

const KEY = "redline.quizSettings";

export function loadSettings(): QuizSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: QuizSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: settings just aren't remembered */
  }
}

/** Topics the student has notes or checked work on, most practiced first. */
export function knownTopics(pages: Page[], struggleTopics: string[]): string[] {
  const n = new Map<string, number>();
  for (const p of pages) for (const t of p.brain?.topics ?? []) n.set(t, (n.get(t) ?? 0) + 1);
  for (const t of struggleTopics) n.set(t, (n.get(t) ?? 0) + 2);
  return [...n].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/** Index what's stale, then ask /api/quiz for questions that follow the settings. */
export async function generateQuiz(settings: QuizSettings, opts: { mock?: boolean; exclude?: string[]; onProgress?(msg: string | null): void } = {}): Promise<QuizQuestion[]> {
  let { pages, notebooks } = await loadAllPages();
  await indexStalePages(pages, {
    mock: opts.mock,
    onProgress: (done, total) => total > 0 && opts.onProgress?.(done < total ? `Reading your pages (${done + 1}/${total})…` : null),
  });
  ({ pages, notebooks } = await loadAllPages());
  const scoped = settings.notebookIds.length ? pages.filter((p) => settings.notebookIds.includes(p.notebookId)) : pages;
  const contexts = toContexts(scoped, notebooks);
  if (!contexts.length && !opts.mock) throw new Error(settings.notebookIds.length ? "Those notebooks don't have notes yet. Pick others, or write a few pages first." : "Write a few pages of notes first, then I can quiz you on them.");

  opts.onProgress?.("Writing questions…");
  const body: QuizRequest = { pages: contexts, mastery: masteryFromEvents(await allStruggles()), settings, exclude: opts.exclude };
  const res = await fetch(`/api/quiz${opts.mock ? "?mock=1" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  opts.onProgress?.(null);
  if (!res.ok) throw new Error(json.error ?? "Quiz is unavailable right now.");
  return json as QuizQuestion[];
}

export const quizTitle = (s: QuizSettings) =>
  `${DIFFICULTIES.find((d) => d.id === s.difficulty)?.label ?? "Practice"} quiz${s.focus === "topics" && s.topics.length === 1 ? ` · ${s.topics[0].replace(/-/g, " ")}` : ""}`;
