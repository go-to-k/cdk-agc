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
    await createTestFile("Stack.assets.json", "{}");
    await createTestFile("unused.txt", "delete me");

    await cleanupAssets({ outdir: TEST_DIR, dryRun: false, keepHours: 0 });

    expect(await fileExists("manifest.json")).toBe(true);
    expect(await fileExists("tree.json")).toBe(true);
    expect(await fileExists("cdk.context.json")).toBe(true);
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
});
