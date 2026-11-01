import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { decodeCorpusRef } from "../store/comparisonStore";
import { usePoemsStore } from "../store/poemsStore";

const selectClass =
  "min-w-0 max-w-[150px] truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm sm:max-w-[200px]";

const labelClass = "text-xs font-medium text-slate-500";

export default function CorpusPicker() {
  const groups = usePoemsStore((s) => s.groups);
  const count = usePoemsStore((s) => s.poems.length);
  const { keyA, keyB, setA, setB, swap } = useGlobalCorpusSelection();

  if (count === 0) return null;

  const hasB = keyB != null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        <span className={labelClass} aria-hidden="true">
          A
        </span>
        <select
          aria-label="Корпус A"
          title="Корпус A"
          value={keyA}
          onChange={(e) => setA(decodeCorpusRef(e.target.value))}
          className={selectClass}
        >
          <option value="all">Весь корпус</option>
          <option value="none">Без группы</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id} title={g.name}>
              {g.name} ({g.poemIds.length})
            </option>
          ))}
        </select>
      </div>

      {hasB && (
        <button
          onClick={swap}
          title="Поменять A и B местами"
          aria-label="Поменять A и B местами"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          ⇄
        </button>
      )}

      <div className="flex items-center gap-1">
        <span className={labelClass} aria-hidden="true">
          B
        </span>
        <select
          aria-label="Корпус B"
          title="Корпус B"
          value={keyB ?? ""}
          onChange={(e) =>
            setB(e.target.value ? decodeCorpusRef(e.target.value) : null)
          }
          className={selectClass}
        >
          <option value="">Сравнить с…</option>
          <option value="all">Весь корпус</option>
          <option value="none">Без группы</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id} title={g.name}>
              {g.name} ({g.poemIds.length})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
