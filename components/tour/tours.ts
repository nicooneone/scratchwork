// Owner: C. Tour content and "has this person seen it" flags.
import type { TourStep } from "./Tour";

const KEYS = { library: "redline.tour.library", notebook: "redline.tour.notebook" } as const;
export type TourId = keyof typeof KEYS;

export function tourDone(id: TourId): boolean {
  try {
    return localStorage.getItem(KEYS[id]) === "done";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}

export function markTour(id: TourId | "all") {
  try {
    for (const k of id === "all" ? Object.values(KEYS) : [KEYS[id]]) localStorage.setItem(k, "done");
  } catch {
    /* ignore */
  }
}

/** The notebook tour shows again the next time a notebook opens. */
export function resetNotebookTour() {
  try {
    localStorage.removeItem(KEYS.notebook);
  } catch {
    /* ignore */
  }
}

export function resetTours() {
  try {
    for (const k of Object.values(KEYS)) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Pencil/finger device vs mouse/trackpad. */
export const usesTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function libraryTour(hasNotebooks: boolean): TourStep[] {
  return [
    {
      title: "Welcome to RedLine",
      body: "A notebook that checks your math as you write. It underlines the first wrong step and asks you a question about it, instead of handing you the answer.",
      cta: "Show me around",
    },
    {
      target: "new-notebook",
      title: "Start with a notebook",
      body: "Make one for each class. Pick a cover and the paper you like: grid, lined, dot, Cornell or graph.",
    },
    {
      title: hasNotebooks ? "Open a notebook" : "That's it for here",
      body: hasNotebooks
        ? "Open any notebook and we'll show you the tools inside. Long-press (or right-click) a cover to rename or delete it."
        : "Create your first notebook and we'll show you the tools inside. You can replay this tour any time.",
      cta: "Got it",
    },
  ];
}

export function notebookTour(): TourStep[] {
  const touch = usesTouch();
  return [
    {
      title: "Your notebook",
      body: "Here's a one-minute look at how everything works. You can skip anytime and replay it from the ⋯ menu.",
      cta: "Let's go",
    },
    {
      target: "page",
      title: "Write right on the page",
      body: touch
        ? "Write with your Apple Pencil. Fingers scroll and pinch to zoom, so a resting palm never leaves marks."
        : "Draw with your mouse or trackpad. Scroll to move around the page. (On an iPad, the Apple Pencil draws and fingers scroll.)",
    },
    {
      target: "tools",
      title: "Pens, colors and more",
      body: "Fountain pen, fineliner, pencil and highlighter. Tap the eraser again to switch between erasing whole strokes and precise erasing. The lasso selects part of the page to ask about. The ★ saves your favorite pen.",
    },
    {
      target: "tutor",
      title: "Tutor mode checks every line",
      body: "Start the next line and RedLine reads the one above and checks the math. A red line marks the first mistake. Tap “Look here” for a hint: a question, never the answer. Fix it and the mark clears.",
    },
    {
      target: "more",
      title: "More options",
      body: touch
        ? "Check the whole page on demand, let your finger draw, switch to dark mode, or replay this tour."
        : "Check the whole page on demand, switch to dark mode, or replay this tour. Mouse drawing is already on.",
    },
    {
      target: "ai",
      title: "Ask, Quiz and Insights",
      body: "Ask anything about your notes and jump to the page the answer came from. Make a quiz from your weak spots, with presets or your own settings. Insights shows how well you know each topic.",
    },
    {
      target: "pages",
      title: "Your pages",
      body: "Add pages and choose the paper for each one. A green dot means RedLine has read that page, so Ask and Quiz can use it.",
    },
    {
      title: "Try it now",
      body: "Write 2x + 3 = 7. On the next line, write 2x = 5. Watch the red line appear, then tap “Look here”.",
      cta: "Start writing",
    },
  ];
}
