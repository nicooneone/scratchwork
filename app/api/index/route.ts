// Owner: D. POST IndexRequest → PageBrain. STUB: returns a fixture until Step 4.
import { brain } from "@/fixtures";

export const maxDuration = 30;

export async function POST() {
  return Response.json({ ...brain, indexedAt: Date.now() });
}
