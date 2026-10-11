import { describe, expect, it } from "vitest";
import type { LineKind, ReadLine } from "../types";
import { firstError, verifyLines } from "./verify";
import { normalize } from "./expr";

let n = 0;
const L = (text: string, kind: LineKind = "equation", extra: Partial<ReadLine> = {}): ReadLine => ({
  index: ++n, kind, text, latex: "", readConfidence: 1, aiVerdict: "unclear", ...extra,
});
/** Verdict of the LAST line, checked against the line before it. */
const step = (a: string, b: string) => verifyLines([L(a), L(b)])[1];

describe("algebra: legal moves pass", () => {
  it("distributing", () => expect(step("3(x-4)+5 = 2x+7", "3x-12+5 = 2x+7")).toMatchObject({ verdict: "correct", verifiedBy: "math" }));
  it("combining like terms", () => expect(step("3x-12+5 = 2x+7", "3x-7 = 2x+7").verdict).toBe("correct"));
  it("moving terms across", () => expect(step("3x-7 = 2x+7", "3x-2x = 7+7").verdict).toBe("correct"));
  it("dividing both sides", () => expect(step("2x = 6", "x = 3").verdict).toBe("correct"));
  it("swapping sides", () => expect(step("x + 1 = 4", "4 = x + 1").verdict).toBe("correct"));
  it("factoring a quadratic", () => expect(step("x^2 - 5x + 6 = 0", "(x-2)(x-3) = 0").verdict).toBe("correct"));
  it("x = 2 or x = 3 after factoring", () => expect(step("(x-2)(x-3) = 0", "x = 2 or x = 3").verdict).toBe("correct"));
  it("comma-separated solutions", () => expect(step("(x-2)(x-3) = 0", "x = 2, x = 3").verdict).toBe("correct"));
  it("x(x-5) parses as multiplication", () => expect(step("x^2 - 5x = 0", "x(x-5) = 0").verdict).toBe("correct"));
  it("unicode minus, times, squared", () => expect(step("3(x − 4) = 6", "3·x − 12 = 6").verdict).toBe("correct"));
});

describe("algebra: mistakes fail", () => {
  it("sign error distributing", () => expect(step("3(x-4)+5 = 2x+7", "3x+12+5 = 2x+7")).toMatchObject({ verdict: "error", verifiedBy: "math" }));
  it("dropped negative moving a term", () => expect(step("5x + 8 = 2x - 7", "5x - 2x = -7 + 8").verdict).toBe("error"));
  it("divided only one term", () => expect(step("2x + 4 = 10", "x + 4 = 5").verdict).toBe("error"));
  it("wrong sign on the answer", () => expect(step("x - 14 = 0", "x = -14").verdict).toBe("error"));
  it("only one root of a quadratic", () => expect(step("(x-2)(x-3) = 0", "x = 2").verdict).toBe("error"));
});

describe("algebra: unclear instead of guessing", () => {
  it("0 = 0", () => expect(step("x + 1 = x + 1", "0 = 0").verdict).toBe("unclear"));
  it("a new variable appears (substitution)", () => expect(step("x^2 + 2x = 3", "u + 2x = 3").verdict).toBe("unclear"));
  it("plus-minus", () => expect(step("x^2 = 4", "x = ±2").verdict).toBe("unclear"));
  it("garbage", () => expect(step("2x = 6", "x = )(").verdict).toBe("unclear"));
  it("text lines", () => expect(verifyLines([L("Notes on chapter 3", "text")])[0].verdict).toBe("unclear"));
  it("the first equation is the problem itself", () => expect(verifyLines([L("2x = 6")])[0].verdict).toBe("unclear"));
  it("errors are carried forward, not repeated", () => {
    const v = verifyLines([L("2x + 2 = 10"), L("2x = 12"), L("x = 6")]);
    expect(v.map((r) => r.verdict)).toEqual(["unclear", "error", "correct"]);
  });
});

describe("arithmetic and expressions", () => {
  it("standalone arithmetic", () => {
    expect(verifyLines([L("3*4 = 12")])[0].verdict).toBe("correct");
    expect(verifyLines([L("3*4 = 13")])[0].verdict).toBe("error");
  });
  it("expression chain with = continuations", () => {
    const v = verifyLines([L("3(x+2) + x", "expression"), L("= 3x + 6 + x", "expression"), L("= 4x + 7", "expression")]);
    expect(v.map((r) => r.verdict)).toEqual(["unclear", "correct", "error"]);
  });
  it("sin(x)^2 and log(x) parse", () => {
    const v = verifyLines([L("sin(x)^2 + cos(x)^2", "expression"), L("= 1", "expression")]);
    expect(v[1].verdict).toBe("correct");
    expect(verifyLines([L("log(x^2)", "expression"), L("= 2 log(x)", "expression")])[1].verdict).toBe("correct");
  });
});

describe("normalize", () => {
  it("handles handwriting notation", () => {
    expect(normalize("sin^2(x)")).toBe("sin(x)^2");
    expect(normalize("ln(x)")).toBe("log(x)");
    expect(normalize("√(x+1)")).toBe("sqrt(x+1)");
    expect(normalize("|x−3|")).toBe("abs(x-3)");
    expect(normalize("(x-2)(x-3)")).toBe("(x-2)*(x-3)");
  });
});

describe("demo scripts (plan §9) produce the right first error", () => {
  it("1. integral with an extra factor of 2", () => {
    const lines = [
      L("integral(2*x*cos(x^2)) dx", "integral", { integrand: "2*x*cos(x^2)" }),
      L("= 2*sin(x^2) + C", "integral", { result: "2*sin(x^2) + C" }),
    ];
    const v = verifyLines(lines);
    expect(firstError(lines.map((l, i) => ({ index: l.index, verdict: v[i].verdict })))).toBe(lines[1].index);
    expect(v[1].note).toMatch(/derivative of your answer is .*cos/);
    // fixed
    expect(verifyLines([lines[0], L("= sin(x^2) + C", "integral", { result: "sin(x^2) + C" })])[1].verdict).toBe("correct");
  });

  it("2. sign error distributing, then fixed", () => {
    const wrong = [L("3(x - 4) + 5 = 2x + 7"), L("3x + 12 + 5 = 2x + 7")];
    const vw = verifyLines(wrong);
    expect(firstError(wrong.map((l, i) => ({ index: l.index, verdict: vw[i].verdict })))).toBe(wrong[1].index);
    const fixed = [L("3(x - 4) + 5 = 2x + 7"), L("3x - 12 + 5 = 2x + 7"), L("x = 14")];
    expect(verifyLines(fixed).map((r) => r.verdict)).toEqual(["unclear", "correct", "correct"]);
  });

  it("3. all correct", () => {
    const lines = [L("4(x + 2) = 2x + 14"), L("4x + 8 = 2x + 14"), L("2x = 6"), L("x = 3")];
    const v = verifyLines(lines);
    expect(v.slice(1).every((r) => r.verdict === "correct" && r.verifiedBy === "math")).toBe(true);
    expect(firstError(lines.map((l, i) => ({ index: l.index, verdict: v[i].verdict })))).toBeNull();
  });

  it("4. product rule missed, then fixed", () => {
    const wrong = L("d/dx(x^3*sin(x)) = 3x^2*cos(x)", "derivative", { expr: "x^3*sin(x)", result: "3x^2*cos(x)" });
    expect(verifyLines([wrong])[0]).toMatchObject({ verdict: "error", verifiedBy: "math" });
    const fixed = L("= 3x^2 sin x + x^3 cos x", "derivative", { expr: "x^3*sin(x)", result: "3x^2 sin x + x^3 cos x" });
    expect(verifyLines([fixed])[0].verdict).toBe("correct");
  });
});
