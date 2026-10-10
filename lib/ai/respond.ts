// Owner: D. Small helpers shared by the API routes.

/** True when the request asks for fixture data (`?mock=1`), so the UI never blocks on AI work. */
export function wantsMock(request: Request): boolean {
  return new URL(request.url).searchParams.get("mock") === "1";
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/** The AI is down or too slow: tell the UI in plain words. */
export function aiUnavailable(err: unknown): Response {
  console.error("[api] AI call failed:", err);
  return Response.json({ error: "The tutor couldn't respond right now. Try again in a moment." }, { status: 503 });
}

/** Base64 images bigger than this are rejected (Vercel's request body limit is 4.5 MB). */
export const MAX_PNG_BASE64 = 4_000_000;

/** "Chain Rule" / "chain_rule" → "chain-rule". */
export function kebab(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const k = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return k || undefined;
}
