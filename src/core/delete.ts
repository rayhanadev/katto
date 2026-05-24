import { rm } from "node:fs/promises";
import { basename } from "node:path";

import type { Entry, Options, Stats } from "../types";

import { DELETE_CONCURRENCY } from "../constants";
import { Semaphore } from "./semaphore";

export async function deleteEntry(entry: Entry, options: Options): Promise<boolean> {
  if (!isSafeTarget(entry.path, options.targets)) {
    entry.status = "failed";
    entry.error = "refused: path basename is not a target";
    return false;
  }

  if (options.dryRun) {
    await Bun.sleep(80);
    entry.status = "deleted";
    return true;
  }

  entry.status = "deleting";
  try {
    await rm(entry.path, {
      recursive: true,
      force: true,
      maxRetries: 2,
      retryDelay: 20,
    });
    entry.status = "deleted";
    return true;
  } catch (error) {
    entry.status = "failed";
    entry.error = error instanceof Error ? error.message : String(error);
    return false;
  }
}

export async function deleteAll(
  entries: Entry[],
  options: Options,
  stats: Stats,
  onChange: (entry?: Entry) => void,
): Promise<void> {
  const semaphore = new Semaphore(DELETE_CONCURRENCY);

  await Promise.all(
    entries
      .filter((entry) => entry.status !== "deleted")
      .map((entry) =>
        semaphore.run(async () => {
          const size = entry.size ?? 0;
          onChange(entry);

          const ok = await deleteEntry(entry, options);
          if (ok) {
            stats.deleted++;
            stats.reclaimed += size;
          }

          onChange(entry);
        }),
      ),
  );
}

function isSafeTarget(path: string, targets: string[]): boolean {
  return targets.includes(basename(path));
}
