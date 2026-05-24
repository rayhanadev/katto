import {
  BoxRenderable,
  StyledText,
  TextAttributes,
  TextRenderable,
  bg,
  fg,
  type CliRenderer,
  type TextChunk,
} from "@opentui/core";
import { homedir } from "node:os";

import type { Entry, Options, TuiState } from "../types";

import { sortedEntries } from "../core/results";
import { formatAge, formatSize, truncate } from "../utils/format";
import { clamp } from "../utils/math";

interface ViewParts {
  header: TextRenderable;
  summary: TextRenderable;
  tableHead: TextRenderable;
  body: TextRenderable;
  footer: TextRenderable;
}

export function createView(renderer: CliRenderer): ViewParts {
  const root = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: "#0F1115",
    paddingX: 1,
    paddingY: 1,
  });

  const header = new TextRenderable(renderer, {
    height: 2,
    content: "",
    fg: "#DDE6F2",
    attributes: TextAttributes.BOLD,
  });
  const summary = new TextRenderable(renderer, {
    height: 1,
    content: "",
    fg: "#8FA3B8",
  });
  const tableHead = new TextRenderable(renderer, {
    height: 3,
    content: "",
    fg: "#B8C5D6",
    attributes: TextAttributes.BOLD,
  });
  const body = new TextRenderable(renderer, {
    flexGrow: 1,
    content: "",
    fg: "#D7DEE8",
  });
  const footer = new TextRenderable(renderer, {
    height: 2,
    content: "",
    fg: "#8FA3B8",
  });

  root.add(header);
  root.add(summary);
  root.add(tableHead);
  root.add(body);
  root.add(footer);
  renderer.root.add(root);

  return { header, summary, tableHead, body, footer };
}

export function paint(
  renderer: CliRenderer,
  parts: ViewParts,
  state: TuiState,
  options: Options,
): void {
  const width = Math.max(52, renderer.width - 2);
  const height = Math.max(4, renderer.height - 11);
  const visible = sortedEntries(state.entries, state.sort);
  const ready = isReady(state);

  state.selected = clamp(state.selected, 0, Math.max(0, visible.length - 1));
  if (state.selected < state.offset) state.offset = state.selected;
  if (state.selected >= state.offset + height) state.offset = state.selected - height + 1;

  parts.header.content = renderHeader(options);
  parts.summary.content = renderSummary(state, options);
  parts.tableHead.content = renderTableHead(width);
  parts.body.content = renderRows({
    entries: visible,
    state,
    options,
    width,
    height,
    ready,
  });
  parts.footer.content = renderFooter(state, ready);
  renderer.requestRender();
}

export function isReady(state: TuiState): boolean {
  return state.stats.done && state.entries.every((entry) => entry.status !== "sizing");
}

function renderHeader(options: Options): StyledText {
  const root = truncate(formatRoot(options.root), 72).trim();
  return new StyledText([
    text("[k] katto "),
    fg("#7F8A99")(`(${root})`),
    text("\nFast cleanup for generated dependency and build folders"),
  ]);
}

function renderSummary(state: TuiState, options: Options): string {
  const elapsed = ((Date.now() - state.stats.startedAt) / 1000).toFixed(1);
  const total = state.entries.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
  const status = isReady(state) ? "ready" : "scanning";

  return [
    statCell("status", status),
    statCell("found", String(state.entries.length)),
    statCell("sized", String(state.stats.sized)),
    statCell("total", formatSize(total, options.sizeUnit)),
    statCell("deleted", String(state.stats.deleted)),
    statCell("reclaimed", formatSize(state.stats.reclaimed, options.sizeUnit)),
    statCell("elapsed", `${elapsed}s`),
  ].join("  ");
}

function renderTableHead(width: number): string {
  const cols = columns(width);
  return [
    border("top", cols),
    row(["size", "age", "status", "path"], cols),
    border("middle", cols),
  ].join("\n");
}

function renderRows(input: {
  entries: Entry[];
  state: TuiState;
  options: Options;
  width: number;
  height: number;
  ready: boolean;
}): StyledText {
  const { entries, state, options, width, height, ready } = input;
  const cols = columns(width);
  const rowHeight = Math.max(1, height - 1);
  const chunks: TextChunk[] = [];
  const rows = entries.slice(state.offset, state.offset + rowHeight);

  rows.forEach((entry, index) => {
    const absolute = state.offset + index;
    const size = formatSize(entry.size, options.sizeUnit);
    const age = formatAge(entry.mtime);
    const status = entry.status;
    const relativePath = entry.path.replace(`${options.root}/`, "");
    const line = row([size, age, status, relativePath], cols);

    chunks.push(ready && absolute === state.selected ? highlight(line) : text(line));
    chunks.push(text("\n"));
  });

  if (chunks.length === 0) {
    const message = state.stats.done ? "No target folders found." : "Waiting for matches...";
    chunks.push(text(row(["", "", "", message], cols)), text("\n"));
  }

  chunks.push(text(border("bottom", cols)));
  return new StyledText(chunks);
}

function renderFooter(state: TuiState, ready: boolean): string {
  if (state.confirmDeleteAll) {
    return `Confirm delete all ${state.entries.length} matches: y confirm  n cancel\n${state.message}`;
  }

  if (!ready) {
    return `q quit  r rescan  sort ${state.sort}\nSelection unlocks after scan and metadata finish.`;
  }

  return `j/k move  d delete  D delete all  s sort:${state.sort}  r rescan  q quit\n${state.message}`;
}

function statCell(label: string, value: string): string {
  return `${label} ${value}`;
}

function columns(width: number) {
  const size = 10;
  const age = 7;
  const status = 9;
  const separators = 5;
  const cellPadding = 8;
  const fixed = size + age + status + separators + cellPadding;
  return {
    size,
    age,
    status,
    path: Math.max(8, width - fixed),
  };
}

function row(values: [string, string, string, string], cols: ReturnType<typeof columns>): string {
  return [
    "│",
    cell(values[0], cols.size),
    "│",
    cell(values[1], cols.age),
    "│",
    cell(values[2], cols.status),
    "│",
    cell(values[3], cols.path),
    "│",
  ].join("");
}

function border(kind: "top" | "middle" | "bottom", cols: ReturnType<typeof columns>): string {
  const chars =
    kind === "top" ? ["┌", "┬", "┐"] : kind === "middle" ? ["├", "┼", "┤"] : ["└", "┴", "┘"];
  const segment = (width: number): string => "─".repeat(width + 2);

  return [
    chars[0],
    segment(cols.size),
    chars[1],
    segment(cols.age),
    chars[1],
    segment(cols.status),
    chars[1],
    segment(cols.path),
    chars[2],
  ].join("");
}

function cell(value: string, width: number): string {
  return ` ${truncate(value, width)} `;
}

function text(value: string): TextChunk {
  return {
    __isChunk: true,
    text: value,
  };
}

function highlight(value: string): TextChunk {
  return bg("#243447")(fg("#F8FAFC")(value));
}

function formatRoot(path: string): string {
  const home = homedir();
  return path === home
    ? "~"
    : path.startsWith(`${home}/`)
      ? `~/${path.slice(home.length + 1)}`
      : path;
}
