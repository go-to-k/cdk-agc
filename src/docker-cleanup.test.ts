import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  collectDockerImageAssetPaths,
  deleteDockerImages,
  extractDockerImageHash,
  parseDockerSize,
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

    // Mock: search all images with size
    const allImagesOutput = `cdkasset-${hash}:latest\t${imageId}\t269.4MB\n123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}\t269.4MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker image rm for local tag
    mockedExecSync.mockReturnValueOnce("" as any);
    // Mock: docker image rm for ECR tag
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(3); // 1 search + 2 deletes
  });

  it("should delete Docker image by ECR format tag only", async () => {
    const hash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId = "9cd584f88ee2";

    // Mock: search all images and find ECR format (no local format)
    const allImagesOutput = `123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}\t100MB\ncdkasset-other:latest\tabcd1234\t50MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker image rm for ECR tag succeeds
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(2); // 1 search + 1 delete
  });

  it("should not delete when image does not exist", async () => {
    const hash = "nonexistent0000000000000000000000000000000000000000000000000000000";

    // Mock: no matching images in all images
    const allImagesOutput = `cdkasset-other:latest\tabcd1234\t50MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    await deleteDockerImages([hash], false);

    expect(mockedExecSync).toHaveBeenCalledTimes(1); // Only search, no delete
  });

  it("should not delete in dry-run mode", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images
    const localTag = `cdkasset-${hash}:latest`;
    const allImagesOutput = `${localTag}\t${imageId}\t100MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    await deleteDockerImages([hash], true);

    expect(mockedExecSync).toHaveBeenCalledTimes(1); // Only search, no delete
    expect(mockedExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining("docker image rm"),
      expect.anything(),
    );
  });

  it("should handle docker image rm errors gracefully", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images
    const allImagesOutput = `cdkasset-${hash}:latest\t${imageId}\t100MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker image rm fails (e.g., image in use)
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
    const allImagesOutput = `my-custom-repo:${hash}\tabcd1234\t100MB\nother-repo/image:latest\tef567890\t50MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    await deleteDockerImages([hash], false);

    // Should not match non-CDK repos - only 1 search, no delete
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it("should match ECR format with full AWS URI", async () => {
    const hash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId = "9cd584f88ee2";

    // Mock: search all images and find ECR URI with full format
    const allImagesOutput = `123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}\t150MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker image rm succeeds
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
    const allImagesOutput = `cdkasset-${hash1}:latest\t${imageId1}\t100MB\ncdkasset-${hash2}:latest\t${imageId2}\t200MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker image rm for both images
    mockedExecSync.mockReturnValueOnce("" as any);
    mockedExecSync.mockReturnValueOnce("" as any);

    await deleteDockerImages([hash1, hash2], false);

    // Should only search once, then delete both - total 3 calls
    expect(mockedExecSync).toHaveBeenCalledTimes(3);
  });

  it("should return total size of deleted Docker images", async () => {
    const hash1 = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const hash2 = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId1 = "cd626b785a64";
    const imageId2 = "9cd584f88ee2";

    // Mock: search all images - 100MB + 200MB = 300MB total
    const allImagesOutput = `cdkasset-${hash1}:latest\t${imageId1}\t100MB\ncdkasset-${hash2}:latest\t${imageId2}\t200MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker image rm for both images
    mockedExecSync.mockReturnValueOnce("" as any);
    mockedExecSync.mockReturnValueOnce("" as any);

    const totalSize = await deleteDockerImages([hash1, hash2], false);

    // Should return 100MB + 200MB = 300MB in bytes
    expect(totalSize).toBe(100 * 1024 * 1024 + 200 * 1024 * 1024);
  });

  it("should return 0 when no images are found", async () => {
    const hash = "nonexistent0000000000000000000000000000000000000000000000000000000";

    // Mock: no matching images
    const allImagesOutput = `other-image:latest\tabcd1234\t50MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    const totalSize = await deleteDockerImages([hash], false);

    expect(totalSize).toBe(0);
  });

  it("should return 0 when empty array is provided", async () => {
    const totalSize = await deleteDockerImages([], false);

    expect(totalSize).toBe(0);
  });

  it("should return 0 when Docker daemon is not running", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";

    // Mock: Docker command fails
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error("Docker not running");
    });

    const totalSize = await deleteDockerImages([hash], false);

    expect(totalSize).toBe(0);
  });

  it("should return correct size in dry-run mode", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images - 269.4MB
    const allImagesOutput = `cdkasset-${hash}:latest\t${imageId}\t269.4MB`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    const totalSize = await deleteDockerImages([hash], true);

    // Should return size even in dry-run mode
    expect(totalSize).toBe(Math.round(269.4 * 1024 * 1024));
  });
});

describe("parseDockerSize", () => {
  it("should parse bytes", () => {
    expect(parseDockerSize("512B")).toBe(512);
    expect(parseDockerSize("1B")).toBe(1);
  });

  it("should parse kilobytes", () => {
    expect(parseDockerSize("1KB")).toBe(1024);
    expect(parseDockerSize("1.5KB")).toBe(1536);
    expect(parseDockerSize("10KB")).toBe(10240);
  });

  it("should parse megabytes", () => {
    expect(parseDockerSize("1MB")).toBe(1024 * 1024);
    expect(parseDockerSize("2.5MB")).toBe(Math.round(2.5 * 1024 * 1024));
    expect(parseDockerSize("269.4MB")).toBe(Math.round(269.4 * 1024 * 1024));
  });

  it("should parse gigabytes", () => {
    expect(parseDockerSize("1GB")).toBe(1024 * 1024 * 1024);
    expect(parseDockerSize("1.5GB")).toBe(Math.round(1.5 * 1024 * 1024 * 1024));
  });

  it("should parse terabytes", () => {
    expect(parseDockerSize("1TB")).toBe(1024 * 1024 * 1024 * 1024);
    expect(parseDockerSize("2.5TB")).toBe(Math.round(2.5 * 1024 * 1024 * 1024 * 1024));
  });

  it("should handle lowercase units", () => {
    expect(parseDockerSize("1kb")).toBe(1024);
    expect(parseDockerSize("1mb")).toBe(1024 * 1024);
    expect(parseDockerSize("1gb")).toBe(1024 * 1024 * 1024);
  });

  it("should handle mixed case units", () => {
    expect(parseDockerSize("1Mb")).toBe(1024 * 1024);
    expect(parseDockerSize("1gB")).toBe(1024 * 1024 * 1024);
  });

  it("should handle spaces between number and unit", () => {
    expect(parseDockerSize("1 MB")).toBe(1024 * 1024);
    expect(parseDockerSize("2.5 GB")).toBe(Math.round(2.5 * 1024 * 1024 * 1024));
  });

  it("should return 0 for invalid formats", () => {
    expect(parseDockerSize("invalid")).toBe(0);
    expect(parseDockerSize("")).toBe(0);
    expect(parseDockerSize("MB")).toBe(0);
    expect(parseDockerSize("123")).toBe(0);
    expect(parseDockerSize("123XB")).toBe(0);
  });

  it("should handle decimal values correctly", () => {
    expect(parseDockerSize("0.5MB")).toBe(Math.round(0.5 * 1024 * 1024));
    expect(parseDockerSize("1.25GB")).toBe(Math.round(1.25 * 1024 * 1024 * 1024));
  });
});
