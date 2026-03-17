import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Calculate size of file or directory
 */
export async function calculateSize(itemPath: string): Promise<number> {
  let stats;
  try {
    stats = await fs.lstat(itemPath);
  } catch {
    // Skip items that can't be accessed
    return 0;
  }

  if (stats.isFile() || stats.isSymbolicLink()) {
    return stats.size;
  }

  if (stats.isDirectory()) {
    const entries = await fs.readdir(itemPath);
    const sizes = await Promise.all(
      entries.map((entry) => calculateSize(path.join(itemPath, entry))),
    );
    return sizes.reduce((sum, size) => sum + size, 0);
  }

  return 0;
}

/**
 * Format bytes to human-readable string
 */
export function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"] as const;
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex] ?? units[0]}`;
}
