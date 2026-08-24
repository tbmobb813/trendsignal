import { useState, useEffect, useCallback } from 'react';

const queryCache = new Map<string, { data: any; timestamp: number }>();
const STALE_TIME_MS = 1000 * 60 * 5; // 5 minutes cache stale time

export interface UseQueryResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

/**
 * Lightweight, zero-dependency caching query hook inspired by SWR/React-Query.
 * Prevents redundant fetches and manages loading/error states in React 19.
 */
export function useQuery<T>(
  queryKey: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {}
): UseQueryResult<T> {
  const [data, setLocalData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const enabled = options.enabled !== false;

  const executeFetch = useCallback(async (force = false) => {
    if (!queryKey) return;

    const cached = queryCache.get(queryKey);
    if (!force && cached && Date.now() - cached.timestamp < STALE_TIME_MS) {
      setLocalData(cached.data);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetcher();
      if (queryCache.size >= 50 && !queryCache.has(queryKey)) {
        const oldestKey = queryCache.keys().next().value;
        if (oldestKey !== undefined) {
          queryCache.delete(oldestKey);
        }
      }
      queryCache.set(queryKey, { data: result, timestamp: Date.now() });
      setLocalData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [queryKey, fetcher]);

  useEffect(() => {
    if (enabled) {
      executeFetch(false);
    }
  }, [enabled, executeFetch]);

  const refetch = useCallback(() => executeFetch(true), [executeFetch]);
  
  const setData = useCallback((newData: T | null) => {
    if (queryKey) {
      if (newData === null) {
        queryCache.delete(queryKey);
      } else {
        // Enforce cache size limits (LRU-like deletion of the oldest entry)
        if (queryCache.size >= 50 && !queryCache.has(queryKey)) {
          const oldestKey = queryCache.keys().next().value;
          if (oldestKey !== undefined) {
            queryCache.delete(oldestKey);
          }
        }
        queryCache.set(queryKey, { data: newData, timestamp: Date.now() });
      }
    }
    setLocalData(newData);
  }, [queryKey]);

  return {
    data,
    error,
    isLoading,
    refetch,
    setData,
  };
}
