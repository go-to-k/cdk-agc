import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";

/**
 * Check if asset directories contain Dockerfile to identify Docker image assets
 * @param assetEntries - Pre-filtered entries that start with "asset."
 * @param outdir - Directory path where assets are located
 */
export async function collectDockerImageAssetPaths(
  assetEntries: string[],
  outdir: string,
): Promise<Set<string>> {
  return new Set<string>(
    await Promise.all(
      assetEntries.map(async (entry) => {
        const itemPath = path.join(outdir, entry);
        try {
          const stats = await fs.stat(itemPath);
          if (!stats.isDirectory()) return null;

          // Check if Dockerfile exists in the directory
          try {
            await fs.access(path.join(itemPath, "Dockerfile"));
            return itemPath;
          } catch {
            return null;
          }
        } catch {
          return null;
        }
      }),
    ).then((paths) => paths.filter((p): p is string => p !== null)),
  );
}

/**
 * Extract hash from Docker image asset path
 */
export function extractDockerImageHash(assetPath: string): string | null {
  const match = assetPath.match(/asset\.(.+)/);
  return match ? match[1] : null;
}

/**
 * Delete multiple Docker images by hash values
 * Only prints header if at least one image is found
 */
export async function deleteDockerImages(hashes: string[], dryRun: boolean): Promise<void> {
  if (hashes.length === 0) {
    return;
  }

  // Get all Docker images once
  let allImagesOutput: string;
  try {
    allImagesOutput = execSync(`docker images --format "{{.Repository}}:{{.Tag}}\t{{.ID}}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    // Docker not available or error - warn user
    console.warn(
      `\nWarning: Cannot check Docker images (Docker daemon may not be running). Skipping Docker cleanup.`,
    );
    return;
  }

  const existingHashes = hashes.filter((hash) => imageExistsInOutput(hash, allImagesOutput));

  if (existingHashes.length === 0) {
    return;
  }

  console.log("");

  for (const hash of existingHashes) {
    await deleteDockerImageFromOutput(hash, allImagesOutput, dryRun);
  }

  console.log("");
}

/**
 * Check if Docker image exists in the given docker images output
 */
function imageExistsInOutput(hash: string, allImagesOutput: string): boolean {
  for (const line of allImagesOutput.split("\n")) {
    if (!line) continue;
    const [tag] = line.split("\t");

    // Check for local format or ECR format
    if (tag === `cdkasset-${hash}:latest`) {
      return true;
    }
    if (tag.endsWith(`:${hash}`) && tag.includes("container-assets")) {
      return true;
    }
  }

  return false;
}

/**
 * Delete Docker image by hash value using pre-fetched docker images output
 */
async function deleteDockerImageFromOutput(
  hash: string,
  allImagesOutput: string,
  dryRun: boolean,
): Promise<void> {
  // Search all images for all tags with this hash
  const allTags = allImagesOutput
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split("\t")[0])
    .filter(
      (tag) =>
        tag === `cdkasset-${hash}:latest` ||
        (tag.endsWith(`:${hash}`) && tag.includes("container-assets")),
    );

  if (allTags.length === 0) {
    return;
  }

  console.log(
    `Found Docker image with ${allTags.length} tag(s) (asset.${hash.substring(0, 8)}...):`,
  );
  allTags.forEach((tag) => {
    console.log(`  - ${tag}`);
  });

  if (!dryRun) {
    for (const tag of allTags) {
      try {
        execSync(`docker rmi ${tag}`, { stdio: "pipe" });
      } catch (error) {
        console.warn(
          `    Warning: Failed to delete Docker image ${tag}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
