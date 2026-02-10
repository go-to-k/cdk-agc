import { promises as fs } from "fs";
import path from "path";
import os from "os";

export interface CleanupOptions {
  outdir: string;
  dryRun: boolean;
  keepHours: number;
}

export interface TempCleanupOptions {
  dryRun: boolean;
  keepHours: number;
}

interface ManifestArtifact {
  type: string;
  properties?: {
    file?: string;
    templateFile?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Manifest {
  version: string;
  artifacts?: Record<string, ManifestArtifact>;
}

/**
 * Recursively collect all paths referenced in the manifest
 */
function collectActivePaths(obj: unknown, basePath: string, collected: Set<string>): void {
  if (typeof obj === "string") {
    const fullPath = path.join(basePath, obj);
    collected.add(fullPath);
    // Also protect parent directories
    let parent = path.dirname(fullPath);
    while (parent !== basePath && parent !== ".") {
      collected.add(parent);
      parent = path.dirname(parent);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item) => collectActivePaths(item, basePath, collected));
  } else if (obj && typeof obj === "object") {
    Object.values(obj).forEach((value) => collectActivePaths(value, basePath, collected));
  }
}

/**
 * Parse *.assets.json files and collect asset paths (recursively)
 */
async function collectAssetPaths(outdir: string, activePaths: Set<string>): Promise<void> {
  const items = await fs.readdir(outdir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(outdir, item.name);

    if (item.isDirectory()) {
      // Recursively scan subdirectories (e.g., assembly-MyStage/)
      await collectAssetPaths(itemPath, activePaths);
    } else if (item.name.endsWith(".assets.json")) {
      // Parse assets.json file
      try {
        const content = await fs.readFile(itemPath, "utf-8");
        const assets = JSON.parse(content);

        // Collect asset paths from files object
        if (assets.files) {
          for (const fileEntry of Object.values(assets.files)) {
            const entry = fileEntry as { source?: { path?: string } };
            if (entry.source?.path) {
              const assetPath = path.join(outdir, entry.source.path);
              activePaths.add(assetPath);
            }
          }
        }

        // Collect asset paths from dockerImages object
        if (assets.dockerImages) {
          for (const imageEntry of Object.values(assets.dockerImages)) {
            const entry = imageEntry as { source?: { directory?: string } };
            if (entry.source?.directory) {
              const assetPath = path.join(outdir, entry.source.directory);
              activePaths.add(assetPath);
            }
          }
        }
      } catch (error) {
        // Skip malformed asset files
        console.warn(`Warning: Failed to parse ${item.name}:`, error);
      }
    }
  }
}

/**
 * Parse manifest file and get active paths
 */
async function getActivePathsFromManifest(outdir: string): Promise<Set<string>> {
  const manifestPath = path.join(outdir, "manifest.json");
  const activePaths = new Set<string>();

  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    const manifest: Manifest = JSON.parse(content);

    collectActivePaths(manifest, outdir, activePaths);

    // Also collect paths from *.assets.json files
    await collectAssetPaths(outdir, activePaths);
  } catch (error) {
    throw new Error(
      `Failed to read manifest.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return activePaths;
}

/**
 * Check if file/directory should be protected from deletion
 */
async function isProtected(
  itemPath: string,
  activePaths: Set<string>,
  keepHours: number,
): Promise<boolean> {
  // Protect paths referenced in manifest
  if (activePaths.has(itemPath)) {
    return true;
  }

  // Protect files/directories within retention period
  if (keepHours > 0) {
    const stats = await fs.stat(itemPath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours <= keepHours) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate size of file or directory
 */
async function calculateSize(itemPath: string): Promise<number> {
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
 * Recursively remove file or directory
 */
async function remove(itemPath: string): Promise<void> {
  const stats = await fs.stat(itemPath);

  if (stats.isDirectory()) {
    await fs.rm(itemPath, { recursive: true, force: true });
  } else {
    await fs.unlink(itemPath);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Clean up cdk.out directory
 */
export async function cleanupAssets(options: CleanupOptions): Promise<void> {
  const { outdir, dryRun, keepHours } = options;

  console.log(`Scanning ${outdir}...`);
  console.log(`Protection policy: Active manifest + files modified within ${keepHours} hours\n`);

  // Check directory exists
  try {
    await fs.access(outdir);
  } catch {
    throw new Error(`Directory not found: ${outdir}`);
  }

  // Collect paths referenced in manifest
  const activePaths = await getActivePathsFromManifest(outdir);

  // Scan directory items
  const entries = await fs.readdir(outdir);
  const itemsToDelete: Array<{ path: string; size: number }> = [];

  await Promise.all(
    entries.map(async (entry) => {
      const itemPath = path.join(outdir, entry);

      // Only consider asset.* files/directories for deletion
      if (!entry.startsWith("asset.")) {
        return;
      }

      if (await isProtected(itemPath, activePaths, keepHours)) {
        return;
      }

      const size = await calculateSize(itemPath);
      itemsToDelete.push({ path: itemPath, size });
    }),
  );

  // Display results
  if (itemsToDelete.length === 0) {
    console.log(`✓ No unused assets found.`);
    return;
  }

  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);

  console.log(`Found ${itemsToDelete.length} unused item(s):\n`);
  itemsToDelete.forEach((item) => {
    const relativePath = path.relative(outdir, item.path);
    console.log(`  - ${relativePath} (${formatSize(item.size)})`);
  });

  console.log(`\nTotal size to reclaim: ${formatSize(totalSize)}\n`);

  if (dryRun) {
    console.log("Dry-run mode: No files were deleted.");
  } else {
    // Delete in parallel
    await Promise.all(itemsToDelete.map((item) => remove(item.path)));
    console.log("✓ Cleanup completed successfully.");
  }
}

/**
 * Find all cdk.out temporary directories in $TMPDIR
 */
async function findTempDirectories(): Promise<string[]> {
  const tmpdir = os.tmpdir();
  const directories: string[] = [];

  try {
    const items = await fs.readdir(tmpdir, { withFileTypes: true });

    for (const item of items) {
      // Match directories starting with "cdk.out", "cdk-", or ".cdk"
      if (
        item.isDirectory() &&
        (item.name.startsWith("cdk.out") ||
          item.name.startsWith("cdk-") ||
          item.name.startsWith(".cdk"))
      ) {
        const dirPath = path.join(tmpdir, item.name);
        directories.push(dirPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to scan $TMPDIR (${tmpdir}):`, error);
  }

  return directories;
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

/**
 * Clean up all temporary CDK output directories
 */
export async function cleanupTempDirectories(options: TempCleanupOptions): Promise<void> {
  const { dryRun, keepHours } = options;
  const tmpdir = os.tmpdir();

  console.log(`Scanning ${tmpdir}...`);
  console.log(`Protection policy: Time-based (directories modified within ${keepHours} hours)\n`);

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
        await remove(dir);
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
