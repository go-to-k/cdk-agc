import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { calculateSize, formatSize } from "./utils.js";

export interface TempCleanupOptions {
  dryRun: boolean;
  keepHours: number;
  verbose?: boolean;
}

/**
 * Clean up all temporary CDK output directories
 */
export async function cleanupTempDirectories(options: TempCleanupOptions): Promise<void> {
  const { dryRun, keepHours, verbose } = options;
  const tmpdir = os.tmpdir();

  console.log(`Scanning ${tmpdir}`);
  console.log(keepHours > 0 ? `Keeping directories modified within ${keepHours} hours\n` : "");

  const directories = await findTempDirectories();

  if (directories.length === 0) {
    console.log("✓ No temporary CDK directories found.");
    return;
  }

  if (verbose) {
    console.log(`Found ${directories.length} temporary CDK directory(ies)\n`);
  }

  let totalCleaned = 0;
  let totalSize = 0;
  const protectedDirs: Array<{ path: string; reason: string }> = [];
  const dirsToDelete: Array<{ path: string; size: number }> = [];

  for (const dir of directories) {
    try {
      // Check if directory should be protected by age
      const protectionReason = await getProtectionReason(dir, keepHours);
      if (protectionReason) {
        if (verbose) {
          protectedDirs.push({ path: dir, reason: protectionReason });
        }
        continue;
      }

      // Calculate size before deletion
      const size = await calculateSize(dir);
      totalSize += size;
      dirsToDelete.push({ path: dir, size });

      totalCleaned++;
    } catch (error) {
      if (verbose) {
        console.warn(
          `Warning: Failed to process ${dir}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      continue;
    }
  }

  if (verbose && protectedDirs.length > 0) {
    console.log("Protected directories:");
    for (const item of protectedDirs) {
      console.log(`  ⊘ ${path.basename(item.path)} - ${item.reason}`);
    }
    console.log("");
  }

  if (verbose && dirsToDelete.length > 0) {
    console.log("Directories to delete:");
    for (const item of dirsToDelete) {
      console.log(`  ✓ ${path.basename(item.path)} (${formatSize(item.size)})`);
    }
    console.log("");
  }

  if (!dryRun && dirsToDelete.length > 0) {
    if (verbose) {
      console.log("Deleting directories:");
    }
    for (const item of dirsToDelete) {
      try {
        if (verbose) {
          console.log(`  → Deleting ${path.basename(item.path)}...`);
        }
        await fs.rm(item.path, { recursive: true, force: true });
      } catch (error) {
        console.warn(
          `Warning: Failed to delete ${item.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (verbose) {
      console.log("");
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
 * Get the reason why a directory should be protected from deletion
 * Returns null if not protected
 */
async function getProtectionReason(dirPath: string, keepHours: number): Promise<string | null> {
  if (keepHours <= 0) {
    return null;
  }

  try {
    const stats = await fs.stat(dirPath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours <= keepHours) {
      return `modified within last ${keepHours} hour(s)`;
    }
  } catch {
    return null;
  }

  return null;
}
