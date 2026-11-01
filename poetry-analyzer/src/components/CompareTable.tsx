interface Row {
  label: string;
  a: string | number;
  b: string | number;
  delta?: number | null;
  unit?: string;
}

interface Props {
  labelA: string;
  labelB: string;
  rows: Row[];
}

function fmtDelta(delta: number | null | undefined, unit = ""): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${unit}`;
}

export default function CompareTable({ labelA, labelB, rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Метрика</th>
            <th className="px-3 py-2 text-right font-medium">{labelA}</th>
            <th className="px-3 py-2 text-right font-medium">{labelB}</th>
            <th className="py-2 pl-3 text-right font-medium">Δ (A − B)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="py-2 pr-4 text-slate-700">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.a}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.b}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-slate-500">
                {fmtDelta(r.delta, r.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
