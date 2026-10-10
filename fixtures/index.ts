// Typed access to the fixture JSON, used by API routes in mock mode and by UI work before the real APIs land.
import type { AskResponse, CheckResult, HintRequest, PageBrain, QuizQuestion } from "@/lib/types";
import checkErrorJson from "./check-error.json";
import checkCorrectJson from "./check-correct.json";
import brainJson from "./brain.json";
import askJson from "./ask.json";
import quizJson from "./quiz.json";
import hintRequestJson from "./hint-request.json";

export const checkError = checkErrorJson as CheckResult;
export const checkCorrect = checkCorrectJson as CheckResult;
export const brain = brainJson as PageBrain;
export const ask = askJson as AskResponse;
export const quiz = quizJson as QuizQuestion[];
export const hintRequest = hintRequestJson as HintRequest;
