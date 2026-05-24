import { homedir } from "node:os";
import { resolve } from "node:path";

import type { KattoOptions, Options } from "../types";

import { DEFAULT_TARGETS } from "../constants";

export function createOptions(input: KattoOptions = {}): Options {
  const targets = uniqueList(input.targets ?? DEFAULT_TARGETS);
  if (targets.length === 0) throw new Error("At least one target is required.");

  return {
    root: resolveRoot(input.root),
    targets,
    exclude: uniqueList(input.exclude ?? []),
    excludeSensitive: input.excludeSensitive ?? false,
    dryRun: input.dryRun ?? false,
    noSize: input.noSize ?? false,
    sizeStrategy: input.noSize ? "none" : (input.sizeStrategy ?? "auto"),
    sort: input.sort ?? "size",
    sizeUnit: input.sizeUnit ?? "auto",
  };
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function resolveRoot(root: string | undefined): string {
  const value = root ?? process.cwd();
  if (value === "~") return homedir();
  const homeRelative = stripPrefix(value, "~/");
  if (homeRelative !== null) return resolve(homedir(), homeRelative);
  return resolve(value);
}

function stripPrefix(value: string, prefix: string): string | null {
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}
