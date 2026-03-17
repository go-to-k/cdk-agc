#!/usr/bin/env node
import { execSync } from "child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptsDir = __dirname;

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║          cdk-agc Test Suite - All Tests                   ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

const tests = [
  { name: "Basic Cleanup", script: "test-basic.ts" },
  { name: "Multiple Synths", script: "test-multiple.ts" },
  { name: "Keep Hours Option", script: "test-keep-hours.ts" },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`\n🧪 Running: ${test.name}`);
    console.log("─".repeat(60));
    execSync(
      `node --enable-source-maps --experimental-strip-types ${path.join(scriptsDir, test.script)}`,
      {
        stdio: "inherit",
      },
    );
    passed++;
    console.log(`\n✅ ${test.name} - PASSED\n`);
  } catch {
    failed++;
    console.error(`\n❌ ${test.name} - FAILED\n`);
  }
}

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log(`║  Test Results: ${passed} passed, ${failed} failed                        ║`);
console.log("╚════════════════════════════════════════════════════════════╝\n");

if (failed > 0) {
  process.exit(1);
}
