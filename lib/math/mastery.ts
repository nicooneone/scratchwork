// Owner: B. Bayesian Knowledge Tracing (Corbett & Anderson, 1994), one skill per topic.
//
// Hidden state: does the student know the skill?  P(L) = probability they do.
// Parameters:  P(L0) = 0.30  prior,   P(T) = 0.15  chance to learn after each attempt,
//              P(S) = 0.10  slip (knows it, still wrong),  P(G) = 0.20  guess (doesn't, still right).
//
// After a CORRECT line:  P(L | obs) = P(L)(1 - S) / [ P(L)(1 - S) + (1 - P(L)) G ]
// After a WRONG line:    P(L | obs) = P(L) S       / [ P(L) S       + (1 - P(L))(1 - G) ]
// Then learning:         P(L) <- P(L | obs) + (1 - P(L | obs)) T
// Mastered when P(L) >= 0.95.
import type { MasteryState, StruggleEvent } from "../types";

export const BKT = { pL0: 0.3, pT: 0.15, pS: 0.1, pG: 0.2, mastered: 0.95 } as const;

export function initial(topic: string): MasteryState {
  return { topic, pKnown: BKT.pL0, attempts: 0 };
}

export function update(state: MasteryState, correct: boolean): MasteryState {
  const { pT, pS, pG } = BKT;
  const L = state.pKnown;
  const posterior = correct ? (L * (1 - pS)) / (L * (1 - pS) + (1 - L) * pG) : (L * pS) / (L * pS + (1 - L) * (1 - pG));
  const pKnown = posterior + (1 - posterior) * pT;
  return { topic: state.topic, pKnown, attempts: state.attempts + 1 };
}

export const isMastered = (s: MasteryState) => s.pKnown >= BKT.mastered;

/** Fold the struggle log per topic in time order. Weakest topic first. */
export function masteryFromEvents(events: StruggleEvent[]): MasteryState[] {
  const byTopic = new Map<string, MasteryState>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (!e.topic) continue;
    byTopic.set(e.topic, update(byTopic.get(e.topic) ?? initial(e.topic), e.correct));
  }
  return [...byTopic.values()].sort((a, b) => a.pKnown - b.pKnown);
}
