// The judge demo scripts (docs/DEMO.md). If one of these breaks, the live demo breaks.
import { describe, expect, it } from "vitest";
import type { ReadLine } from "../types";
import { firstError, verifyLines } from "./verify";

const L = (index: number, text: string, extra: Partial<ReadLine> = {}): ReadLine => ({
  index, kind: "equation", text, latex: "", readConfidence: 0.95, aiVerdict: "unclear", ...extra,
});
const first = (lines: ReadLine[]) => {
  const v = verifyLines(lines);
  return firstError(lines.map((l, i) => ({ index: l.index, verdict: v[i].verdict })));
};

describe("demo scripts", () => {
  it("1. integral with an extra factor of 2 is caught, the fix passes", () => {
    const wrong = L(1, "integral of 2*x*cos(x^2) dx = 2*sin(x^2) + C", { kind: "integral", integrand: "2*x*cos(x^2)", result: "2*sin(x^2)" });
    const fixed = { ...wrong, text: "integral of 2*x*cos(x^2) dx = sin(x^2) + C", result: "sin(x^2)" };
    expect(first([wrong])).toBe(1);
    expect(verifyLines([fixed])[0]).toMatchObject({ verdict: "correct", verifiedBy: "math" });
  });
  it("2. sign error distributing is flagged on line 2, the fix solves to x = 14", () => {
    expect(first([L(1, "3*(x-4)+5 = 2*x+7"), L(2, "3*x+12+5 = 2*x+7"), L(3, "x = -10")])).toBe(2);
    expect(first([L(1, "3*(x-4)+5 = 2*x+7"), L(2, "3*x-12+5 = 2*x+7"), L(3, "x = 14")])).toBeNull();
  });
  it("3. an all-correct solution gets no red line", () => {
    const v = verifyLines([L(1, "4*(x+2) = 2*x+14"), L(2, "4*x+8 = 2*x+14"), L(3, "2*x = 6"), L(4, "x = 3")]);
    expect(v.slice(1).every((x) => x.verdict === "correct" && x.verifiedBy === "math")).toBe(true);
  });
  it("4. product rule missed is caught, the fix passes", () => {
    const d = (result: string) => L(1, `d/dx (x^3*sin(x)) = ${result}`, { kind: "derivative", expr: "x^3*sin(x)", result });
    expect(verifyLines([d("3*x^2*cos(x)")])[0].verdict).toBe("error");
    expect(verifyLines([d("3*x^2*sin(x) + x^3*cos(x)")])[0].verdict).toBe("correct");
  });
  it("5. forgetting to flip an inequality is caught", () => {
    expect(first([L(1, "-3*x + 2 > 8"), L(2, "-3*x > 6"), L(3, "x > -2")])).toBe(3);
    expect(first([L(1, "-3*x + 2 > 8"), L(2, "-3*x > 6"), L(3, "x < -2")])).toBeNull();
  });
  it("6. dividing by x loses a solution", () => {
    expect(first([L(1, "x^2 = 5*x"), L(2, "x = 5")])).toBe(2);
    expect(first([L(1, "x^2 = 5*x"), L(2, "x*(x-5) = 0"), L(3, "x = 0 or x = 5")])).toBeNull();
  });
  it("7. a limit", () => {
    const lim = (r: string) => L(1, `lim x->0 sin(3*x)/x = ${r}`, { kind: "limit", expr: "sin(3*x)/x", point: "0", result: r });
    expect(verifyLines([lim("3")])[0].verdict).toBe("correct");
    expect(verifyLines([lim("1")])[0].verdict).toBe("error");
  });
});
