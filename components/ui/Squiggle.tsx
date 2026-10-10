// Owner: C. AI loading state: a pen squiggle drawing itself. No spinners.
export function Squiggle({ label = "Reading your work…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-ink-soft ${className}`} role="status">
      <svg width="54" height="18" viewBox="0 0 54 18" aria-hidden>
        <path
          d="M2 12 C 8 2, 12 2, 14 10 S 22 16, 26 8 S 34 2, 38 10 S 46 16, 52 6"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="squiggle"
        />
      </svg>
      <span className="font-hand text-lg leading-none">{label}</span>
    </div>
  );
}
