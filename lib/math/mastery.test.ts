import { describe, expect, it } from "vitest";
import { BKT, initial, isMastered, masteryFromEvents, update } from "./mastery";

describe("Bayesian Knowledge Tracing", () => {
  it("starts at P(L0)", () => expect(initial("t")).toEqual({ topic: "t", pKnown: BKT.pL0, attempts: 0 }));

  it("matches the formula by hand for one correct answer", () => {
    // P(L|correct) = .3*.9 / (.3*.9 + .7*.2) = .27/.41 ; then + (1 - that)*.15
    const post = 0.27 / 0.41;
    expect(update(initial("t"), true).pKnown).toBeCloseTo(post + (1 - post) * 0.15, 10);
  });

  it("rises monotonically on a correct streak and reaches mastery", () => {
    let s = initial("t");
    let prev = s.pKnown;
    for (let i = 0; i < 6; i++) {
      s = update(s, true);
      expect(s.pKnown).toBeGreaterThan(prev);
      prev = s.pKnown;
    }
    expect(isMastered(s)).toBe(true);
    expect(s.attempts).toBe(6);
  });

  it("drops after an error", () => {
    const high = update(update(initial("t"), true), true);
    expect(update(high, false).pKnown).toBeLessThan(high.pKnown);
  });

  it("stays strictly inside (0, 1)", () => {
    let s = initial("t");
    for (let i = 0; i < 50; i++) s = update(s, i % 3 !== 0);
    expect(s.pKnown).toBeGreaterThan(0);
    expect(s.pKnown).toBeLessThan(1);
    let w = initial("t");
    for (let i = 0; i < 50; i++) w = update(w, false);
    expect(w.pKnown).toBeGreaterThan(0);
  });

  it("folds events per topic in time order, weakest first", () => {
    const m = masteryFromEvents([
      { key: "1", pageId: "p", topic: "chain-rule", correct: true, at: 3 },
      { key: "2", pageId: "p", topic: "u-substitution", correct: false, at: 1 },
      { key: "3", pageId: "p", topic: "chain-rule", correct: true, at: 2 },
      { key: "4", pageId: "p", topic: "u-substitution", correct: false, at: 4 },
    ]);
    expect(m.map((x) => x.topic)).toEqual(["u-substitution", "chain-rule"]);
    expect(m[1].attempts).toBe(2);
  });
});
