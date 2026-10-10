// Owner: A. Page backgrounds as CSS, drawn under the ink. Sizes are in page units
// and scaled with the page (the page element sets `--u` = 1 page unit in px).
import type { CSSProperties } from "react";
import type { TemplateId } from "../types";

const LINE = "var(--template-line, #c9d6ea)";

export const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "lined", label: "Lined" },
  { id: "grid", label: "Grid" },
  { id: "dot", label: "Dot" },
  { id: "cornell", label: "Cornell" },
  { id: "graph", label: "Graph" },
];

export function templateStyle(template: TemplateId): CSSProperties {
  const u = "var(--u, 1px)";
  // Line thickness never drops below 1 CSS px, so small thumbnails still show the paper.
  const hair = `max(1px, ${u})`;
  switch (template) {
    case "lined":
      return {
        backgroundImage: `linear-gradient(to bottom, transparent calc(${u} * 48 - ${hair}), ${LINE} calc(${u} * 48 - ${hair}), ${LINE} calc(${u} * 48))`,
        backgroundSize: `100% calc(${u} * 48)`,
        backgroundPosition: `0 calc(${u} * 72)`,
      };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
        backgroundSize: `calc(${u} * 40) calc(${u} * 40)`,
      };
    case "dot":
      return {
        backgroundImage: `radial-gradient(circle, ${LINE} max(0.8px, calc(${u} * 2.2)), transparent max(1.2px, calc(${u} * 2.6)))`,
        backgroundSize: `calc(${u} * 40) calc(${u} * 40)`,
      };
    case "cornell":
      return {
        backgroundImage: [
          `linear-gradient(90deg, transparent calc(${u} * 279), #e3a5a0 calc(${u} * 279), #e3a5a0 calc(${u} * 279 + max(1px, ${u} * 2)), transparent calc(${u} * 279 + max(1px, ${u} * 2)))`,
          `linear-gradient(to bottom, transparent calc(${u} * 1150), ${LINE} calc(${u} * 1150), ${LINE} calc(${u} * 1150 + max(1px, ${u} * 2)), transparent calc(${u} * 1150 + max(1px, ${u} * 2)))`,
          `linear-gradient(to bottom, transparent calc(${u} * 48 - ${hair}), ${LINE} calc(${u} * 48 - ${hair}), ${LINE} calc(${u} * 48))`,
        ].join(","),
        backgroundSize: `100% 100%, 100% 100%, 100% calc(${u} * 48)`,
        backgroundRepeat: "no-repeat, no-repeat, repeat",
      };
    case "graph":
      return {
        backgroundImage: [
          `linear-gradient(90deg, transparent calc(50% - 1px), #8ea3c4 calc(50% - 1px), #8ea3c4 calc(50% + 1px), transparent calc(50% + 1px))`,
          `linear-gradient(to bottom, transparent calc(50% - 1px), #8ea3c4 calc(50% - 1px), #8ea3c4 calc(50% + 1px), transparent calc(50% + 1px))`,
          `linear-gradient(${LINE} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: `100% 100%, 100% 100%, calc(${u} * 25) calc(${u} * 25), calc(${u} * 25) calc(${u} * 25)`,
        backgroundRepeat: "no-repeat, no-repeat, repeat, repeat",
      };
    default:
      return {};
  }
}
