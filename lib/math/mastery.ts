// Owner: B. STUB from Step 0 — signatures are fixed; implement Bayesian Knowledge Tracing in Step 2c.
import type { MasteryState, StruggleEvent } from "../types";

export function initial(topic: string): MasteryState {
  return { topic, pKnown: 0.3, attempts: 0 };
}

export function update(state: MasteryState, _correct: boolean): MasteryState {
  return state;
}

export function masteryFromEvents(_events: StruggleEvent[]): MasteryState[] {
  return [];
}
