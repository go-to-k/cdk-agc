import { promises as fs } from "fs";
import path from "path";

/**
 * Calculate size of file or directory
 */
export async function calculateSize(itemPath: string): Promise<number> {
  const stats = await fs.stat(itemPath);

  if (stats.isFile()) {
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
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
