// Owner: D. POST QuizRequest → QuizQuestion[]. STUB: returns a fixture until Step 4.
import { quiz } from "@/fixtures";

export const maxDuration = 30;

export async function POST() {
  return Response.json(quiz);
}
