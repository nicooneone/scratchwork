"use client";
// Owner: C. Concept map: topics from every indexed page. Node size = pages on that topic,
// edges = topics on the same page (weight 1) or on consecutive pages of a notebook (weight 0.5). Tap a node to list its pages.
import { useMemo, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { Notebook, Page } from "@/lib/types";
import { pageLabel } from "@/components/ai/indexing";

interface Node extends SimulationNodeDatum {
  id: string;
  pages: string[];
  r: number;
}
type Link = SimulationLinkDatum<Node> & { w: number };

const W = 340, H = 280;

export function ConceptMap({ pages, notebooks, onNavigate }: { pages: Page[]; notebooks: Map<string, Notebook>; onNavigate(pageId: string): void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => {
    const byTopic = new Map<string, Set<string>>();
    const pairs = new Map<string, number>();
    for (const p of pages) {
      const topics = [...new Set(p.brain?.topics ?? [])];
      for (const t of topics) (byTopic.get(t) ?? byTopic.set(t, new Set()).get(t)!).add(p.id);
      for (let i = 0; i < topics.length; i++)
        for (let j = i + 1; j < topics.length; j++) {
          const k = [topics[i], topics[j]].sort().join("|");
          pairs.set(k, (pairs.get(k) ?? 0) + 1);
        }
    }
    // Topics on consecutive pages of the same notebook are related too (a lesson continues), at half weight.
    const byNotebook = new Map<string, Page[]>();
    for (const p of pages) if (p.brain?.topics?.length) (byNotebook.get(p.notebookId) ?? byNotebook.set(p.notebookId, []).get(p.notebookId)!).push(p);
    for (const list of byNotebook.values()) {
      list.sort((a, b) => a.index - b.index);
      for (let i = 0; i + 1 < list.length; i++) {
        if (list[i + 1].index !== list[i].index + 1) continue;
        for (const a of new Set(list[i].brain!.topics))
          for (const b of new Set(list[i + 1].brain!.topics)) {
            if (a === b) continue;
            const k = [a, b].sort().join("|");
            pairs.set(k, (pairs.get(k) ?? 0) + 0.5);
          }
      }
    }
    const nodes: Node[] = [...byTopic].map(([id, ps]) => ({ id, pages: [...ps], r: 9 + 5 * Math.sqrt(ps.size) }));
    const links: Link[] = [...pairs].map(([k, w]) => {
      const [a, b] = k.split("|");
      return { source: a, target: b, w };
    });
    // Run the layout to rest once, then render statically (no animation loop on the iPad).
    const sim = forceSimulation(nodes)
      .force("link", forceLink<Node, Link>(links).id((d) => d.id).distance(70).strength(0.6))
      .force("charge", forceManyBody().strength(-160))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<Node>().radius((d) => d.r + 22))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();
    for (const n of nodes) {
      n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x ?? W / 2));
      n.y = Math.max(n.r + 4, Math.min(H - n.r - 16, n.y ?? H / 2));
    }
    return { nodes, links };
  }, [pages]);

  if (!nodes.length) return <p className="text-sm text-ink-soft">Topics appear here once your pages are indexed.</p>;
  const sel = nodes.find((n) => n.id === selected);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-surface ring-1 ring-rule">
        {links.map((l, i) => {
          const s = l.source as Node, t = l.target as Node;
          const hot = selected && (s.id === selected || t.id === selected);
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={hot ? "var(--ink)" : "var(--rule)"} strokeWidth={Math.min(5, 0.8 + l.w)} />;
        })}
        {nodes.map((n) => (
          <g key={n.id} onClick={() => setSelected(n.id === selected ? null : n.id)} style={{ cursor: "pointer" }}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.id === selected ? "var(--ink)" : "var(--desk)"} stroke="var(--ink)" strokeWidth={1.2} />
            <text x={n.x} y={(n.y ?? 0) + n.r + 12} textAnchor="middle" fontSize={10.5} fill="var(--ink)">
              {n.id.replace(/-/g, " ")}
            </text>
          </g>
        ))}
      </svg>
      {sel && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sel.pages.map((id) => {
            const p = pages.find((x) => x.id === id);
            return p ? (
              <button key={id} onClick={() => onNavigate(id)} className="rounded-full bg-desk px-2.5 py-1 text-xs font-medium">
                {pageLabel(p, notebooks)}
              </button>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
