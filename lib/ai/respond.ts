// Owner: D. Small helpers shared by the API routes.

/** True when the request asks for fixture data (`?mock=1`), so the UI never blocks on AI work. */
export function wantsMock(request: Request): boolean {
  return new URL(request.url).searchParams.get("mock") === "1";
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
