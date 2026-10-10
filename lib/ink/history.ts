// Owner: A. Undo/redo for one page. Removals remember each stroke's original index so undo
// puts it back in the same z-order (otherwise restored ink would land above later precise erases).
import type { Stroke } from "../types";

type Command =
  | { type: "add"; stroke: Stroke; index: number }
  | { type: "remove"; items: { stroke: Stroke; index: number }[] };

const LIMIT = 100;

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  recordAdd(stroke: Stroke, index: number) {
    this.push({ type: "add", stroke, index });
  }

  /** `items` must be sorted by ascending index (their indices in the array before removal). */
  recordRemove(items: { stroke: Stroke; index: number }[]) {
    if (items.length) this.push({ type: "remove", items });
  }

  private push(cmd: Command) {
    this.undoStack.push(cmd);
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Returns the new stroke list, or null if there was nothing to undo. */
  undo(strokes: Stroke[]): Stroke[] | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    this.redoStack.push(cmd);
    return cmd.type === "add" ? removeAt(strokes, [cmd.index]) : insertAt(strokes, cmd.items);
  }

  redo(strokes: Stroke[]): Stroke[] | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    this.undoStack.push(cmd);
    return cmd.type === "add"
      ? insertAt(strokes, [{ stroke: cmd.stroke, index: cmd.index }])
      : removeAt(strokes, cmd.items.map((i) => i.index));
  }
}

function removeAt(strokes: Stroke[], indices: number[]): Stroke[] {
  const drop = new Set(indices);
  return strokes.filter((_, i) => !drop.has(i));
}

function insertAt(strokes: Stroke[], items: { stroke: Stroke; index: number }[]): Stroke[] {
  const out = strokes.slice();
  for (const { stroke, index } of items) out.splice(index, 0, stroke); // ascending order keeps indices valid
  return out;
}
