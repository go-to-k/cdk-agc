import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  collectDockerImageAssetPaths,
  deleteDockerImages,
  extractDockerImageHash,
} from "./docker-cleanup.js";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe("collectDockerImageAssetPaths", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "docker-cleanup-test-"));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should identify directories with Dockerfile as Docker image assets", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const assetDir = path.join(testDir, `asset.${hash}`);
    await fs.mkdir(assetDir);
    await fs.writeFile(path.join(assetDir, "Dockerfile"), "FROM node:24");

    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(1);
    expect(result.has(assetDir)).toBe(true);
  });

  it("should not identify directories without Dockerfile as Docker image assets", async () => {
    const assetDir = path.join(testDir, "asset.abc123");
    await fs.mkdir(assetDir);
    await fs.writeFile(path.join(assetDir, "some-file.txt"), "content");

    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(0);
  });

  it("should not identify files as Docker image assets", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    await fs.writeFile(path.join(testDir, `asset.${hash}.zip`), "content");

    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(0);
  });

  it("should handle multiple Docker image assets", async () => {
    const hash1 = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const hash2 = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";

    const assetDir1 = path.join(testDir, `asset.${hash1}`);
    const assetDir2 = path.join(testDir, `asset.${hash2}`);

    await fs.mkdir(assetDir1);
    await fs.mkdir(assetDir2);
    await fs.writeFile(path.join(assetDir1, "Dockerfile"), "FROM node:24");
    await fs.writeFile(path.join(assetDir2, "Dockerfile"), "FROM node:20");

    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(2);
    expect(result.has(assetDir1)).toBe(true);
    expect(result.has(assetDir2)).toBe(true);
  });

  it("should only process entries starting with 'asset.'", async () => {
    const dockerDir = path.join(testDir, "not-an-asset");
    await fs.mkdir(dockerDir);
    await fs.writeFile(path.join(dockerDir, "Dockerfile"), "FROM node:24");

    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(0);
  });

  it("should handle empty directory", async () => {
    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(0);
  });

  it("should handle mixed assets (Docker and file assets)", async () => {
    const dockerHash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const fileHash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";

    const dockerAssetDir = path.join(testDir, `asset.${dockerHash}`);
    const fileAssetDir = path.join(testDir, `asset.${fileHash}`);

    await fs.mkdir(dockerAssetDir);
    await fs.mkdir(fileAssetDir);
    await fs.writeFile(path.join(dockerAssetDir, "Dockerfile"), "FROM node:24");
    await fs.writeFile(path.join(fileAssetDir, "index.js"), "console.log('hello')");

    const entries = await fs.readdir(testDir);
    const assetEntries = entries.filter((entry) => entry.startsWith("asset."));
    const result = await collectDockerImageAssetPaths(assetEntries, testDir);

    expect(result.size).toBe(1);
    expect(result.has(dockerAssetDir)).toBe(true);
    expect(result.has(fileAssetDir)).toBe(false);
  });
});

describe("extractDockerImageHash", () => {
  it("should extract hash from Docker asset path", () => {
    const hash = extractDockerImageHash(
      "asset.f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d",
    );
    expect(hash).toBe("f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d");
  });

  it("should extract hash from Docker asset path with directory", () => {
    const hash = extractDockerImageHash(
      "/path/to/cdk.out/asset.9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42",
    );
    expect(hash).toBe("9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42");
  });

  it("should return null for non-asset paths", () => {
    expect(extractDockerImageHash("not-an-asset")).toBe(null);
  });
});

describe("deleteDockerImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock behavior to prevent actual Docker commands
    mockedExecSync.mockImplementation(() => {
      throw new Error("Unmocked execSync call");
    });
  });

  it("should delete Docker images by local and ECR format tags", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images
    const allImagesOutput = `cdkasset-${hash}:latest\t${imageId}\n123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi for local tag
    mockedExecSync.mockReturnValueOnce("" as any);
    // Mock: docker rmi for ECR tag
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(3); // 1 search + 2 deletes
  });

  it("should delete Docker image by ECR format tag only", async () => {
    const hash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId = "9cd584f88ee2";

    // Mock: search all images and find ECR format (no local format)
    const allImagesOutput = `123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}\ncdkasset-other:latest\tabcd1234`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi for ECR tag succeeds
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(2); // 1 search + 1 delete
  });

  it("should not delete when image does not exist", async () => {
    const hash = "nonexistent0000000000000000000000000000000000000000000000000000000";

    // Mock: no matching images in all images
    const allImagesOutput = `cdkasset-other:latest\tabcd1234`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(1); // Only search, no delete
  });

  it("should not delete in dry-run mode", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images
    const localTag = `cdkasset-${hash}:latest`;
    const allImagesOutput = `${localTag}\t${imageId}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    await deleteDockerImages([hash], true);

    expect(mockedExecSync).toHaveBeenCalledTimes(1); // Only search, no delete
    expect(mockedExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining("docker rmi"),
      expect.anything(),
    );
  });

  it("should handle docker rmi errors gracefully", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images
    const allImagesOutput = `cdkasset-${hash}:latest\t${imageId}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi fails (e.g., image in use)
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error("Error response from daemon: conflict: unable to delete");
    });

    // Should not throw - errors are caught and logged
    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(2); // search + 1 delete attempt
  });

  it("should handle execSync errors when searching for images", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";

    // Mock: all images search throws error
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error("Docker not running");
    });

    // Should not throw - errors are caught silently
    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(1); // Only search attempt
  });

  it("should not match non-CDK images", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";

    // Mock: search all images - has matching hash but not CDK-related (no cdkasset- or container-assets)
    const allImagesOutput = `my-custom-repo:${hash}\tabcd1234\nother-repo/image:latest\tef567890`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    await deleteDockerImages([hash], false);

    // Should not match non-CDK repos - only 1 search, no delete
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it("should match ECR format with full AWS URI", async () => {
    const hash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId = "9cd584f88ee2";

    // Mock: search all images and find ECR URI with full format
    const allImagesOutput = `123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi succeeds
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(2); // 1 search + 1 delete
  });

  it("should handle empty array", async () => {
    await deleteDockerImages([], false);

    // Should not call execSync at all
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it("should handle multiple hashes efficiently", async () => {
    const hash1 = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const hash2 = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId1 = "cd626b785a64";
    const imageId2 = "9cd584f88ee2";

    // Mock: search all images once for both hashes
    const allImagesOutput = `cdkasset-${hash1}:latest\t${imageId1}\ncdkasset-${hash2}:latest\t${imageId2}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi for both images
    mockedExecSync.mockReturnValueOnce("" as any);
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash1, hash2], false);

    // Should only search once, then delete both - total 3 calls
    expect(mockedExecSync).toHaveBeenCalledTimes(3);
  });
});
