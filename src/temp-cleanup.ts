import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { calculateSize, formatSize } from "./utils.js";

export interface TempCleanupOptions {
  dryRun: boolean;
  keepHours: number;
}

/**
 * Clean up all temporary CDK output directories
 */
export async function cleanupTempDirectories(options: TempCleanupOptions): Promise<void> {
  const { dryRun, keepHours } = options;
  const tmpdir = os.tmpdir();

  console.log(`Scanning ${tmpdir}`);
  console.log(keepHours > 0 ? `Keeping directories modified within ${keepHours} hours\n` : "");

  const directories = await findTempDirectories();

  if (directories.length === 0) {
    console.log("✓ No temporary CDK directories found.");
    return;
  }

  let totalCleaned = 0;
  let totalSize = 0;

  for (const dir of directories) {
    try {
      // Check if directory should be protected by age
      if (await shouldProtectDirectory(dir, keepHours)) {
        continue;
      }

      // Calculate size before deletion
      const size = await calculateSize(dir);
      totalSize += size;

      if (!dryRun) {
        await fs.rm(dir, { recursive: true, force: true });
      }

      totalCleaned++;
    } catch {
      // Silently continue on error
      continue;
    }
  }

  if (totalCleaned === 0) {
    console.log("✓ No temporary CDK directories to clean.");
    return;
  }

  console.log(`Found ${totalCleaned} temporary CDK directory(ies)\n`);
  console.log(`Total size to reclaim: ${formatSize(totalSize)}\n`);

  if (dryRun) {
    console.log("Dry-run mode: No files were deleted.");
  } else {
    console.log("✓ Cleanup completed successfully.");
  }
}

/**
 * Find all cdk.out temporary directories in $TMPDIR
 */
async function findTempDirectories(): Promise<string[]> {
  const tmpdir = os.tmpdir();

  try {
    const items = await fs.readdir(tmpdir, { withFileTypes: true });

    return items
      .filter(
        (item) =>
          item.isDirectory() &&
          (item.name.startsWith("cdk.out") ||
            item.name.startsWith("cdk-") ||
            item.name.startsWith(".cdk")),
      )
      .map((item) => path.join(tmpdir, item.name));
  } catch (error) {
    console.warn(`Warning: Failed to scan $TMPDIR (${tmpdir}):`, error);
    return [];
  }
}

/**
 * Check if directory should be protected based on age
 */
async function shouldProtectDirectory(dirPath: string, keepHours: number): Promise<boolean> {
  if (keepHours <= 0) {
    return false;
  }

  try {
    const stats = await fs.stat(dirPath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    return ageHours <= keepHours;
  } catch {
    return false;
  }
}
