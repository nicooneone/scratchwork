import { describe, expect, it } from "vitest";
import { checkLimit } from "./calculus";

const v = (e: string, p: string, r: string) => {
  try {
    return checkLimit(e, p, r).verdict;
  } catch {
    return "unclear";
  }
};

describe("checkLimit", () => {
  it("classic finite limits", () => {
    expect(v("sin(x)/x", "0", "1")).toBe("correct");
    expect(v("sin(x)/x", "0", "0")).toBe("error");
    expect(v("(1-cos(x))/x^2", "0", "1/2")).toBe("correct");
    expect(v("(x^2-4)/(x-2)", "2", "4")).toBe("correct");
    expect(v("(x^2-4)/(x-2)", "2", "2")).toBe("error");
    expect(v("x*log(x)", "0+", "0")).toBe("correct");
  });
  it("limits at infinity", () => {
    expect(v("(3x^2+1)/(x^2-5)", "inf", "3")).toBe("correct");
    expect(v("(3x^2+1)/(x^2-5)", "inf", "inf")).toBe("error");
    expect(v("(1+1/x)^x", "inf", "e")).toBe("correct");
    expect(v("exp(x)", "inf", "inf")).toBe("correct");
    expect(v("1/x", "inf", "0")).toBe("correct");
  });
  it("infinite and one-sided limits, DNE", () => {
    expect(v("1/x^2", "0", "inf")).toBe("correct");
    expect(v("1/x", "0+", "inf")).toBe("correct");
    expect(v("1/x", "0-", "-inf")).toBe("correct");
    expect(v("1/x", "0", "DNE")).toBe("correct");
    expect(v("abs(x)/x", "0", "DNE")).toBe("correct");
    expect(v("abs(x)/x", "0", "1")).toBe("error");
    expect(v("x^2", "3", "DNE")).toBe("error");
  });
  it("oscillation stays unclear", () => {
    expect(v("sin(1/x)", "0", "0")).not.toBe("correct");
  });
});
