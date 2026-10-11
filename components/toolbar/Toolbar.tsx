"use client";
// Owner: C. Notebook toolbar. Two rows so it fits an iPad in portrait:
//   top:    back · pages · title · undo/redo · Tutor · ⋯ (check page, draw with finger, dark mode) · AI
//   bottom: tools · colors (+ custom) · size with live preview · favorites
// Active buttons get a light ink tint, not a solid fill, so the page stays the loudest thing on screen.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HIGHLIGHTER_COLORS, TOOL_PRESETS, inkPalette, isEraser, themedInk } from "@/lib/ink/tools";
import { useTheme } from "@/lib/useTheme";
import { ThemeIcon, switchTheme } from "@/components/ui/ThemeToggle";
import type { ToolKind, ToolState } from "@/lib/types";
import { Icon } from "@/components/ui/icons";

interface Favorite {
  tool: ToolKind;
  color: string;
  size: number;
}

const FAV_KEY = "scratchwork.favorites"; // storage key kept from the old name so saved favorites survive
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
  const theme = useTheme();
  const inkColors = inkPalette(theme);
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
    const defaultColor = tool === "highlighter" ? HIGHLIGHTER_COLORS[0] : inkColors[0];
    const color = remembered?.color ?? (tool === "highlighter" || ts.tool === "highlighter" || isEraser(ts.tool) || ts.tool === "lasso" ? defaultColor : ts.color);
    onToolState({ ...ts, tool, color, size: remembered?.size ?? TOOL_PRESETS[tool].defaultSize });
  };

  const eraserOn = isEraser(ts.tool);
  const preset = TOOL_PRESETS[ts.tool];
  const colors = ts.tool === "highlighter" ? HIGHLIGHTER_COLORS : inkColors;
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
        <TBtn
          label={ts.tutorMode ? "Tutor on: checks your work as you write (tap to turn off)" : "Tutor off (tap to turn on)"}
          active={ts.tutorMode}
          onClick={() => onToolState({ ...ts, tutorMode: !ts.tutorMode })}
        >
          <span className="relative">
            <Icon.tutor />
            {ts.tutorMode && p.checking && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-ink-soft" aria-hidden />}
          </span>
        </TBtn>
        <MoreMenu
          drawWithFinger={ts.drawWithFinger}
          onDrawWithFinger={() => onToolState({ ...ts, drawWithFinger: !ts.drawWithFinger })}
          onCheck={p.onCheck}
          checking={p.checking}
        />
        <TBtn label="Ask RedLine" active={p.aiOpen} onClick={p.onToggleAI}>
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
              fav={f.tool === "highlighter" ? f : { ...f, color: themedInk(f.color, theme) }}
              active={f.tool === ts.tool && (f.tool === "highlighter" ? f.color : themedInk(f.color, theme)) === ts.color && f.size === ts.size}
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
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors disabled:opacity-30 ${active ? "bg-ink/10" : "hover:bg-desk"}`}
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

/** "⋯": the settings you change once a session, kept off the toolbar. */
function MoreMenu({ drawWithFinger, onDrawWithFinger, onCheck, checking }: { drawWithFinger: boolean; onDrawWithFinger(): void; onCheck?(): void; checking?: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dark = useTheme() === "dark";

  useEffect(() => {
    if (!open) return;
    // Capture phase: the page canvas swallows its own pointer events.
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <TBtn label="More" active={open} onClick={() => setOpen((o) => !o)}>
        <Icon.more />
      </TBtn>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-64 rounded-xl bg-paper p-1.5 shadow-xl ring-1 ring-rule animate-[sheet-in_.15s_ease-out]">
          {onCheck && (
            <MenuRow
              icon={<Icon.check size={20} />}
              label={checking ? "Checking…" : "Check page now"}
              disabled={checking}
              onClick={() => {
                onCheck();
                setOpen(false);
              }}
            />
          )}
          <MenuRow icon={<Icon.finger size={20} />} label="Draw with finger" on={drawWithFinger} onClick={onDrawWithFinger} />
          {/* The menu closes in the same update as the theme change, so it vanishes under the ink. */}
          <MenuRow icon={<ThemeIcon size={20} />} label="Dark mode" on={dark} onClick={(el) => switchTheme(el, () => setOpen(false))} />
        </div>
      )}
    </div>
  );
}

function MenuRow({ icon, label, on, disabled, onClick }: { icon: ReactNode; label: string; on?: boolean; disabled?: boolean; onClick(el: HTMLElement): void }) {
  const isSwitch = on !== undefined;
  return (
    <button
      role={isSwitch ? "menuitemcheckbox" : "menuitem"}
      aria-checked={isSwitch ? on : undefined}
      disabled={disabled}
      onClick={(e) => onClick(e.currentTarget)}
      className="flex h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[15px] text-ink transition-colors hover:bg-desk disabled:opacity-50"
    >
      <span className="flex w-6 justify-center text-ink-soft">{icon}</span>
      <span className="flex-1">{label}</span>
      {isSwitch && (
        <span className={`relative h-[22px] w-9 shrink-0 rounded-full transition-colors ${on ? "bg-ink" : "bg-ink/15"}`} aria-hidden>
          <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-paper shadow-sm transition-[left] ${on ? "left-[17px]" : "left-[3px]"}`} />
        </span>
      )}
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
