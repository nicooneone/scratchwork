// Owner: C. Small inline icon set (stroke icons, 24px grid). No icon dependency.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 22, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const Icon = {
  back: (p: P) => <I {...p}><path d="M15 5l-7 7 7 7" /></I>,
  plus: (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>,
  undo: (p: P) => <I {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></I>,
  redo: (p: P) => <I {...p}><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></I>,
  pen: (p: P) => <I {...p}><path d="M15 4l5 5L9 20l-6 1 1-6z" /><path d="M13 6l5 5" /></I>,
  fineliner: (p: P) => <I {...p}><path d="M17 3l4 4L8 20H4v-4z" /></I>,
  pencil: (p: P) => <I {...p}><path d="M16 3l5 5L8 21H3v-5z" /><path d="M3 16l5 5" /><path d="M14 5l5 5" /></I>,
  highlighter: (p: P) => <I {...p}><path d="M9 15l-4 4h5l2-2" /><path d="M9 15l7-11 4 4-11 7z" /><path d="M4 21h16" /></I>,
  eraser: (p: P) => <I {...p}><path d="M7 21h12" /><path d="M5 15l9-9a2 2 0 013 0l3 3a2 2 0 010 3l-8 8H9z" /><path d="M10 10l5 5" /></I>,
  lasso: (p: P) => <I {...p}><ellipse cx="12" cy="9" rx="8" ry="5" strokeDasharray="3 3" /><path d="M7 13c-1 3 1 5 3 5s2 2 1 3" /></I>,
  finger: (p: P) => <I {...p}><path d="M9 11V5a2 2 0 014 0v6" /><path d="M13 10a2 2 0 014 0v2a2 2 0 014 0v3a7 7 0 01-7 7h-1a7 7 0 01-6-3l-3-5a2 2 0 013-2l2 2" /></I>,
  sparkle: (p: P) => <I {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></I>,
  check: (p: P) => <I {...p}><path d="M5 12l5 5 9-10" /></I>,
  close: (p: P) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>,
  play: (p: P) => <I {...p}><path d="M8 5l11 7-11 7z" fill="currentColor" /></I>,
  stop: (p: P) => <I {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /></I>,
  send: (p: P) => <I {...p}><path d="M4 12l16-8-6 16-2-6z" /></I>,
  pages: (p: P) => <I {...p}><rect x="4" y="3" width="12" height="16" rx="1.5" /><path d="M8 21h10a2 2 0 002-2V7" /></I>,
  star: (p: P) => <I {...p}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" /></I>,
  tutor: (p: P) => <I {...p}><path d="M4 18c3-1 4-4 6-4s2 3 4 3 3-2 6-3" /><circle cx="17" cy="7" r="4" /></I>,
  more: (p: P) => <I {...p}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></I>,
};
