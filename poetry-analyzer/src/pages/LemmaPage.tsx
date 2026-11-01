// src/pages/LemmaPage.tsx
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Highlight } from "../components/Highlight";
import Pagination from "../components/Pagination";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { usePagination } from "../hooks/usePagination";
import { POS_COLORS, posGroup, type PosGroup } from "../lib/pos";
import { translateMeter } from "../lib/api";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";
import type { Poem } from "../types";

const COLLOCATION_WINDOW = 5;

interface CountEntry {
  name: string;
  count: number;
}

interface PositionStats {
  begin: number;
  middle: number;
  end: number;
  total: number;
}

export default function LemmaPage() {
  const { lemma: rawLemma } = useParams<{ lemma: string }>();
  const lemma = rawLemma ? decodeURIComponent(rawLemma) : "";

  const poems = usePoemsStore((s) => s.poems);
  const analyses = useAnalysisStore((s) => s.analyses);
  const navigate = useNavigate();

  const {
    a: corpusPoems,
    b: corpusB,
    keyA,
    labelA,
    labelB,
    setA,
  } = useGlobalCorpusSelection();

  // Стихи, где лемма встречается, + формы для подсветки.
  const matches = useMemo(() => {
    const result: { poem: Poem; forms: string[] }[] = [];
    for (const poem of corpusPoems) {
      const a = analyses[poem.id];
      if (!a) continue;
      const forms = new Set<string>();
      for (const t of a.tokens) {
        if (t.lemma === lemma) forms.add(t.original);
      }
      if (forms.size > 0) result.push({ poem, forms: [...forms] });
    }
    return result;
  }, [corpusPoems, analyses, lemma]);

  const posDist = useMemo(() => {
    const counts = new Map<PosGroup, number>();
    for (const poem of corpusPoems) {
      const a = analyses[poem.id];
      if (!a) continue;
      for (const t of a.tokens) {
        if (t.lemma !== lemma) continue;
        const g = posGroup(t.pos);
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [corpusPoems, analyses, lemma]);

  const countB = useMemo(() => {
    if (!corpusB) return null;
    let n = 0;
    for (const poem of corpusB) {
      const a = analyses[poem.id];
      if (!a) continue;
      if (a.tokens.some((t) => t.lemma === lemma)) n++;
    }
    return n;
  }, [corpusB, analyses, lemma]);

  // ─── Портрет: формы, размеры, позиции, коллокации, частота ────────
  const portrait = useMemo(() => {
    const forms = new Map<string, number>();
    const meters = new Map<string, number>();
    const positions: PositionStats = {
      begin: 0,
      middle: 0,
      end: 0,
      total: 0,
    };
    const collocations = new Map<string, number>();
    let freq = 0;
    let totalLemmas = 0;

    for (const poem of corpusPoems) {
      const a = analyses[poem.id];
      if (!a) continue;
      totalLemmas += a.tokens.length;

      const indices: number[] = [];
      for (let i = 0; i < a.tokens.length; i++) {
        if (a.tokens[i].lemma === lemma) indices.push(i);
      }
      if (indices.length === 0) continue;

      freq += indices.length;

      for (const i of indices) {
        const t = a.tokens[i];
        const form = t.original.toLowerCase();
        forms.set(form, (forms.get(form) ?? 0) + 1);
      }

      const meter = a.meter
        ? (translateMeter(a.meter) ?? "не определён")
        : "не определён";
      meters.set(meter, (meters.get(meter) ?? 0) + 1);

      // Коллокации в окне ±N
      for (const i of indices) {
        const lo = Math.max(0, i - COLLOCATION_WINDOW);
        const hi = Math.min(a.tokens.length, i + COLLOCATION_WINDOW + 1);
        for (let j = lo; j < hi; j++) {
          if (j === i) continue;
          const other = a.tokens[j].lemma;
          if (other === lemma) continue;
          if (other.length <= 1) continue;
          collocations.set(other, (collocations.get(other) ?? 0) + 1);
        }
      }

      // Позиция первого вхождения в каждой строке
      const formsSet = new Set(
        indices.map((i) => a.tokens[i].original.toLowerCase()),
      );
      for (const line of poem.content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const lower = line.toLowerCase();
        const words = lower.split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;

        let matchedAt = -1;
        let matchedLen = 0;
        for (const form of formsSet) {
          const idx = lower.indexOf(form);
          if (idx >= 0 && (matchedAt === -1 || idx < matchedAt)) {
            matchedAt = idx;
            matchedLen = form.length;
          }
        }
        if (matchedAt === -1) continue;

        // Позиция по номеру «слова» в строке
        let acc = 0;
        let wordPos = 0;
        for (let wi = 0; wi < words.length; wi++) {
          if (acc >= matchedAt) {
            wordPos = wi;
            break;
          }
          acc += words[wi].length + 1;
          wordPos = wi + 1;
        }
        const ratio = wordPos / Math.max(1, words.length);
        if (ratio < 0.33) positions.begin++;
        else if (ratio < 0.67) positions.middle++;
        else positions.end++;
        positions.total++;

        void matchedLen;
      }
    }

    const byCount = (m: Map<string, number>): CountEntry[] =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count }));

    return {
      freq,
      totalLemmas,
      forms: byCount(forms),
      meters: byCount(meters),
      positions,
      collocations: byCount(collocations).slice(0, 20),
    };
  }, [corpusPoems, analyses, lemma]);

  const total = matches.length;
  const { page, pageSize, setPage, setPageSize } = usePagination({
    total,
    defaultPageSize: 20,
  });
  const start = (page - 1) * pageSize;
  const visible = matches.slice(start, start + pageSize);

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  const percentOfLemmas =
    portrait.totalLemmas > 0
      ? ((portrait.freq / portrait.totalLemmas) * 100).toFixed(2)
      : "0.00";

  return (
    <div>
      <Link to="/stats" className="text-sm text-slate-500 hover:text-slate-900">
        ← К статистике
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">
        Лемма: <span className="font-mono">{lemma}</span>
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>
          Найдено стихотворений: <strong>{total}</strong> · вхождений:{" "}
          <strong>{portrait.freq}</strong> · {percentOfLemmas}% всех лемм
        </span>
        {keyA !== "all" && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 py-1 pl-2 pr-1">
            корпус «{labelA}»
            <button
              onClick={() => setA("all")}
              className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Убрать фильтр по корпусу"
            >
              ✕
            </button>
          </span>
        )}
        {countB !== null && labelB && (
          <span className="text-slate-500">
            · в корпусе «{labelB}»: <strong>{countB}</strong>
          </span>
        )}
        {posDist.map(([group, count]) => (
          <span
            key={group}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: POS_COLORS[group] ?? "#d6d3d1" }}
            />
            {group} · {count}
          </span>
        ))}
      </div>

      {total === 0 ? (
        <p className="mt-6 text-slate-500">
          {keyA !== "all"
            ? "В этом корпусе проанализированных стихов с данной леммой нет."
            : "В проанализированных стихах эта лемма не встречается. Возможно, анализ ещё не запускался."}
        </p>
      ) : (
        <>
          {/* ─── Портрет ──────────────────────────────────────── */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card title="Формы">
              <BarList entries={portrait.forms} />
            </Card>
            <Card title={`Коллокации (окно ±${COLLOCATION_WINDOW} слов)`}>
              {portrait.collocations.length === 0 ? (
                <p className="text-sm text-slate-500">Нет данных.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {portrait.collocations.map((c) => (
                    <button
                      key={c.name}
                      onClick={() =>
                        navigate(`/lemma/${encodeURIComponent(c.name)}`)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      <span className="text-slate-800">{c.name}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600 tabular-nums">
                        {c.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Размеры (среди стихов, где есть слово)">
              <BarList entries={portrait.meters} />
            </Card>
            <Card title="Позиция в строке">
              <PositionBar positions={portrait.positions} />
            </Card>
          </div>

          {/* ─── Конкорданс ───────────────────────────────────── */}
          <h2 className="mt-8 text-lg font-semibold">Стихи с леммой</h2>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />

          <ul className="space-y-3">
            {visible.map(({ poem, forms }) => (
              <li
                key={poem.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <Link
                  to={`/poems/${poem.id}`}
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  Стихотворение {poem.index}
                </Link>
                <pre className="mt-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-700">
                  <Highlight text={poem.content} query={forms} />
                </pre>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}

// ─── Мелкие компоненты ───────────────────────────────────────────────

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function BarList({ entries }: { entries: CountEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Нет данных.</p>;
  }
  const max = Math.max(...entries.map((e) => e.count), 1);
  return (
    <div className="space-y-1.5">
      {entries.map((e) => (
        <div key={e.name} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-slate-700">
            {e.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${(e.count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums text-slate-600">
            {e.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function PositionBar({ positions }: { positions: PositionStats }) {
  if (positions.total === 0) {
    return <p className="text-sm text-slate-500">Нет данных.</p>;
  }
  const items = [
    { name: "начало", count: positions.begin, color: "#1b9e77" },
    { name: "середина", count: positions.middle, color: "#7570b3" },
    { name: "конец", count: positions.end, color: "#d95f02" },
  ];
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.name} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-slate-700">{it.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(it.count / positions.total) * 100}%`,
                backgroundColor: it.color,
              }}
            />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-slate-600">
            {it.count}{" "}
            <span className="text-xs text-slate-400">
              ({Math.round((it.count / positions.total) * 100)}%)
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
