// src/components/OverlapBanner.tsx
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { plural } from "../lib/plural";

export default function OverlapBanner() {
  const {
    overlapCount,
    isSubset,
    identical,
    includeOverlap,
    setIncludeOverlap,
    aForCompare,
    bForCompare,
    labelA,
    labelB,
  } = useGlobalCorpusSelection();

  if (overlapCount === 0) return null;

  const nameA = labelA;
  const nameB = labelB ?? "B";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <div>
        {identical ? (
          <>
            Группы «{nameA}» и «{nameB}» идентичны по составу. Сравнивать нечего
            — выберите разные группы или отметьте «Не исключать пересечение»,
            чтобы увидеть «всё vs всё».
          </>
        ) : isSubset ? (
          <>
            Одна группа целиком входит в другую. Общих стихов:{" "}
            <strong>{overlapCount}</strong>.{" "}
            {includeOverlap
              ? "Пересечение включено в обе стороны."
              : "Из большей группы они исключены."}{" "}
            {!includeOverlap && (
              <>
                Сравниваются: «{nameA}» ({aForCompare.length}{" "}
                {plural(aForCompare.length, "стих", "стиха", "стихов")}) и «
                {nameB}» ({bForCompare?.length ?? 0}{" "}
                {plural(bForCompare?.length ?? 0, "стих", "стиха", "стихов")}
                ).
              </>
            )}
          </>
        ) : (
          <>
            Пересечение: <strong>{overlapCount}</strong>{" "}
            {plural(overlapCount, "стих", "стиха", "стихов")}.{" "}
            {includeOverlap
              ? "Включены в обе группы (частоты завышены — интерпретируйте осторожно)."
              : "Исключены из обеих сторон для честного сравнения."}
          </>
        )}
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={includeOverlap}
          onChange={(e) => setIncludeOverlap(e.target.checked)}
        />
        Не исключать пересечение
      </label>
    </div>
  );
}
