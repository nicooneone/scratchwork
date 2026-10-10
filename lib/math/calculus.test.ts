import { describe, expect, it } from "vitest";
import type { ReadLine } from "../types";
import { checkDerivative, checkIntegral, simpson } from "./calculus";
import { verifyLines } from "./verify";

describe("indefinite integrals (numeric differentiation of the answer)", () => {
  it("∫2x·cos(x²) = sin(x²) + C passes", () => expect(checkIntegral("2x·cos(x²)", "sin(x²) + C")).toMatchObject({ verdict: "correct", verifiedBy: "math" }));
  it("∫2x·cos(x²) = 2sin(x²) + C fails with a note", () => {
    const r = checkIntegral("2x·cos(x²)", "2sin(x²) + C");
    expect(r.verdict).toBe("error");
    expect(r.note).toMatch(/4/);
  });
  it("power rule", () => {
    expect(checkIntegral("3x^2 + 4x", "x^3 + 2x^2 + C").verdict).toBe("correct");
    expect(checkIntegral("x^3", "x^4 + C").verdict).toBe("error");
    expect(checkIntegral("x^3", "x^4/4 + C").verdict).toBe("correct");
  });
  it("any constant is fine, and a missing + C still checks the function", () => {
    expect(checkIntegral("2x", "x^2 + 7").verdict).toBe("correct");
    expect(checkIntegral("2x", "x^2").verdict).toBe("correct");
  });
  it("1/x and ln work where defined", () => expect(checkIntegral("1/x", "ln(abs(x)) + C").verdict).toBe("correct"));
  it("e^x and trig", () => {
    expect(checkIntegral("e^x", "e^x + C").verdict).toBe("correct");
    expect(checkIntegral("sin(x)", "cos(x) + C").verdict).toBe("error");
    expect(checkIntegral("sin(x)", "-cos(x) + C").verdict).toBe("correct");
  });
  it("other variable names", () => expect(checkIntegral("2t", "t^2 + C").verdict).toBe("correct"));
  it("mismatched variables -> unclear (via verifyLines)", () => {
    const line: ReadLine = { index: 1, kind: "integral", text: "", latex: "", integrand: "2x", result: "u^2 + C", readConfidence: 1, aiVerdict: "unclear" };
    expect(verifyLines([line])[0].verdict).toBe("unclear");
  });
});

describe("definite integrals (Simpson's rule)", () => {
  it("∫_0^1 x^2 = 1/3 passes", () => expect(checkIntegral("x^2", "1/3", "0", "1").verdict).toBe("correct"));
  it("∫_0^1 x^2 = 1/2 fails", () => expect(checkIntegral("x^2", "1/2", "0", "1").verdict).toBe("error"));
  it("∫_0^π sin = 2", () => expect(checkIntegral("sin(x)", "2", "0", "pi").verdict).toBe("correct"));
  it("simpson is accurate", () => expect(simpson(Math.exp, 0, 1)).toBeCloseTo(Math.E - 1, 9));
});

describe("derivatives", () => {
  it("d/dx x³ = 3x² passes, = 3x fails", () => {
    expect(checkDerivative("x^3", "3x^2").verdict).toBe("correct");
    expect(checkDerivative("x^3", "3x").verdict).toBe("error");
  });
  it("chain rule", () => {
    expect(checkDerivative("sin(x^2)", "2x cos(x^2)").verdict).toBe("correct");
    expect(checkDerivative("sin(x^2)", "cos(x^2)").verdict).toBe("error");
  });
  it("quotient rule", () => expect(checkDerivative("x/(x+1)", "1/(x+1)^2").verdict).toBe("correct"));
  it("the note never states the correct derivative", () => {
    const r = checkDerivative("sin(x^2)", "cos(x^2)");
    expect(r.note).toMatch(/slope/);
    expect(r.note).not.toMatch(/2.*x.*cos/);
  });
});
