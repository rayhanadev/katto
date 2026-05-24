import type { Entry, KattoOptions, Options, ScanProgress, SortMode, Stats } from "./types";

import { deleteAll as deleteEntries, deleteEntry as deleteOneEntry } from "./core/delete";
import { createOptions } from "./core/options";
import { sortedEntries, serializeEntry } from "./core/results";
import { scanEntries } from "./core/scanner";
import { freshStats } from "./core/stats";

export class Katto {
  readonly options: Options;
  entries: Entry[] = [];
  stats: Stats = freshStats();

  constructor(options: KattoOptions = {}) {
    this.options = createOptions(options);
  }

  async scan(): Promise<Entry[]> {
    this.entries = [];
    this.stats = freshStats();
    this.entries = await scanEntries(this.options);
    this.refreshScanStats();
    this.stats.scanned = this.entries.length;
    this.stats.done = true;
    return this.entries;
  }

  async *scanWithProgress(): AsyncGenerator<ScanProgress, Entry[]> {
    const seen = new Set<number>();
    const queue: ScanProgress[] = [];
    let notify: (() => void) | undefined;
    let done = false;
    let error: unknown;
    let result: Entry[] = [];

    this.entries = [];
    this.stats = freshStats();

    const wake = (): void => {
      const resolve = notify;
      notify = undefined;
      resolve?.();
    };

    const scanPromise = scanEntries(this.options, (entry) => {
      const phase = seen.has(entry.id) ? "updated" : "found";
      seen.add(entry.id);

      if (!this.entries.includes(entry)) this.entries.push(entry);
      this.refreshScanStats();
      queue.push({
        phase,
        entry,
        entries: this.entries,
        stats: this.stats,
      });
      wake();
    })
      .then((entries) => {
        result = entries;
        this.entries = entries;
        this.refreshScanStats();
        this.stats.scanned = entries.length;
        this.stats.done = true;
      })
      .catch((scanError: unknown) => {
        error = scanError;
      })
      .finally(() => {
        done = true;
        wake();
      });

    while (!done || queue.length > 0) {
      const progress = queue.shift();
      if (progress) {
        yield progress;
        continue;
      }

      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }

    await scanPromise;
    if (error) throw error;
    return result;
  }

  async deleteEntry(entry: Entry): Promise<boolean> {
    const size = entry.size ?? 0;
    const ok = await deleteOneEntry(entry, this.options);

    if (ok) {
      this.stats.deleted++;
      this.stats.reclaimed += size;
    }

    return ok;
  }

  async deleteAll(
    entries: Entry[] = this.entries,
    onProgress?: (progress: { entry?: Entry; stats: Stats }) => void,
  ): Promise<void> {
    await deleteEntries(entries, this.options, this.stats, (entry) => {
      onProgress?.({ entry, stats: this.stats });
    });
  }

  sort(entries: Entry[] = this.entries, sort: SortMode = this.options.sort): Entry[] {
    return sortedEntries(entries, sort);
  }

  serialize(entry: Entry): object {
    return serializeEntry(entry);
  }

  private refreshScanStats(): void {
    this.stats.found = this.entries.length;
    this.stats.sized = this.entries.filter((entry) => entry.size !== null).length;
  }
}

export type {
  Entry,
  KattoOptions,
  Options,
  ScanProgress,
  SizeStrategy,
  SizeUnit,
  SortMode,
  Stats,
} from "./types";
