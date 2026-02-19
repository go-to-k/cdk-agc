import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { formatSize } from "./utils.js";

/**
 * Get the Docker-compatible CLI command to use.
 * Respects the CDK_DOCKER environment variable, defaulting to "docker".
 */
function getDockerCommand(): string {
  return process.env.CDK_DOCKER ?? "docker";
}

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
 * Returns the total size of Docker images in bytes
 */
export async function deleteDockerImages(hashes: string[], dryRun: boolean): Promise<number> {
  if (hashes.length === 0) {
    return 0;
  }

  // Get all Docker images once with size information
  const dockerCommand = getDockerCommand();
  let allImagesOutput: string;
  try {
    allImagesOutput = execSync(
      `${dockerCommand} image ls --format "{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}"`,
      {
        encoding: "utf-8",
        stdio: "pipe",
      },
    );
  } catch {
    // Docker not available or error - warn user
    console.warn(
      `\nWarning: Cannot check Docker images (${dockerCommand} daemon may not be running). Skipping Docker cleanup.`,
    );
    return 0;
  }

  const existingHashes = hashes.filter((hash) => imageExistsInOutput(hash, allImagesOutput));

  if (existingHashes.length === 0) {
    return 0;
  }

  console.log("");

  let totalDockerSize = 0;
  for (const hash of existingHashes) {
    const size = await deleteDockerImageFromOutput(hash, allImagesOutput, dryRun);
    totalDockerSize += size;
  }

  if (totalDockerSize > 0) {
    console.log(`Total Docker image size to reclaim: ${formatSize(totalDockerSize)}`);
  }

  console.log("");

  return totalDockerSize;
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
 * Returns the size of the image in bytes
 */
async function deleteDockerImageFromOutput(
  hash: string,
  allImagesOutput: string,
  dryRun: boolean,
): Promise<number> {
  // Search all images for all tags with this hash and extract size
  const matchingLines = allImagesOutput
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [tag, id, size] = line.split("\t");
      return { tag, id, size };
    })
    .filter(
      ({ tag }) =>
        tag === `cdkasset-${hash}:latest` ||
        (tag.endsWith(`:${hash}`) && tag.includes("container-assets")),
    );

  if (matchingLines.length === 0) {
    return 0;
  }

  const allTags = matchingLines.map(({ tag }) => tag);
  // Use the size from the first matching image (all tags point to the same image)
  const imageSize = parseDockerSize(matchingLines[0].size);

  console.log(
    `Found Docker image with ${allTags.length} tag(s) [asset.${hash.substring(0, 8)}...] (${formatSize(imageSize)}):`,
  );
  allTags.forEach((tag) => {
    console.log(`  - ${tag}`);
  });
  console.log("");

  if (!dryRun) {
    const dockerCommand = getDockerCommand();
    for (const tag of allTags) {
      try {
        execSync(`${dockerCommand} image rm ${tag}`, { stdio: "pipe" });
      } catch (error) {
        console.warn(
          `    Warning: Failed to delete Docker image ${tag}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return imageSize;
}

/**
 * Parse Docker image size string to bytes
 */
export function parseDockerSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return Math.round(value * (multipliers[unit] || 1));
}
