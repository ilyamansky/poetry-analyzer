import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

interface SetParamOptions {
  resetPage?: boolean;
}

export function useQueryParams() {
  const [params, setParams] = useSearchParams();

  const getParam = useCallback(
    (key: string, defaultValue: string): string =>
      params.get(key) ?? defaultValue,
    [params],
  );

  const setParam = useCallback(
    (
      key: string,
      value: string,
      defaultValue: string,
      opts?: SetParamOptions,
    ) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === defaultValue || value === "") next.delete(key);
          else next.set(key, value);
          if (opts?.resetPage) next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { params, getParam, setParam, setParams };
}
