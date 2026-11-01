import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, BAR, GRID, TOOLTIP_CURSOR, TOOLTIP_STYLE } from "./theme";

interface Props<T> {
  title: ReactNode;
  actions?: ReactNode;
  data: T[];
  nameKey: string;
  valueKey?: string;
  vertical?: boolean;
  height?: number;
  /** Минимальная высота строки в вертикальном режиме. */
  perRow?: number;
  yWidth?: number;
  maxHeight?: number;
  xInterval?: number;
  emptyText?: string;
  onBarClick?: (name: string) => void;
}

export default function BarChartCard<T extends object>({
  title,
  actions,
  data,
  nameKey,
  valueKey = "count",
  vertical = false,
  height = 260,
  perRow = 22,
  yWidth = 110,
  maxHeight,
  xInterval,
  emptyText = "Нет данных для отображения.",
  onBarClick,
}: Props<T>) {
  const interactive = typeof onBarClick === "function";

  const chart = (
    <ResponsiveContainer
      width="100%"
      height={vertical ? Math.max(height, data.length * perRow) : height}
    >
      <BarChart
        data={data}
        layout={vertical ? "vertical" : "horizontal"}
        margin={
          vertical ? { left: 12, right: 24, top: 8, bottom: 8 } : undefined
        }
      >
        <CartesianGrid
          stroke={GRID}
          vertical={!vertical}
          horizontal={vertical}
        />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey={nameKey}
              tick={AXIS}
              width={yWidth}
              interval={0}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={nameKey} tick={AXIS} interval={xInterval} />
            <YAxis tick={AXIS} allowDecimals={false} />
          </>
        )}
        <Tooltip cursor={TOOLTIP_CURSOR} contentStyle={TOOLTIP_STYLE} />
        <Bar
          dataKey={valueKey}
          fill={BAR}
          radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          cursor={interactive ? "pointer" : undefined}
          onClick={
            interactive
              ? (entry: unknown) => {
                  const e = entry as { payload?: Record<string, unknown> };
                  const name = e.payload?.[nameKey];
                  if (typeof name === "string") onBarClick?.(name);
                }
              : undefined
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-700">{title}</h2>
        {actions}
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : maxHeight ? (
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {chart}
        </div>
      ) : (
        chart
      )}
    </div>
  );
}
