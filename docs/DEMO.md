# Demo runbook

Every script below is covered by `lib/math/demo.test.ts`, so if `npm test` passes, the math side of the demo works.

## Before judging (in this order)

1. **Vercel env vars:** `GEMINI_API_KEY` set (and `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` for the voice). Redeploy after changing them. Open `/api/health` on the live URL to confirm.
2. **iPad, from the live URL (Home Screen app):**
   - Write script 2 below, pause: red line under line 2, "Look here" opens a spoken hint.
   - Fix it: the red line disappears, "Nice fix!" shows.
   - Write two short problems side by side: each column is checked on its own.
   - Rest your palm on the screen while writing: only the Pencil draws.
   - Make a quiz (Quick check), write one answer, check it grades.
   - Toggle dark mode from the ⋯ menu.
3. **Fill the demo notebooks on the final URL.** Notebooks are stored per website address, so ones made on localhost or another URL won't show up. Make a "Calc 1" and an "Algebra" notebook and a couple of notes pages (limits, chain rule, linear equations, plus one non-math page) so Ask and Quiz have material.
4. **Backup:** if Wi-Fi or Gemini fails, add `?mock=1` to the notebook URL. It shows sample results without the network. Phone hotspot ready, iPad and Pencil charged.

## Scripts (write big, one step per line)

1. **Integral, wrong:** `∫ 2x·cos(x²) dx = 2 sin(x²) + C` (extra factor 2). Fix: `= sin(x²) + C`.
2. **Sign error distributing:** `3(x − 4) + 5 = 2x + 7`, then `3x + 12 + 5 = 2x + 7` (red line). Fix: `3x − 12 + 5 = 2x + 7`, then `x = 14`.
3. **All correct:** `4(x + 2) = 2x + 14`, `4x + 8 = 2x + 14`, `2x = 6`, `x = 3`. No red line.
4. **Product rule missed:** `d/dx (x³ sin x) = 3x² cos x` (red line). Fix: `3x² sin x + x³ cos x`.
5. **Inequality sign not flipped:** `−3x + 2 > 8`, `−3x > 6`, `x > −2` (red line). Fix: `x < −2`.
6. **Lost solution:** `x² = 5x`, then `x = 5` (red line: dividing by x lost x = 0). Fix: `x(x − 5) = 0`, `x = 0 or x = 5`.
7. **Limit:** `lim x→0 sin(3x)/x = 1` (red line). Fix: `= 3`.

## 2-minute pitch

1. **Hook (10 s):** "Your iPad is where you do your math. But your notebook has no idea when you're wrong. Ours does."
2. **Live (60 s):** script 2 or 1. Pause, red line, tap "Look here", hear the hint, fix it, the line goes away.
3. **Tech (25 s):** "Gemini only reads. We find the lines from the pen strokes ourselves, and our math engine proves each step: equations by comparing solution sets, integrals by differentiating your answer. See the badge: verified by math. When math can't decide, it says AI judgement, and a second AI check has to agree before you see red."
4. **Brain (20 s):** Ask "What did I struggle with this week?", tap the page link. Then Quiz me.
5. **Close (5 s):** "RedLine. The notebook that checks your thinking."

**Likely questions**
- *Hallucinations?* The math verdicts are proofs. AI-only verdicts are labeled and double-checked, and unclear handwriting gets a question, not a red line.
- *Why web, not native?* Works on any iPad today with one codebase. Native PencilKit is next.
- *Privacy?* Notes stay on the device; only the lines being checked are sent.
- *Does it give away answers?* No. Hints never show the corrected line.
