import { describe, it, expect } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const CLI_PATH = path.join(process.cwd(), "dist", "cli.mjs");

describe("CLI", () => {
  it("should show error when --cleanup-tmp and --outdir are used together", async () => {
    try {
      await execAsync(`node ${CLI_PATH} -t -o ./custom-dir`);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stderr).toContain("--cleanup-tmp and --outdir cannot be used together");
    }
  });

  it("should show error when --keep-hours is negative", async () => {
    try {
      await execAsync(`node ${CLI_PATH} -k -5`);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stderr).toContain("--keep-hours must be a non-negative number");
    }
  });

  it("should show error when --keep-hours is not a number", async () => {
    try {
      await execAsync(`node ${CLI_PATH} -k abc`);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stderr).toContain("--keep-hours must be a non-negative number");
    }
  });
});
