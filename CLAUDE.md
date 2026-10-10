@AGENTS.md

# Scratchwork — team rules (HackRU F26, 24h)

The full build plan is `docs/PLAN.md`. Read your step there before writing code.

## Who owns what (don't edit another role's files without asking in team chat)
- **A — Lead / Ink engine:** `lib/ink/**` (except `segment.ts`), `components/canvas/**`, `lib/types.ts`, `lib/db.ts`, `app/dev/**`, integration.
- **B — Math & Data:** `lib/math/**`, `lib/ink/segment.ts`, all `*.test.ts`.
- **C — App shell & UX:** `app/page.tsx`, `app/notebook/**`, `components/library/**`, `components/toolbar/**`, `components/ai/**`, `components/brain/**`, `app/globals.css`, `app/manifest.ts`, icons.
- **D — AI backend & Ship:** `app/api/**`, `lib/ai/**`, `lib/voice.ts`, `fixtures/**`, README, Devpost.

`lib/types.ts` and `lib/db.ts` are **append-only**: add, never rename/remove without telling everyone.

## Rules
- Function signatures stubbed in Step 0 are the contract. Keep them; replace the bodies.
- Every API route keeps working with `?mock=1` (returns fixtures) so the UI is never blocked.
- API keys only in `.env.local` / Vercel env vars. Never `NEXT_PUBLIC_` a key. Never commit `.env.local`.
- `git pull --rebase` before every push. Small commits. Never force-push. Never leave `main` failing `npm run build`.
- Test on the real iPad from the deployed URL. Only the Apple Pencil draws (palm rejection).
- Every on-screen verdict is labeled *verified by math* or *AI judgement*. Hints never reveal the corrected line.

## Commands
- `npm run dev` — local dev server
- `npm test` — unit tests (Vitest)
- `npm run build` — must pass before pushing
