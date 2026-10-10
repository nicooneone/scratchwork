// Shared contract for the whole team. Owned by A (Lead). APPEND-ONLY after Step 0:
// add fields/types, never rename or remove without telling the team first.

// ---------- Ink ----------
// "lasso" selects a region (never saved as a stroke).
export type ToolKind = "pen" | "fineliner" | "pencil" | "highlighter" | "eraser-stroke" | "eraser-precise" | "lasso";
export type TemplateId = "blank" | "lined" | "grid" | "dot" | "cornell" | "graph";

/** One input sample: x, y in page units (page is 1000 × 1414), pressure 0–1. */
export type Pt = [x: number, y: number, pressure: number];

export interface Stroke {
  id: string;
  tool: ToolKind;
  color: string; // CSS color, e.g. "#1d2a44"
  size: number; // base width in page units
  points: Pt[];
  /** ms since stroke start for each point (for replay / hesitation analysis). */
  times?: number[];
  createdAt: number;
  /** True when drawn with a mouse/finger (no real pressure): the renderer simulates pressure from speed. */
  simulated?: boolean;
}

export interface ToolState {
  tool: ToolKind;
  color: string;
  size: number;
  drawWithFinger: boolean; // false = only Apple Pencil draws (palm rejection)
  tutorMode: boolean; // Live Check on/off
}

// ---------- Notebooks ----------
export interface Notebook {
  id: string;
  title: string;
  cover: string; // CSS color
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  notebookId: string;
  index: number; // 0-based position in the notebook
  template: TemplateId;
  strokes: Stroke[];
  updatedAt: number;
  brain?: PageBrain;
  quiz?: QuizQuestion[];
  demoId?: string; // set on pages of the demo notebooks (demo mode replay)
}

/** Page geometry, in page units. */
export const PAGE_W = 1000;
export const PAGE_H = 1414;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
} // page units, origin top-left

// ---------- Live Check ----------
export interface LineBox {
  index: number; // 1-based, matches the "L1:" label printed in the exported PNG
  box: Box;
  strokeIds: string[];
}

export type LineKind = "equation" | "expression" | "integral" | "derivative" | "text" | "other";
export type Verdict = "correct" | "error" | "unclear";

/** What Gemini read on one handwritten line. Math is plain ASCII usable by mathjs. */
export interface ReadLine {
  index: number;
  kind: LineKind;
  text: string; // e.g. "3*x + 12 + 5 = 2*x + 7"
  latex: string;
  integrand?: string; // integral lines
  result?: string; // integral / derivative lines
  expr?: string; // derivative lines
  lower?: string; // definite integrals
  upper?: string;
  readConfidence: number; // 0–1
  aiVerdict: Verdict;
  misconception?: string; // short kebab-case, e.g. "sign-error-distributing"
  topic?: string; // short kebab-case, e.g. "u-substitution"
}

export interface CheckedLine extends ReadLine {
  box: Box;
  verdict: Verdict;
  verifiedBy: "math" | "ai";
  note?: string; // from the math engine, e.g. "the derivative of your answer is 4*x*cos(x^2)"
}

export interface CheckResult {
  pageId: string;
  lines: CheckedLine[];
  firstErrorIndex: number | null; // LineBox.index of the first wrong line
}

export interface CheckRequest {
  pageId: string;
  png: string; // base64, no data: prefix
  lines: LineBox[];
  demoId?: string;
}

// ---------- Notebook Brain / Ask / Quiz ----------
export interface PageBrain {
  transcript: string;
  summary: string;
  topics: string[];
  indexedAt: number;
}

export interface StruggleEvent {
  key: string; // hash of the line's sorted stroke ids (dedupe re-checks)
  pageId: string;
  topic: string;
  misconception?: string;
  correct: boolean;
  at: number;
}

export interface MasteryState {
  topic: string;
  pKnown: number; // Bayesian Knowledge Tracing P(L)
  attempts: number;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  topic: string;
  answer: string; // ASCII math
  answerKind: "equation" | "expression" | "number";
  answerBox?: Box;
  sourcePageIds: string[];
}

export interface PageContext {
  id: string;
  label: string; // e.g. "Calc 1 · p4"
  transcript: string;
}

export interface IndexRequest {
  png: string;
}

export interface AskRequest {
  question: string;
  snippetPng?: string;
  pages: PageContext[];
  struggles: StruggleEvent[];
}

export interface AskResponse {
  answer: string;
  citations: string[]; // page ids
}

export interface QuizRequest {
  pages: PageContext[];
  mastery: MasteryState[];
}

export interface HintRequest {
  line: CheckedLine;
  context: CheckedLine[];
  level: 1 | 2 | 3;
  studentReply?: string;
}

export interface HintResponse {
  level: 1 | 2 | 3;
  text: string;
}
