import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import PoemCard from "../components/PoemCard";
import SearchInput from "../components/SearchInput";
import SelectionToolbar from "../components/SelectionToolbar";
import { useDebounce } from "../hooks/useDebounce";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { usePagination } from "../hooks/usePagination";
import { useQueryParams } from "../hooks/useQueryParams";
import { decodeCorpusRef } from "../store/comparisonStore";
import { usePoemsStore } from "../store/poemsStore";

export default function PoemsPage() {
  const poems = usePoemsStore((s) => s.poems);
  const groups = usePoemsStore((s) => s.groups);
  const createGroup = usePoemsStore((s) => s.createGroup);
  const addToGroup = usePoemsStore((s) => s.addToGroup);
  const removeFromGroup = usePoemsStore((s) => s.removeFromGroup);

  const { getParam, setParam } = useQueryParams();
  const q = getParam("q", "");

  const [input, setInput] = useState(q);
  const [lastUrlQ, setLastUrlQ] = useState(q);
  const debouncedInput = useDebounce(input, 250);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Селект «Показать» управляет глобальным A — тот же слот, что и в шапке.
  // На этой странице B не используется, поэтому второй селект скрыт.
  const { a: groupPoems, keyA, setA } = useGlobalCorpusSelection();

  // Render-phase sync URL → input (back button, внешняя навигация).
  // Официальный React-паттерн для «adjust state when a prop changes»:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (q !== lastUrlQ) {
    setLastUrlQ(q);
    setInput(q);
  }

  const activeGroup = useMemo(
    () =>
      keyA !== "all" && keyA !== "none"
        ? (groups.find((g) => g.id === keyA) ?? null)
        : null,
    [groups, keyA],
  );

  // Push debounced input → URL.
  useEffect(() => {
    if (input !== debouncedInput) return;
    if (debouncedInput === q) return;
    setParam("q", debouncedInput.trim(), "", { resetPage: true });
  }, [input, debouncedInput, q, setParam]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groupPoems;
    return groupPoems.filter((p) => p.content.toLowerCase().includes(needle));
  }, [groupPoems, q]);

  const total = filtered.length;
  const { page, pageSize, setPage, setPageSize } = usePagination({
    total,
    defaultPageSize: 20,
  });
  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroup = (name: string) => {
    createGroup(name, Array.from(selected));
    setSelected(new Set());
  };

  const handleAddToGroup = (groupId: string) => {
    addToGroup(groupId, Array.from(selected));
    setSelected(new Set());
  };

  const handleRemoveFromCurrentGroup = () => {
    if (!activeGroup) return;
    removeFromGroup(activeGroup.id, Array.from(selected));
    setSelected(new Set());
  };

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Стихов пока нет. Сначала загрузите файл на странице «Загрузка».
      </p>
    );
  }

  return (
    <div className={selected.size > 0 ? "pb-32 sm:pb-24" : undefined}>
      {/* Фильтры: селект A + поиск */}
      <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span className="hidden sm:inline">Показать:</span>
          <select
            aria-label="Какой корпус показать"
            value={keyA}
            onChange={(e) => setA(decodeCorpusRef(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
          >
            <option value="all">Весь корпус</option>
            {groups.length > 0 && <option value="none">Без группы</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.poemIds.length})
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0 flex-1 sm:min-w-64">
          <SearchInput value={input} onChange={setInput} />
        </div>
      </div>

      <SelectionToolbar
        count={selected.size}
        groups={groups}
        currentGroupId={activeGroup?.id ?? null}
        currentGroupName={activeGroup?.name}
        onCreateGroup={handleCreateGroup}
        onAddToGroup={handleAddToGroup}
        onRemoveFromCurrentGroup={handleRemoveFromCurrentGroup}
        onClear={() => setSelected(new Set())}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {q
            ? "Ничего не найдено по текущим фильтрам."
            : "В этом корпусе нет стихов."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <PoemCard
              key={p.id}
              poem={p}
              query={q}
              selected={selected.has(p.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
