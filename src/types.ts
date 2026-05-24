export type SortMode = "found" | "size" | "path" | "age";
export type SizeUnit = "auto" | "mb" | "gb" | "bytes";
export type SizeStrategy = "auto" | "native" | "js" | "none";

export interface Options {
  root: string;
  targets: string[];
  exclude: string[];
  excludeSensitive: boolean;
  dryRun: boolean;
  noSize: boolean;
  sizeStrategy: SizeStrategy;
  sort: SortMode;
  sizeUnit: SizeUnit;
}

export interface CliOptions extends Options {
  deleteAll: boolean;
  yes: boolean;
  json: boolean;
  jsonStream: boolean;
}

export interface KattoOptions {
  root?: string;
  targets?: string[];
  exclude?: string[];
  excludeSensitive?: boolean;
  dryRun?: boolean;
  noSize?: boolean;
  sizeStrategy?: SizeStrategy;
  sort?: SortMode;
  sizeUnit?: SizeUnit;
}

export interface Entry {
  id: number;
  path: string;
  name: string;
  size: number | null;
  mtime: number | null;
  status: "found" | "sizing" | "ready" | "deleting" | "deleted" | "failed";
  error?: string;
}

export interface Stats {
  scanned: number;
  found: number;
  sized: number;
  deleted: number;
  reclaimed: number;
  startedAt: number;
  done: boolean;
}

export interface ScanProgress {
  phase: "found" | "updated";
  entry: Entry;
  entries: Entry[];
  stats: Stats;
}

export interface TuiState {
  entries: Entry[];
  stats: Stats;
  selected: number;
  offset: number;
  sort: SortMode;
  message: string;
  confirmDeleteAll: boolean;
}
