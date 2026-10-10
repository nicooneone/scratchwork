// Owner: D. POST HintRequest → HintResponse. STUB: canned hint until Step 4.
import type { HintRequest, HintResponse } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<HintRequest>;
  const level = body.level ?? 1;
  const hint: HintResponse = {
    level,
    text: "Look at this line. What do you get when you multiply 3 by negative 4?",
  };
  return Response.json(hint);
}
