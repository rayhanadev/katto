import type { Dirent } from "node:fs";

import { lstat, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import type { Entry, Options } from "../types";

import { DEFAULT_PRUNES, SIZE_CONCURRENCY, WALK_CONCURRENCY } from "../constants";
import { Semaphore } from "./semaphore";

export async function scanEntries(
  options: Options,
  onEntryChange?: (entry: Entry) => void,
): Promise<Entry[]> {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const targetNames = new Set(options.targets);
  const pruneNames = new Set([...DEFAULT_PRUNES, ...options.exclude]);
  const prunePaths = new Set(
    options.exclude.filter((item) => item.includes("/")).map((item) => resolve(options.root, item)),
  );

  if (options.excludeSensitive) {
    for (const item of sensitivePrunes()) pruneNames.add(item);
  }

  let id = 0;

  await walkDirs(options.root, (parent, direntName) => {
    const path = `${parent}/${direntName}`;

    if (prunePaths.has(path) || (pruneNames.has(direntName) && !targetNames.has(direntName))) {
      return "prune";
    }

    if (!targetNames.has(direntName)) return "descend";
    if (seen.has(path)) return "prune";

    seen.add(path);
    const entry: Entry = {
      id: id++,
      path,
      name: direntName,
      size: null,
      mtime: null,
      status: shouldHydrateSize(options) ? "sizing" : "ready",
    };

    entries.push(entry);
    onEntryChange?.(entry);

    return "prune";
  });

  if (shouldHydrateSize(options)) {
    await hydrateEntryMetadata(entries, options, onEntryChange);
  }

  return entries;
}

function sensitivePrunes(): string[] {
  return [
    "Library",
    "Applications",
    "System",
    "Volumes",
    ".Trash",
    ".cache",
    ".config",
    ".local",
    ".ssh",
    ".gnupg",
  ];
}

async function hydrateEntryMetadata(
  entries: Entry[],
  options: Options,
  onEntryChange?: (entry: Entry) => void,
): Promise<void> {
  const semaphore = new Semaphore(SIZE_CONCURRENCY);

  await Promise.allSettled(
    entries.map((entry) =>
      semaphore.run(() => hydrateOneEntryMetadata(entry, options, onEntryChange)),
    ),
  );
}

async function hydrateOneEntryMetadata(
  entry: Entry,
  options: Options,
  onEntryChange?: (entry: Entry) => void,
): Promise<void> {
  try {
    const [size, mtime] = await Promise.all([
      entrySize(entry.path, options),
      statMtime(entry.path),
    ]);
    entry.size = size;
    entry.mtime = mtime;
  } catch (error) {
    entry.error = error instanceof Error ? error.message : String(error);
  }

  entry.status = "ready";
  onEntryChange?.(entry);
}

function shouldHydrateSize(options: Options): boolean {
  return !options.noSize && options.sizeStrategy !== "none";
}

async function entrySize(path: string, options: Options): Promise<number | null> {
  switch (options.sizeStrategy) {
    case "native":
      return await duSize(path);
    case "js":
      return await jsSize(path);
    case "auto":
      return (await duSize(path)) ?? (await jsSize(path));
    case "none":
      return null;
  }
}

async function walkDirs(
  root: string,
  visit: (parent: string, direntName: string) => "descend" | "prune",
): Promise<void> {
  const queue = [root];
  let active = 0;
  let index = 0;
  let rejectWalk: ((error: unknown) => void) | null = null;

  await new Promise<void>((resolveWalk, reject) => {
    rejectWalk = reject;

    const pump = (): void => {
      if (index >= queue.length && active === 0) {
        resolveWalk();
        return;
      }

      while (active < WALK_CONCURRENCY && index < queue.length) {
        const dir = queue[index++]!;
        active++;

        void readdir(dir, { withFileTypes: true })
          .then((dirents) => {
            for (const dirent of dirents) {
              if (dirent.isSymbolicLink() || !dirent.isDirectory()) continue;
              const decision = visit(dir, dirent.name);
              if (decision === "descend") queue.push(`${dir}/${dirent.name}`);
            }
          })
          .catch((error: unknown) => {
            const code =
              typeof error === "object" && error !== null && "code" in error ? error.code : "";
            if (code !== "EACCES" && code !== "EPERM" && code !== "ENOENT" && rejectWalk) {
              rejectWalk(error);
            }
          })
          .finally(() => {
            active--;
            pump();
          });
      }
    };

    pump();
  });
}

async function duSize(path: string): Promise<number | null> {
  return (
    (await runDu(["du", "-skA", path])) ??
    (await runDu(["du", "-sk", "--apparent-size", path])) ??
    (await runDu(["du", "-sk", path]))
  );
}

async function runDu(command: string[]): Promise<number | null> {
  try {
    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "ignore",
    });
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) return null;

    const match = /^(\d+)/.exec(output);
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

async function jsSize(path: string): Promise<number | null> {
  let total = 0;
  const queue = [path];
  let active = 0;
  let index = 0;

  await new Promise<void>((resolveSize) => {
    const pump = (): void => {
      if (index >= queue.length && active === 0) {
        resolveSize();
        return;
      }

      while (active < SIZE_CONCURRENCY && index < queue.length) {
        const dir = queue[index++]!;
        active++;

        void readdir(dir, { withFileTypes: true })
          .then(async (dirents) => {
            await Promise.all(dirents.map((dirent) => addDirentSize(dir, dirent, queue)));
          })
          .catch(() => {})
          .finally(() => {
            active--;
            pump();
          });
      }
    };

    const addDirentSize = async (
      dir: string,
      dirent: Dirent<string>,
      queue: string[],
    ): Promise<void> => {
      if (dirent.isSymbolicLink()) return;

      const child = `${dir}/${dirent.name}`;
      if (dirent.isDirectory()) {
        queue.push(child);
        return;
      }

      try {
        total += (await lstat(child)).size;
      } catch {}
    };

    pump();
  });

  return total;
}

async function statMtime(path: string): Promise<number | null> {
  try {
    return (await lstat(path)).mtimeMs;
  } catch {
    return null;
  }
}
