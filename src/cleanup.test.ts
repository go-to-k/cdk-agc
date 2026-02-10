import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { cleanupAssets, cleanupTempDirectories } from "./cleanup.js";

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

  it("should protect assets and essential metadata files", async () => {
    await createTestManifest({
      "MyStack.assets": {
        type: "cdk:asset-manifest",
        properties: {
          file: "MyStack.assets.json",
        },
      },
      MyStack: {
        type: "aws:cloudformation:stack",
        properties: {
          templateFile: "MyStack.template.json",
        },
      },
    });

    // Create assets.json with asset reference
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
      },
    };

    await createTestFile("MyStack.template.json", "{}");
    await createTestFile("MyStack.assets.json", JSON.stringify(assetsJson, null, 2));
    await createTestFile("tree.json", "{}");
    await createTestFile("cdk.out", "");
    await createTestFile("asset.abc123/index.js", "console.log('protected')");
    await createTestFile("asset.unused/file.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("manifest.json")).toBe(true);
    expect(await fileExists("MyStack.template.json")).toBe(true);
    expect(await fileExists("MyStack.assets.json")).toBe(true);
    expect(await fileExists("tree.json")).toBe(true);
    expect(await fileExists("cdk.out")).toBe(true);
    expect(await fileExists("asset.abc123/index.js")).toBe(true);
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

  it("should protect nested stack template files", async () => {
    await createTestManifest({
      "CdkSampleStack.assets": {
        type: "cdk:asset-manifest",
        properties: {
          file: "CdkSampleStack.assets.json",
        },
      },
      CdkSampleStack: {
        type: "aws:cloudformation:stack",
        properties: {
          templateFile: "CdkSampleStack.template.json",
        },
        metadata: {
          "/CdkSampleStack/MyNestedStack.NestedStack/MyNestedStack.NestedStackResource": [
            {
              type: "aws:cdk:logicalId",
              data: "MyNestedStackNestedStackMyNestedStackNestedStackResource9C617903",
            },
          ],
        },
      },
    });
    await createTestFile("CdkSampleStack.template.json", "{}");
    await createTestFile("CdkSampleStack.assets.json", "{}");
    await createTestFile("CdkSampleStackMyNestedStackEC13F2A2.nested.template.json", "{}");
    await createTestFile("asset.unused-dir/file.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("CdkSampleStack.template.json")).toBe(true);
    expect(await fileExists("CdkSampleStack.assets.json")).toBe(true);
    expect(await fileExists("CdkSampleStackMyNestedStackEC13F2A2.nested.template.json")).toBe(true);
    expect(await fileExists("asset.unused-dir")).toBe(false);
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

  it("should work without manifest.json", async () => {
    // Create assets.json and asset without manifest.json
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
      },
    };

    await createTestFile("Stack.assets.json", JSON.stringify(assetsJson, null, 2));
    await createTestFile("asset.abc123/index.js", "console.log('abc')");
    await createTestFile("asset.unused/old.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    // Referenced asset should be protected
    expect(await fileExists("asset.abc123/index.js")).toBe(true);
    // Unreferenced asset should be deleted
    expect(await fileExists("asset.unused")).toBe(false);
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

  it("should protect assets referenced in nested assembly directories", async () => {
    await createTestManifest({
      "assembly-MyStage": {
        type: "cdk:cloud-assembly",
        properties: {
          directoryName: "assembly-MyStage",
          displayName: "MyStage",
        },
      },
    });

    // Create nested assembly directory structure
    await createTestFile("assembly-MyStage/cdk.out", "");
    await createTestFile("assembly-MyStage/manifest.json", "{}");
    await createTestFile("assembly-MyStage/MyStageCdkSampleStackC627666C.template.json", "{}");

    // Create assets.json in nested assembly that references top-level asset with relative path
    const nestedAssetsJson = {
      version: "1.0.0",
      files: {
        asset1: {
          source: {
            path: "../asset.1b74676f43a7db3c2b7b40ca7b8ae1cffa9314da05f888ba85f0e5bdbba35098",
            packaging: "zip",
          },
          destinations: {},
        },
      },
    };
    await createTestFile(
      "assembly-MyStage/MyStageCdkSampleStackC627666C.assets.json",
      JSON.stringify(nestedAssetsJson, null, 2),
    );

    // Create assets at top level
    await createTestFile(
      "asset.1b74676f43a7db3c2b7b40ca7b8ae1cffa9314da05f888ba85f0e5bdbba35098/index.js",
      "console.log('stage asset')",
    );
    await createTestFile("asset.unused/old.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    // Asset referenced in nested assembly should be protected
    expect(await fileExists("assembly-MyStage/cdk.out")).toBe(true);
    expect(await fileExists("assembly-MyStage/manifest.json")).toBe(true);
    expect(await fileExists("assembly-MyStage/MyStageCdkSampleStackC627666C.template.json")).toBe(
      true,
    );
    expect(await fileExists("assembly-MyStage/MyStageCdkSampleStackC627666C.assets.json")).toBe(
      true,
    );
    expect(
      await fileExists(
        "asset.1b74676f43a7db3c2b7b40ca7b8ae1cffa9314da05f888ba85f0e5bdbba35098/index.js",
      ),
    ).toBe(true);

    // Unreferenced asset should be deleted
    expect(await fileExists("asset.unused")).toBe(false);
  });
});

describe("cleanupTempDirectories", () => {
  const TEST_TMPDIR = path.join(process.cwd(), "test-tmpdir");

  beforeEach(async () => {
    await fs.mkdir(TEST_TMPDIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_TMPDIR, { recursive: true, force: true });
  });

  async function createTempCdkDir(
    name: string,
    withManifest: boolean,
    withAssets: boolean = false,
  ) {
    const dirPath = path.join(TEST_TMPDIR, name);
    await fs.mkdir(dirPath, { recursive: true });

    if (withManifest) {
      await fs.writeFile(
        path.join(dirPath, "manifest.json"),
        JSON.stringify({ version: "1.0.0" }, null, 2),
      );
    }

    if (withAssets) {
      const assetsJson = {
        version: "1.0.0",
        files: {
          testAsset: {
            source: {
              path: "asset.abc123",
              packaging: "zip",
            },
            destinations: {},
          },
        },
      };
      await fs.writeFile(
        path.join(dirPath, "Stack.assets.json"),
        JSON.stringify(assetsJson, null, 2),
      );
      await fs.mkdir(path.join(dirPath, "asset.abc123"), { recursive: true });
      await fs.writeFile(path.join(dirPath, "asset.abc123", "file.txt"), "test content");
    }

    return dirPath;
  }

  async function dirExists(name: string): Promise<boolean> {
    try {
      await fs.access(path.join(TEST_TMPDIR, name));
      return true;
    } catch {
      return false;
    }
  }

  it("should delete all temporary CDK directories regardless of manifest.json", async () => {
    // Mock os.tmpdir() to use our test directory
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk.out123", true, true);
      await createTempCdkDir("cdk-456", false, false);

      await cleanupTempDirectories({ dryRun: false, keepHours: 0 });

      // All directories should be deleted entirely
      expect(await dirExists("cdk.out123")).toBe(false);
      expect(await dirExists("cdk-456")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should delete incomplete CDK directories without manifest.json", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk.out-empty", false, false);
      await createTempCdkDir("cdk-partial", false, false);
      await fs.writeFile(path.join(TEST_TMPDIR, "cdk-partial", "random.txt"), "leftover");

      await cleanupTempDirectories({ dryRun: false, keepHours: 0 });

      expect(await dirExists("cdk.out-empty")).toBe(false);
      expect(await dirExists("cdk-partial")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should protect recent directories when keepHours is set", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk-recent", false, false);
      const oldDir = await createTempCdkDir("cdk-old", false, false);

      // Set old directory to 5 hours ago
      const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
      await fs.utimes(oldDir, new Date(fiveHoursAgo), new Date(fiveHoursAgo));

      await cleanupTempDirectories({ dryRun: false, keepHours: 3 });

      // Recent directory should be protected
      expect(await dirExists("cdk-recent")).toBe(true);
      // Old directory should be deleted
      expect(await dirExists("cdk-old")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should handle dry-run mode without deleting", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk.out-dryrun", false, false);

      await cleanupTempDirectories({ dryRun: true, keepHours: 0 });

      // Directory should still exist in dry-run mode
      expect(await dirExists("cdk.out-dryrun")).toBe(true);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should only process directories starting with cdk.out, cdk-, or .cdk", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk.out123", false, false);
      await createTempCdkDir("cdk-456", false, false);
      await createTempCdkDir(".cdkABC", false, false);
      await fs.mkdir(path.join(TEST_TMPDIR, "other-temp-dir"), { recursive: true });

      await cleanupTempDirectories({ dryRun: false, keepHours: 0 });

      expect(await dirExists("cdk.out123")).toBe(false);
      expect(await dirExists("cdk-456")).toBe(false);
      expect(await dirExists(".cdkABC")).toBe(false);
      expect(await dirExists("other-temp-dir")).toBe(true);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });
});
