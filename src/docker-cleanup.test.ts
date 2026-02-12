import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteDockerImage, extractDockerImageHash } from "./docker-cleanup.js";
import { execSync } from "child_process";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

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

  it("should return null for non-Docker asset paths", () => {
    expect(extractDockerImageHash("asset.abc123")).toBe(null);
    expect(extractDockerImageHash("asset.short-hash")).toBe(null);
    expect(extractDockerImageHash("not-an-asset")).toBe(null);
  });

  it("should extract hash even from file asset paths with extensions", () => {
    // Note: The regex extracts 64-char hash regardless of extensions
    // The caller needs to determine if it's a Docker asset or not
    const hash = extractDockerImageHash(
      "asset.eb93b3552fe4b3afa7eb14804860c17203e945e505594402ffb078c988d41520.zip",
    );
    expect(hash).toBe("eb93b3552fe4b3afa7eb14804860c17203e945e505594402ffb078c988d41520");
  });
});

describe("deleteDockerImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock behavior to prevent actual Docker commands
    mockedExecSync.mockImplementation(() => {
      throw new Error("Unmocked execSync call");
    });
  });

  it("should delete Docker image by local format tag", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Mock: search all images
    const allImagesOutput = `cdkasset-${hash}:latest\t${imageId}\n123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi for local tag
    mockedExecSync.mockReturnValueOnce("" as any);
    // Mock: docker rmi for ECR tag
    mockedExecSync.mockReturnValueOnce("" as any);

    const result = await deleteDockerImage(hash, false);

    expect(result).toBe(true);
  });

  it("should delete Docker image by ECR format tag when local format not found", async () => {
    const hash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId = "9cd584f88ee2";

    // Mock: search all images and find ECR format (no local format)
    const allImagesOutput = `
123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}
cdkasset-other:latest\tabcd1234
    `.trim();
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    // Mock: docker rmi for ECR tag succeeds
    mockedExecSync.mockReturnValueOnce("" as any);

    const result = await deleteDockerImage(hash, false);

    expect(result).toBe(true);
  });

  it("should return false when image does not exist", async () => {
    const hash = "nonexistent0000000000000000000000000000000000000000000000000000000";

    // Mock: local format tag not found
    mockedExecSync.mockReturnValueOnce("" as any);

    // Mock: no matching images in all images
    const allImagesOutput = `
cdkasset-other:latest\tabcd1234
    `.trim();
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    const result = await deleteDockerImage(hash, false);

    expect(result).toBe(false);
    expect(mockedExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining("docker rmi"),
      expect.anything(),
    );
  });

  it("should not delete in dry-run mode", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";
    const imageId = "cd626b785a64";

    // Reset and setup fresh mock
    mockedExecSync.mockReset();
    const localTag = `cdkasset-${hash}:latest`;
    const allImagesOutput = `${localTag}\t${imageId}`;
    mockedExecSync.mockReturnValue(allImagesOutput as any);

    const result = await deleteDockerImage(hash, true);

    expect(result).toBe(true);
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

    const result = await deleteDockerImage(hash, false);

    expect(result).toBe(true); // Function still succeeds even if docker rmi fails
  });

  it("should handle execSync errors when searching for images", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";

    // Mock: all images search throws error
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error("Docker not running");
    });

    const result = await deleteDockerImage(hash, false);

    expect(result).toBe(false); // Should return false when docker images fails
  });

  it("should only match ECR tags with container-assets", async () => {
    const hash = "f575bdffb1fb794e3010c609b768095d4f1d64e2dca5ce27938971210488a04d";

    // Mock: local format tag not found
    mockedExecSync.mockReturnValueOnce("" as any);

    // Mock: search all images - has matching hash but not container-assets
    const allImagesOutput = `
my-custom-repo:${hash}\tabcd1234
other-repo/image:latest\tef567890
    `.trim();
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);

    const result = await deleteDockerImage(hash, false);

    // Should not match non-container-assets repos
    expect(result).toBe(false);
  });

  it("should match ECR format with full AWS URI", async () => {
    const hash = "9ae778431447a6965dbd163b99646b5275c91c065727748fa16e8ccc29e9dd42";
    const imageId = "9cd584f88ee2";

    // Reset and setup fresh mock
    mockedExecSync.mockReset();
    const allImagesOutput = `123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:${hash}\t${imageId}`;
    mockedExecSync.mockReturnValueOnce(allImagesOutput as any);
    mockedExecSync.mockReturnValueOnce("" as any);

    const result = await deleteDockerImage(hash, false);

    expect(result).toBe(true);
  });
});
