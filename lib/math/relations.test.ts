import { describe, expect, it } from "vitest";
import type { ReadLine } from "../types";
import { verifyLines } from "./verify";

const lines = (...texts: string[]): ReadLine[] =>
  texts.map((text, i) => ({ index: i + 1, kind: "equation", text, latex: "", readConfidence: 1, aiVerdict: "unclear" }));
const verdicts = (...texts: string[]) => verifyLines(lines(...texts)).map((v) => v.verdict);

describe("relations: equations", () => {
  it("square roots and squaring", () => {
    expect(verdicts("sqrt(x) = 3", "x = 9")).toEqual(["unclear", "correct"]);
    const r = verifyLines(lines("sqrt(x+2) = x", "x + 2 = x^2"));
    expect(r[1].verdict).toBe("correct");
    expect(r[1].note).toMatch(/check/i);
  });
  it("dividing by x loses a solution", () => {
    const r = verifyLines(lines("x^2 = 3x", "x = 3"));
    expect(r[1].verdict).toBe("error");
    expect(r[1].misconception).toBe("lost-a-solution");
  });
  it("factored and listed solutions", () => {
    expect(verdicts("x^2 - 5x + 6 = 0", "(x-2)(x-3) = 0", "x = 2 or x = 3")).toEqual(["unclear", "correct", "correct"]);
    expect(verdicts("x^2 - 5x + 6 = 0", "x = 2 or x = 4")[1]).toBe("error");
  });
  it("no real solutions changing to some is an error", () => {
    expect(verdicts("x^2 + 1 = 0", "x^2 = 1")[1]).toBe("error");
  });
  it("trig equations are not falsely flagged", () => {
    expect(verdicts("2sin(x) = 1", "sin(x) = 1/2")[1]).toBe("correct");
    expect(verdicts("sin(x) = 1/2", "x = pi/6")[1]).not.toBe("error");
  });
  it("two variables", () => {
    expect(verdicts("y = 2x + 1", "y - 1 = 2x")[1]).toBe("correct");
    expect(verdicts("y = 2x + 1", "y = 2x - 1")[1]).toBe("error");
    expect(verdicts("2x + 4y = 8", "x + 2y = 4")[1]).toBe("correct");
  });
  it("only the first wrong line is flagged", () => {
    expect(verdicts("2x + 3 = 7", "2x = 10", "x = 5")).toEqual(["unclear", "error", "correct"]);
  });
});

describe("relations: inequalities", () => {
  it("linear steps", () => {
    expect(verdicts("2x + 3 < 7", "2x < 4", "x < 2")).toEqual(["unclear", "correct", "correct"]);
  });
  it("forgetting to flip the sign", () => {
    const r = verifyLines(lines("-2x > 6", "x > -3"));
    expect(r[1].verdict).toBe("error");
    expect(r[1].misconception).toBe("inequality-sign-not-flipped");
    expect(verdicts("-2x > 6", "x < -3")[1]).toBe("correct");
  });
  it("chained and non-strict", () => {
    expect(verdicts("1 < 2x + 1 <= 7", "0 < x <= 3")[1]).toBe("correct");
    expect(verdicts("3x >= 9", "x ≥ 3")[1]).toBe("correct");
  });
  it("arithmetic with no variable", () => {
    expect(verdicts("7 > 2")[0]).toBe("correct");
    expect(verdicts("3*4 = 13")[0]).toBe("error");
  });
});
