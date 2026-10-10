"use client";
// Owner: C. Notebook toolbar. Two rows so it fits an iPad in portrait:
//   top:    back · title · undo/redo · draw-with-finger · Tutor mode · Check · AI
//   bottom: tools · colors (+ custom) · size with live preview · favorites
import { useRef, useState, type ReactNode } from "react";
import { HIGHLIGHTER_COLORS, INK_COLORS, TOOL_PRESETS, isEraser } from "@/lib/ink/tools";
import type { ToolKind, ToolState } from "@/lib/types";
import { Icon } from "@/components/ui/icons";

interface Favorite {
  tool: ToolKind;
  color: string;
  size: number;
}

const FAV_KEY = "scratchwork.favorites";
const MAX_FAVS = 6;
const DRAW_TOOLS: { tool: ToolKind; icon: (p: { size?: number }) => ReactNode }[] = [
  { tool: "pen", icon: Icon.pen },
  { tool: "fineliner", icon: Icon.fineliner },
  { tool: "pencil", icon: Icon.pencil },
  { tool: "highlighter", icon: Icon.highlighter },
];

export interface ToolbarProps {
  title: string;
  toolState: ToolState;
  onToolState(next: ToolState): void;
  history: { canUndo: boolean; canRedo: boolean };
  onUndo(): void;
  onRedo(): void;
  onBack(): void;
  aiOpen: boolean;
  onToggleAI(): void;
  /** Manual "check this page" (Live Check also runs on its own when Tutor mode is on). */
  onCheck?(): void;
  checking?: boolean;
  railOpen?: boolean;
  onToggleRail?(): void;
}

export function Toolbar(p: ToolbarProps) {
  const { toolState: ts, onToolState } = p;
  const lastByTool = useRef<Partial<Record<ToolKind, { color: string; size: number }>>>({});
  // The toolbar only renders after the notebook loads from IndexedDB, so this never runs on the server.
  const [favs, setFavs] = useState<Favorite[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
    } catch {
      return []; // private mode or bad JSON
    }
  });
  const saveFavs = (next: Favorite[]) => {
    setFavs(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const pick = (tool: ToolKind) => {
    if (tool === ts.tool) return;
    lastByTool.current[ts.tool] = { color: ts.color, size: ts.size };
    const remembered = lastByTool.current[tool];
    const defaultColor = tool === "highlighter" ? HIGHLIGHTER_COLORS[0] : INK_COLORS[0];
    const color = remembered?.color ?? (tool === "highlighter" || ts.tool === "highlighter" || isEraser(ts.tool) || ts.tool === "lasso" ? defaultColor : ts.color);
    onToolState({ ...ts, tool, color, size: remembered?.size ?? TOOL_PRESETS[tool].defaultSize });
  };

  const eraserOn = isEraser(ts.tool);
  const preset = TOOL_PRESETS[ts.tool];
  const colors = ts.tool === "highlighter" ? HIGHLIGHTER_COLORS : INK_COLORS;
  const showColor = !eraserOn && ts.tool !== "lasso";
  const showSize = ts.tool !== "lasso";

  return (
    <div className="chrome z-20 border-b border-rule bg-paper/95 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(29,42,68,.04)] backdrop-blur">
      {/* top row */}
      <div className="flex h-12 items-center gap-1 px-2">
        <TBtn label="Library" onClick={p.onBack}>
          <Icon.back />
        </TBtn>
        {p.onToggleRail && (
          <TBtn label="Pages" active={p.railOpen} onClick={p.onToggleRail}>
            <Icon.pages />
          </TBtn>
        )}
        <div className="min-w-0 flex-1 truncate px-1 font-hand text-2xl leading-none">{p.title}</div>
        <TBtn label="Undo" onClick={p.onUndo} disabled={!p.history.canUndo}>
          <Icon.undo />
        </TBtn>
        <TBtn label="Redo" onClick={p.onRedo} disabled={!p.history.canRedo}>
          <Icon.redo />
        </TBtn>
        <Divider />
        <TBtn label="Draw with finger" active={ts.drawWithFinger} onClick={() => onToolState({ ...ts, drawWithFinger: !ts.drawWithFinger })}>
          <Icon.finger />
        </TBtn>
        <button
          onClick={() => onToolState({ ...ts, tutorMode: !ts.tutorMode })}
          aria-pressed={ts.tutorMode}
          className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${ts.tutorMode ? "bg-mark text-white" : "bg-desk text-ink-soft"}`}
        >
          <Icon.tutor size={18} />
          Tutor {ts.tutorMode ? "on" : "off"}
        </button>
        {p.onCheck && (
          <button onClick={p.onCheck} disabled={p.checking} className="h-10 rounded-full border border-rule px-3 text-sm font-medium disabled:opacity-50">
            {p.checking ? "Checking…" : "Check page"}
          </button>
        )}
        <TBtn label="Ask Scratchwork" active={p.aiOpen} onClick={p.onToggleAI}>
          <Icon.sparkle />
        </TBtn>
      </div>

      {/* bottom row: tools, colors, size, favorites */}
      <div className="no-scrollbar flex h-14 items-center gap-1 overflow-x-auto px-2">
        {DRAW_TOOLS.map(({ tool, icon }) => (
          <TBtn key={tool} label={TOOL_PRESETS[tool].label} active={ts.tool === tool} onClick={() => pick(tool)}>
            {icon({})}
          </TBtn>
        ))}
        <TBtn
          label={eraserOn ? `${TOOL_PRESETS[ts.tool].label} (tap to switch)` : "Eraser"}
          active={eraserOn}
          onClick={() => pick(eraserOn ? (ts.tool === "eraser-stroke" ? "eraser-precise" : "eraser-stroke") : "eraser-stroke")}
        >
          <span className="relative">
            <Icon.eraser />
            {eraserOn && (
              <span className="absolute -bottom-1.5 -right-2 rounded bg-ink px-1 text-[9px] font-semibold leading-tight text-paper">
                {ts.tool === "eraser-stroke" ? "STROKE" : "PRECISE"}
              </span>
            )}
          </span>
        </TBtn>
        <TBtn label="Lasso: select a region to ask about" active={ts.tool === "lasso"} onClick={() => pick("lasso")}>
          <Icon.lasso />
        </TBtn>

        {showColor && (
          <>
            <Divider />
            {colors.map((c) => (
              <Swatch key={c} color={c} active={ts.color.toLowerCase() === c.toLowerCase()} onClick={() => onToolState({ ...ts, color: c })} />
            ))}
            <label className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-label="Custom color">
              <span
                className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-paper ${!colors.some((c) => c.toLowerCase() === ts.color.toLowerCase()) ? "ring-2 ring-ink" : ""}`}
                style={{ background: "conic-gradient(#e33, #fc3, #3c6, #39f, #93f, #e33)" }}
              />
              <input type="color" value={toHex(ts.color)} onChange={(e) => onToolState({ ...ts, color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </>
        )}

        {showSize && (
          <>
            <Divider />
            <div className="flex shrink-0 items-center gap-2 px-1">
              <span className="flex h-9 w-9 items-center justify-center" aria-hidden>
                <span
                  className="rounded-full"
                  style={{
                    width: Math.max(3, Math.min(30, ts.size * 1.4)),
                    height: Math.max(3, Math.min(30, ts.size * 1.4)),
                    background: eraserOn ? "transparent" : ts.color,
                    border: eraserOn ? "1.5px solid var(--ink-soft)" : undefined,
                    opacity: ts.tool === "highlighter" ? 0.55 : 1,
                  }}
                />
              </span>
              <input
                aria-label="Size"
                type="range"
                min={preset.minSize}
                max={preset.maxSize}
                step={0.5}
                value={ts.size}
                onChange={(e) => onToolState({ ...ts, size: Number(e.target.value) })}
                className="w-28 accent-[var(--ink)]"
              />
            </div>
          </>
        )}

        <Divider />
        <div className="flex shrink-0 items-center gap-1">
          {favs.map((f, i) => (
            <FavoriteChip
              key={`${f.tool}-${f.color}-${f.size}-${i}`}
              fav={f}
              active={f.tool === ts.tool && f.color === ts.color && f.size === ts.size}
              onApply={() => onToolState({ ...ts, tool: f.tool, color: f.color, size: f.size })}
              onRemove={() => saveFavs(favs.filter((_, j) => j !== i))}
            />
          ))}
          {favs.length < MAX_FAVS && !eraserOn && ts.tool !== "lasso" && (
            <TBtn label="Save this pen as a favorite" onClick={() => saveFavs([...favs, { tool: ts.tool, color: ts.color, size: ts.size }])}>
              <span className="flex items-center text-ink-soft">
                <Icon.star size={18} />
                <Icon.plus size={12} />
              </span>
            </TBtn>
          )}
        </div>
      </div>
    </div>
  );
}

function TBtn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-30 ${active ? "bg-ink text-paper" : "text-ink hover:bg-desk"}`}
    >
      {children}
    </button>
  );
}

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick(): void }) {
  return (
    <button aria-label={`Color ${color}`} onClick={onClick} className="flex h-11 w-9 shrink-0 items-center justify-center">
      <span className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-paper ${active ? "ring-2 ring-ink" : ""}`} style={{ background: color }} />
    </button>
  );
}

function FavoriteChip({ fav, active, onApply, onRemove }: { fav: Favorite; active: boolean; onApply(): void; onRemove(): void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const removed = useRef(false);
  return (
    <button
      aria-label={`Favorite: ${TOOL_PRESETS[fav.tool].label}, hold to remove`}
      title="Tap to use · hold to remove"
      onPointerDown={() => {
        removed.current = false;
        timer.current = setTimeout(() => {
          removed.current = true;
          onRemove();
        }, 600);
      }}
      onPointerUp={() => clearTimeout(timer.current)}
      onPointerLeave={() => clearTimeout(timer.current)}
      onClick={() => !removed.current && onApply()}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-desk ring-1 ring-ink" : ""}`}
    >
      <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden>
        <path
          d="M3 11 C 9 3, 13 3, 15 8 S 23 13, 27 5"
          fill="none"
          stroke={fav.color}
          strokeWidth={Math.max(1.5, Math.min(9, fav.size * 0.9))}
          strokeLinecap={fav.tool === "highlighter" ? "butt" : "round"}
          opacity={fav.tool === "highlighter" ? 0.55 : 1}
        />
      </svg>
    </button>
  );
}

const Divider = () => <span className="mx-1 h-7 w-px shrink-0 bg-rule" />;

/** <input type="color"> only accepts #rrggbb. */
function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + [...c.slice(1)].map((ch) => ch + ch).join("");
  return "#1d2a44";
}
