# RedLine

**The iPad notebook that checks your thinking, not just your answer.** Built at HackRU Fall 2026 (Education track).

Write math with an Apple Pencil like you would in GoodNotes. Pause, and RedLine reads your handwriting, verifies every step with a math engine, and circles the first wrong line in red pen. Tap the note for a spoken, Socratic hint. Ask questions about everything in your notebooks, and get quizzed on the topics you struggle with.

> Work in progress — this README is finished in Step 8 of [`docs/PLAN.md`](docs/PLAN.md).

## Run it

```bash
npm install
cp .env.example .env.local   # then add your keys
npm run dev
```

Open http://localhost:3000. On an iPad, open the deployed URL in Safari → Share → **Add to Home Screen**.

## Stack

Next.js · TypeScript · Tailwind · perfect-freehand · Dexie (IndexedDB) · Gemini API · ElevenLabs · mathjs · Vercel

## Team

Built by a team of four at HackRU F26. AI-assisted coding tools were used during the hackathon.
