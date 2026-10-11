"use client";
// Owner: C. Keeps one broken panel from taking down the whole notebook (no white "Application error").
import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode; label: string; onReset?(): void; compact?: boolean; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div role="alert" className={`chrome z-30 rounded-xl bg-paper p-4 text-sm shadow-lg ring-1 ring-rule ${this.props.compact ? "" : "m-3"}`}>
        <p className="font-semibold">{this.props.label} hit a snag.</p>
        <p className="mt-1 text-ink-soft">Your notes are safe. Try again, and if it keeps happening, reload the page.</p>
        <button
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
          className="mt-3 h-9 rounded-full bg-ink px-4 font-medium text-paper"
        >
          Try again
        </button>
      </div>
    );
  }
}
