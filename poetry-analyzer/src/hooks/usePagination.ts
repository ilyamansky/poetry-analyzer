import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

interface Options {
  total: number;
  defaultPageSize?: number;
}

export function usePagination({ total, defaultPageSize = 50 }: Options) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.max(1, Number(params.get("size")) || defaultPageSize);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const setPage = (p: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(p));
      return next;
    });
  };

  const setPageSize = (s: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("size", String(s));
      next.set("page", "1");
      return next;
    });
  };

  useEffect(() => {
    if (page > pageCount) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    }
  }, [page, pageCount, setParams]);

  return { page, pageSize, setPage, setPageSize };
}
