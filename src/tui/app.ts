import { createCliRenderer, type KeyEvent } from "@opentui/core";

import type { CliOptions, TuiState } from "../types";

import { RENDER_INTERVAL_MS } from "../constants";
import { freshStats } from "../core/stats";
import { Katto } from "../sdk";
import { createView, isReady, paint } from "./view";

export async function runTui(options: CliOptions): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    maxFps: 30,
    backgroundColor: "#101216",
  });

  const state: TuiState = {
    entries: [],
    stats: freshStats(),
    selected: 0,
    offset: 0,
    sort: options.sort,
    message: "Scanning...",
    confirmDeleteAll: false,
  };

  const view = createView(renderer);
  let renderQueued = false;
  let scanRun = 0;
  let katto = new Katto(options);

  const requestPaint = (): void => {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      paint(renderer, view, state, options);
    }, RENDER_INTERVAL_MS);
  };

  const startScan = async (): Promise<void> => {
    const currentRun = ++scanRun;
    katto = new Katto(options);
    resetForScan(state);
    state.stats = katto.stats;
    requestPaint();

    try {
      for await (const progress of katto.scanWithProgress()) {
        onScanEntry(state, currentRun, scanRun, progress.entries, requestPaint);
      }
      if (currentRun !== scanRun) return;

      state.entries = katto.entries;
      state.stats = katto.stats;
      state.message = `Scan complete in ${((Date.now() - state.stats.startedAt) / 1000).toFixed(1)}s.`;
      requestPaint();

      await maybeDeleteAllAfterScan(katto, options, state, requestPaint);
    } catch (error) {
      state.message = error instanceof Error ? error.message : String(error);
      state.stats.done = true;
      requestPaint();
    }
  };

  const deleteSelected = async (): Promise<void> => {
    const entry = katto.sort(state.entries, state.sort)[state.selected];
    if (!entry || entry.status === "deleted" || entry.status === "deleting") return;
    state.message = `Deleting ${entry.path}`;
    requestPaint();

    const ok = await katto.deleteEntry(entry);
    if (ok) {
      state.message = `Deleted ${entry.path}`;
    } else {
      state.message = entry.error ?? `Failed to delete ${entry.path}`;
    }

    requestPaint();
  };

  const deleteAllEntries = async (): Promise<void> => {
    state.message = "Deleting all matches...";
    await katto.deleteAll(state.entries, requestPaint);
    state.message = "Delete-all complete.";
    requestPaint();
  };

  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    handleKey({
      key,
      state,
      options,
      rendererDestroy: () => renderer.destroy(),
      requestPaint,
      startScan,
      deleteSelected,
      deleteAllEntries,
    });
  });

  renderer.on("resize", requestPaint);
  paint(renderer, view, state, options);
  await startScan();
}

function resetForScan(state: TuiState): void {
  state.entries.splice(0);
  state.stats = freshStats();
  state.selected = 0;
  state.offset = 0;
  state.message = "Scanning...";
  state.confirmDeleteAll = false;
}

function onScanEntry(
  state: TuiState,
  currentRun: number,
  scanRun: number,
  entries: TuiState["entries"],
  requestPaint: () => void,
): void {
  if (currentRun !== scanRun) return;
  state.entries = entries;
  state.stats.found = state.entries.length;
  state.stats.sized = state.entries.filter((item) => item.size !== null).length;
  requestPaint();
}

async function maybeDeleteAllAfterScan(
  katto: Katto,
  options: CliOptions,
  state: TuiState,
  requestPaint: () => void,
): Promise<void> {
  if (!options.deleteAll) return;

  if (!options.yes) {
    state.confirmDeleteAll = true;
    requestPaint();
    return;
  }

  state.message = "Deleting all matches...";
  await katto.deleteAll(state.entries, requestPaint);
  state.message = "Delete-all complete.";
  requestPaint();
}

function handleKey(input: {
  key: KeyEvent;
  state: TuiState;
  options: CliOptions;
  rendererDestroy: () => void;
  requestPaint: () => void;
  startScan: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  deleteAllEntries: () => Promise<void>;
}): void {
  const {
    key,
    state,
    options,
    rendererDestroy,
    requestPaint,
    startScan,
    deleteSelected,
    deleteAllEntries,
  } = input;

  if (key.name === "q" || key.name === "escape") {
    rendererDestroy();
    return;
  }

  if (state.confirmDeleteAll) {
    handleDeleteAllConfirm(key, state, options, requestPaint, deleteAllEntries);
    return;
  }

  if (key.name === "r") {
    void startScan();
    return;
  }

  if (!isReady(state)) return;

  switch (key.name) {
    case "down":
    case "j":
      state.selected++;
      requestPaint();
      break;
    case "up":
    case "k":
      state.selected--;
      requestPaint();
      break;
    case "d":
      void deleteSelected();
      break;
    case "D":
      state.confirmDeleteAll = true;
      requestPaint();
      break;
    case "s":
      state.sort =
        state.sort === "found"
          ? "size"
          : state.sort === "size"
            ? "path"
            : state.sort === "path"
              ? "age"
              : "found";
      requestPaint();
      break;
  }
}

function handleDeleteAllConfirm(
  key: KeyEvent,
  state: TuiState,
  options: CliOptions,
  requestPaint: () => void,
  deleteAllEntries: () => Promise<void>,
): void {
  if (key.name === "y") {
    state.confirmDeleteAll = false;
    void deleteAllEntries();
    return;
  }

  if (key.name === "n") {
    state.confirmDeleteAll = false;
    options.deleteAll = false;
    state.message = "Delete-all cancelled.";
    requestPaint();
  }
}
