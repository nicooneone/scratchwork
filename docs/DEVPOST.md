# Devpost submission: RedLine

Track: **Education only**. Superlatives (2 max): **Use of ElevenLabs** and **Best UI/UX**. All three teammates listed as contributors.

Try it out: https://scratchwork-psi.vercel.app · Code: https://github.com/nicooneone/scratchwork

---

## Tagline

The iPad notebook that checks your thinking, not just your answer.

## Inspiration

Every student has gotten a math test back with a red X next to the final answer and no idea where things went wrong. The mistake is almost always one line: a dropped negative, a missing chain-rule factor, an inequality that should have flipped. Teachers don't have time to read every line of everyone's work, and AI chatbots just hand you the answer. We wanted a notebook that reads your actual handwriting, finds the exact line where your thinking broke, and helps you fix it yourself.

## What it does

RedLine is a GoodNotes-style notebook for iPad and Apple Pencil, with pressure-sensitive pens, highlighter, erasers, lasso, page templates and dark mode.

Turn on Tutor mode and just write math. As you move to the next line, RedLine reads your handwriting and checks every step. The first wrong step gets a red line under it. Tap it and a tutor asks you a question out loud (ElevenLabs voice) that points you at the mistake without ever giving the answer. Every mark says whether it was "verified by math" or is an "AI judgement".

It handles algebra through Calc 1: equations, inequalities, factoring, equations in up to three variables, derivatives, integrals and limits. It catches the mistakes students actually make, like a sign error when distributing, dividing by x and losing a solution, or forgetting to flip an inequality when dividing by a negative. You can work several problems side by side and each one is checked on its own.

Tap "Show me why" and RedLine draws what your step did: the point where both sides of the equation meet slides from the right answer to the wrong one. For integrals, it compares the slope of your answer to what you integrated ("yours is 2x as tall everywhere").

Cross out a mistake and rewrite it, and RedLine understands the crossed-out work is gone.

RedLine also remembers everything you write. Ask it "What did I struggle with this week?" and it answers with links to your own pages. Quiz Me writes practice questions from your notes, aimed at the topics you get wrong most, and grades your handwritten answers. Insights tracks your mastery of each topic.

## How we built it

RedLine is a Next.js / TypeScript web app installed to the iPad Home Screen. Notes are stored on the device in IndexedDB.

Ink: a custom engine on top of perfect-freehand, with real Apple Pencil pressure, palm rejection, pinch-zoom, stroke and precise erasers, and undo.

Reading vs. checking: we split the two on purpose. We group pen strokes into lines ourselves (including splitting side-by-side problems into columns), render them with line labels, and Gemini only transcribes what was written, told never to fix mistakes. A deterministic math engine built on mathjs then checks each step:

- Equations: first a random-point test for whether one line is a multiple of the other, then a comparison of the real solution sets. Losing a solution is an error; squaring both sides is allowed, with a reminder to check for extra answers.
- Inequalities: both lines must be true for exactly the same values, and if flipping the sign would fix it, that's the diagnosis.
- Integrals by numerically differentiating the student's answer (so any method works), definite integrals with Simpson's rule, derivatives against a numeric slope, and limits by sampling closer and closer from each side.

When the math can't decide, the AI's verdict is shown and labeled "AI judgement", and a red line from the AI is double-checked by a second, focused AI pass first. If the handwriting was hard to read, RedLine asks "Did you write …?" instead of marking you wrong. Lines that haven't changed are never re-read, which keeps checks fast.

Cross-outs are detected geometrically from the strokes (straight strike-throughs and scribbles over earlier ink), with tests that make sure +, x, the not-equals sign, fraction bars and underlines are never mistaken for them.

"Show me why" graphs are computed by the math engine (root finding plus an animated morph), not by AI. Mastery uses Bayesian Knowledge Tracing. Quiz answer keys are verified by the math engine before you see them, and math is typeset with KaTeX.

Voice: ElevenLabs Flash for spoken Socratic hints, with the iPad's built-in voice as a fallback.

The project has 140 automated tests, including one for every problem in our demo. We used AI coding assistants (Claude) while building.

## Challenges we ran into

Knowing when a student has finished a line. Checking too early marked half-written lines as wrong, so we hold back errors on the line you're still writing until you move on.

LLMs "helpfully" correct the mistakes they're supposed to find. We fixed that by separating reading (Gemini) from checking (our math engine).

Steps that are correct but change the answers. Squaring both sides adds solutions and is fine; dividing by x removes one and is wrong. A simple "are these the same?" test gets both wrong, so we compare solution sets.

Gemini sometimes broke its own LaTeX inside JSON (\times turned into a tab character), which we had to detect and repair.

Making palm rejection, Pencil pressure and audio playback work inside iPad Safari's rules.

## Accomplishments that we're proud of

A tutor that never gives away the answer, built on math that can be checked, not guessed.

"Show me why": seeing your wrong step move the answer is a moment students actually remember.

It feels like a real notes app, not a demo.

## What we learned

Use AI for what it's good at (reading messy handwriting) and plain math for what has to be correct. Test on the real device early. Small timing decisions, like when to check, matter more to how an app feels than big features.

## What's next for RedLine

Thinking Replay: watch how a problem was solved, including where you hesitated. A teacher view showing which mistakes a whole class makes. A native iPad app with PencilKit. Chemistry and physics.

## Built with (tags)

next.js, react, typescript, tailwindcss, gemini, elevenlabs, mathjs, katex, perfect-freehand, indexeddb, dexie, vercel, ipad, apple-pencil
