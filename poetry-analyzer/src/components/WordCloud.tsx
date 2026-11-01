import { useEffect, useState } from "react";
import cloud from "d3-cloud";

export interface CloudWord {
  text: string;
  size: number;
  color?: string;
}

interface PlacedWord extends CloudWord {
  x: number;
  y: number;
  rotate: number;
}

interface Props {
  words: CloudWord[];
  width?: number;
  height?: number;
  onWordClick?: (text: string) => void;
}

export default function WordCloud({
  words,
  width = 760,
  height = 380,
  onWordClick,
}: Props) {
  const [placed, setPlaced] = useState<PlacedWord[]>([]);

  useEffect(() => {
    if (words.length === 0) return;
    let cancelled = false;
    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(words.map((w) => ({ ...w })))
      .padding(2)
      .rotate(0)
      .font("system-ui")
      .fontSize((d) => d.size)
      .on("end", (result) => {
        if (!cancelled) setPlaced(result as PlacedWord[]);
      });
    layout.start();
    return () => {
      cancelled = true;
      layout.stop();
    };
  }, [words, width, height]);

  if (words.length === 0) {
    return (
      <p className="text-sm text-slate-500">Нет данных для отображения.</p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full select-none"
      role="img"
    >
      <g transform={`translate(${width / 2},${height / 2})`}>
        {placed.map((w) => (
          <text
            key={w.text}
            transform={`translate(${w.x},${w.y}) rotate(${w.rotate})`}
            textAnchor="middle"
            fontSize={w.size}
            fontFamily="system-ui"
            fill={w.color ?? "#0f172a"}
            className={
              onWordClick ? "cursor-pointer hover:opacity-70" : undefined
            }
            onClick={onWordClick ? () => onWordClick(w.text) : undefined}
          >
            {w.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
