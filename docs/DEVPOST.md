# Devpost submission: RedLine

Submit to the **Education** track only (more than one track is a DQ). Add all three teammates, link the public repo, attach the video and screenshots.

**Tagline:** The iPad notebook that checks your thinking, not just your answer.

---

## Inspiration

More and more students do their math homework on an iPad. But the notebook has no idea when you're wrong. You find out days later from a grade, or never, because the answer key only shows the final answer, not which step broke. A tutor would look over your shoulder and point at the line where it went wrong, then ask you a question instead of telling you the fix. We wanted every student to have that.

## What it does

RedLine is a note-taking app for the iPad and Apple Pencil. You write math the way you normally would. When you pause or start the next line, RedLine reads your handwriting, checks every step, and draws a red line under the **first** step that goes wrong. Tap "Look here" and the tutor asks you a question about the mistake, out loud. Up to three hints get more specific, but they never show the corrected line. Fix it, and the red line goes away.

Every verdict is labeled **verified by math** or **AI judgement**, so you always know what you can trust.

It covers algebra through Calc 1: equations, inequalities, factoring, equations in up to three variables, derivatives, integrals and limits. It catches the mistakes students actually make: a sign error when distributing, dividing by x and losing a solution, forgetting to flip an inequality, a missing chain rule factor.

Beyond checking:

- **Ask** questions about everything in your notebooks, with answers that link to the exact page. Lasso part of a page to ask about just that.
- **Quiz me** builds a quiz from your own notes, focused on your weak spots. Choose the difficulty, topics, timer and hints, then answer by hand on a page that grades itself.
- **Insights** tracks mastery per topic and draws a concept map of your notes.

## How we built it

**Gemini only reads; our engine decides.** That split is the core of RedLine.

1. **Finding lines.** We cluster the Pencil strokes ourselves into handwritten lines, split side-by-side problems into columns at wide gaps, and group lines into problems at blank space. Each line is labeled `L1, L2, …` in the image we send.
2. **Reading.** Gemini transcribes each labeled line exactly as written, mistakes included. The prompt forbids correcting anything, because a "fixed" transcription would hide the student's error.
3. **Proving.** A deterministic engine on top of mathjs checks every step:
   - Equations are compared by random-point proportionality, then by their real solution sets, which catches lost solutions and allows squaring both sides with a reminder to check answers.
   - Inequalities must be true for exactly the same values; if flipping the sign would fix it, that's the diagnosis.
   - Derivatives are checked with numerical differentiation, integrals by differentiating the student's answer (so any method works), definite integrals with Simpson's rule, and limits by sampling closer and closer from each side.
4. **When math can't decide** (a substitution, words mixed in), the AI's verdict is used and labeled. A red line from the AI alone needs a second, focused AI check to agree, and low-confidence handwriting gets a question ("Did you write …?") instead of an accusation.
5. **Speed.** Lines that haven't changed are never re-read, so most checks send one line, and checking starts the moment you begin writing below.
6. **Brain.** Pages are transcribed in the background. Ask and Quiz use Gemini's long context over the whole notebook. Mastery uses Bayesian Knowledge Tracing.

Built with Next.js 16, React 19, TypeScript, Tailwind, perfect-freehand for the ink, Dexie (IndexedDB) so notes stay on the device, Gemini, ElevenLabs for the voice, KaTeX for math notation, d3-force for the concept map, and Vitest (140 tests on the math engine and line detection). Deployed on Vercel as an installable web app.

## Challenges we ran into

- **AI that corrects you.** Language models want to be helpful and silently fix a wrong sign while transcribing. We had to separate reading from judging completely and treat the model as a scanner, not a grader.
- **Knowing what's a line.** Exponents, fraction bars, integral limits and two problems side by side all break naive line detection. We wrote our own segmentation with fragment merging and column detection, backed by tests.
- **Correct steps that change the answer set.** Squaring both sides or multiplying by a denominator is valid but adds solutions; dividing by x is invalid because it removes one. A simple "are these equivalent?" test gets both wrong, so we compare real solution sets.
- **The iPad.** Palm rejection, Safari's gestures, audio that only plays inside a tap, and a canvas that has to keep up with the Pencil without lag.

## Accomplishments that we're proud of

- A red line you can trust: when it says "verified by math," it's a proof, not a guess.
- Hints that make students think instead of handing them the answer.
- Checking that starts as soon as you write the next line, and skips re-reading anything that hasn't changed.

## What we learned

The hardest part of AI in education isn't getting an answer, it's knowing when the answer is reliable and being honest about it. Pairing a model for perception with deterministic math for judgement gave us something neither could do alone.

## What's next for RedLine

- Pilot with a campus tutoring center and an intro calculus course.
- A native iPad app with PencilKit for even lower ink latency.
- More subjects: Calc 2 series, linear algebra, physics units, chemistry balancing.
- Teacher view: which steps a whole class gets wrong.

## Built with

nextjs, react, typescript, tailwindcss, gemini, elevenlabs, mathjs, katex, d3, dexie, indexeddb, vitest, vercel

## AI disclosure

AI-assisted coding tools were used during the hackathon.
