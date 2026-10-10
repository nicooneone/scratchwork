# Blueprint: HackRU Fall 2026 — "Scratchwork" (v2: the notebook)

> **Objective:** Win HackRU F26 (Rutgers, Busch Student Center, Oct 10–11 2026, 24h) with a **GoodNotes-style handwriting notebook for iPad + Apple Pencil whose AI checks your work as you write**, knows everything in your notebooks, and quizzes you on where you struggled.
> **Mode:** Direct mode (git present, `gh` not installed) — one GitHub repo, `main` only, strict file ownership.
> **Plan v2:** Sat Oct 10 2026, 10:30 EDT. **No project code before the official "hacking begins" call** (pre-built code = automatic DQ). The TypeScript in this plan is *design*: retype/regenerate it after hacking starts. Disclose AI-assisted coding on Devpost.

---

## 0. Intel (what wins here)

Sources: hackru.org (F26 page), HackRU F25 Devpost (rules/prizes/judges — **re-verify at opening ceremony**).

| Fact | Consequence |
|---|---|
| Submit to **exactly one** track. More than one = **DQ**. | **Education** only. D owns the Devpost form; a second person checks it. |
| Superlatives stack. F25: Best UI/UX, Best Newbie, MLH Gemini, MLH ElevenLabs, MLH Snowflake, MLH .Tech, IDEA Entrepreneurial, sponsor challenge. | Target Gemini + ElevenLabs + .Tech + UI/UX + IDEA (+ Newbie only if true). |
| Judging: **Functionality · Creativity · Technical Difficulty.** | Must work live on the iPad, feel like a real notes app, and have one hard idea we can explain in 20 s. |
| F25 judges: math / stats / economics / info-tech professors + industry engineers. | A notebook that catches a wrong integral step is exactly their world. |
| Table judging, **all 4 present**. F25 timing: hack 12:00 Sat → 12:00 Sun, Devpost due 11:00, judging 13:00. | Timeline below assumes the same. |

---

## 1. The product — **Scratchwork**

> *"The notebook that checks your thinking, not just your answer."*

### Platform decision (final)
**Web app (PWA) running in Safari on the iPad 8th gen, installed via "Add to Home Screen" (full-screen, app icon).** Apple Pencil (1st gen) works through Pointer Events with real pressure + tilt.

Why not native Swift/PencilKit: Xcode isn't installed on the lead's Mac (≈10+ GB download on venue Wi-Fi), only Mac users could contribute, and native signing to a device eats hours. Web means: every teammate can code on any laptop, judges can try it on any device, one deploy to our `.tech` domain (MLH prize), and the existing AI backend plan carries over.

Apple Pencil 1st gen limits (don't plan around them): **no hover, no double-tap, no squeeze.** Pressure and tilt: yes.

### What we build (24 h scope)
**Notebook (the base app):**
- Library of notebooks with covers → pages with thumbnails.
- **Templates:** blank, lined, grid, dot, Cornell, graph-with-axes.
- **Tools:** fountain pen (pressure-varying), fineliner (constant width), pencil (grainy, lighter), highlighter (flat, translucent, *under* the ink), **stroke eraser** and **precise eraser**, lasso (select a region to ask the AI about it).
- Size slider, color swatches + custom color, **favorites row** of saved pen presets (GoodNotes-style).
- Undo/redo, pinch-zoom + two-finger pan, **palm rejection** (only the Pencil draws; fingers scroll/zoom). "Draw with finger/mouse" toggle for laptops and judges.
- Autosave to the device (IndexedDB). Works offline for note-taking.

**AI (the differentiator):**
1. **Live Check (tutor mode):** pause writing for ~2.5 s → the AI reads your recent lines, a math engine verifies each step, and a **red-pen circle + margin note** appears on the first wrong line. Correct lines get a faint green tick. Tap the note → Socratic hint ladder, spoken by **ElevenLabs**. Handles algebra *and* calculus (derivatives/integrals).
2. **Ask Scratchwork:** chat panel that has read *all* your notebooks. Answers cite pages (**[Calc 1 · p4]** → tap to jump there). Lasso a region + "Ask about this".
3. **Notebook Brain:** every page is transcribed in the background into text + summary + topics. A **concept map** shows how topics connect across pages and notebooks.
4. **Struggle map + Quiz Me:** every Live Check result is logged per topic; mastery is estimated with **Bayesian Knowledge Tracing**. "Quiz me" generates questions weighted toward weak topics and creates a **quiz page** you answer by hand, which Live Check then grades.

**Scope guardrail:** Math is the AI's domain for checking (algebra + single-variable calculus). Ask/Brain work on any subject's notes. No PDF import, no shape recognition, no text boxes, no cloud sync, no sharing. Those go on the "after the hackathon" list.

### The 20-second "technical difficulty" line
> "Three things are hard here. One: a pressure-sensitive ink engine in the browser with palm rejection and a precise eraser. Two: we segment handwriting into lines **from the pen strokes themselves**, so we know exactly where each line is; Gemini only reads them. Three: a deterministic math engine verifies every step: equation steps by testing algebraic equivalence at random points, and **integrals by numerically differentiating your answer and comparing it to the integrand**. Every verdict says *verified by math* or *AI judgement*."

### Superlatives
| Prize | How we earn it honestly |
|---|---|
| MLH Gemini | Vision reading of handwriting, notebook-wide Q&A with citations, topic extraction, quiz generation |
| MLH ElevenLabs | Spoken Socratic hints from the margin notes |
| MLH .Tech | Hosted at `scratchwork.tech` (or similar) via MLH's free code; it's also the install URL |
| Best UI/UX | Paper-and-ink feel, red-pen annotations, GoodNotes-grade toolbar on iPad |
| IDEA Entrepreneurial | Freemium notebook; AI tutor tier; schools/tutoring centers license |

---

## 2. Stack (chosen — don't debate it)

- **Next.js 15 (App Router) + TypeScript + Tailwind**; deployed on **Vercel** (every push to `main` → live in ~1 min; test on the iPad from the deployed URL, since venue Wi-Fi usually blocks laptop→iPad LAN access).
- **perfect-freehand** — pressure-sensitive stroke outlines (the same idea tldraw uses).
- **Dexie** (IndexedDB) — notebooks, pages, strokes, brain, struggle log. All on-device.
- **Gemini API** via `@google/genai` (latest Flash model in AI Studio; Flash-Lite fallback), temperature 0 for reading.
- **ElevenLabs** `POST /v1/text-to-speech/{voice_id}/stream`, `eleven_flash_v2_5`, premade voice.
- **mathjs** — parsing + numeric evaluation in the verifier.
- **d3-force** — concept-map layout. **Vitest** — tests for pure logic.

Keys only in `.env.local` / Vercel env: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. Never `NEXT_PUBLIC_`. Each teammate uses their own Gemini key locally (free-tier caps).

**Why no vector database:** a student's notebooks are at most a few hundred pages of transcript. Gemini's long context reads all of it directly, so retrieval is more accurate and simpler. Say this if judges ask; embeddings are a post-hackathon scale step.

---

## 3. Team roles

| Role | Owns (files) | Carries |
|---|---|---|
| **A — Lead / Ink engine** | `lib/ink/**` (except `segment.ts`), `components/canvas/**`, `lib/types.ts`, `lib/db.ts`, integration | Technical difficulty (ink) |
| **B — Math & Data** *(Java-first teammate: pure functions + tests, no UI)* | `lib/math/**` (`verify.ts`, `calculus.ts`, `mastery.ts`), `lib/ink/segment.ts`, `**/*.test.ts` | Technical difficulty (math) |
| **C — App shell & UX** | `app/page.tsx`, `app/notebook/**`, `components/library/**`, `components/toolbar/**`, `components/ai/**`, `components/brain/**`, `app/globals.css`, `public/manifest.json`, icons | Best UI/UX |
| **D — AI backend & Ship** | `app/api/**`, `lib/ai/**` (`gemini.ts`, `prompts.ts`), `lib/voice.ts`, README, Devpost, pitch, domain, video | Gemini, ElevenLabs, .Tech, IDEA |

`lib/types.ts` and `lib/db.ts` are owned by A and **append-only** after Step 0; announce changes in chat. Git: `git pull --rebase` before every push, small commits, never edit another role's files without asking, never force-push.

---

## 4. Dependency graph

```
Step 0  Scaffold + contract + PWA shell (A, ~90 min, everyone else does setup)
   │
   ├── Step 1  Ink engine: canvas, tools, eraser, undo, templates, export  (A)   ─┐
   ├── Step 2  Math engine: segmentation + verifier + calculus + BKT       (B)   ─┤
   ├── Step 3  App shell: library, pages, toolbar UI, AI panels on fixtures (C)  ─┼─► Step 5 Live Check integration (A+B+C+D)
   └── Step 4  AI backend: /check /index /ask /quiz /hint /speak           (D)   ─┘        │
                                                                                         ▼
                                              Step 6 Brain + Ask + Quiz integration (C+D) ─► Step 7 Hardening (all) ─► Step 8 Ship (D lead)
```
Steps 1–4 are file-disjoint and run in parallel against the Step 0 contract + fixtures. Step 6 can start as soon as Step 4's `/api/index` and `/api/ask` work (it doesn't need Live Check).

---

## 5. Timeline (assumes hacking 12:00 Sat → 12:00 Sun; Devpost due 11:00; judging 13:00)

| Time | Milestone |
|---|---|
| **10:30–12:00 Sat (no code)** | iPad: charged, iPadOS **not** updating mid-event, Pencil paired + charged (Lightning adapter in bag), Safari open. Everyone: Google AI Studio key, ElevenLabs key + premade voice, Vercel, Devpost, GitHub repo access. D: MLH .tech code. B: on paper, write the **demo scripts** (§9) and 15 verifier test cases. Opening ceremony: **confirm prizes + deadlines.** |
| 12:00–13:30 | **Step 0** (A). Others: read their step, install Node, clone. |
| 13:30–18:00 | **Steps 1–4** in parallel. |
| **18:00 Checkpoint 1** | On the iPad from the deployed URL: write with pen/highlighter/eraser on a grid template, pages autosave and survive reload. Separately: `/api/check` + verifier return the right first-error line for all demo scripts (from exported PNGs). If missed: cut pencil grain, precise eraser, Cornell/graph templates. |
| 18:00–24:00 | **Step 5** Live Check end to end. **Step 6** starts when Step 4's endpoints are up. DNS for `.tech` set up now. |
| **00:00 Checkpoint 2** | On the iPad: write a wrong integral → red circle appears ≤ 6 s → tap → spoken hint. Ask answers with a page citation. |
| 00:00–06:00 | Sleep in shifts (2 × 3h). Finish Step 6 (Brain, concept map, Quiz). Step 7 hardening. |
| **06:00 FEATURE FREEZE** | Bug fixes + polish only. |
| 06:00–09:00 | Fill the demo notebooks by hand (real notes, see §9). Rehearse the pitch ×3. |
| 09:00–10:30 | **Step 8**: video, Devpost, screenshots. |
| **10:30** | Devpost submitted, **Education only**. |
| 13:00 | Judging, all four present, iPad + Pencil + backup laptop at the table. |

---

## 6. Steps

Each step is self-contained: a fresh agent or teammate can execute it cold with this section + `lib/types.ts`.

---

### Step 0 — Scaffold, contract, PWA shell, deploy
- **Owner:** A · **Model tier:** strongest · **Depends on:** hacking started · **Parallel:** no · **Timebox:** 90 min

**Context brief.** Empty repo `scratchwork`. We're building an iPad-first handwriting notebook web app (Next.js) with AI step-checking. Four people will build in parallel on disjoint files, so this step creates the skeleton, the **shared types**, the **local database schema**, **fixtures**, and **stubs for every cross-team function** so nobody blocks.

**Tasks.**
1. In the cloned repo: `npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --yes` (if Next 16+, dynamic `params` is a Promise). `npm i @google/genai mathjs perfect-freehand dexie d3-force` · `npm i -D vitest @types/d3-force`. Add `"test": "vitest run"` + `vitest.config.ts` with the `@` alias.
2. `lib/types.ts`:
   ```ts
   export type ToolKind = "pen" | "fineliner" | "pencil" | "highlighter" | "eraser-stroke" | "eraser-precise";
   export type TemplateId = "blank" | "lined" | "grid" | "dot" | "cornell" | "graph";
   export type Pt = [x: number, y: number, pressure: number];          // page units, pressure 0–1
   export interface Stroke { id: string; tool: ToolKind; color: string; size: number; points: Pt[]; createdAt: number }
   export interface Notebook { id: string; title: string; cover: string; createdAt: number; updatedAt: number }
   export interface Page { id: string; notebookId: string; index: number; template: TemplateId; strokes: Stroke[]; updatedAt: number; brain?: PageBrain; quiz?: QuizQuestion[]; demoId?: string }
   export interface ToolState { tool: ToolKind; color: string; size: number; drawWithFinger: boolean; tutorMode: boolean }
   export interface Box { x: number; y: number; w: number; h: number }  // page units (page = 1000 × 1414)
   export interface LineBox { index: number; box: Box; strokeIds: string[] }
   export type LineKind = "equation" | "expression" | "integral" | "derivative" | "text" | "other";
   export type Verdict = "correct" | "error" | "unclear";
   export interface ReadLine {
     index: number; kind: LineKind; text: string; latex: string;
     integrand?: string; result?: string; expr?: string;              // filled for integral/derivative lines
     lower?: string; upper?: string;                                   // definite integrals
     readConfidence: number; aiVerdict: Verdict; misconception?: string; topic?: string;
   }
   export interface CheckedLine extends ReadLine { box: Box; verdict: Verdict; verifiedBy: "math" | "ai"; note?: string }
   export interface CheckResult { pageId: string; lines: CheckedLine[]; firstErrorIndex: number | null }
   export interface PageBrain { transcript: string; summary: string; topics: string[]; indexedAt: number }
   export interface StruggleEvent { key: string; pageId: string; topic: string; misconception?: string; correct: boolean; at: number } // key = hash of the line's stroke ids (dedupe)
   export interface MasteryState { topic: string; pKnown: number; attempts: number }
   export interface QuizQuestion { id: string; prompt: string; topic: string; answer: string; answerKind: "equation" | "expression" | "number"; answerBox?: Box; sourcePageIds: string[] }
   export interface PageContext { id: string; label: string; transcript: string }   // label e.g. "Calc 1 · p4"
   export interface AskRequest { question: string; snippetPng?: string; pages: PageContext[]; struggles: StruggleEvent[] }
   export interface AskResponse { answer: string; citations: string[] }             // page ids
   export interface HintRequest { line: CheckedLine; context: CheckedLine[]; level: 1 | 2 | 3; studentReply?: string }
   ```
3. `lib/db.ts` (Dexie): tables `notebooks`, `pages` (index `notebookId`), `struggles` (index `topic`). Export typed helpers `listNotebooks`, `createNotebook`, `getPages`, `savePage`, `logStruggle`, `allStruggles`.
4. **Stubs** (correct signatures, trivial bodies):
   - `lib/ink/segment.ts`: `segmentLines(strokes: Stroke[]): LineBox[]` → one box around everything.
   - `lib/math/verify.ts`: `verifyLines(lines: ReadLine[]): Pick<CheckedLine, "verdict" | "verifiedBy" | "note">[]` → all `unclear`/`ai`.
   - `lib/math/mastery.ts`: `initial(topic)`, `update(state, correct)`, `masteryFromEvents(events): MasteryState[]`.
   - `lib/math/quiz.ts`: `checkQuizAnswer(q: QuizQuestion, line: ReadLine): Verdict` → `"unclear"` (B owns).
   - `lib/ink/export.ts`: `renderToPng(strokes: Stroke[], region: Box, opts?: { lineNumbers?: LineBox[] }): Promise<string>` (base64) → returns a 1×1 PNG.
   - `components/canvas/PageCanvas.tsx`: props `{page, toolState: ToolState, onChange(strokes), onLassoSelect(box), children}` (children = SVG overlay rendered in a `viewBox="0 0 1000 1414"` layer), plus a ref exposing `undo()`, `redo()`. Stub renders a blank page.
   - API routes returning fixtures, each with `export const maxDuration = 30`: `/api/check` (POST `{pageId, png, lines: LineBox[]}` → `CheckResult`), `/api/index` (POST `{png}` → `PageBrain`), `/api/ask` (POST `AskRequest` → `AskResponse`), `/api/quiz` (POST `{pages: PageContext[], mastery: MasteryState[]}` → `QuizQuestion[]`), `/api/hint` (POST `HintRequest` → `{level, text}`), `/api/speak` (POST `{text}` → 501).
   - `lib/ai/gemini.ts` exporting `ai` and `MODEL`; empty `lib/ai/prompts.ts`.
5. `fixtures/`: `check-error.json`, `check-correct.json`, `brain.json`, `ask.json`, `quiz.json`, `hint-request.json` (valid against the types).
6. PWA shell: `public/manifest.json` (`display: "standalone"`, name, icons 192/512 placeholder), `<meta name="apple-mobile-web-app-capable" content="yes">`, `apple-touch-icon`, viewport `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no` (we do our own zoom).
7. `.env.example`; verify `.env.local` is git-ignored. Import to Vercel, set env vars, deploy.

**Verification.**
```bash
npm run build && npm test -- --passWithNoTests
curl -s -X POST localhost:3000/api/check -H 'content-type: application/json' -d '{}' | head -c 200
git check-ignore .env.local
```
On the iPad: open the deployed URL → Share → Add to Home Screen → opens full-screen.
**Exit criteria.** All four teammates pulled and ran `npm run dev`; deployed URL installs on the iPad.
**Rollback.** Re-scaffold (cheap).

---

### Step 1 — Ink engine
- **Owner:** A · **Model tier:** strongest · **Depends on:** 0 · **Parallel with:** 2, 3, 4 · **Timebox:** 13:30–18:00 for the Checkpoint 1 tools (pen, fineliner, highlighter, stroke eraser, undo, save); pencil grain, precise eraser, lasso until 20:00

**Context brief.** Build `components/canvas/PageCanvas.tsx` + `lib/ink/**`: a pressure-sensitive drawing surface for one `Page` (types in `lib/types.ts`). It must feel like GoodNotes on an iPad 8th gen with an Apple Pencil 1st gen in Safari: low latency, smooth strokes, fingers never draw. C builds the toolbar UI and passes the current tool in via props; you own everything that touches pixels.

**Architecture.**
- Page is a fixed logical 1000 × 1414 surface, scaled to fit width; zoom/pan by CSS transform (two-finger pinch/pan, **clamped 1×–2×**: higher zoom blurs and sharp redraw would blow Safari's ~16.7 MP canvas limit on the A12). Only the current page has live canvases; thumbnails are cached `<img>`s; set `canvas.width = 0` on unmount to free memory.
- Layers (bottom → top): **template** (CSS/SVG background by `TemplateId`) → **highlighter canvas** → **ink canvas** (committed strokes) → **live canvas** (stroke in progress) → **annotation layer** (SVG; Live Check marks, owned by Step 5). Canvases are sized × `devicePixelRatio`.
- Input: Pointer Events on the live canvas with CSS `touch-action: none; -webkit-user-select: none; -webkit-touch-callout: none`. Draw only when `pointerType === "pen"` (or `"mouse"`/`"touch"` if the "draw with finger" toggle is on). Use `getCoalescedEvents()` when available (feature-detect). Pressure from `e.pressure`; mouse and finger report 0 → use 0.5.
- **Palm rejection:** ignore all `touch` pointers while a pen is down and for 300 ms after pen-up (palms otherwise trigger pinch/pan). `preventDefault()` on `gesturestart` and on non-passive `touchstart`/`touchmove` over the page to kill Safari's magnifier, double-tap zoom, and page zoom.
- Rendering: `getStroke(points, opts)` from perfect-freehand → polygon → `Path2D` → fill. **Pass `simulatePressure: false` for pen input** (the default `true` ignores real Pencil pressure; keep `true` for mouse/finger) and `last: true` on pen-up. Live stroke redraws only the live canvas each frame (`requestAnimationFrame`); on pen-up, commit to the ink canvas incrementally (draw just that stroke), not a full redraw.
- Tool presets (`lib/ink/tools.ts`):
  - pen: `thinning 0.6, smoothing 0.5, streamline 0.5`, pressure on.
  - fineliner: `thinning 0`, constant width.
  - pencil: `thinning 0.3`, opacity 0.75, fill with a small noise `CanvasPattern` for grain.
  - highlighter: not perfect-freehand (it has no square caps). Use `ctx.stroke()` with `lineCap: "butt"`, `lineJoin: "round"`, full opacity, on the highlighter canvas; set **CSS `opacity: 0.35` on that canvas element** so overlapping highlights don't darken. Stays under the ink.
  - eraser-stroke: on move, hit-test the eraser circle against stroke segments (point-to-segment distance ≤ radius + stroke size/2) → delete whole strokes.
  - eraser-precise: saved as a stroke with `tool: "eraser-precise"` and rendered in order with `globalCompositeOperation = "destination-out"` on the ink canvas. (Stretch: also on highlighter.) **For the live demo fix, use the stroke eraser**, since it removes strokes from the data, not just pixels.
- Undo/redo: command stack of `{add|remove, strokes, indices}`; a `remove` stores each stroke's **original index** and undo re-inserts there (otherwise restored ink lands above later precise-erases); undo/redo does a full redraw. 100 levels.
- Lasso: freehand polygon (dashed) → returns its bounding `Box` via `onLassoSelect(box)`. No moving strokes (stretch).
- Persistence: debounce 500 ms after each change → `savePage` (Dexie).
- `lib/ink/export.ts`: `renderToPng(strokes, region, {lineNumbers})`: on a transparent offscreen canvas at 2×, **replay all ink strokes in order, including `eraser-precise` with `destination-out`** (otherwise erased ink still reaches Gemini), skip highlighter, no template; then fill white with `destination-over`. Expand the region by **60 units on the left**, draw a thin margin rule, and print gray labels `L1:`, `L2:` … at each `LineBox`'s y in that margin. Max 1600 px long edge. Returns base64 PNG (no prefix).

**Tasks.** Implement the above; a dev page `/dev/canvas` with a crude tool switcher for testing before C's toolbar lands.

**Verification.** On the iPad (deployed URL): 30-second scribble test without lag; palm resting on screen draws nothing; pinch-zoom works; each tool looks distinct; precise eraser cuts through a stroke; undo 10× then redo 10×; reload → strokes persist. `npm run build` clean.
**Exit criteria.** Checkpoint 1 ink half passes on the physical iPad.
**Rollback.** If the pencil grain or precise eraser misbehaves, ship pen/fineliner/highlighter/stroke-eraser only (cut list §11).

---

### Step 2 — Math engine: line segmentation, verifier, calculus, mastery
- **Owner:** B · **Model tier:** strongest (correctness-critical) · **Depends on:** 0 · **Parallel with:** 1, 3, 4 · **Timebox:** 5h

**Context brief.** Pure TypeScript functions with unit tests; no UI, no network. Signatures are stubbed in Step 0, **don't change them**. This is the project's credibility: "*Gemini reads, math verifies.*"

**2a. `segmentLines(strokes): LineBox[]`** (`lib/ink/segment.ts`). Ignore highlighter and eraser strokes. Compute each stroke's bounding box. Sort by vertical center. Greedily cluster: a stroke joins the current line if its vertical range overlaps the line's range by ≥ 40% of the smaller height. Then **merge** a small cluster into its neighbor only when it is **< 0.6 × median line height tall** *or* lies horizontally inside the neighbor's x-range and the gap is < 0.35 × median height (keeps fractions, exponents, integral limits with their line without merging two real lines written close together). Return lines top-to-bottom with padded boxes (+8 units). Tests: 3 synthetic lines; a fraction (numerator/bar/denominator) stays one line; an exponent stays with its base.

**2b. `verifyLines(lines: ReadLine[])`** (`lib/math/verify.ts`). Variable defaults to `x` (accept the single free variable found; more than one → `unclear`). Seeded RNG for determinism.
1. **Normalize:** `−`→`-`, `×`/`·`→`*`, `²`→`^2`, `³`→`^3`, `π`→`pi`, `ln`→`log`, `√(`→`sqrt(`, `|u|`→`abs(u)`, `sin^2(x)`→`sin(x)^2`, `x(`→`x*(` (but not for function names), `)(`→`)*(`, digit `(` → digit `*(`. `±` → `unclear`. Use `math.create(all, {predictable: true})` so `sqrt`/`log` of negatives give NaN (skipped) instead of complex numbers.
2. **Equation lines:** split on `\bor\b` / `,` into clauses; each clause needs exactly one `=`; parse each side **separately** with `math.parse` (never parse `x = 14` whole, it's an assignment; never pass `or` to mathjs). Line function `F(x) = Π_j (lhs_j − rhs_j)`.
3. **Equivalence** `equiv(Fa, Fb)`: sample x ∈ [−10, 10], skip where `|Fa| < 1e-3` or non-finite; collect 6 valid samples (give up after 50). < 4 valid → `unclear`. Equivalent iff all ratios `Fb/Fa` agree within relative tol 1e-6 and are nonzero (ratio −1 = swapped sides, fine).
4. **Chains:** compare each equation line to the **last parsable equation line**. Expression lines starting with `=` (e.g. `= 2x + 6`) are compared to the previous expression by difference ≈ 0 at samples. Lines are independent of any "problem", since free notes have none.
5. **Calculus (`lib/math/calculus.ts`):**
   - `integral` lines (`integrand`, `result` given by the reader): correct iff `d/dx result ≈ integrand` at 6 samples in **[−3, 3]** (skip NaN/huge), using a central difference `(R(x+h) − R(x−h)) / 2h`, `h = 1e-4`, tolerance `≤ 1e-4 · max(1, |f|)`. `+ C` is stripped. **Definite** (`lower`/`upper` set): Simpson's rule (200 intervals) on the integrand vs the stated `result`. Integrand and result in different variables → `unclear`.
   - `derivative` lines (`expr`, `result`): numeric derivative of `expr` ≈ `result`.
   - **Notes:** when a calculus check fails, build the `note` with `math.derivative(result, x)` (symbolic, e.g. "the derivative of your answer is 4·x·cos(x^2)"); wrap in try/catch, no note if it fails.
   - Anything else (u-substitution bookkeeping, text): `unclear` → falls back to AI verdict, labeled `ai`.
6. Return per line `{verdict, verifiedBy, note?}`. The `note` is gold for the hint.
7. `lib/math/quiz.ts` `checkQuizAnswer(q, line)`: compare the student's last line to `q.answer` per `answerKind` (equation → `equiv`; expression/number → difference ≈ 0 at samples).

**2c. Mastery (`lib/math/mastery.ts`) — Bayesian Knowledge Tracing.** `P(L0)=0.3, P(T)=0.15, P(S)=0.10, P(G)=0.20`.
- Correct: `P(L|obs) = P(L)(1−S) / [P(L)(1−S) + (1−P(L))G]`; wrong: `P(L|obs) = P(L)S / [P(L)S + (1−P(L))(1−G)]`; then `P(L) ← P(L|obs) + (1−P(L|obs))·T`. Mastered at ≥ 0.95. `masteryFromEvents` folds `StruggleEvent[]` per topic in time order. Formulas go in a code comment: professors may ask.

**Tests (≥ 20).** Each legal algebra move passes (incl. swapping sides); sign error, dropped negative, divided-one-term fail; `x = 2 or x = 3` after `(x−2)(x−3)=0` passes; `x(x−5)` parses; `0 = 0` → unclear; unicode normalized; `∫2x·cos(x²) = sin(x²) + C` passes, `= 2sin(x²) + C` fails; `d/dx x³ = 3x²` passes, `= 3x` fails; `sin(x)^2` and `log(x)` parse; definite `∫_0^1 x^2 = 1/3` passes; BKT monotonic and bounded in (0,1); segmentation cases above.

**Verification.** `npm test` green. **Exit criteria:** all demo scripts (§9), hand-typed as `ReadLine[]`, produce the right `firstErrorIndex`.
**Rollback.** Calculus check misbehaves → return `unclear` for calculus (AI fallback, honestly labeled); algebra stays math-verified.

---

### Step 3 — App shell & UX (on fixtures)
- **Owner:** C · **Model tier:** default · **Depends on:** 0 · **Parallel with:** 1, 2, 4 · **Timebox:** 13:30–18:00 for library, notebook view, toolbar, margin note; AI panels + concept map until 20:00

**Context brief.** Everything around the canvas, designed for an iPad in landscape and portrait, touch-first (44 pt hit targets). Visual identity: **paper and ink**: warm-white paper, ink-blue UI, **red pen reserved for the AI tutor's marks**. Build against fixtures/stubs; A's `PageCanvas` drops in via props `{page, tool, onChange, onLassoSelect}`.

**Tasks.**
1. **Library** `app/page.tsx`: grid of notebook covers (6 cover colors), "New notebook" sheet (title, cover, default template), long-press → rename/delete.
2. **Notebook view** `app/notebook/[id]`: top toolbar + page area + collapsible left page-thumbnail rail (add page, choose template per page, reorder is stretch).
3. **Toolbar** `components/toolbar/**`: tool buttons (pen, fineliner, pencil, highlighter, eraser with stroke/precise toggle, lasso), color swatches + custom color popover, size slider with live preview dot, **favorites row** (save current tool+color+size as a preset; stored in `localStorage`), undo/redo, "draw with finger" toggle, **Tutor mode** toggle (Live Check on/off), AI button.
4. **AI side panel** `components/ai/**` (slides in from the right, ~380 px): tabs **Ask** (chat bubbles, citations render as chips `Calc 1 · p4` → navigate), **Quiz** (list of generated questions + "Make quiz page"), **Insights** (struggle map: topics with BKT mastery bars, weakest first).
5. **Margin note** component: red handwritten-style note bubble anchored to a box; tap → expands with hint text, ▶ play voice, "Another hint", "I fixed it".
6. **Concept map** `components/brain/ConceptMap.tsx`: d3-force graph, topic nodes sized by page count, edges when topics co-occur on a page, tap a node → list of pages. Fixture-driven first.
7. Typography: a handwriting face for the tutor's notes only (e.g., Caveat), a clean UI face elsewhere. Loading state for AI: a small pen squiggle animation, no spinners.

**Verification.** Click through every screen on fixtures on the iPad; portrait + landscape; `npm run build` clean.
**Exit criteria.** Screenshots good enough for Devpost; the toolbar drives `/dev/canvas` tools once A's canvas lands.
**Rollback.** Components are isolated; revert one file at a time.

---

### Step 4 — AI backend
- **Owner:** D · **Model tier:** strongest (prompts + schemas) · **Depends on:** 0 · **Parallel with:** 1, 2, 3 · **Timebox:** 5h

**Context brief.** Replace the fixture stubs in `app/api/**` with real Gemini/ElevenLabs calls. Request/response shapes are fixed in `lib/types.ts`. All images arrive as base64 PNG ≤ 1600 px (Vercel body limit 4.5 MB). Use `responseMimeType: "application/json"` + `responseSchema` (no tuple types; use enums for `kind`/`aiVerdict`), temperature 0 for reading, low thinking budget, Flash-Lite fallback on 429.

**Tasks.**
1. **`/api/check`** — input `{pageId, png, lines: LineBox[]}`; the PNG has gray line numbers printed in the margin. Prompt: "For each numbered line, transcribe EXACTLY what is written, **including mistakes, never correct the student**. Output ASCII math (`*`, `^`, `-`, `=`, `or`), **function arguments always in parentheses** (`sin(x)`, never `sin x`). Ignore the gray `L1:` labels in the margin; they only identify lines. Classify `kind`. For integrals give `integrand`, `result` (and `lower`/`upper` if definite); for derivatives `expr` and `result`. Give your own `aiVerdict`, a short kebab-case `misconception` if wrong, and the `topic` (e.g. `u-substitution`, `linear-equations`)." Then call `verifyLines` (B), merge: math verdicts win; `unclear` → AI verdict with `verifiedBy: "ai"`. Attach each `LineBox.box`, compute `firstErrorIndex`. Target < 6 s.
2. **`/api/index`** — page PNG → `PageBrain` `{transcript, summary (1 sentence), topics (≤ 5, lowercase kebab-case, reuse common names)}`.
3. **`/api/ask`** — `AskRequest` → put every page transcript in the prompt as `<page id="…" label="…">…</page>`, the struggle log as a compact table, and the optional lasso snippet image. Instruct: answer concisely, cite pages as `[[pageId]]`, and if the question is about the student's weaknesses use the struggle log. Return `{answer, citations}` (parse `[[id]]` markers).
4. **`/api/quiz`** — input `{pages, mastery}`. 5 questions, ≥ 3 from the 2 weakest topics (lowest `pKnown`), each with a short checkable `answer` (ASCII math), `answerKind`, and `sourcePageIds`.
5. **`/api/hint`** — Socratic ladder. L1: one question pointing at the wrong line. L2: name the concept + small reminder. L3: a fully worked **parallel example with different numbers**. Use the verifier's `note` when present. Spoken-friendly (no LaTeX). **Leak guard:** if the hint contains the correct result for that line (regex on the normalized expected result, when known), regenerate once, then fall back to a canned hint per misconception (write 6).
6. **`/api/speak`** — `{text}` ≤ 300 chars → proxy ElevenLabs stream (`xi-api-key`, `eleven_flash_v2_5`, premade voice) as `audio/mpeg`. During development use `speechSynthesis`; switch for integration (free credits are small).
7. `lib/voice.ts`: `speak(text)` (ElevenLabs, fallback `speechSynthesis`), `listen()` (Web Speech API, fallback text box).
8. Save real responses per demo script to `fixtures/cache/<demoId>-error.json` and `<demoId>-fixed.json` for demo mode.

**Verification.**
```bash
printf '{"pageId":"t","png":"%s","lines":[]}' "$(base64 -i fixtures/demo-integral.png)" > /tmp/body.json
curl -s -X POST localhost:3000/api/check -H 'content-type: application/json' -d @/tmp/body.json | python3 -m json.tool | head -40
curl -s -X POST localhost:3000/api/speak -H 'content-type: application/json' -d '{"text":"What is the derivative of x squared?"}' -o /tmp/t.mp3 && afplay /tmp/t.mp3
```
**Exit criteria.** All demo scripts transcribe exactly (mistakes preserved) with the right first error; `/api/ask` cites the right page on a 10-page fixture notebook; hints never leak the corrected line.
**Rollback.** Every route keeps `?mock=1` → fixture.

---

### Step 5 — Live Check integration (the money feature)
- **Owner:** A (lead) + B, C, D · **Model tier:** strongest · **Depends on:** 1, 2, 3, 4 · **Timebox:** 18:00–24:00

**Context brief.** Wire: pen idle → segment → export → `/api/check` → annotations → hint + voice → struggle log.

**Tasks.**
1. With Tutor mode on: after **2.5 s** with no pen down following a stroke, run a check if strokes changed since the last check. One request in flight; drop stale results if the page changed meanwhile (compare a stroke-count/version stamp).
2. Region: `segmentLines` on the page → take the lines that contain new strokes plus up to 5 lines above them (context) → union box → `renderToPng(strokes, region, {lineNumbers})`. Send `lines` with boxes in **page units**.
3. Annotation layer (SVG over the page): animated hand-drawn **red circle** around the `firstErrorIndex` line's box + margin note (C's component) in the right margin; small green ticks on correct lines (fade after 3 s); gray "?" for `unclear`. Badge in the note: "✓ verified by math" or "AI judgement".
4. Tap note → `/api/hint` L1 → show text + `speak()`. "Another hint" → L2 → L3. "I fixed it" → force re-check. **iPad Safari audio unlock:** in the tap handler, *synchronously* call `play()` on one reused `<audio>` element (a tiny silent clip) before any `await`, then set its `src` to the fetched audio later. Otherwise Safari blocks playback and the hint is silent.
5. Erasing/rewriting the wrong line → next idle check clears the red mark when it's now correct (satisfying moment, so make it a nice animation).
6. Every checked line with a `topic` → `logStruggle({key, topic, misconception, correct})`, where `key` = hash of the line's sorted stroke ids; upsert by `key` so re-checks don't double-count.

**Verification.** On the iPad with the Pencil, the demo scripts in §9: red circle appears on the right line ≤ 6 s after pausing; voice hint plays; fixing it clears the mark. 3 runs in a row, venue Wi-Fi.
**Exit criteria.** Checkpoint 2 met.
**Rollback.** `git revert` the integration commit; manual "Check this page" button as fallback trigger.

---

### Step 6 — Notebook Brain, Ask, Quiz Me, Insights
- **Owner:** D (wiring) + C after Step 5 frees them · **Model tier:** default · **Depends on:** 3, 4 (Step 5 not required) · **Timebox:** 20:00–04:00 (D starts alone while A, B, C finish Step 5)

**Tasks.**
1. **Background indexing:** when a page has been idle 10 s and changed since `brain.indexedAt`, export the full page → `/api/index` → save `page.brain`. Show a tiny "indexed" dot on the thumbnail. Queue, one at a time.
2. **Ask:** build `AskRequest` from all pages with a `brain` (label = `"<notebook> · p<n>"`) + all struggles (+ lasso snippet if invoked from the lasso). Render the answer; citation chips navigate to the page.
3. **Concept map:** build the graph client-side from `brain.topics` (no LLM call): nodes = topics, edges = co-occurrence on a page or in consecutive pages of a notebook.
4. **Insights:** `masteryFromEvents(allStruggles())` → bars, weakest first, with the top misconception per topic.
5. **Quiz Me:** `/api/quiz` → show questions → "Make quiz page" creates a new page (grid template) with `page.quiz` set; questions render as typed text at the top of the page with answer space below each. Each question gets an `answerBox`; Live Check on a quiz page runs `checkQuizAnswer(q, lastLineInBox)` and shows ✓/✗ next to the question.

**Verification.** Fill 2 notebooks with ≥ 6 real pages; ask "What did I struggle with this week?" → mentions the right topic and cites a real page; quiz has ≥ 3 weak-topic questions; concept map shows ≥ 2 connected clusters.
**Exit criteria.** All five features demo-able on the iPad.
**Rollback.** Concept map and quiz pages are first on the cut list; Ask is not.

---

### Step 7 — Demo hardening (feature freeze 06:00)
- **Owner:** all (A coordinates) · **Depends on:** 5, 6 · **Timebox:** 00:00–06:00 in shifts

1. **Demo mode** (`?demo=1`): pages created from the demo notebooks carry `page.demoId`. `/api/check` replays `<demoId>-error.json` or `<demoId>-fixed.json` (choose by whether the line count/stroke count changed since the error) but takes **boxes from the live `segmentLines`**, so the circle lands on what was actually drawn. Pre-rendered hint mp3s in `public/audio/`.
2. Error states: offline ("Notes still save. The tutor is back when you're online."), API timeout (8 s), unreadable ("I couldn't read line 3, can you write it a bit bigger?").
3. iPad performance: 3 full pages of ink, still no lag; memory OK after 20 page switches.
4. Bug bash: each person uses the iPad for 10 minutes of real note-taking.
5. Phone hotspot tested as Wi-Fi backup; backup laptop with Chrome + mouse ("draw with finger" toggle) in case the iPad dies.
6. Call `navigator.storage.persist()` on first launch. Add notebook **export/import as JSON** (backup before the demo). **Never delete the Home Screen icon**: that wipes the PWA's storage. Offline cold launch needs a service worker; if there's no time, don't claim it (notes still save offline once the app is open).
7. `npm run build` clean; no console errors.

**Exit criteria.** 10 consecutive successful Live Check runs on the iPad.

---

### Step 8 — Ship
- **Owner:** D (lead) · **Depends on:** 7 · **Hard deadline:** Devpost by **10:30 Sun**

1. `.tech` domain → Vercel (DNS done at ~18:00 Sat). Re-install the PWA on the iPad from the final domain (IndexedDB is per-origin, so fill the demo notebooks *on the final domain*).
2. README: pitch, architecture diagram (Ink → Segmentation → Gemini reader → Math verifier → Tutor; Brain → Ask/Quiz), BKT + numeric-derivative check explained, how to run, credits.
3. Devpost: **Education track only**; superlatives: Gemini, ElevenLabs, .Tech, UI/UX, IDEA (+ Newbie only if true). All 4 contributors. Public repo. "Built with" + AI-assisted-coding disclosure.
4. 2-min video (screen-record the iPad: Control Center → Screen Recording): write → red circle → voice hint → fix → Ask with citation → Quiz → concept map.
5. IDEA slide: problem / users / freemium + school license / next steps (pilot with a tutoring center, native iPad app with PencilKit, more subjects). Ask organizers if IDEA needs a separate pitch.

**Verification.** Logged-out Devpost view: Education only, 4 contributors, video plays, repo public.

---

## 7. Invariants (check after every step)

- `npm run build` passes on `main`; never leave it broken > 10 min.
- No keys in git: `git log -p | grep -E "AIza|sk_"` → nothing.
- Fingers never draw on the iPad (unless the toggle is on).
- Notes save without network.
- Hints never reveal the corrected line; every verdict is labeled *math* or *AI*.

---

## 8. Judge pitch (2 min, at the table, on the iPad)

1. **Hook (C, 10 s):** "GoodNotes is where students do their math. But your notebook has no idea when you're wrong. Ours does."
2. **Live (A, 60 s):** in the Calc notebook, write `∫ 2x·cos(x²) dx = 2 sin(x²) + C` and pause → red circle → tap → voice: "What do you get if you differentiate your answer?" → stroke-erase the 2 → the circle disappears.
3. **Tech (B, 25 s):** "Gemini only reads. We found the lines from the pen strokes ourselves, and our engine *proves* each step: algebra by testing equivalence at random points, integrals by differentiating your answer numerically. See the badge: verified by math."
4. **Brain (D, 20 s):** Ask: "What did I struggle with this week?" → answer cites Calc p3 → tap → jumps there. "Quiz me" → quiz page built from my weak spots. Concept map flash.
5. **Close (all, 5 s):** "Scratchwork. The notebook that checks your thinking."

Prepared answers: *Why web, not native?* (works on any iPad today, one codebase; native PencilKit is next) · *Hallucinations?* (math-verified badge, AI-judged lines labeled, reading is temperature 0 and told never to correct) · *Privacy?* (notes live on the device; only checked snippets are sent for analysis) · *Why no vector DB?* (long context reads the whole notebook; more accurate at student scale).

---

## 9. Demo scripts (B writes these on paper before 12:00 — they're the test cases and the demo)

1. **Integral, wrong:** `∫ 2x·cos(x²) dx` → `= 2 sin(x²) + C` (extra factor 2; numeric-derivative check catches it). Fix: `= sin(x²) + C`.
2. **Algebra, sign error distributing:** `3(x − 4) + 5 = 2x + 7` → `3x + 12 + 5 = 2x + 7` ✗ → fix `3x − 12 + 5 = 2x + 7` → `x = 14`.
3. **Algebra, all correct:** `4(x + 2) = 2x + 14` → `4x + 8 = 2x + 14` → `2x = 6` → `x = 3` (green ticks).
4. **Derivative, wrong:** `d/dx (x³ · sin x) = 3x² cos x` ✗ (product rule missed) → fix `3x² sin x + x³ cos x`.
5. **Notes pages** for the Brain: a page each on limits, the chain rule, u-substitution, and linear equations, plus a non-math page (e.g., a biology page on cell organelles) to show Ask works across subjects.

Write big and clear, one step per line.

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Ink lag / memory on iPad 8 (A12) in Safari | Live canvas redraws only the current stroke; incremental commit; zoom capped at 2×; one page's canvases alive at a time; test on the real iPad by 15:00 |
| Hint audio silent on iPad | Synchronous audio unlock in the tap handler (Step 5.4); text hint always shown too |
| Safari gestures interfere (text selection, magnifier, double-tap zoom, back-swipe) | `touch-action: none`, `user-select/touch-callout: none`, `user-scalable=no`, installed PWA (no browser chrome) |
| Gemini misreads or "fixes" handwriting | Our own line boxes + numbers; prompt forbids correcting; temperature 0; low-confidence lines show "?"; demo mode |
| Line segmentation splits fractions/limits | Gap-merge rule + tests; Gemini can still read a merged region |
| Gemini rate limits | Per-member keys, idle debounce, one request in flight, Flash-Lite fallback |
| Venue Wi-Fi dies | Hotspot; notes work offline; demo mode cache |
| IndexedDB is per-origin (localhost ≠ vercel.app ≠ .tech) | Fill demo notebooks on the final `.tech` domain, in the installed PWA |
| iPad dies or Pencil disconnects | Charge both at every meal; Lightning adapter in bag; backup laptop with draw-with-mouse |
| Multi-track submission | D owns the form, second person verifies |

---

## 11. Plan mutation protocol

- **Cut order if behind** (top first): spoken replies via `listen()` (keep spoken hints) → precise eraser (keep stroke eraser) → lasso → concept map → quiz *pages* (keep the question list) → pencil grain → Cornell/graph templates → background indexing (index on "Ask" instead). Calculus verification stays: it's the pitch.
- **Never cut:** smooth pressure ink with palm rejection, templates (blank/lined/grid), red-pen Live Check on the right line, Ask with page citations.
- Split a step → `5a/5b` with owner + reason here. Skip → `SKIPPED — reason — time` under the heading. Log every change below.

### Change log
- 10:00 Sat: v1 plan (photo-of-paper tutor).
- 10:15 Sat: adversarial review applied to v1.
- 10:45 Sat: **v2 pivot to a GoodNotes-style iPad notebook** (user request). Web PWA chosen over native (no Xcode on the lead Mac, team-wide contribution, .tech prize). Added ink engine, stroke-based line segmentation, calculus verification by numeric differentiation, Notebook Brain (long-context Q&A with citations, concept map), Quiz Me from the struggle log. Dropped camera capture and teacher dashboard.
- 10:55 Sat: v2 adversarial review applied: export replays precise erases, Safari audio unlock, `simulatePressure: false`, palm-touch gesture blocking, zoom cap 2×, undo index preservation, safer segmentation merge, `L1:` margin labels, mathjs normalization + predictable mode, definite integrals via Simpson, contract additions (`ToolState`, `demoId`, `StruggleEvent.key`, quiz answer fields, `checkQuizAnswer`), timeboxes aligned to checkpoints, cut list reordered.
