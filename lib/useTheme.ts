"use client";
import { useSyncExternalStore } from "react";
import { getTheme, subscribeTheme, type Theme } from "./theme";

/** The current light/dark theme; re-renders when it changes. Renders as "light" on the server. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "light");
}
