"use client";
// Owner: C. Text with real math notation: $...$ LaTeX (or detected ASCII math) typeset with KaTeX.
// KaTeX's fonts are bundled with the app, so this works offline and never shows "int" or "x^2".
import katex from "katex";
import "katex/dist/katex.min.css";
import { memo } from "react";
import { toSegments } from "@/lib/math/tex";

function render(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display, output: "html", strict: "ignore", trust: false });
  } catch {
    return tex.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  }
}

export const MathText = memo(function MathText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`math-text ${className}`}>
      {toSegments(text).map((s, i) =>
        s.kind === "text" ? <span key={i}>{s.text}</span> : <span key={i} dangerouslySetInnerHTML={{ __html: render(s.tex, false) }} />,
      )}
    </span>
  );
});

/** A single LaTeX expression (e.g. an answer key already converted to TeX). */
export const MathTex = memo(function MathTex({ tex, className = "" }: { tex: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: render(tex, false) }} />;
});
