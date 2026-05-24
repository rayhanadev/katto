import type { Stats } from "../types";

export function freshStats(): Stats {
  return {
    scanned: 0,
    found: 0,
    sized: 0,
    deleted: 0,
    reclaimed: 0,
    startedAt: Date.now(),
    done: false,
  };
}
