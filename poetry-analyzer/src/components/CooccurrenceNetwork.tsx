import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force";
import type { CooccurrenceGraph } from "../lib/cooccurrence";
import type { NetworkMetrics } from "../lib/networkMetrics";
import { communityColor } from "../lib/networkMetrics";

type SizeMode = "freq" | "degree" | "betweenness" | "pagerank";
type ColorMode = "focus" | "community";

interface SimNode extends SimulationNodeDatum {
  id: string;
  freq: number;
}

type SimLink = SimulationLinkDatum<SimNode> & { weight: number };

interface Props {
  graph: CooccurrenceGraph;
  metrics?: NetworkMetrics;
  focusId?: string;
  sizeBy?: SizeMode;
  colorBy?: ColorMode;
  width?: number;
  height?: number;
  onNodeClick?: (id: string) => void;
}

function radiusFromRatio(ratio: number): number {
  return 4 + 13 * Math.sqrt(Math.max(0, Math.min(1, ratio)));
}

function nodeRadius(
  nodeId: string,
  freq: number,
  metrics: NetworkMetrics | undefined,
  sizeBy: SizeMode,
): number {
  if (!metrics || sizeBy === "freq") {
    const maxFreq = metrics?.maxFreq ?? Math.max(1, freq);
    return radiusFromRatio(freq / Math.max(1, maxFreq));
  }
  const m = metrics.byId.get(nodeId);
  if (!m) return 4;
  if (sizeBy === "degree")
    return radiusFromRatio(m.degree / Math.max(1, metrics.maxDegree));
  if (sizeBy === "betweenness")
    return radiusFromRatio(
      m.betweenness / Math.max(1e-9, metrics.maxBetweenness),
    );
  return radiusFromRatio(m.pagerank / Math.max(1e-9, metrics.maxPageRank));
}

function labelHalfOverhang(label: string, radius: number): number {
  const fullWidth = label.length * 6.5;
  return Math.max(0, fullWidth / 2 - radius);
}

const EDGE_PADDING = 8;
const LABEL_HEIGHT_ABOVE = 20;

function clampNodeToBounds(
  node: SimNode,
  radius: number,
  width: number,
  height: number,
) {
  if (node.x == null || node.y == null) return;
  if (node.fx != null || node.fy != null) return;

  const overhang = labelHalfOverhang(node.id, radius);
  const minX = radius + EDGE_PADDING + overhang;
  const maxX = width - radius - EDGE_PADDING - overhang;
  const minY = radius + EDGE_PADDING + LABEL_HEIGHT_ABOVE;
  const maxY = height - radius - EDGE_PADDING;

  if (node.x < minX) {
    node.x = minX;
    if ((node.vx ?? 0) < 0) node.vx = 0;
  } else if (node.x > maxX) {
    node.x = maxX;
    if ((node.vx ?? 0) > 0) node.vx = 0;
  }
  if (node.y < minY) {
    node.y = minY;
    if ((node.vy ?? 0) < 0) node.vy = 0;
  } else if (node.y > maxY) {
    node.y = maxY;
    if ((node.vy ?? 0) > 0) node.vy = 0;
  }
}

export default function CooccurrenceNetwork({
  graph,
  metrics,
  focusId,
  sizeBy = "freq",
  colorBy = "focus",
  width = 640,
  height = 480,
  onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const dragRef = useRef<{ node: SimNode; moved: boolean } | null>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);

  const maxFreq = useMemo(
    () => Math.max(1, ...graph.nodes.map((n) => n.freq)),
    [graph],
  );
  const maxWeight = useMemo(
    () => Math.max(1e-9, ...graph.edges.map((e) => e.weight)),
    [graph],
  );

  useEffect(() => {
    const simNodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = graph.edges.map((e) => ({ ...e }));
    if (simNodes.length === 0) return;

    const cx = width / 2;
    const cy = height / 2;

    if (simNodes.length > 1) {
      const startR = Math.min(width, height) * 0.2;
      simNodes.forEach((n, i) => {
        const angle = (i / simNodes.length) * Math.PI * 2;
        n.x = cx + Math.cos(angle) * startR;
        n.y = cy + Math.sin(angle) * startR;
      });
    } else {
      simNodes[0].x = cx;
      simNodes[0].y = cy;
    }

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(
            (l) =>
              nodeRadius(
                (l.source as SimNode).id,
                (l.source as SimNode).freq,
                metrics,
                sizeBy,
              ) +
              nodeRadius(
                (l.target as SimNode).id,
                (l.target as SimNode).freq,
                metrics,
                sizeBy,
              ) +
              30,
          )
          .strength((l) => 0.2 + 0.6 * (l.weight / maxWeight)),
      )
      .force("charge", forceManyBody().strength(-220))
      .force("center", forceCenter(cx, cy))
      .force("x", forceX<SimNode>(cx).strength(0.1))
      .force("y", forceY<SimNode>(cy).strength(0.1))
      .force(
        "collide",
        forceCollide<SimNode>(
          (d) => nodeRadius(d.id, d.freq, metrics, sizeBy) + 8,
        ),
      )
      .alphaMin(0.02)
      .on("tick", () => {
        for (const n of simNodes) {
          clampNodeToBounds(
            n,
            nodeRadius(n.id, n.freq, metrics, sizeBy),
            width,
            height,
          );
        }
        setNodes([...simNodes]);
        setLinks([...simLinks]);
      });
    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
    // metrics и sizeBy меняют радиус узлов → меняют collision и link
    // distance, поэтому при их смене симуляция перезапускается.
    // Это ожидаемое поведение, не цикл — значения приходят из useMemo
    // и меняются только при реальном изменении графа/селектора.
  }, [graph, width, height, maxFreq, maxWeight, metrics, sizeBy]);

  const toSvgPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  };

  const handlePointerDown = (e: React.PointerEvent, node: SimNode) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { node, moved: false };
    node.fx = node.x;
    node.fy = node.y;
    simRef.current?.alphaTarget(0.3).restart();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toSvgPoint(e);
    drag.node.fx = p.x;
    drag.node.fy = p.y;
    drag.moved = true;
  };

  const handlePointerUp = (node: SimNode) => {
    const drag = dragRef.current;
    if (!drag || drag.node !== node) return;
    dragRef.current = null;
    clampNodeToBounds(
      node,
      nodeRadius(node.id, node.freq, metrics, sizeBy),
      width,
      height,
    );
    node.fx = null;
    node.fy = null;
    simRef.current?.alphaTarget(0);
    if (!drag.moved) onNodeClick?.(node.id);
  };

  if (graph.nodes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Нет связей для отображения — ослабьте фильтры или уменьшите минимальный
        вес.
      </p>
    );
  }

  const fillForNode = (n: SimNode): string => {
    if (n.id === focusId && colorBy === "focus") return "#b91c1c";
    if (colorBy === "community" && metrics) {
      const m = metrics.byId.get(n.id);
      if (m) return communityColor(m.community);
    }
    return "#0f172a";
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full touch-none select-none rounded-lg bg-slate-50"
      role="img"
    >
      <g stroke="#94a3b8">
        {links.map((l, i) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          return (
            <line
              key={i}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={t.x ?? 0}
              y2={t.y ?? 0}
              strokeWidth={0.5 + 3.5 * (l.weight / maxWeight)}
              strokeOpacity={0.45}
            />
          );
        })}
      </g>

      <g>
        {nodes.map((n) => {
          const r = nodeRadius(n.id, n.freq, metrics, sizeBy);
          const isFocus = n.id === focusId;
          const m = metrics?.byId.get(n.id);
          const tooltip = [
            `«${n.id}»`,
            `Частота: ${n.freq}`,
            m ? `Степень: ${m.degree}` : null,
            m ? `Betweenness: ${m.betweenness.toFixed(3)}` : null,
            m ? `PageRank: ${m.pagerank.toFixed(4)}` : null,
            m ? `Сообщество: C${m.community + 1}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          return (
            <g
              key={n.id}
              transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
              onPointerDown={(e) => handlePointerDown(e, n)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(n)}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                r={r}
                fill={fillForNode(n)}
                fillOpacity={isFocus ? 0.95 : 0.85}
                stroke={isFocus ? "#7f1d1d" : "#fff"}
                strokeWidth={isFocus ? 2.5 : 1.5}
              >
                <title>{tooltip}</title>
              </circle>
            </g>
          );
        })}
      </g>

      <g pointerEvents="none">
        {nodes.map((n) => {
          const r = nodeRadius(n.id, n.freq, metrics, sizeBy);
          return (
            <text
              key={n.id}
              x={n.x ?? 0}
              y={(n.y ?? 0) - r - 3}
              textAnchor="middle"
              fontSize={11}
              fill="#334155"
              style={{
                paintOrder: "stroke",
                stroke: "#f8fafc",
                strokeWidth: 2.5,
                strokeLinejoin: "round",
              }}
            >
              {n.id}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
