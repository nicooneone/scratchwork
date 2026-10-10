import { describe, expect, it } from "vitest";
import { currentBlock, groupBlocks } from "./blocks";
import type { LineBox, Stroke } from "../types";

const line = (y: number, ids: string[], h = 50): LineBox => ({ index: 0, box: { x: 80, y, w: 400, h }, strokeIds: ids });
const stroke = (id: string, createdAt: number): Stroke => ({ id, tool: "pen", color: "#000", size: 4, points: [[0, 0, 0.5]], createdAt });

describe("groupBlocks", () => {
  it("keeps consecutive lines (normal spacing) in one problem", () => {
    expect(groupBlocks([line(100, ["a"]), line(170, ["b"]), line(240, ["c"])])).toHaveLength(1);
  });
  it("splits on lined paper where lines sit close together and one ruled line is skipped", () => {
    const tight = [line(100, ["a"], 40), line(148, ["b"], 40), line(196, ["c"], 40), line(292, ["d"], 40), line(340, ["e"], 40)];
    expect(groupBlocks(tight).map((b) => b.length)).toEqual([3, 2]);
  });
  it("splits problems at a blank-line gap", () => {
    const blocks = groupBlocks([line(100, ["a"]), line(170, ["b"]), line(400, ["c"]), line(470, ["d"])]);
    expect(blocks.map((b) => b.map((l) => l.strokeIds[0]))).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("currentBlock", () => {
  const lines = [line(100, ["a"]), line(170, ["b"]), line(400, ["c"]), line(470, ["d"])];
  it("picks the problem with the newest stroke and renumbers its lines from 1", () => {
    const block = currentBlock(lines, [stroke("a", 1), stroke("b", 2), stroke("c", 5), stroke("d", 3)]);
    expect(block.map((l) => [l.index, l.strokeIds[0]])).toEqual([[1, "c"], [2, "d"]]);
  });
  it("picks the first problem when it was edited last", () => {
    const block = currentBlock(lines, [stroke("a", 9), stroke("b", 2), stroke("c", 5), stroke("d", 3)]);
    expect(block.map((l) => l.strokeIds[0])).toEqual(["a", "b"]);
  });
  it("ignores eraser strokes when deciding what is newest", () => {
    const erase: Stroke = { ...stroke("e", 99), tool: "eraser-precise" };
    const block = currentBlock(lines, [stroke("a", 9), stroke("c", 5), erase]);
    expect(block[0].strokeIds[0]).toBe("a");
  });
});
