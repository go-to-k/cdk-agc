import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
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

  it("should correctly filter protected and unprotected directories", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk-recent");
      const oldDir = await createTempCdkDir("cdk-old");

      // Set old directory to 10 hours ago
      const tenHoursAgo = Date.now() - 10 * 60 * 60 * 1000;
      await fs.utimes(oldDir, new Date(tenHoursAgo), new Date(tenHoursAgo));

      await cleanupTempDirectories({ dryRun: false, keepHours: 5 });

      // Recent directory should be protected by keepHours
      expect(await dirExists("cdk-recent")).toBe(true);
      // Old directory should be deleted
      expect(await dirExists("cdk-old")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should handle multiple directories with different ages", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk-very-recent");
      const recentDir = await createTempCdkDir("cdk-recent");
      const oldDir = await createTempCdkDir("cdk-old");

      // Set different ages
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

      await fs.utimes(recentDir, new Date(twoHoursAgo), new Date(twoHoursAgo));
      await fs.utimes(oldDir, new Date(sixHoursAgo), new Date(sixHoursAgo));

      await cleanupTempDirectories({ dryRun: false, keepHours: 4 });

      // Very recent and recent directories should be protected
      expect(await dirExists("cdk-very-recent")).toBe(true);
      expect(await dirExists("cdk-recent")).toBe(true);
      // Old directory should be deleted
      expect(await dirExists("cdk-old")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should correctly map filtered results to deletion candidates", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk-dir1");
      await createTempCdkDir("cdk-dir2");
      await createTempCdkDir("cdk-dir3");
      const protectedDir = await createTempCdkDir("cdk-protected");

      // Set protected directory to be recent
      const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000;
      await fs.utimes(protectedDir, new Date(oneHourAgo), new Date(oneHourAgo));

      // Set other directories to be old
      const tenHoursAgo = Date.now() - 10 * 60 * 60 * 1000;
      for (const name of ["cdk-dir1", "cdk-dir2", "cdk-dir3"]) {
        const dirPath = path.join(TEST_TMPDIR, name);
        await fs.utimes(dirPath, new Date(tenHoursAgo), new Date(tenHoursAgo));
      }

      await cleanupTempDirectories({ dryRun: false, keepHours: 2 });

      // Protected directory should exist
      expect(await dirExists("cdk-protected")).toBe(true);
      // Other directories should be deleted
      expect(await dirExists("cdk-dir1")).toBe(false);
      expect(await dirExists("cdk-dir2")).toBe(false);
      expect(await dirExists("cdk-dir3")).toBe(false);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should handle empty directory list correctly", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      // No CDK directories created
      await fs.mkdir(path.join(TEST_TMPDIR, "other-dir"), { recursive: true });

      // Should not throw and complete successfully
      await cleanupTempDirectories({ dryRun: false, keepHours: 0 });

      expect(await dirExists("other-dir")).toBe(true);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });

  it("should handle all directories being protected", async () => {
    const originalTmpdir = os.tmpdir;
    os.tmpdir = () => TEST_TMPDIR;

    try {
      await createTempCdkDir("cdk-dir1");
      await createTempCdkDir("cdk-dir2");
      await createTempCdkDir("cdk-dir3");

      // All directories are recent (protected by keepHours)
      await cleanupTempDirectories({ dryRun: false, keepHours: 24 });

      // All directories should still exist
      expect(await dirExists("cdk-dir1")).toBe(true);
      expect(await dirExists("cdk-dir2")).toBe(true);
      expect(await dirExists("cdk-dir3")).toBe(true);
    } finally {
      os.tmpdir = originalTmpdir;
    }
  });
});
