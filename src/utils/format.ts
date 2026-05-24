import type { SizeUnit } from "../types";

export function formatSize(bytes: number | null, unit: SizeUnit): string {
  if (bytes === null) return "pending";
  if (unit === "bytes") return `${bytes} B`;

  const mb = bytes / 1024 / 1024;
  if (unit === "mb" || (unit === "auto" && mb < 1024)) return `${Math.round(mb)} MB`;

  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatAge(mtime: number | null): string {
  if (mtime === null) return "--";

  const days = Math.max(0, Math.floor((Date.now() - mtime) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d";

  return `${days}d`;
}

export function truncate(value: string, width: number): string {
  if (width <= 0) return "";
  if (value.length <= width) return value.padEnd(width);
  if (width === 1) return value.slice(0, 1);

  return `${value.slice(0, width - 1)}…`;
}
