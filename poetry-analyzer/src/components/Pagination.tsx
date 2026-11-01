import { cn } from "../lib/cn";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

/**
 * Строит компактный список страниц для рендера:
 * всегда первая и последняя, текущая ± siblings, между разрывами — '…'.
 *
 * Пример (page=6, pageCount=20, siblings=1):
 *   [1, '…', 5, 6, 7, '…', 20]
 */
function buildPages(
  page: number,
  pageCount: number,
  siblings = 1,
): (number | "ellipsis")[] {
  const totalNumbers = siblings * 2 + 5; // первая, последняя, текущая, 2 разрыва минимум

  // Если страниц мало — показываем все подряд
  if (pageCount <= totalNumbers) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const left = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, pageCount - 1);

  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < pageCount - 1;

  const items: (number | "ellipsis")[] = [1];

  if (showLeftEllipsis) items.push("ellipsis");
  else {
    // если разрыва нет — просто добиваем числами от 2
    for (let i = 2; i < left; i++) items.push(i);
  }

  for (let i = left; i <= right; i++) items.push(i);

  if (showRightEllipsis) items.push("ellipsis");
  else {
    for (let i = right + 1; i < pageCount; i++) items.push(i);
  }

  items.push(pageCount);
  return items;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = buildPages(page, pageCount);

  const btnBase =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>
          {from}–{to} из {total}
        </span>
        <label className="flex items-center gap-2">
          На страниц:
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className={btnBase}
            aria-label="Первая страница"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={btnBase}
            aria-label="Предыдущая страница"
          >
            ‹
          </button>

          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span
                key={`e-${i}`}
                className="px-2 text-sm text-slate-400 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "min-w-9 rounded-lg border px-3 py-1.5 text-sm transition",
                  p === page
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className={btnBase}
            aria-label="Следующая страница"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageCount)}
            disabled={page >= pageCount}
            className={btnBase}
            aria-label="Последняя страница"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
