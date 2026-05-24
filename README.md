# katto

Fast interactive cleanup for generated dependency and build folders.

`katto` is a Bun-powered terminal UI for finding large disposable folders like `node_modules` and deleting them safely. It is inspired by `npkill`, but focuses on a fast pruned scanner, Bun-native filesystem APIs, and an OpenTUI interface.

## Features

- Finds target folders such as `node_modules` without descending into them.
- Skips symlink traversal to avoid loops in unusual package trees.
- Sorts by size by default.
- Locks selection until scan and metadata are complete.
- Deletes with guarded target-name checks.
- Supports JSON output for scripts and automation.
- Built with Bun and OpenTUI.

## Requirements

- Bun 1.3 or newer
- macOS, Linux, or another platform with Bun and Node-compatible filesystem APIs

## Install

```bash
bun install -g katto
```

For local development:

```bash
cd katto
bun install
bun run dev
```

## Usage

```bash
katto
katto -d ~/Projects
katto -t node_modules,.next,dist
katto --json --no-size
```

## TUI Controls

| Key         | Action                |
| ----------- | --------------------- |
| `j`, `down` | Move down             |
| `k`, `up`   | Move up               |
| `d`         | Delete selected entry |
| `D`         | Delete all entries    |
| `s`         | Cycle sort mode       |
| `r`         | Rescan                |
| `q`, `esc`  | Quit                  |

Selection and deletion are disabled until scanning and metadata collection finish.

## CLI Options

```text
Usage
  katto [directory] [options]

Options
  -d, --directory            Root directory to scan. Defaults to cwd.
  -f, --full                 Scan from your home directory.
  -t, --targets              Comma-separated folder names. Default: node_modules.
  -E, --exclude              Comma-separated names or paths to prune.
  -x, --exclude-sensitive    Skip common sensitive/cache roots.
  -D, --delete-all           Delete every match after scanning.
  -y, --yes                  Skip delete-all confirmation.
      --dry-run              Simulate deletion.
      --json                 Print final JSON instead of the TUI.
      --json-stream          Print one JSON object per found folder.
      --no-size              Skip size calculation for maximum scan speed.
      --no-stats             Alias for --no-size.
  -s, --sort                 Sort by found, size, path, or age. Default: size.
      --size-strategy        Size calculation: auto, native, js, or none.
      --size-unit            Display unit: auto, mb, gb, or bytes.
  -v, --version              Show version.
  -h, --help                 Show help.
```

## JSON Output

```bash
katto --json -d ~/Projects
katto --json-stream --no-size -d ~/Projects
```

`--json` prints one final object with `stats` and `results`. `--json-stream` prints one JSON object per result as entries are found.

## Size Strategy

`--size-strategy auto` is the default. It uses native `du` sizing when available and falls back to the portable JS walker on systems without `du`.

- `native` is fastest on macOS/Linux.
- `js` avoids native commands and uses Bun filesystem APIs.
- `none` skips size calculation, equivalent to `--no-size`.

## SDK

`katto` also exposes a Bun-compatible SDK. Importing the package does not start the CLI.

```ts
import { Katto } from "katto";

const katto = new Katto({
  root: "~/Projects",
  targets: ["node_modules", ".next", "dist"],
  sizeStrategy: "auto",
});

const entries = await katto.scan();
const largest = katto.sort(entries, "size");
```

Delete APIs are available too:

```ts
import { Katto } from "katto";

const katto = new Katto({ dryRun: true });
const entries = await katto.scan();

for (const entry of entries) {
  await katto.deleteEntry(entry);
}
```

For progress updates, use the explicit progress API:

```ts
for await (const { phase, entry, stats } of katto.scanWithProgress()) {
  if (phase === "found") console.log(`found ${entry.path}`);
  console.log(`${stats.found} matches`);
}

const entries = katto.entries;
```

Exports:

- `Katto`
- `Entry`, `Options`, `KattoOptions`, `ScanProgress`, `Stats`, `SortMode`, `SizeStrategy`, `SizeUnit` types

## Safety Notes

`katto` only deletes folders whose basename matches one of the configured targets. By default that target is `node_modules`.

Use `--dry-run` to preview delete flows:

```bash
katto -D --dry-run
```

## Development

```bash
bun install
bun run dev
bun run build
```

Useful scripts:

- `bun run dev` runs the TypeScript entry directly.
- `bun run build` bundles the CLI into `dist/` using tsdown.
- `bun run <lint|format|typecheck>` runs lint, format, or typecheck.

## License

MIT
