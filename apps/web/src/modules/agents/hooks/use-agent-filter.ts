"use client";

import { useMemo } from "react";

/**
 * Filters a list by a free-text query against fields produced by `getFields`.
 * Empty query returns the original list. Matching is case-insensitive
 * substring on any of the returned strings.
 */
export function useAgentFilter<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | null | undefined>,
): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const fields = getFields(item);
      for (const field of fields) {
        if (field && field.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [items, query, getFields]);
}
