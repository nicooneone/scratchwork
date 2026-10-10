/** Short random id. crypto.randomUUID needs a secure context (https or localhost). */
export function uid(): string {
  return crypto.randomUUID();
}
