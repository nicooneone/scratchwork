"use client";
// Owner: C. Quiz pages: questions typed at the top of each answer area, answered by hand.
// Live Check grades the last line written inside each answer box (lib/math/quiz.ts).
import { checkQuizAnswer } from "@/lib/math/quiz";
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
  firstNumber = 1,
  hintsAllowed = false,
  shownHints = [],
  revealed = false,
  onToggleHint,
}: {
  questions: QuizQuestion[];
  grades: Record<string, Verdict>;
  title?: string;
  firstNumber?: number;
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
      {questions.map((q, i) => {
        const b = q.answerBox!;
        const lines = wrap(`${firstNumber + i}. ${q.prompt}`, 62);
        const hintOpen = shownHints.includes(q.id);
        const g = grades[q.id];
        return (
          <g key={q.id}>
            {lines.map((ln, j) => (
              <text key={j} x={LEFT} y={b.y - PROMPT_H + 30 + j * 28} fontSize={23} fill="var(--ink)" className="font-sans">
                {ln}
              </text>
            ))}
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
            {hintOpen && q.hint && (
              <text x={b.x + 16} y={b.y + 30} fontSize={26} fill="var(--ink-soft)" className="font-hand">
                {wrap(q.hint, 64)[0]}
                {wrap(q.hint, 64)[1] ? <tspan x={b.x + 16} dy={28}>{wrap(q.hint, 64)[1]}</tspan> : null}
              </text>
            )}
            {revealed && (
              <text x={b.x + b.w - 16} y={b.y + b.h - 14} fontSize={24} textAnchor="end" fill="var(--ok)" className="font-sans" fontWeight={600}>
                Answer: {q.answer.length > 40 ? q.answer.slice(0, 40) + "…" : q.answer}
              </text>
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

function wrap(s: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(/\s+/)) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, 2);
}
