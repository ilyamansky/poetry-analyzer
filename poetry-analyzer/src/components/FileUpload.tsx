import { useRef, useState } from "react";

interface Props {
  onFile: (text: string, fileName: string) => void;
}

export default function FileUpload({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = async (file: File) => {
    const text = await file.text();
    onFile(text, file.name);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
        dragging
          ? "border-slate-900 bg-slate-100"
          : "border-slate-300 bg-white hover:border-slate-500"
      }`}
    >
      <p className="text-lg font-medium">Перетащите файл сюда</p>
      <p className="mt-1 text-sm text-slate-500">
        или кликните, чтобы выбрать. Поддерживается .txt
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />
    </div>
  );
}
