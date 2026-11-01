// src/components/Layout.tsx
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import CorpusPicker from "./CorpusPicker";
import { isFullAnalysis } from "../lib/api";
import { usePoemsStore } from "../store/poemsStore";
import { useAnalysisStore } from "../store/analysisStore";
import { useAnalysisProgressStore } from "../store/analysisProgressStore";
import { cn } from "../lib/cn";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", end: true, label: "Загрузка" },
  { to: "/poems", label: "Стихи" },
  { to: "/groups", label: "Группы" },
  { to: "/stats", label: "Статистика" },
  { to: "/compare", label: "Сравнение" },
  { to: "/table", label: "Таблица" },
  { to: "/concordance", label: "Конкорданс" },
  { to: "/network", label: "Сеть" },
  { to: "/dispersion", label: "Распределения" },
  { to: "/repeats", label: "Повторы" },
];

// Страницы, где CorpusPicker не нужен — точное совпадение пути.
const HIDE_PICKER_EXACT = ["/", "/poems", "/groups", "/table", "/repeats"];
// Страницы, где CorpusPicker не нужен — по префиксу (детейлы стиха).
const HIDE_PICKER_PREFIX = ["/poems/"];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200",
  );

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200",
  );

export default function Layout() {
  const fileName = usePoemsStore((s) => s.fileName);
  const count = usePoemsStore((s) => s.poems.length);
  const poems = usePoemsStore((s) => s.poems);
  const analyses = useAnalysisStore((s) => s.analyses);

  const runningMode = useAnalysisProgressStore((s) => s.runningMode);
  const progress = useAnalysisProgressStore((s) => s.progress);

  const { pathname } = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Render-phase sync: при смене маршрута закрываем мобильное меню.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  const showPicker =
    !HIDE_PICKER_EXACT.includes(pathname) &&
    !HIDE_PICKER_PREFIX.some((p) => pathname.startsWith(p));
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Плавный сброс прокрутки при смене маршрута.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  const fullCount = poems.reduce(
    (n, p) => (analyses[p.id] && isFullAnalysis(analyses[p.id]) ? n + 1 : n),
    0,
  );

  const showRunningBadge = runningMode !== null && progress !== null;
  const showIdleBadge = !showRunningBadge && count > 0 && fullCount < count;

  const analysisBadge = showRunningBadge ? (
    <Link
      to="/stats"
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
      title={`Идёт ${runningMode === "full" ? "полный анализ" : "лемматизация"}`}
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
      {progress!.done}/{progress!.total}
    </Link>
  ) : showIdleBadge ? (
    <Link
      to="/stats"
      className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
      title="Запустить лингвистический анализ на странице «Статистика»"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
      анализ
    </Link>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 2xl:max-w-7xl">
          <div className="flex items-center gap-3 pt-3 pb-2">
            {/* Название + файл под ним (слева) */}
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-semibold sm:text-lg">
                Поэтический анализ
              </span>
              {fileName && (
                <span className="min-w-0 truncate text-xs text-slate-500 sm:text-sm">
                  {fileName} · {count} стих.
                </span>
              )}
            </div>

            {/* Desktop: badge + corpus picker справа */}
            <div className="ml-auto hidden items-center gap-2 md:flex">
              {analysisBadge}
              {showPicker && <CorpusPicker />}
            </div>

            {/* Mobile: гамбургер */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 md:hidden"
            >
              <span className="text-base leading-none">
                {menuOpen ? "✕" : "☰"}
              </span>
              Разделы
            </button>
          </div>

          {/* Desktop: навигация */}
          <nav className="-ml-3 hidden flex-wrap gap-1.5 pb-3 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={desktopLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile: строка с CorpusPicker (только для страниц, где он нужен) */}
          {showPicker && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-2 md:hidden">
              <CorpusPicker />
            </div>
          )}
        </div>

        {/* Mobile-меню: absolute под шапкой */}
        <div
          id="mobile-nav"
          className={cn(
            "absolute inset-x-0 top-full z-40 border-b border-slate-200 bg-white shadow-lg transition-[opacity,transform] duration-200 ease-out md:hidden",
            menuOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0",
          )}
          aria-hidden={!menuOpen}
        >
          <nav className="mx-auto grid max-w-6xl grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-2 sm:px-6">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={mobileLinkClass}
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
