// Owner: D. Every prompt and JSON schema the AI routes use, in one place.
import type { QuizSettings } from "../types";

// ---------- /api/check: read handwritten math lines ----------
export const READER_SYSTEM = `You read a student's handwritten math from an image of their notebook page.

The image has gray labels "L1:", "L2:", ... in the left margin. Each label marks one handwritten line. The labels are not part of the math: never transcribe them.

For every labeled line, transcribe EXACTLY what the student wrote, INCLUDING their mistakes.

Crossed-out writing is DELETED: anything with a line struck through it or scribbled over is not part of the line, so leave it out (the student may have rewritten it nearby). If a whole labeled line is crossed out, return it with kind "text", text "" and aiVerdict "unclear". Never correct, simplify or "fix" anything. If the student wrote 3x + 12 when it should be 3x - 12, you write 3*x + 12. Your transcription is checked by a separate math engine, so fixing a mistake hides it from the student.

Write math as plain ASCII that a calculator parser understands:
- explicit multiplication: 3*x, 2*(x+1), x*sin(x)
- powers with ^: x^2
- function arguments ALWAYS in parentheses: sin(x), cos(x^2), log(x), sqrt(x) — never "sin x"
- minus is "-", never "−"
- several solutions joined with " or ": x = 2 or x = 3
- a line that continues a calculation and starts with "=" keeps the leading "="

Classify each line's kind:
- "equation": contains one "=" relating two sides (e.g. 3*x - 12 = 2*x + 7, x = 14)
- "expression": a continuation like "= 2*x + 6", or a bare expression
- "integral": an integral and its result. You MUST give "integrand" (without "dx"), "result" (without "+ C"), and for definite integrals "lower" and "upper"
- "derivative": a derivative and its result, e.g. d/dx (x^3) = 3*x^2. You MUST give "expr" (what is differentiated, e.g. x^3*sin(x)) and "result" (e.g. 3*x^2*cos(x))
- "text": words, not math
- "other": anything else

"text" is always the WHOLE line as written (for an integral line: integral of 2*x*cos(x^2) dx = 2*sin(x^2) + C).

Also give, for each line:
- "aiVerdict": your own judgement of whether this step follows correctly from the previous lines ("correct", "error", or "unclear")
- "misconception": if wrong, a short kebab-case name for the mistake (e.g. "sign-error-distributing", "dropped-negative-moving-terms", "missing-chain-rule-factor", "product-rule-missing-term", "arithmetic-slip")
- "topic": short kebab-case topic (e.g. "linear-equations", "distributing", "u-substitution", "chain-rule", "product-rule", "factoring-quadratics")
- "readConfidence": 0 to 1, how sure you are you read the handwriting correctly
- "latex": the same line in LaTeX`;

export const READER_SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "The N of the 'LN:' label" },
          kind: { type: "string", enum: ["equation", "expression", "integral", "derivative", "text", "other"] },
          text: { type: "string" },
          latex: { type: "string" },
          integrand: { type: "string" },
          result: { type: "string" },
          expr: { type: "string" },
          lower: { type: "string" },
          upper: { type: "string" },
          readConfidence: { type: "number" },
          aiVerdict: { type: "string", enum: ["correct", "error", "unclear"] },
          misconception: { type: "string" },
          topic: { type: "string" },
        },
        required: ["index", "kind", "text", "latex", "readConfidence", "aiVerdict"],
      },
    },
  },
  required: ["lines"],
};

// ---------- /api/index: transcribe a whole page for the Notebook Brain ----------
export const INDEX_SYSTEM = `You transcribe a student's handwritten notebook page so it can be searched and studied later.

Return:
- "transcript": everything on the page in reading order, as plain text (ignore any gray "L1:" labels in the margin, and leave out anything crossed out or scribbled over). Write math inline in ASCII (3*x^2, sin(x), integral of 2*x dx). Keep the student's mistakes; do not correct them.
- "summary": one short sentence saying what the page is about.
- "topics": up to 5 short kebab-case topics (e.g. "chain-rule", "u-substitution", "linear-equations", "cell-organelles"). Prefer common, general names so the same topic gets the same name on every page.

If the page is blank or unreadable, return an empty transcript, the summary "Blank page", and no topics.`;

export const INDEX_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    summary: { type: "string" },
    topics: { type: "array", items: { type: "string" } },
  },
  required: ["transcript", "summary", "topics"],
};

// ---------- /api/ask: questions about the student's notebooks ----------
export const ASK_SYSTEM = `You are RedLine, a study assistant that has read all of a student's handwritten notebooks.

You get the transcripts of their pages, each in <page id="..." label="...">. You may also get a log of the math steps they got right and wrong ("struggles"), and an image of a region they selected with the lasso.

Rules:
- Answer the question directly and concisely (at most about 120 words unless they ask for more). Talk to the student as "you".
- Ground your answer in their notes. Every time you use something from a page, cite it right there as [[page-id]] using the exact id. Never invent an id.
- For questions about what they struggle with, use the struggles log and cite the pages it came from.
- If their notes don't cover the question, say so briefly, then answer from general knowledge without citations.
- Plain text only, no Markdown headings. Math in plain readable form (x^2, sin(x)).

Return "answer" (with the [[page-id]] citations inline) and "citations" (the list of page ids you cited).`;

export const ASK_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "citations"],
};

// ---------- /api/quiz: practice questions aimed at weak topics ----------
export const QUIZ_SYSTEM = `You write a short practice quiz for a student, based on their own notes.

You get their page transcripts (<page id="...">) and their mastery per topic (pKnown from 0 to 1, lower = weaker).

Follow the QUIZ SETTINGS in the request exactly: the number of questions, difficulty, focus, topics and question styles.
- Each must be solvable by hand on paper, in the same notation as their notes.
- "prompt" is shown to the student with real math typesetting: write EVERY piece of math in LaTeX between $ signs, e.g. "Evaluate $\\int 6x(x^2+1)^2\\,dx$", "Solve $2(x-5)+3=x+4$", "Find $\\frac{d}{dx}\\left(x^2\\sin x\\right)$", "Simplify $\\frac{x^2-9}{x-3}$", "Evaluate $\\int_0^1 x^2\\,dx$". Never write math as words or ASCII ("integral of", "int", "x^2", "sqrt(x)", "d/dx") outside $...$.
- "answer" is the final answer in plain ASCII math a parser understands (x = 11, (x^2 + 1)^3, 2*x*sin(x) + x^2*cos(x), 7). No "+ C" on integrals.
- "answerKind": "equation" if the answer is like x = 11, "number" if it is a single number, otherwise "expression".
- "topic": the kebab-case topic it practices.
- "sourcePageIds": ids of the pages the question is based on (exact ids only).
- "checkEquation": for "solve for x" questions, the equation itself in ASCII (e.g. 2*(x - 3) + 4 = x + 5). Otherwise omit.
- "integrand": for integral questions, the integrand in ASCII (e.g. 2*x*exp(x^2)). Otherwise omit.
- "difficulty": "warm-up", "standard", "challenge" or "exam", matching how hard the question really is.
- "style": "solve", "simplify", "derivative", "integral" or "word" (a short real-world word problem).
- "hint": one short sentence that nudges toward the first step, math in $...$ LaTeX like the prompt. It must NOT contain the answer or any intermediate result.
Work each answer out carefully step by step before writing it: a wrong answer key is the worst possible mistake.`;

export const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          topic: { type: "string" },
          answer: { type: "string" },
          answerKind: { type: "string", enum: ["equation", "expression", "number"] },
          sourcePageIds: { type: "array", items: { type: "string" } },
          checkEquation: { type: "string" },
          integrand: { type: "string" },
          difficulty: { type: "string", enum: ["warm-up", "standard", "challenge", "exam"] },
          style: { type: "string", enum: ["solve", "simplify", "derivative", "integral", "word"] },
          hint: { type: "string" },
        },
        required: ["prompt", "topic", "answer", "answerKind", "sourcePageIds"],
      },
    },
  },
  required: ["questions"],
};

// ---------- /api/hint: Socratic hints, spoken aloud ----------
export const HINT_SYSTEM = `You are a patient math tutor. A student made a mistake on one line of their handwritten work. You help them find it themselves. You NEVER tell them the corrected line or the final answer.

Hint levels:
- Level 1: ask ONE short question that points their attention at the exact spot where the mistake is. Example: "Look at line 2. What do you get when you multiply 3 by negative 4?"
- Level 2: name the concept and give a small reminder, still without the answer. Example: "When you distribute, the 3 multiplies every term inside the parentheses, including the sign."
- Level 3: work a SIMILAR example with DIFFERENT numbers all the way through, then say "Now try yours."

If the student replied, first react to their reply in one short sentence (encourage what is right), then give the hint for the requested level.

Your hint is read aloud by a voice, so:
- at most 2 short sentences for levels 1 and 2, at most 4 for level 3
- no LaTeX, no symbols that sound odd: say "x squared", "negative 4", "times"
- talk to the student as "you"

Also return "correctedLine": what the wrong line SHOULD say, in ASCII math. This is never shown to the student; it is used to check that your hint does not give it away.`;

export const HINT_SCHEMA = {
  type: "object",
  properties: {
    hint: { type: "string" },
    correctedLine: { type: "string" },
  },
  required: ["hint", "correctedLine"],
};

/** Used when the AI is down or keeps giving the answer away. Keyed by misconception. */
export const CANNED_HINTS: Record<string, string> = {
  "sign-error-distributing": "Look closely at how you distributed. What happens to the sign of each term inside the parentheses?",
  "dropped-negative-moving-terms": "When you moved a term to the other side, what should happen to its sign?",
  "divided-only-one-term": "When you divided, did you divide every term on that side, or just one?",
  "missing-chain-rule-factor": "Try differentiating your answer. Do you get back exactly what you integrated?",
  "product-rule-missing-term": "This is a product of two functions. How many terms does the product rule give you?",
  "arithmetic-slip": "Check the arithmetic on this line one number at a time. Is every calculation right?",
  default: "Compare this line with the one above it. What changed, and is that change allowed?",
};

// ---------- Quiz settings -> plain-language instructions ----------
const DIFFICULTY_TEXT: Record<string, string> = {
  "warm-up": "warm-up: one or two steps, confidence builders",
  standard: "standard: like a typical homework problem",
  challenge: "challenge: several steps or a twist, still under 5 minutes",
  exam: "exam: the hardest problem that could appear on a test on these notes",
};
const STYLE_TEXT: Record<string, string> = {
  solve: "solve an equation",
  simplify: "simplify or expand an expression",
  derivative: "find a derivative",
  integral: "evaluate an integral",
  word: "a short word problem",
};

export function quizSettingsText(s: QuizSettings | undefined, exclude: string[] = []): string {
  const count = Math.max(1, Math.min(10, Math.round(s?.count ?? 5)));
  const lines = [`- Write exactly ${count} question${count === 1 ? "" : "s"}.`];
  lines.push(`- Difficulty: ${DIFFICULTY_TEXT[s?.difficulty ?? "standard"] ?? DIFFICULTY_TEXT.standard}.`);
  const focus = s?.focus ?? "weak";
  if (focus === "weak") lines.push(`- Focus: at least ${Math.ceil(count * 0.6)} must target the 2 weakest topics.`);
  else if (focus === "mixed") lines.push("- Focus: spread the questions across all the topics in the notes.");
  else if (s?.topics?.length) lines.push(`- Focus: ONLY these topics: ${s.topics.join(", ")}.`);
  if (s?.styles?.length) lines.push(`- Question styles allowed: ${s.styles.map((x) => STYLE_TEXT[x] ?? x).join("; ")}. Use no other style.`);
  if (s?.instructions?.trim()) lines.push(`- Student's own request (follow it unless it asks for something unsafe or off-topic): "${s.instructions.trim().slice(0, 200)}"`);
  if (exclude.length) lines.push(`- Do not repeat or closely copy these questions: ${exclude.map((e) => `"${e.slice(0, 120)}"`).join("; ")}.`);
  return lines.join("\n");
}
