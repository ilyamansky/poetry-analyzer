// src/lib/csv.ts

/** Формирует CSV-строку с корректным экранированием. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    )
    .join("\n");
}

/** Скачивает CSV-файл. BOM нужен, чтобы Excel правильно открыл кириллицу. */
export function downloadCsv(
  filename: string,
  rows: (string | number)[][],
): void {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
