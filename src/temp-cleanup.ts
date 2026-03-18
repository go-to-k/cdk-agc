import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { calculateSize, formatSize } from "./utils.js";

export interface TempCleanupOptions {
  dryRun: boolean;
  keepHours: number;
  verbose?: boolean;
}

interface ProtectionResult {
  isProtected: boolean;
  reason?: string;
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

  const analysisResults = await Promise.all(
    directories.map(async (dir) => {
      try {
        const protection = await checkProtection(dir, keepHours);
        const size = await calculateSize(dir);

        return {
          path: dir,
          size,
          protection,
        };
      } catch (error) {
        if (verbose) {
          console.warn(
            `Warning: Failed to process ${dir}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return null;
      }
    }),
  );

  const validResults = analysisResults.filter(
    (result): result is { path: string; size: number; protection: ProtectionResult } =>
      result !== null,
  );

  const protectedDirs = validResults
    .filter((result) => result.protection.isProtected)
    .map(({ path, protection }) => ({ path, reason: protection.reason! }));

  const dirsToDelete = validResults
    .filter((result) => !result.protection.isProtected)
    .map(({ path, size }) => ({ path, size }));

  const totalCleaned = dirsToDelete.length;
  const totalSize = dirsToDelete.reduce((sum, item) => sum + item.size, 0);

  // Display verbose information
  if (verbose) {
    displayProtectedDirectories(protectedDirs);
    displayDirectoriesToDelete(dirsToDelete);
  }

  // Delete directories
  if (!dryRun && dirsToDelete.length > 0) {
    await deleteDirectoriesWithProgress(dirsToDelete, verbose ?? false);
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
 * Check if a directory should be protected from deletion
 */
async function checkProtection(dirPath: string, keepHours: number): Promise<ProtectionResult> {
  if (keepHours <= 0) {
    return { isProtected: false };
  }

  try {
    const stats = await fs.stat(dirPath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours <= keepHours) {
      return { isProtected: true, reason: `modified within last ${keepHours} hour(s)` };
    }
  } catch {
    return { isProtected: false };
  }

  return { isProtected: false };
}

/**
 * Display protected directories in verbose mode
 */
function displayProtectedDirectories(dirs: Array<{ path: string; reason: string }>): void {
  if (dirs.length === 0) {
    return;
  }

  console.log("Protected directories:");
  for (const item of dirs) {
    console.log(`  ⊘ ${path.basename(item.path)} - ${item.reason}`);
  }
  console.log("");
}

/**
 * Display directories to be deleted in verbose mode
 */
function displayDirectoriesToDelete(dirs: Array<{ path: string; size: number }>): void {
  if (dirs.length === 0) {
    return;
  }

  console.log("Directories to delete:");
  for (const item of dirs) {
    console.log(`  ✓ ${path.basename(item.path)} (${formatSize(item.size)})`);
  }
  console.log("");
}

/**
 * Delete directories with optional verbose progress output
 */
async function deleteDirectoriesWithProgress(
  dirs: Array<{ path: string }>,
  verbose: boolean,
): Promise<void> {
  if (verbose) {
    console.log("Deleting directories:");
  }

  for (const item of dirs) {
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
