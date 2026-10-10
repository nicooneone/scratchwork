import { describe, expect, it } from "vitest";
import type { QuizQuestion, ReadLine } from "../types";
import { checkQuizAnswer } from "./quiz";

const q = (answer: string, answerKind: QuizQuestion["answerKind"]): QuizQuestion => ({ id: "q", prompt: "", topic: "t", answer, answerKind, sourcePageIds: [] });
const line = (text: string): ReadLine => ({ index: 1, kind: "other", text, latex: "", readConfidence: 1, aiVerdict: "unclear" });

describe("checkQuizAnswer", () => {
  it("equations", () => {
    expect(checkQuizAnswer(q("x = 14", "equation"), line("x = 14"))).toBe("correct");
    expect(checkQuizAnswer(q("x = 14", "equation"), line("14 = x"))).toBe("correct");
    expect(checkQuizAnswer(q("x = 14", "equation"), line("x = -14"))).toBe("error");
  });
  it("expressions, with or without + C", () => {
    expect(checkQuizAnswer(q("sin(x^3)", "expression"), line("= sin(x^3) + C"))).toBe("correct");
    expect(checkQuizAnswer(q("2*x*e^x + x^2*e^x", "expression"), line("e^x(x^2 + 2x)"))).toBe("correct");
    expect(checkQuizAnswer(q("2*x*e^x + x^2*e^x", "expression"), line("2x e^x"))).toBe("error");
  });
  it("numbers", () => {
    expect(checkQuizAnswer(q("1/3", "number"), line("0.33"))).toBe("error"); // too imprecise
    expect(checkQuizAnswer(q("1/3", "number"), line("0.3333333333"))).toBe("correct");
    expect(checkQuizAnswer(q("1/3", "number"), line("= 1/3"))).toBe("correct");
  });
  it("unreadable -> unclear", () => expect(checkQuizAnswer(q("x = 1", "equation"), line("??"))).toBe("unclear"));
});
