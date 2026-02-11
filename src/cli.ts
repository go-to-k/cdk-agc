#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "module";
import { cleanupAssets } from "./asset-cleanup.js";
import { cleanupTempDirectories } from "./temp-cleanup.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program
  .name("cdk-agc")
  .description("CDK Assembly Garbage Collector - Clean up unused assets in cdk.out")
  .version(pkg.version)
  .option("-o, --outdir <path>", "CDK output directory", "cdk.out")
  .option("-d, --dry-run", "Show what would be deleted without actually deleting", false)
  .option("-k, --keep-hours <number>", "Protect files modified within this many hours", "0")
  .option("-t, --cleanup-tmp", "Clean up all temporary cdk.out directories in $TMPDIR", false)
  .action(async (options) => {
    try {
      const keepHours = parseInt(options.keepHours, 10);
      if (isNaN(keepHours) || keepHours < 0) {
        console.error("Error: --keep-hours must be a non-negative number");
        process.exit(1);
      }

      // Check for conflicting options
      if (options.cleanupTmp && options.outdir !== "cdk.out") {
        console.error("Error: --cleanup-tmp and --outdir cannot be used together");
        process.exit(1);
      }

      if (options.cleanupTmp) {
        await cleanupTempDirectories({
          dryRun: options.dryRun,
          keepHours,
        });
      } else {
        await cleanupAssets({
          outdir: options.outdir,
          dryRun: options.dryRun,
          keepHours,
        });
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
