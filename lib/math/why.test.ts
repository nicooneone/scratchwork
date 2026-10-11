import { describe, expect, it } from "vitest";
import type { CheckedLine } from "../types";
import { buildWhy, niceNumber, roots } from "./why";

const line = (index: number, text: string, extra: Partial<CheckedLine> = {}): CheckedLine => ({
  index, text, kind: "equation", latex: "", readConfidence: 1, aiVerdict: "correct",
  box: { x: 0, y: 0, w: 0, h: 0 }, verdict: "correct", verifiedBy: "math", ...extra,
});

describe("niceNumber", () => {
  it("writes numbers the way a student would", () => {
    expect(niceNumber(14)).toBe("14");
    expect(niceNumber(-10)).toBe("−10");
    expect(niceNumber(2 / 11)).toBe("2/11");
    expect(niceNumber(-1.5)).toBe("−3/2");
    expect(niceNumber(Math.PI)).toBe("3.14");
  });
});

describe("roots", () => {
  it("finds both roots of a quadratic and ignores a pole", () => {
    expect(roots((x) => x * x - 5 * x + 6)).toEqual([2, 3]);
    expect(roots((x) => 1 / (x - 1))).toEqual([]);
  });
});

describe("buildWhy: equation steps", () => {
  const ctx = [line(1, "3*(x - 4) + 5 = 2*x + 7")];
  const err = line(2, "3*x + 12 + 5 = 2*x + 7", { verdict: "error" });

  it("shows the answer moving from x = 14 to x = -10", () => {
    const g = buildWhy(err, ctx)!;
    expect(g.kind).toBe("equation");
    expect(g.frames).toHaveLength(2);
    expect(g.frames[0].dots.map((d) => d.label)).toEqual(["x = 14"]);
    expect(g.frames[1].dots.filter((d) => !d.ghost).map((d) => d.label)).toEqual(["x = −10"]);
    expect(g.summary).toContain("from x = 14 to x = −10");
    // both answers are inside the window
    expect(g.view.x0).toBeLessThan(-10);
    expect(g.view.x1).toBeGreaterThan(14);
  });

  it("follows the last equation before the mistake, skipping unclear lines", () => {
    const g = buildWhy(err, [line(1, "3*(x - 4) + 5 = 2*x + 7"), line(0, "hello", { verdict: "unclear", kind: "text" })]);
    expect(g?.frames[0].dots[0].label).toBe("x = 14");
  });

  it("handles a step that makes the equation impossible", () => {
    const g = buildWhy(line(2, "2*x + 3 = 2*x + 5", { verdict: "error" }), [line(1, "2*x + 3 = x + 5")])!;
    expect(g.frames[1].caption).toContain("never meet");
  });

  it("returns null when there's no earlier equation to compare with", () => {
    expect(buildWhy(err, [])).toBeNull();
  });

  it("returns null for lines that aren't wrong", () => {
    expect(buildWhy({ ...err, verdict: "correct" }, ctx)).toBeNull();
  });
});

describe("buildWhy: calculus", () => {
  it("integral with an extra factor of 2 says so", () => {
    const g = buildWhy(line(1, "integral of 2*x*cos(x^2) dx = 2*sin(x^2) + C", { kind: "integral", integrand: "2*x*cos(x^2)", result: "2*sin(x^2)", verdict: "error" }), [])!;
    expect(g.kind).toBe("integral");
    expect(g.summary).toContain("2× as tall");
  });

  it("integral with the wrong sign says it's flipped", () => {
    const g = buildWhy(line(1, "", { kind: "integral", integrand: "sin(x)", result: "cos(x)", verdict: "error" }), [])!;
    expect(g.summary).toContain("upside down");
  });

  it("derivative that misses the product rule gets a graph", () => {
    const g = buildWhy(line(1, "", { kind: "derivative", expr: "x^3*sin(x)", result: "3*x^2*cos(x)", verdict: "error" }), [])!;
    expect(g.kind).toBe("derivative");
    expect(g.frames[0].curves).toHaveLength(2);
  });

  it("a correct integral produces no graph", () => {
    expect(buildWhy(line(1, "", { kind: "integral", integrand: "2*x*cos(x^2)", result: "sin(x^2)", verdict: "error" }), [])).toBeNull();
  });
});
