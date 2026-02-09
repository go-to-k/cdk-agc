#!/usr/bin/env node
import { Command } from "commander";
import { cleanupAssets } from "./cleanup.js";

const program = new Command();

program
  .name("cdk-agc")
  .description("CDK Assembly Garbage Collector - Clean up unused assets in cdk.out")
  .version("0.1.0")
  .option("-o, --outdir <path>", "CDK output directory", "cdk.out")
  .option("-d, --dry-run", "Show what would be deleted without actually deleting", false)
  .option("-k, --keep-hours <number>", "Protect files modified within this many hours", "0")
  .action(async (options) => {
    try {
      const keepHours = parseInt(options.keepHours, 10);
      if (isNaN(keepHours) || keepHours < 0) {
        console.error("Error: --keep-hours must be a non-negative number");
        process.exit(1);
      }

      await cleanupAssets({
        outdir: options.outdir,
        dryRun: options.dryRun,
        keepHours,
      });
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
