import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, BAR, GRID, TOOLTIP_CURSOR, TOOLTIP_STYLE } from "./charts/theme";

const COLOR_A = BAR;
const COLOR_B = "#f97316"; // orange-500
const BAR_STROKE = "#e2e8f0"; // slate-200

interface RowDatum {
  name: string;
  a: number;
  b: number;
}

interface FlatRow {
  name: string;
  value: number;
  series: "a" | "b";
  original: RowDatum;
  isSeparator: boolean;
}

interface Props {
  data: RowDatum[];
  labelA: string;
  labelB: string;
  height?: number;
  vertical?: boolean;
  yWidth?: number;
  maxHeight?: number;
  unit?: string;
  onBarClick?: (name: string) => void;
}

export default function CompareCharts({
  data,
  labelA,
  labelB,
  height = 320,
  vertical = false,
  yWidth = 110,
  maxHeight,
  unit,
  onBarClick,
}: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">Нет данных для отображения.</p>
    );
  }

  const interactive = typeof onBarClick === "function";
  const axisTick = unit
    ? { ...AXIS, formatter: (v: number) => `${v.toFixed(1)}${unit}` }
    : AXIS;

  const formatValue = (v: number) =>
    unit ? `${v.toFixed(2)}${unit}` : v.toLocaleString("ru-RU");

  // ────────────────────────────────────────────────────────────────────
  // Горизонтальные столбики (top-N списки): каждая пара A/B разворачивается
  // в две строки, между парами вставляется пустая строка-разделитель.
  // Подпись стоит у каждого столбика (A — нормальная, B — приглушённая),
  // поэтому пары визуально разъезжаются, и длинный список не сливается
  // в сплошную полосу.
  // ────────────────────────────────────────────────────────────────────
  if (vertical) {
    const flat: FlatRow[] = [];
    data.forEach((d, i) => {
      flat.push({
        name: d.name,
        value: d.a,
        series: "a",
        original: d,
        isSeparator: false,
      });
      flat.push({
        name: d.name,
        value: d.b,
        series: "b",
        original: d,
        isSeparator: false,
      });
      if (i < data.length - 1) {
        flat.push({
          name: "",
          value: 0,
          series: "a",
          original: d,
          isSeparator: true,
        });
      }
    });

    const renderYAxisTick = (props: {
      x?: number;
      y?: number;
      payload?: { index?: number; value?: string };
    }) => {
      const { x = 0, y = 0, payload } = props;
      const idx = payload?.index;
      if (idx == null) return <g />;
      const row = flat[idx];
      if (!row || row.isSeparator) return <g />;
      const isB = row.series === "b";
      return (
        <text
          x={x - 6}
          y={y + 3}
          textAnchor="end"
          fontSize={isB ? 10 : 11.5}
          fill={isB ? "#94a3b8" : "#0f172a"}
          fontWeight={isB ? 400 : 500}
        >
          {isB ? `· ${row.name}` : row.name}
        </text>
      );
    };

    const renderTooltip = (props: {
      active?: boolean;
      payload?: Array<{ payload: FlatRow }>;
    }) => {
      if (!props.active || !props.payload || props.payload.length === 0)
        return null;
      const row = props.payload[0].payload;
      if (row.isSeparator) return null;
      const { original } = row;
      return (
        <div style={TOOLTIP_STYLE}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            {original.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: COLOR_A,
                borderRadius: 2,
              }}
            />
            <span>
              {labelA}: {formatValue(original.a)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: COLOR_B,
                borderRadius: 2,
              }}
            />
            <span>
              {labelB}: {formatValue(original.b)}
            </span>
          </div>
        </div>
      );
    };

    const handleClick = (entry: unknown) => {
      const e = entry as { payload?: FlatRow };
      const row = e?.payload;
      if (row && !row.isSeparator) onBarClick?.(row.original.name);
    };

    const chartHeight = Math.max(height, flat.length * 22);

    const chart = (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={flat}
          layout="vertical"
          margin={{ left: 12, right: 24, top: 8, bottom: 8 }}
        >
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" tick={axisTick} />
          <YAxis
            type="category"
            dataKey="name"
            tick={renderYAxisTick}
            width={yWidth}
            interval={0}
          />
          <Tooltip content={renderTooltip} cursor={TOOLTIP_CURSOR} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            payload={[
              {
                value: labelA,
                type: "square",
                color: COLOR_A,
                id: "a",
              },
              {
                value: labelB,
                type: "square",
                color: COLOR_B,
                id: "b",
              },
            ]}
          />
          <Bar
            dataKey="value"
            stroke={BAR_STROKE}
            strokeWidth={1}
            radius={[0, 4, 4, 0]}
            barCategoryGap="15%"
            cursor={interactive ? "pointer" : undefined}
            onClick={interactive ? handleClick : undefined}
          >
            {flat.map((row, i) => (
              <Cell
                key={i}
                fill={
                  row.isSeparator
                    ? "transparent"
                    : row.series === "a"
                      ? COLOR_A
                      : COLOR_B
                }
                stroke={row.isSeparator ? "none" : BAR_STROKE}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );

    if (maxHeight) {
      return (
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {chart}
        </div>
      );
    }
    return chart;
  }

  // ────────────────────────────────────────────────────────────────────
  // Вертикальные столбики (размеры, части речи): мало категорий, пара A+B
  // стоят рядом, подпись по центру. Достаточно обводки и зазора.
  // ────────────────────────────────────────────────────────────────────
  const handleClickPair = (entry: unknown) => {
    const e = entry as { payload?: { name?: string }; name?: string };
    const name = e.payload?.name ?? e.name;
    if (name) onBarClick?.(name);
  };

  const barCommon = {
    radius: [4, 4, 0, 0] as [number, number, number, number],
    stroke: BAR_STROKE,
    strokeWidth: 1,
    cursor: interactive ? ("pointer" as const) : undefined,
    onClick: interactive ? handleClickPair : undefined,
  };

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        barCategoryGap="20%"
        barGap={2}
        margin={{ left: 12, right: 24, top: 8, bottom: 8 }}
      >
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} interval={0} />
        <YAxis tick={axisTick} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) =>
            typeof value === "number" ? formatValue(value) : value
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="a" name={labelA} fill={COLOR_A} {...barCommon} />
        <Bar dataKey="b" name={labelB} fill={COLOR_B} {...barCommon} />
      </BarChart>
    </ResponsiveContainer>
  );

  if (maxHeight) {
    return (
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {chart}
      </div>
    );
  }
  return chart;
}
