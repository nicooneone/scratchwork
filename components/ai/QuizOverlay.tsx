"use client";
// Owner: C. Quiz pages: questions typed at the top of each answer area, answered by hand.
// Live Check grades the last line written inside each answer box (lib/math/quiz.ts).
import { checkQuizAnswer } from "@/lib/math/quiz";
import { answerTex } from "@/lib/math/tex";
import { MathTex, MathText } from "@/components/math/MathText";
import type { CheckedLine, QuizQuestion, Verdict } from "@/lib/types";

const TOP = 110, LEFT = 70, WIDTH = 860, BLOCK = 245, PROMPT_H = 64;

/** Give each question an answer area on the page (page units). Up to 5 per page; fewer get more room. */
export function layoutQuiz(questions: QuizQuestion[]): QuizQuestion[] {
  const qs = questions.slice(0, 5);
  const block = Math.min(BLOCK * 1.6, (1414 - TOP - 40) / Math.max(qs.length, 1));
  return qs.map((q, i) => ({ ...q, answerBox: { x: LEFT, y: TOP + i * block + PROMPT_H, w: WIDTH, h: block - PROMPT_H - 18 } }));
}

/** Grade each question from the checked lines whose centers fall in its answer box. */
export function gradeQuiz(questions: QuizQuestion[], lines: CheckedLine[]): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  for (const q of questions) {
    const b = q.answerBox;
    if (!b) continue;
    const inside = lines.filter((l) => {
      const cx = l.box.x + l.box.w / 2, cy = l.box.y + l.box.h / 2;
      return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
    });
    const last = inside[inside.length - 1];
    if (last) out[q.id] = checkQuizAnswer(q, last);
  }
  return out;
}

export function QuizOverlay({
  questions,
  grades,
  title = "Quiz · from your notes",
  hintsAllowed = false,
  shownHints = [],
  onToggleHint,
}: {
  questions: QuizQuestion[];
  grades: Record<string, Verdict>;
  title?: string;
  firstNumber?: number; // numbering and revealed answers are drawn by QuizMathLayer
  hintsAllowed?: boolean;
  shownHints?: string[];
  revealed?: boolean;
  onToggleHint?(id: string): void;
}) {
  return (
    <g>
      <text x={LEFT} y={72} fontSize={34} className="font-hand" fontWeight={700} fill="var(--ink)">
        {title}
      </text>
      {questions.map((q) => {
        const b = q.answerBox;
        if (!b) return null;
        const hintOpen = shownHints.includes(q.id);
        const g = grades[q.id];
        return (
          <g key={q.id}>
            {/* question text, hint and answer are typeset in QuizMathLayer (HTML over the page) */}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="none" stroke="var(--rule)" strokeDasharray="8 8" strokeWidth={1.5} />
            {g === "correct" && <path d={`M ${b.x + b.w - 60} ${b.y + 36} l 14 16 l 28 -36`} fill="none" stroke="var(--ok)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className="draw-in" style={{ ["--len" as string]: 90 }} />}
            {hintsAllowed && q.hint && (
              <g
                data-ui=""
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                // Canvas cancels touch events, so open on pointerup (see TutorMarks).
                onPointerUp={() => onToggleHint?.(q.id)}
                role="button"
                aria-label={hintOpen ? "Hide hint" : "Show hint"}
              >
                <rect x={b.x + b.w - 118} y={b.y - PROMPT_H + 6} width={118} height={36} rx={18} fill={hintOpen ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" strokeWidth={1.5} />
                <text x={b.x + b.w - 59} y={b.y - PROMPT_H + 31} fontSize={20} textAnchor="middle" fill={hintOpen ? "var(--paper)" : "var(--ink)"} className="font-sans">
                  {hintOpen ? "Hide hint" : "Hint"}
                </text>
              </g>
            )}
            {g === "error" && (
              <g className="draw-in" style={{ ["--len" as string]: 120 }}>
                <path d={`M ${b.x + b.w - 62} ${b.y + 18} l 36 36 M ${b.x + b.w - 26} ${b.y + 18} l -36 36`} fill="none" stroke="var(--mark)" strokeWidth={6} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// Page units -> CSS inside PageCanvas's htmlOverlay (container = page width; 1 unit = 0.1cqw).
const px = (u: number) => `${u * 0.1}cqw`;
const pctX = (u: number) => `${(u / 1000) * 100}%`;
const pctY = (u: number) => `${(u / 1414) * 100}%`;

/** Question text, hints and revealed answers with real math notation (KaTeX), positioned over the quiz page. */
export function QuizMathLayer({
  questions,
  firstNumber = 1,
  hintsAllowed = false,
  shownHints = [],
  revealed = false,
}: {
  questions: QuizQuestion[];
  firstNumber?: number;
  hintsAllowed?: boolean;
  shownHints?: string[];
  revealed?: boolean;
}) {
  return (
    <div className="quiz-math text-ink">
      {questions.map((q, i) => {
        const b = q.answerBox;
        if (!b) return null;
        const chip = hintsAllowed && !!q.hint;
        return (
          <div key={q.id}>
            <div
              className="absolute font-sans"
              style={{ left: pctX(LEFT), top: pctY(b.y - PROMPT_H + 4), width: pctX(b.w - (chip ? 132 : 0)), fontSize: px(23), lineHeight: 1.3 }}
            >
              <span className="font-semibold">{firstNumber + i}.</span> <MathText text={q.prompt ?? ""} />
            </div>
            {chip && shownHints.includes(q.id) && (
              <div className="absolute font-hand text-ink-soft" style={{ left: pctX(b.x + 16), top: pctY(b.y + 6), width: pctX(b.w - 32), fontSize: px(26), lineHeight: 1.25 }}>
                <MathText text={q.hint!} />
              </div>
            )}
            {revealed && q.answer && (
              <div
                className="absolute text-right font-sans font-semibold text-ok"
                style={{ left: pctX(b.x), top: pctY(b.y + b.h - 46), width: pctX(b.w - 16), fontSize: px(24) }}
              >
                Answer: <MathTex tex={answerTex(q.answer)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
