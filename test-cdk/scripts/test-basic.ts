#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDK_OUT = path.join(__dirname, '../cdk.out');
const CLI = path.join(__dirname, '../../dist/cli.mjs');

console.log('\n=== Test 1: Basic Cleanup ===\n');

// Clean up previous test
try {
  execSync('rm -rf cdk.out', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
} catch {}

// Step 1: CDK Synth
console.log('1. Running CDK synth...');
execSync('pnpm synth', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// Step 2: Add dummy files
console.log('\n2. Adding dummy files...');
fs.writeFileSync(path.join(CDK_OUT, 'unused-file.txt'), 'This file should be deleted');
fs.mkdirSync(path.join(CDK_OUT, 'unused-dir'), { recursive: true });
fs.writeFileSync(path.join(CDK_OUT, 'unused-dir/test.txt'), 'test content');
console.log('   ✓ Added unused-file.txt and unused-dir/');

// Step 3: Dry run
console.log('\n3. Running cdk-agc in dry-run mode...');
execSync(`node ${CLI} -o ${CDK_OUT} -d`, { stdio: 'inherit' });

// Step 4: Actual cleanup
console.log('\n4. Running actual cleanup...');
execSync(`node ${CLI} -o ${CDK_OUT}`, { stdio: 'inherit' });

// Step 5: Verify
console.log('\n5. Verifying cleanup...');
const hasUnusedFile = fs.existsSync(path.join(CDK_OUT, 'unused-file.txt'));
const hasUnusedDir = fs.existsSync(path.join(CDK_OUT, 'unused-dir'));
const hasManifest = fs.existsSync(path.join(CDK_OUT, 'manifest.json'));
const hasTemplate = fs.existsSync(path.join(CDK_OUT, 'TestStack.template.json'));

if (!hasUnusedFile && !hasUnusedDir && hasManifest && hasTemplate) {
  console.log('   ✓ Cleanup successful!');
  console.log('   ✓ Protected files still exist');
  console.log('   ✓ Unused files removed');
} else {
  console.error('   ✗ Verification failed!');
  process.exit(1);
}

// Step 6: Re-synth to verify CDK still works
console.log('\n6. Re-running CDK synth to verify...');
execSync('pnpm synth > /dev/null 2>&1', { cwd: path.join(__dirname, '..') });
console.log('   ✓ CDK synth still works after cleanup\n');
