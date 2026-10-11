import { describe, expect, it } from "vitest";
import { INK_COLORS, INK_COLORS_DARK, inkPalette, themedInk } from "./tools";

describe("adaptive ink (dark mode)", () => {
  it("the default ink is white in dark mode and navy in light mode", () => {
    expect(inkPalette("dark")[0]).toBe("#ffffff");
    expect(themedInk(INK_COLORS[0], "dark")).toBe("#ffffff");
    expect(themedInk("#FFFFFF", "light")).toBe(INK_COLORS[0]);
  });
  it("palette colors swap to their counterpart, index for index", () => {
    INK_COLORS.forEach((c, i) => {
      expect(themedInk(c, "dark")).toBe(INK_COLORS_DARK[i]);
      expect(themedInk(INK_COLORS_DARK[i], "light")).toBe(c);
    });
  });
  it("is idempotent: a color already right for the theme stays put", () => {
    for (const c of INK_COLORS) expect(themedInk(c, "light")).toBe(c);
    for (const c of INK_COLORS_DARK) expect(themedInk(c, "dark")).toBe(c);
  });
  it("custom colors pass through unless they would vanish into the paper", () => {
    expect(themedInk("#e8730c", "dark")).toBe("#e8730c");
    expect(themedInk("#000", "dark")).toBe("#ffffff");
    expect(themedInk("#fafafa", "light")).toBe(INK_COLORS[0]);
    expect(themedInk("not-a-color", "dark")).toBe("not-a-color");
  });
});
