import type { Entry, SortMode } from "../types";

export function sortedEntries(entries: Entry[], sort: SortMode): Entry[] {
  const copy = [...entries];

  switch (sort) {
    case "size":
      return copy.sort((a, b) => (b.size ?? -1) - (a.size ?? -1));
    case "path":
      return copy.sort((a, b) => a.path.localeCompare(b.path));
    case "age":
      return copy.sort((a, b) => (a.mtime ?? 0) - (b.mtime ?? 0));
    case "found":
      return copy.sort((a, b) => a.id - b.id);
  }
}

export function serializeEntry(entry: Entry): object {
  return {
    path: entry.path,
    size: entry.size,
    mtime: entry.mtime,
    status: entry.status,
    error: entry.error,
  };
}
