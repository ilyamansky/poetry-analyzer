import { fmt1 } from "../lib/format";
import type { DistSummary } from "../lib/stats";

export interface DistRow {
  label: string;
  dist: DistSummary;
}

export default function DistributionTable({ rows }: { rows: DistRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Метрика</th>
            <th className="px-3 py-2 text-right font-medium">Мин</th>
            <th className="px-3 py-2 text-right font-medium">Медиана</th>
            <th className="px-3 py-2 text-right font-medium">Среднее</th>
            <th className="px-3 py-2 text-right font-medium">Мода</th>
            <th className="py-2 pl-3 text-right font-medium">Макс</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="py-2 pr-4 text-slate-700">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                {r.dist.min}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {fmt1(r.dist.median)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                {fmt1(r.dist.mean)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.dist.modeCount > 1 ? (
                  <>
                    <span className="font-medium">{r.dist.mode}</span>
                    <span className="ml-1 text-xs text-slate-400">
                      ×{r.dist.modeCount}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-slate-600">
                {r.dist.max}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

