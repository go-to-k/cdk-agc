import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { cleanupAssets } from "./cleanup.js";

const TEST_DIR = path.join(process.cwd(), "test-cdk-out");

async function createTestManifest(artifacts: Record<string, unknown> = {}) {
  const manifest = {
    version: "1.0.0",
    artifacts,
  };
  await fs.writeFile(path.join(TEST_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function createTestFile(relativePath: string, content = "test") {
  const fullPath = path.join(TEST_DIR, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
}

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(TEST_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("cleanupAssets", () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should protect files referenced in manifest", async () => {
    await createTestManifest({
      MyStack: {
        type: "aws:cloudformation:stack",
        properties: {
          templateFile: "MyStack.template.json",
        },
      },
    });
    await createTestFile("MyStack.template.json", "{}");
    await createTestFile("asset.unused/file.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("manifest.json")).toBe(true);
    expect(await fileExists("MyStack.template.json")).toBe(true);
    expect(await fileExists("asset.unused")).toBe(false);
  });

  it("should protect essential metadata files", async () => {
    await createTestManifest();
    await createTestFile("tree.json", "{}");
    await createTestFile("cdk.out", "");
    await createTestFile("Stack.assets.json", "{}");
    await createTestFile("asset.unused/file.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("manifest.json")).toBe(true);
    expect(await fileExists("tree.json")).toBe(true);
    expect(await fileExists("cdk.out")).toBe(true);
    expect(await fileExists("Stack.assets.json")).toBe(true);
    expect(await fileExists("asset.unused")).toBe(false);
  });

  it("should not delete files in dry-run mode", async () => {
    await createTestManifest();
    await createTestFile("asset.unused/file.txt", "should remain");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: true, keepHours: 0 });

    expect(await fileExists("asset.unused/file.txt")).toBe(true);
  });

  it("should protect recent files based on keepHours", async () => {
    await createTestManifest();
    await createTestFile("asset.recent/file.txt", "new file");
    // Wait a bit to ensure mtime is set
    await new Promise((resolve) => setTimeout(resolve, 100));

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 1 });

    expect(await fileExists("asset.recent/file.txt")).toBe(true);
  });

  it("should handle nested paths in manifest", async () => {
    await createTestManifest({
      MyStack: {
        type: "aws:cloudformation:stack",
        properties: {
          file: "assembly-MyStack/MyStack.template.json",
        },
      },
    });
    await createTestFile("assembly-MyStack/MyStack.template.json", "{}");
    await createTestFile("asset.unused-dir/file.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("assembly-MyStack/MyStack.template.json")).toBe(true);
    expect(await fileExists("asset.unused-dir")).toBe(false);
  });

  it("should throw error if manifest.json is missing", async () => {
    await expect(cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 })).rejects.toThrow(
      "Failed to read manifest.json",
    );
  });

  it("should throw error if directory does not exist", async () => {
    await expect(
      cleanupAssets({ outdir: "/non-existent-dir", dryRun: false, keepHours: 0 }),
    ).rejects.toThrow("Directory not found");
  });

  it("should handle empty directory gracefully", async () => {
    await createTestManifest();

    await expect(
      cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 }),
    ).resolves.not.toThrow();
  });

  it("should protect assets referenced in *.assets.json files", async () => {
    await createTestManifest();

    // Create a mock *.assets.json file with asset references
    const assetsJson = {
      version: "1.0.0",
      files: {
        abc123: {
          source: {
            path: "asset.abc123",
            packaging: "zip",
          },
          destinations: {},
        },
        def456: {
          source: {
            path: "asset.def456",
            packaging: "file",
          },
          destinations: {},
        },
      },
      dockerImages: {
        ghi789: {
          source: {
            directory: "asset.ghi789",
            dockerBuildArgs: {},
          },
          destinations: {},
        },
      },
    };

    await createTestFile("Stack.assets.json", JSON.stringify(assetsJson, null, 2));

    // Create referenced asset directories and files
    await createTestFile("asset.abc123/index.js", "console.log('abc')");
    await createTestFile("asset.def456/data.json", '{"key":"value"}');
    await createTestFile("asset.ghi789/Dockerfile", "FROM node:20");

    // Create unreferenced asset directory
    await createTestFile("asset.unused/old.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    // Referenced assets should be protected
    expect(await fileExists("asset.abc123/index.js")).toBe(true);
    expect(await fileExists("asset.def456/data.json")).toBe(true);
    expect(await fileExists("asset.ghi789/Dockerfile")).toBe(true);

    // Unreferenced asset should be deleted
    expect(await fileExists("asset.unused")).toBe(false);
  });

  it("should protect assets used by multiple stacks", async () => {
    await createTestManifest();

    // Create two stacks that share the same asset
    const stack1AssetsJson = {
      version: "1.0.0",
      files: {
        shared123: {
          source: {
            path: "asset.shared123",
            packaging: "zip",
          },
          destinations: {},
        },
        stack1only: {
          source: {
            path: "asset.stack1only",
            packaging: "file",
          },
          destinations: {},
        },
      },
    };

    const stack2AssetsJson = {
      version: "1.0.0",
      files: {
        shared123: {
          source: {
            path: "asset.shared123",
            packaging: "zip",
          },
          destinations: {},
        },
        stack2only: {
          source: {
            path: "asset.stack2only",
            packaging: "file",
          },
          destinations: {},
        },
      },
    };

    await createTestFile("Stack1.assets.json", JSON.stringify(stack1AssetsJson, null, 2));
    await createTestFile("Stack2.assets.json", JSON.stringify(stack2AssetsJson, null, 2));

    // Create asset directories
    await createTestFile("asset.shared123/index.js", "console.log('shared')");
    await createTestFile("asset.stack1only/data1.json", '{"stack":1}');
    await createTestFile("asset.stack2only/data2.json", '{"stack":2}');
    await createTestFile("asset.unused/old.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    // Shared asset should be protected
    expect(await fileExists("asset.shared123/index.js")).toBe(true);

    // Stack-specific assets should be protected
    expect(await fileExists("asset.stack1only/data1.json")).toBe(true);
    expect(await fileExists("asset.stack2only/data2.json")).toBe(true);

    // Unreferenced asset should be deleted
    expect(await fileExists("asset.unused")).toBe(false);
  });

  it("should protect unreferenced assets with --keep-hours", async () => {
    await createTestManifest();

    // Create an assets.json file with one reference
    const assetsJson = {
      version: "1.0.0",
      files: {
        referenced: {
          source: {
            path: "asset.referenced",
            packaging: "zip",
          },
          destinations: {},
        },
      },
    };

    await createTestFile("Stack.assets.json", JSON.stringify(assetsJson, null, 2));

    // Create referenced and unreferenced assets
    await createTestFile("asset.referenced/index.js", "console.log('referenced')");
    await createTestFile("asset.recent-unreferenced/index.js", "console.log('recent')");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 1 });

    // Referenced asset should be protected
    expect(await fileExists("asset.referenced/index.js")).toBe(true);

    // Recent unreferenced asset should be protected by keepHours
    expect(await fileExists("asset.recent-unreferenced/index.js")).toBe(true);
  });

  it("should not delete user files (non-asset files)", async () => {
    await createTestManifest();

    // Create an assets.json file
    const assetsJson = {
      version: "1.0.0",
      files: {
        referenced: {
          source: {
            path: "asset.referenced",
            packaging: "zip",
          },
          destinations: {},
        },
      },
    };

    await createTestFile("Stack.assets.json", JSON.stringify(assetsJson, null, 2));

    // Create CDK-generated asset
    await createTestFile("asset.referenced/index.js", "console.log('referenced')");

    // Create user files that should NOT be deleted
    await createTestFile("my-notes.txt", "User notes");
    await createTestFile("debug.log", "Debug log");
    await createTestFile("temp-data/data.json", '{"test":true}');

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    // Referenced asset should be protected
    expect(await fileExists("asset.referenced/index.js")).toBe(true);

    // User files should NOT be deleted
    expect(await fileExists("my-notes.txt")).toBe(true);
    expect(await fileExists("debug.log")).toBe(true);
    expect(await fileExists("temp-data/data.json")).toBe(true);
  });

  it("should handle negative keepHours (treat as 0)", async () => {
    await createTestManifest();
    await createTestFile("asset.old/file.txt", "old file");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: -1 });

    // Negative value should be treated as no time-based protection
    expect(await fileExists("asset.old")).toBe(false);
  });

  it("should handle very large keepHours value", async () => {
    await createTestManifest();
    await createTestFile("asset.recent/file.txt", "recent file");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 99999 });

    // Very large value should protect all recent files
    expect(await fileExists("asset.recent/file.txt")).toBe(true);
  });

  it("should handle fractional keepHours value", async () => {
    await createTestManifest();
    await createTestFile("asset.verynew/file.txt", "very new file");

    // 0.001 hours = 3.6 seconds
    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0.001 });

    // File created just now should be protected
    expect(await fileExists("asset.verynew/file.txt")).toBe(true);
  });

  it("should delete assets older than keepHours and protect newer ones", async () => {
    await createTestManifest();

    // Create assets with different ages
    const oldAssetPath = path.join(TEST_DIR, "asset.old");
    const newAssetPath = path.join(TEST_DIR, "asset.new");
    const boundaryAssetPath = path.join(TEST_DIR, "asset.boundary");

    await fs.mkdir(oldAssetPath, { recursive: true });
    await fs.writeFile(path.join(oldAssetPath, "file.txt"), "old content");

    await fs.mkdir(newAssetPath, { recursive: true });
    await fs.writeFile(path.join(newAssetPath, "file.txt"), "new content");

    await fs.mkdir(boundaryAssetPath, { recursive: true });
    await fs.writeFile(path.join(boundaryAssetPath, "file.txt"), "boundary content");

    // Set modification times relative to when cleanup will run
    // Add buffer to account for test execution time
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000; // 4 hours ago
    const twoHoursAgo = now - 2 * 60 * 60 * 1000; // 2 hours ago
    const threeHoursAgo = now - 3 * 60 * 60 * 1000 + 100; // Just under 3 hours ago

    await fs.utimes(oldAssetPath, new Date(fourHoursAgo), new Date(fourHoursAgo));
    await fs.utimes(newAssetPath, new Date(twoHoursAgo), new Date(twoHoursAgo));
    await fs.utimes(boundaryAssetPath, new Date(threeHoursAgo), new Date(threeHoursAgo));

    // Clean with keepHours: 3
    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 3 });

    // Asset older than 3 hours should be deleted
    expect(await fileExists("asset.old")).toBe(false);

    // Asset newer than 3 hours should be protected
    expect(await fileExists("asset.new")).toBe(true);

    // Asset exactly at 3 hours boundary should be protected (<=)
    expect(await fileExists("asset.boundary")).toBe(true);
  });
});
