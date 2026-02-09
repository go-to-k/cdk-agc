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
    await createTestFile("unused.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("manifest.json")).toBe(true);
    expect(await fileExists("MyStack.template.json")).toBe(true);
    expect(await fileExists("unused.txt")).toBe(false);
  });

  it("should protect essential metadata files", async () => {
    await createTestManifest();
    await createTestFile("tree.json", "{}");
    await createTestFile("cdk.context.json", "{}");
    await createTestFile("cdk.out", "");
    await createTestFile("Stack.assets.json", "{}");
    await createTestFile("unused.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("manifest.json")).toBe(true);
    expect(await fileExists("tree.json")).toBe(true);
    expect(await fileExists("cdk.context.json")).toBe(true);
    expect(await fileExists("cdk.out")).toBe(true);
    expect(await fileExists("Stack.assets.json")).toBe(true);
    expect(await fileExists("unused.txt")).toBe(false);
  });

  it("should not delete files in dry-run mode", async () => {
    await createTestManifest();
    await createTestFile("unused.txt", "should remain");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: true, keepHours: 0 });

    expect(await fileExists("unused.txt")).toBe(true);
  });

  it("should protect recent files based on keepHours", async () => {
    await createTestManifest();
    await createTestFile("recent.txt", "new file");
    // Wait a bit to ensure mtime is set
    await new Promise((resolve) => setTimeout(resolve, 100));

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 1 });

    expect(await fileExists("recent.txt")).toBe(true);
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
    await createTestFile("unused-dir/file.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("assembly-MyStack/MyStack.template.json")).toBe(true);
    expect(await fileExists("unused-dir")).toBe(false);
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
        "abc123": {
          source: {
            path: "asset.abc123",
            packaging: "zip",
          },
          destinations: {},
        },
        "def456": {
          source: {
            path: "asset.def456",
            packaging: "file",
          },
          destinations: {},
        },
      },
      dockerImages: {
        "ghi789": {
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
        "shared123": {
          source: {
            path: "asset.shared123",
            packaging: "zip",
          },
          destinations: {},
        },
        "stack1only": {
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
        "shared123": {
          source: {
            path: "asset.shared123",
            packaging: "zip",
          },
          destinations: {},
        },
        "stack2only": {
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
        "referenced": {
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
});
