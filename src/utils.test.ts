import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { formatSize, calculateSize } from "./utils.js";

const TEST_DIR = path.join(process.cwd(), "test-utils");

describe("formatSize", () => {
  it("should format bytes correctly", () => {
    expect(formatSize(0)).toBe("0.00 B");
    expect(formatSize(1)).toBe("1.00 B");
    expect(formatSize(999)).toBe("999.00 B");
    expect(formatSize(1023)).toBe("1023.00 B");
  });

  it("should format kilobytes correctly", () => {
    expect(formatSize(1024)).toBe("1.00 KB");
    expect(formatSize(1536)).toBe("1.50 KB");
    expect(formatSize(10240)).toBe("10.00 KB");
    expect(formatSize(1024 * 1023)).toBe("1023.00 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatSize(1024 * 1024)).toBe("1.00 MB");
    expect(formatSize(1024 * 1024 * 1.5)).toBe("1.50 MB");
    expect(formatSize(1024 * 1024 * 100)).toBe("100.00 MB");
    expect(formatSize(1024 * 1024 * 1023)).toBe("1023.00 MB");
  });

  it("should format gigabytes correctly", () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe("1.00 GB");
    expect(formatSize(1024 * 1024 * 1024 * 2.5)).toBe("2.50 GB");
    expect(formatSize(1024 * 1024 * 1024 * 1000)).toBe("1000.00 GB");
  });

  it("should not exceed GB unit", () => {
    expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe("1024.00 GB");
    expect(formatSize(1024 * 1024 * 1024 * 10000)).toBe("10000.00 GB");
  });

  it("should handle decimal precision", () => {
    expect(formatSize(1234)).toBe("1.21 KB");
    expect(formatSize(1234567)).toBe("1.18 MB");
    expect(formatSize(1234567890)).toBe("1.15 GB");
  });
});

describe("calculateSize", () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should calculate size of a single file", async () => {
    const filePath = path.join(TEST_DIR, "test.txt");
    await fs.writeFile(filePath, "hello world");
    const size = await calculateSize(filePath);
    expect(size).toBe(11);
  });

  it("should calculate size of a directory with files", async () => {
    await fs.mkdir(path.join(TEST_DIR, "subdir"), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, "file1.txt"), "hello");
    await fs.writeFile(path.join(TEST_DIR, "subdir", "file2.txt"), "world");
    const size = await calculateSize(TEST_DIR);
    expect(size).toBe(10);
  });

  it("should return 0 for non-existent path", async () => {
    const size = await calculateSize(path.join(TEST_DIR, "nonexistent"));
    expect(size).toBe(0);
  });

  it("should handle broken symbolic links gracefully", async () => {
    const brokenLink = path.join(TEST_DIR, "broken-link.txt");
    await fs.symlink("/nonexistent/path/file.txt", brokenLink);

    // Verify the symlink is indeed broken
    await expect(fs.access(brokenLink)).rejects.toThrow();

    // Should not throw and return symlink size
    const size = await calculateSize(brokenLink);
    expect(size).toBeGreaterThanOrEqual(0);
  });

  it("should handle directory with broken symbolic links", async () => {
    await fs.writeFile(path.join(TEST_DIR, "normal.txt"), "test");
    await fs.symlink("/nonexistent/path", path.join(TEST_DIR, "broken-link"));

    // Should not throw and calculate size (normal file + broken symlink itself)
    const size = await calculateSize(TEST_DIR);
    expect(size).toBeGreaterThan(0);
  });
});
