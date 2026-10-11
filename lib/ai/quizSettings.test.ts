import { describe, expect, it } from "vitest";
import { quizSettingsText } from "./prompts";
import type { QuizSettings } from "../types";

const base: QuizSettings = { count: 5, difficulty: "standard", focus: "weak", topics: [], styles: [], notebookIds: [], timerMin: 0, hints: true, instructions: "" };

describe("quizSettingsText", () => {
  it("defaults to 5 standard questions on weak spots", () => {
    const t = quizSettingsText(undefined);
    expect(t).toMatch(/exactly 5 questions/);
    expect(t).toMatch(/standard/);
    expect(t).toMatch(/2 weakest topics/);
  });
  it("clamps the count to 1..10", () => {
    expect(quizSettingsText({ ...base, count: 50 })).toMatch(/exactly 10 questions/);
    expect(quizSettingsText({ ...base, count: 0 })).toMatch(/exactly 1 question\./);
  });
  it("restricts to picked topics and styles", () => {
    const t = quizSettingsText({ ...base, focus: "topics", topics: ["chain-rule", "u-substitution"], styles: ["integral", "word"] });
    expect(t).toMatch(/ONLY these topics: chain-rule, u-substitution/);
    expect(t).toMatch(/evaluate an integral; a short word problem/);
  });
  it("passes the student's request (trimmed to 200 chars) and exclusions", () => {
    const t = quizSettingsText({ ...base, instructions: "  only trig  " + "x".repeat(300) }, ["Solve 2x = 4"]);
    expect(t).toMatch(/"only trig/);
    expect(t.length).toBeLessThan(600);
    expect(t).toMatch(/Do not repeat.*Solve 2x = 4/);
  });
  it("exam difficulty is described", () => expect(quizSettingsText({ ...base, difficulty: "exam" })).toMatch(/hardest problem/));
});
