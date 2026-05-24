export const VERSION = "0.1.0";
export const DEFAULT_TARGETS = ["node_modules"];
export const DEFAULT_PRUNES = [".git", ".hg", ".svn"];

const CPU_COUNT = navigator.hardwareConcurrency || 8;
const WALK_BASE_CONCURRENCY = CPU_COUNT * 32;

export const WALK_CONCURRENCY =
  WALK_BASE_CONCURRENCY < 32 ? 32 : WALK_BASE_CONCURRENCY > 256 ? 256 : WALK_BASE_CONCURRENCY;
export const SIZE_CONCURRENCY = CPU_COUNT < 4 ? 4 : CPU_COUNT > 8 ? 8 : CPU_COUNT;
export const DELETE_CONCURRENCY = CPU_COUNT < 2 ? 2 : CPU_COUNT > 8 ? 8 : CPU_COUNT;
export const RENDER_INTERVAL_MS = 66;
