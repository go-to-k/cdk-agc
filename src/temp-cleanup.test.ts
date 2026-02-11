import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { cleanupTempDirectories } from "./temp-cleanup.js";

describe("cleanupTempDirectories", () => {
  const TEST_TMPDIR = path.join(process.cwd(), "test-tmpdir");

  beforeEach(async () => {
    await fs.mkdir(TEST_TMPDIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_TMPDIR, { recursive: true, force: true });
  });

  async function createTempCdkDir(name: string) {
    const dirPath = path.join(TEST_TMPDIR, name);
    await fs.mkdir(dirPath, { recursive: true });
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

  it("should delete all temporary CDK directories", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      // Create various temporary directories
      await createTempCdkDir("cdk.out123");
      await createTempCdkDir("cdk-456");

      await cleanupTempDirectories({ dryRun: false, keepHours: 0 });

      // All directories should be deleted entirely
      expect(await dirExists("cdk.out123")).toBe(false);
      expect(await dirExists("cdk-456")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should protect recent directories when keepHours is set", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk-recent");
      const oldDir = await createTempCdkDir("cdk-old");

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
      await createTempCdkDir("cdk.out-dryrun");

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
      await createTempCdkDir("cdk.out123");
      await createTempCdkDir("cdk-456");
      await createTempCdkDir(".cdkABC");
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
