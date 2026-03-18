import { promises as fs } from "node:fs";
import path from "node:path";
import { calculateSize, formatSize } from "./utils.js";
import {
  collectDockerImageAssetPaths,
  deleteDockerImages,
  extractDockerImageHash,
} from "./docker-cleanup.js";

export interface CleanupOptions {
  outdir: string;
  dryRun: boolean;
  keepHours: number;
  verbose?: boolean;
}

interface ProtectionResult {
  isProtected: boolean;
  reason?: string;
}

/**
 * Clean up cdk.out directory
 */
export async function cleanupAssets(options: CleanupOptions): Promise<void> {
  const { outdir, dryRun, keepHours, verbose } = options;

  const fullPath = path.resolve(outdir);
  console.log(`Scanning ${fullPath}`);
  console.log(keepHours > 0 ? `Keeping files modified within ${keepHours} hours\n` : "");

  // Check directory exists
  try {
    await fs.access(outdir);
  } catch {
    throw new Error(`Directory not found: ${fullPath}`);
  }

  if (verbose) {
    console.log("Collecting referenced assets from *.assets.json files...");
  }

  // Collect asset paths referenced in *.assets.json files
  const activePaths = await collectAssetPaths(outdir);

  if (verbose) {
    console.log(`Found ${activePaths.size} asset(s) referenced in *.assets.json files\n`);
  }

  // Scan directory items
  const entries = await fs.readdir(outdir);
  const assetEntries = entries.filter((entry) => entry.startsWith("asset."));

  if (verbose) {
    console.log(
      `Found ${assetEntries.length} total asset file(s)/directory(ies) (starting with "asset.")`,
    );
  }

  // Collect all Docker image asset paths (both active and to-be-deleted)
  const allDockerImageAssetPaths = await collectDockerImageAssetPaths(assetEntries, outdir);

  if (verbose) {
    console.log("Analyzing assets for deletion candidates...\n");
  }

  const analysisResults = await Promise.all(
    assetEntries.map(async (entry) => {
      const itemPath = path.join(outdir, entry);
      const protection = await checkProtection(itemPath, activePaths, keepHours);
      const size = await calculateSize(itemPath);
      const isDockerImageAsset = allDockerImageAssetPaths.has(itemPath);

      return {
        path: itemPath,
        size,
        isDockerImageAsset,
        protection,
      };
    }),
  );

  const protectedItems = analysisResults.filter((item) => item.protection.isProtected);
  const itemsToDelete = analysisResults
    .filter((item) => !item.protection.isProtected)
    .map(({ path, size, isDockerImageAsset }) => ({ path, size, isDockerImageAsset }));

  // Display protected items if verbose
  if (verbose) {
    displayProtectedItems(protectedItems, outdir);
  }

  // Early return if nothing to delete
  if (itemsToDelete.length === 0) {
    console.log(`✓ No unused assets found.`);
    return;
  }

  // Display items to delete and collect Docker image hashes
  console.log(`Found ${itemsToDelete.length} unused item(s):`);
  displayItemsToDelete(itemsToDelete, outdir);

  const dockerImageHashes = itemsToDelete
    .filter((item) => item.isDockerImageAsset)
    .map((item) => extractDockerImageHash(item.path))
    .filter((hash): hash is string => hash !== null);

  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
  console.log(`\nTotal assets size to reclaim: ${formatSize(totalSize)}\n`);

  // Delete assets
  if (!dryRun) {
    await deleteAssetsWithProgress(itemsToDelete, outdir, verbose ?? false);
  }

  let dockerImageSize = 0;
  if (dockerImageHashes.length > 0) {
    dockerImageSize = await deleteDockerImages(dockerImageHashes, dryRun, verbose);
  }

  console.log("");
  console.log(
    `Total size to reclaim (assets + Docker images): ${formatSize(totalSize + dockerImageSize)}\n`,
  );

  if (dryRun) {
    console.log("Dry-run mode: No assets were deleted.");
  } else {
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

    // Only scan assembly-* subdirectories to avoid infinite loops
    if (item.isDirectory() && item.name.startsWith("assembly-")) {
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
 * Check if a file/directory should be protected from deletion
 */
async function checkProtection(
  itemPath: string,
  activePaths: Set<string>,
  keepHours: number,
): Promise<ProtectionResult> {
  // Protect assets referenced in *.assets.json files
  if (activePaths.has(itemPath)) {
    return { isProtected: true, reason: "referenced in *.assets.json" };
  }

  // Protect files/directories within retention period
  if (keepHours > 0) {
    const stats = await fs.stat(itemPath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours <= keepHours) {
      return { isProtected: true, reason: `modified within last ${keepHours} hour(s)` };
    }
  }

  return { isProtected: false };
}

/**
 * Display protected items in verbose mode
 */
function displayProtectedItems(
  items: Array<{ path: string; size: number; protection: ProtectionResult }>,
  outdir: string,
): void {
  if (items.length === 0) {
    return;
  }

  console.log("Protected assets:");
  for (const item of items) {
    const relativePath = path.relative(outdir, item.path);
    console.log(`  ⊘ ${relativePath} (${formatSize(item.size)}) - ${item.protection.reason}`);
  }
  console.log("");
}

/**
 * Display items to be deleted
 */
function displayItemsToDelete(items: Array<{ path: string; size: number }>, outdir: string): void {
  for (const item of items) {
    const relativePath = path.relative(outdir, item.path);
    console.log(`  - ${relativePath} (${formatSize(item.size)})`);
  }
}

/**
 * Delete assets with optional verbose progress output
 */
async function deleteAssetsWithProgress(
  items: Array<{ path: string }>,
  outdir: string,
  verbose: boolean,
): Promise<void> {
  if (verbose) {
    console.log("Deleting assets:");
  }

  await Promise.all(
    items.map(async (item) => {
      if (verbose) {
        const relativePath = path.relative(outdir, item.path);
        console.log(`  → Deleting ${relativePath}...`);
      }
      await fs.rm(item.path, { recursive: true, force: true });
    }),
  );

  if (verbose) {
    console.log("");
  }
}
