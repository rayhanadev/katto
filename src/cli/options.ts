import { createRequire } from "node:module";
import { homedir } from "node:os";

import type { CliOptions, SizeStrategy, SizeUnit, SortMode } from "../types";

import { DEFAULT_TARGETS, VERSION } from "../constants";
import { createOptions } from "../core/options";

const require = createRequire(import.meta.url);
const sade = require("sade") as typeof import("sade");

interface SadeOptions {
  directory?: string;
  full?: boolean;
  targets?: string;
  exclude?: string;
  "exclude-sensitive"?: boolean;
  "delete-all"?: boolean;
  yes?: boolean;
  size?: boolean;
  stats?: boolean;
  "dry-run"?: boolean;
  dryRun?: boolean;
  json?: boolean;
  "json-stream"?: boolean;
  jsonStream?: boolean;
  "no-size"?: boolean;
  noSize?: boolean;
  "no-stats"?: boolean;
  noStats?: boolean;
  sort?: string;
  "size-strategy"?: string;
  sizeStrategy?: string;
  "size-unit"?: string;
  sizeUnit?: string;
}

export async function parseOptions(argv: string[]): Promise<CliOptions> {
  const program = createProgram();

  if (argv.includes("--help") || argv.includes("-h") || argv.includes("?")) {
    program.help();
    process.exit(0);
  }

  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(`katto, ${VERSION}`);
    process.exit(0);
  }

  return await new Promise((resolveOptions, rejectOptions) => {
    program.action((directory: string | undefined, opts: SadeOptions) => {
      try {
        resolveOptions(normalizeOptions(directory, opts));
      } catch (error) {
        rejectOptions(error);
      }
    });

    program.parse(["bun", "katto", ...argv]);
  });
}

function createProgram(): import("sade").Sade {
  return sade("katto [directory]", true)
    .version(VERSION)
    .describe("Fast interactive cleanup for generated dependency/build folders.")
    .option("-d, --directory", "Root directory to scan. Defaults to cwd.")
    .option("-f, --full", "Scan from your home directory.", false)
    .option("-t, --targets", "Comma-separated folder names.", DEFAULT_TARGETS.join(","))
    .option("-E, --exclude", "Comma-separated names or paths to prune.", "")
    .option("-x, --exclude-sensitive", "Skip common sensitive/cache roots.", false)
    .option("-D, --delete-all", "Delete every match after scanning.", false)
    .option("-y, --yes", "Skip delete-all confirmation.", false)
    .option("--dry-run", "Simulate deletion.", false)
    .option("--json", "Print final JSON instead of the TUI.", false)
    .option("--json-stream", "Print one JSON object per found folder.", false)
    .option("--no-size", "Skip size calculation for maximum scan speed.", false)
    .option("--no-stats", "Alias for --no-size.", false)
    .option("-s, --sort", "Sort by found, size, path, or age.", "size")
    .option("--size-strategy", "Size calculation: auto, native, js, or none.", "auto")
    .option("--size-unit", "Display unit: auto, mb, gb, or bytes.", "auto")
    .example("-d ~/Projects -t node_modules,.next,dist")
    .example("--json --no-size");
}

function normalizeOptions(directory: string | undefined, opts: SadeOptions): CliOptions {
  const sort = validateSort(opts.sort ?? "size");
  const sizeStrategy = validateSizeStrategy(opts["size-strategy"] ?? opts.sizeStrategy ?? "auto");
  const sizeUnit = validateSizeUnit(opts["size-unit"] ?? opts.sizeUnit ?? "auto");
  const root = opts.full ? homedir() : (opts.directory ?? directory ?? process.cwd());

  if (opts.json && opts["json-stream"]) {
    throw new Error("Cannot use both --json and --json-stream.");
  }

  const targets = uniqueList(splitList(opts.targets ?? DEFAULT_TARGETS.join(",")));
  if (targets.length === 0) throw new Error("At least one target is required.");

  const options = createOptions({
    root,
    targets,
    exclude: uniqueList(splitList(opts.exclude ?? "")),
    excludeSensitive: Boolean(opts["exclude-sensitive"]),
    dryRun: Boolean(opts["dry-run"] || opts.dryRun),
    noSize: Boolean(
      opts["no-size"] ||
      opts.noSize ||
      opts["no-stats"] ||
      opts.noStats ||
      (opts.size !== undefined && !opts.size) ||
      (opts.stats !== undefined && !opts.stats),
    ),
    sizeStrategy,
    sort,
    sizeUnit,
  });

  return {
    ...options,
    deleteAll: Boolean(opts["delete-all"]),
    yes: Boolean(opts.yes),
    json: Boolean(opts.json),
    jsonStream: Boolean(opts["json-stream"] || opts.jsonStream),
  };
}

function validateSort(value: string): SortMode {
  if (value === "found" || value === "size" || value === "path" || value === "age") return value;
  throw new Error("--sort must be one of: found, size, path, age");
}

function validateSizeUnit(value: string): SizeUnit {
  if (value === "auto" || value === "mb" || value === "gb" || value === "bytes") return value;
  throw new Error("--size-unit must be one of: auto, mb, gb, bytes");
}

function validateSizeStrategy(value: string): SizeStrategy {
  if (value === "auto" || value === "native" || value === "js" || value === "none") return value;
  throw new Error("--size-strategy must be one of: auto, native, js, none");
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values)];
}
