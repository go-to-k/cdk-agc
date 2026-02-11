import { describe, it, expect } from "vitest";
import { formatSize } from "./utils.js";

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
