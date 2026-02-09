import { promises as fs } from "fs";
import path from "path";

export interface CleanupOptions {
  outdir: string;
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

const PROTECTED_FILES = new Set(["manifest.json", "tree.json", "cdk.context.json", "cdk.out"]);

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
 * Parse *.assets.json files and collect asset paths with stack information
 */
async function collectAssetPaths(
  outdir: string,
  activePaths: Set<string>,
  assetToStacksMap: Map<string, Set<string>>,
): Promise<void> {
  const items = await fs.readdir(outdir);
  const assetFiles = items.filter((item) => item.endsWith(".assets.json"));

  for (const assetFile of assetFiles) {
    const stackName = assetFile.replace(".assets.json", "");

    try {
      const content = await fs.readFile(path.join(outdir, assetFile), "utf-8");
      const assets = JSON.parse(content);

      // Collect asset paths from files object
      if (assets.files) {
        for (const fileEntry of Object.values(assets.files)) {
          const entry = fileEntry as { source?: { path?: string } };
          if (entry.source?.path) {
            const assetPath = path.join(outdir, entry.source.path);
            activePaths.add(assetPath);
            if (!assetToStacksMap.has(assetPath)) {
              assetToStacksMap.set(assetPath, new Set());
            }
            assetToStacksMap.get(assetPath)!.add(stackName);
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
            if (!assetToStacksMap.has(assetPath)) {
              assetToStacksMap.set(assetPath, new Set());
            }
            assetToStacksMap.get(assetPath)!.add(stackName);
          }
        }
      }
    } catch (error) {
      // Skip malformed asset files
      console.warn(`Warning: Failed to parse ${assetFile}:`, error);
    }
  }
}

/**
 * Parse manifest file and get active paths with asset-to-stacks mapping
 */
async function getActivePathsFromManifest(
  outdir: string,
): Promise<{ activePaths: Set<string>; assetToStacksMap: Map<string, Set<string>> }> {
  const manifestPath = path.join(outdir, "manifest.json");
  const activePaths = new Set<string>();
  const assetToStacksMap = new Map<string, Set<string>>();

  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    const manifest: Manifest = JSON.parse(content);

    collectActivePaths(manifest, outdir, activePaths);

    // Also collect paths from *.assets.json files
    await collectAssetPaths(outdir, activePaths, assetToStacksMap);
  } catch (error) {
    throw new Error(
      `Failed to read manifest.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { activePaths, assetToStacksMap };
}

/**
 * Check if file/directory should be protected from deletion
 */
async function isProtected(
  itemPath: string,
  outdir: string,
  activePaths: Set<string>,
  keepHours: number,
): Promise<boolean> {
  const basename = path.basename(itemPath);

  // Always protect essential metadata files
  if (PROTECTED_FILES.has(basename)) {
    return true;
  }

  // Always protect *.template.json and *.assets.json
  if (basename.endsWith(".template.json") || basename.endsWith(".assets.json")) {
    return true;
  }

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
  const { activePaths, assetToStacksMap } = await getActivePathsFromManifest(outdir);

  // Scan directory items
  const entries = await fs.readdir(outdir);
  const itemsToDelete: Array<{ path: string; size: number }> = [];
  const referencedAssets: Array<{ path: string; stacks: string[] }> = [];
  const timeProtectedAssets: string[] = [];
  let protectedCount = 0;

  await Promise.all(
    entries.map(async (entry) => {
      const itemPath = path.join(outdir, entry);

      if (await isProtected(itemPath, outdir, activePaths, keepHours)) {
        protectedCount++;
        const stacks = assetToStacksMap.get(itemPath);

        // Check if this is an asset protected by stack reference
        if (stacks && stacks.size > 0 && entry.startsWith("asset.")) {
          referencedAssets.push({ path: entry, stacks: Array.from(stacks).sort() });
        }
        // Check if this is protected by keepHours but not referenced
        else if (keepHours > 0 && entry.startsWith("asset.")) {
          const stats = await fs.stat(itemPath);
          const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
          if (ageHours <= keepHours) {
            timeProtectedAssets.push(entry);
          }
        }
        return;
      }

      const size = await calculateSize(itemPath);
      itemsToDelete.push({ path: itemPath, size });
    }),
  );

  // Display results
  if (itemsToDelete.length === 0) {
    console.log(`✓ No unused assets found. ${protectedCount} item(s) are protected.`);

    if (referencedAssets.length > 0) {
      console.log(`\nAssets referenced in stacks:`);
      for (const asset of referencedAssets) {
        const stacksText =
          asset.stacks.length === 1 ? asset.stacks[0] : asset.stacks.join(", ");
        console.log(`  - ${asset.path} (used in ${stacksText})`);
      }
    }

    if (timeProtectedAssets.length > 0) {
      console.log(`\nAssets protected by --keep-hours ${keepHours}:`);
      for (const asset of timeProtectedAssets) {
        console.log(`  - ${asset}`);
      }
    }
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
