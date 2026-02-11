import { promises as fs } from "fs";
import path from "path";
import { calculateSize, formatSize } from "./utils.js";

export interface CleanupOptions {
  outdir: string;
  dryRun: boolean;
  keepHours: number;
}

/**
 * Clean up cdk.out directory
 */
export async function cleanupAssets(options: CleanupOptions): Promise<void> {
  const { outdir, dryRun, keepHours } = options;

  console.log(`Scanning ${outdir}...`);
  console.log(`Protection policy: Referenced assets + Time-based (modified within ${keepHours} hours)\n`);

  // Check directory exists
  try {
    await fs.access(outdir);
  } catch {
    throw new Error(`Directory not found: ${outdir}`);
  }

  // Collect asset paths referenced in *.assets.json files
  const activePaths = await collectAssetPaths(outdir);

  // Scan directory items
  const entries = await fs.readdir(outdir);

  const itemsToDelete = (
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith("asset."))
        .map(async (entry) => {
          const itemPath = path.join(outdir, entry);

          if (await isProtected(itemPath, activePaths, keepHours)) {
            return null;
          }

          const size = await calculateSize(itemPath);
          return { path: itemPath, size };
        }),
    )
  ).filter((item): item is { path: string; size: number } => item !== null);

  // Display results
  if (itemsToDelete.length === 0) {
    console.log(`✓ No unused assets found.`);
    return;
  }

  console.log(`Found ${itemsToDelete.length} unused item(s):\n`);
  itemsToDelete.forEach((item) => {
    const relativePath = path.relative(outdir, item.path);
    console.log(`  - ${relativePath} (${formatSize(item.size)})`);
  });

  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
  console.log(`\nTotal size to reclaim: ${formatSize(totalSize)}\n`);

  if (dryRun) {
    console.log("Dry-run mode: No files were deleted.");
  } else {
    // Delete in parallel
    await Promise.all(
      itemsToDelete.map((item) => fs.rm(item.path, { recursive: true, force: true })),
    );
    console.log("✓ Cleanup completed successfully.");
  }
}

/**
 * Recursively collect asset paths from *.assets.json files
 */
async function collectAssetPaths(dirPath: string): Promise<Set<string>> {
  const activePaths = new Set<string>();
  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);

    // Recursively scan subdirectories (e.g., assembly-MyStage/)
    if (item.isDirectory()) {
      const subPaths = await collectAssetPaths(itemPath);
      subPaths.forEach((p) => activePaths.add(p));
      continue;
    }

    // Only process *.assets.json files
    if (!item.name.endsWith(".assets.json")) {
      continue;
    }

    // Parse assets.json file
    try {
      const content = await fs.readFile(itemPath, "utf-8");
      const assets = JSON.parse(content);

      // Collect asset paths from files object
      if (assets.files) {
        for (const fileEntry of Object.values(assets.files)) {
          const entry = fileEntry as { source?: { path?: string } };
          if (entry.source?.path) {
            const assetPath = path.join(path.dirname(itemPath), entry.source.path);
            activePaths.add(assetPath);
          }
        }
      }

      // Collect asset paths from dockerImages object
      if (assets.dockerImages) {
        for (const imageEntry of Object.values(assets.dockerImages)) {
          const entry = imageEntry as { source?: { directory?: string } };
          if (entry.source?.directory) {
            const assetPath = path.join(path.dirname(itemPath), entry.source.directory);
            activePaths.add(assetPath);
          }
        }
      }
    } catch (error) {
      // Skip malformed asset files
      console.warn(`Warning: Failed to parse ${item.name}:`, error);
    }
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
  // Protect assets referenced in *.assets.json files
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
