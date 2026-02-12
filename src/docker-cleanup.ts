import { execSync } from "child_process";

/**
 * Collect Docker image info from assets.json files
 */
export function extractDockerImageHash(assetPath: string): string | null {
  // Extract hash from asset path like "asset.f575bdff..."
  const match = assetPath.match(/asset\.([a-f0-9]{64})/);
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
    // Docker not available or error
    return;
  }

  // Find existing hashes
  const existingHashes: string[] = [];
  for (const hash of hashes) {
    if (imageExistsInOutput(hash, allImagesOutput)) {
      existingHashes.push(hash);
    }
  }

  if (existingHashes.length === 0) {
    return;
  }

  // Print header
  const count = existingHashes.length;
  console.log(`\nFound ${count} Docker image(s):`);

  // Delete images
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
): Promise<boolean> {
  try {
    // Search all images for all tags with this hash
    let imageId = "";
    const allTags: string[] = [];

    for (const line of allImagesOutput.split("\n")) {
      if (!line) continue;

      const [tag, id] = line.split("\t");

      // Check for local format tag
      if (tag === `cdkasset-${hash}:latest`) {
        if (!imageId) {
          imageId = id;
        }
        if (!allTags.includes(tag)) {
          allTags.push(tag);
        }
      }

      // Check for ECR format tag
      if (tag.endsWith(`:${hash}`) && tag.includes("container-assets")) {
        if (!imageId) {
          imageId = id;
        }
        if (!allTags.includes(tag)) {
          allTags.push(tag);
        }
      }
    }

    if (!imageId) {
      return false; // Image doesn't exist
    }

    if (dryRun) {
      allTags.forEach((tag) => {
        console.log(`  - ${tag}`);
      });
      return true;
    }

    // Delete all tags
    for (const tag of allTags) {
      try {
        execSync(`docker rmi ${tag}`, { stdio: "pipe" });
      } catch {
        // Ignore if tag doesn't exist or deletion fails
      }
    }

    allTags.forEach((tag) => {
      console.log(`  - ${tag}`);
    });
    return true;
  } catch (error) {
    // Log error for debugging
    console.error(
      `    Failed to delete Docker image for ${hash.substring(0, 12)}...: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}
