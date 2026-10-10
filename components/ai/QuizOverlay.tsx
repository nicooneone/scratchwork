"use client";
// Owner: C. Quiz pages: questions typed at the top of each answer area, answered by hand.
// Live Check grades the last line written inside each answer box (lib/math/quiz.ts).
import { checkQuizAnswer } from "@/lib/math/quiz";
import type { CheckedLine, QuizQuestion, Verdict } from "@/lib/types";

const TOP = 110, LEFT = 70, WIDTH = 860, BLOCK = 245, PROMPT_H = 64;

/** Give each question an answer area on the page (page units). */
export function layoutQuiz(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.slice(0, 5).map((q, i) => ({ ...q, answerBox: { x: LEFT, y: TOP + i * BLOCK + PROMPT_H, w: WIDTH, h: BLOCK - PROMPT_H - 18 } }));
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

export function QuizOverlay({ questions, grades }: { questions: QuizQuestion[]; grades: Record<string, Verdict> }) {
  return (
    <g>
      <text x={LEFT} y={72} fontSize={34} className="font-hand" fontWeight={700} fill="var(--ink)">
        Quiz · from your notes
      </text>
      {questions.map((q, i) => {
        const b = q.answerBox!;
        const lines = wrap(`${i + 1}. ${q.prompt}`, 62);
        const g = grades[q.id];
        return (
          <g key={q.id}>
            {lines.map((ln, j) => (
              <text key={j} x={LEFT} y={b.y - PROMPT_H + 30 + j * 28} fontSize={23} fill="var(--ink)" className="font-sans">
                {ln}
              </text>
            ))}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="none" stroke="#c9d1df" strokeDasharray="8 8" strokeWidth={1.5} />
            {g === "correct" && <path d={`M ${b.x + b.w - 60} ${b.y + 36} l 14 16 l 28 -36`} fill="none" stroke="var(--ok)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className="draw-in" style={{ ["--len" as string]: 90 }} />}
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
