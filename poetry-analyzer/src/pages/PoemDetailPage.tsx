// src/pages/PoemDetailPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  analyzePoem,
  isFullAnalysis,
  translateMeter,
  type PoemAnalysis,
} from "../lib/api";
import { findSimilarPoems, firstLine } from "../lib/similar";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";

export default function PoemDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div>
        <p className="text-slate-600">Стихотворение не найдено.</p>
        <Link
          to="/poems"
          className="mt-2 inline-block text-slate-900 underline"
        >
          ← К списку
        </Link>
      </div>
    );
  }

  return <PoemDetailContent key={id} poemId={id} />;
}

function PoemDetailContent({ poemId }: { poemId: string }) {
  const poem = usePoemsStore((s) => s.poems.find((p) => p.id === poemId));
  const stopwords = usePoemsStore((s) => s.stopwords);
  const analyses = useAnalysisStore((s) => s.analyses);
  const cached = useAnalysisStore((s) => s.analyses[poemId]);
  const setAnalysis = useAnalysisStore((s) => s.setAnalysis);

  const { a: corpusPoems } = useGlobalCorpusSelection();

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [fullRunning, setFullRunning] = useState(false);

  // Авто-загрузка: только леммы — чтобы карточка открывалась мгновенно.
  // Полный анализ (RPST) — по кнопке, потому что он тяжёлый (~0.3 сек/стих,
  // плюс семафор на сервере).
  useEffect(() => {
    if (!poem || cached || !loading) return;

    let cancelled = false;

    analyzePoem(poem.content, "lemmas")
      .then((result) => {
        if (cancelled) return;
        setAnalysis(poemId, result);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [poem, cached, poemId, loading, setAnalysis]);

  const stopwordsSet = useMemo(() => new Set(stopwords), [stopwords]);

  const similar = useMemo(() => {
    if (!cached) return [];
    return findSimilarPoems(poemId, corpusPoems, analyses, {
      topN: 8,
      stopwords: stopwordsSet,
    });
  }, [poemId, corpusPoems, analyses, stopwordsSet, cached]);

  const runFullAnalysis = useCallback(() => {
    if (!poem) return;
    setFullRunning(true);
    setError(null);
    analyzePoem(poem.content, "full")
      .then((result) => setAnalysis(poemId, result))
      .catch((e) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setFullRunning(false));
  }, [poem, poemId, setAnalysis]);

  if (!poem) {
    return (
      <div>
        <p className="text-slate-600">Стихотворение не найдено.</p>
        <Link
          to="/poems"
          className="mt-2 inline-block text-slate-900 underline"
        >
          ← К списку
        </Link>
      </div>
    );
  }

  const lines = poem.content.split("\n").filter((l) => l.trim().length > 0);

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/poems" className="text-sm text-slate-500 hover:text-slate-900">
        ← К списку
      </Link>
      <h1 className="mt-4 text-xl font-semibold sm:text-2xl">
        Стихотворение {poem.index}
      </h1>
      <p className="mt-1 text-xs text-slate-400">{lines.length} строк</p>

      <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-serif text-base leading-relaxed sm:mt-6 sm:p-6 sm:text-lg">
        {poem.content}
      </pre>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Анализ</h2>

        {loading && !cached && (
          <p className="mt-2 text-sm text-slate-500">Анализ…</p>
        )}

        {error && <p className="mt-2 text-sm text-red-600">Ошибка: {error}</p>}

        {cached && (
          <AnalysisView
            analysis={cached}
            fullRunning={fullRunning}
            onRunFull={runFullAnalysis}
          />
        )}
      </section>

      {similar.length > 0 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <h2 className="mb-1 text-sm font-medium text-slate-700">
            Похожие в корпусе
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            По пересечению значимых лемм (TF-IDF, косинус). Чем выше % — тем
            больше общих редких слов.
          </p>
          <ul className="space-y-1">
            {similar.map((s) => (
              <li key={s.poem.id}>
                <Link
                  to={`/poems/${s.poem.id}`}
                  className="block rounded-lg p-2 transition hover:bg-slate-50"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="w-10 shrink-0 text-xs tabular-nums text-slate-400 sm:w-12">
                      #{s.poem.index}
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700">
                      {firstLine(s.poem) || (
                        <span className="italic text-slate-400">(пусто)</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-slate-900">
                      {Math.round(s.score * 100)}%
                    </span>
                  </div>
                  {s.sharedTerms.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 pl-12 sm:pl-14">
                      {s.sharedTerms.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function AnalysisView({
  analysis,
  fullRunning,
  onRunFull,
}: {
  analysis: PoemAnalysis;
  fullRunning: boolean;
  onRunFull: () => void;
}) {
  const full = isFullAnalysis(analysis);
  const meter = translateMeter(analysis.meter);
  const confidence = analysis.scansionScore;

  return (
    <div className="mt-4 space-y-4">
      {full ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:gap-x-8">
            <div>
              <dt className="text-slate-500">Размер</dt>
              <dd className="font-medium">{meter ?? "не определён"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Уверенность разбора</dt>
              <dd className="font-medium tabular-nums">
                {confidence != null ? `${Math.round(confidence * 100)}%` : "—"}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
          <span>
            Выполнена только лемматизация. Размер доступен после полного
            анализа.
          </span>
          <button
            onClick={onRunFull}
            disabled={fullRunning}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            {fullRunning ? "Анализ…" : "Полный анализ"}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          Леммы ({analysis.lemmas.length})
        </h3>
        <p className="text-sm leading-relaxed text-slate-600">
          {analysis.lemmas.map((l, i) => (
            <span key={`${l}-${i}`}>
              <Link
                to={`/lemma/${encodeURIComponent(l)}`}
                className="hover:underline"
              >
                {l}
              </Link>
              {i < analysis.lemmas.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
