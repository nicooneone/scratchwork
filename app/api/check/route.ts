// Owner: D. POST CheckRequest → CheckResult. STUB: returns fixtures until Step 4.
import { checkError } from "@/fixtures";
import type { CheckRequest } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<CheckRequest>;
  return Response.json({ ...checkError, pageId: body.pageId ?? checkError.pageId });
}
