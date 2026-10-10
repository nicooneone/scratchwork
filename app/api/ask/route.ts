// Owner: D. POST AskRequest → AskResponse. STUB: returns a fixture until Step 4.
import { ask } from "@/fixtures";

export const maxDuration = 30;

export async function POST() {
  return Response.json(ask);
}
