// Light / dark theme. The theme lives on <html data-theme="…"> (set before first paint by the
// inline script in app/layout.tsx), so CSS variables switch instantly and the canvas code can read it
// synchronously. React reads it through useTheme() (lib/useTheme.ts); the ink canvas subscribes directly.
// No React import here: the server layout imports this file for the boot script.

export type Theme = "light" | "dark";

export const THEME_KEY = "redline.theme";

/** Status-bar / browser chrome color per theme (matches --desk in globals.css). */
export const THEME_CHROME: Record<Theme, string> = { light: "#f0ede4", dark: "#0e1420" };

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Switch the theme right now (no animation). Listeners run synchronously. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_CHROME[theme]));
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // private mode: the choice just isn't remembered
  }
  for (const fn of listeners) fn();
}

/**
 * Runs before first paint (inlined into <head>), so a dark-mode user never sees a white flash.
 * Saved choice first, then the device setting.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})();`;
