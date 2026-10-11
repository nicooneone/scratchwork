"use client";
// Owner: C. Centered modal sheet with a dimmed backdrop. Tap outside or Esc to close.
import { useEffect, type ReactNode } from "react";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 backdrop-blur-[3px] animate-[fade-in_.2s_ease-out] sm:items-center" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className="w-full max-w-md rounded-[28px] bg-paper p-6 shadow-[inset_0_1px_0_var(--glass-hi),0_0_0_1px_var(--glass-edge),var(--shadow-lg)] animate-[rise-in_.28s_cubic-bezier(.2,.9,.25,1.1)]">
        <h2 className="mb-5 text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}
