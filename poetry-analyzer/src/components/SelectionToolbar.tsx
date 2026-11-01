import { useRef, useState } from "react";
import type { Group } from "../types";

interface Props {
  count: number;
  groups: Group[];
  currentGroupId?: string | null;
  currentGroupName?: string;
  onCreateGroup: (name: string) => void;
  onAddToGroup: (groupId: string) => void;
  onRemoveFromCurrentGroup?: () => void;
  onClear: () => void;
}

export default function SelectionToolbar({
  count,
  groups,
  currentGroupId,
  currentGroupName,
  onCreateGroup,
  onAddToGroup,
  onRemoveFromCurrentGroup,
  onClear,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  if (count === 0) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateGroup(trimmed);
    setName("");
    setCreating(false);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-white shadow-2xl backdrop-blur-sm">
        <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-sm text-slate-300">
          Выбрано: <strong className="text-white tabular-nums">{count}</strong>
        </span>

        {creating ? (
          <>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setCreating(false);
                  setName("");
                }
              }}
              placeholder="Название группы"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-slate-400"
            />
            <button
              onClick={submit}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              Создать
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setName("");
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCreating(true)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-100 transition hover:bg-slate-800"
            >
              Создать группу
            </button>

            {groups.length > 0 && (
              <select
                ref={selectRef}
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) onAddToGroup(id);
                  if (selectRef.current) selectRef.current.value = "";
                }}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-slate-400"
              >
                <option value="">Добавить в группу…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.poemIds.length})
                  </option>
                ))}
              </select>
            )}

            {currentGroupId && onRemoveFromCurrentGroup && (
              <button
                onClick={onRemoveFromCurrentGroup}
                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
              >
                Убрать из «{currentGroupName}»
              </button>
            )}
          </>
        )}

        <button
          onClick={onClear}
          className="ml-1 px-2 text-sm text-slate-400 transition hover:text-white"
        >
          Снять выделение
        </button>
      </div>
    </div>
  );
}
