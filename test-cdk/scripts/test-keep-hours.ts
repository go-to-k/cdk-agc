#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDK_OUT = path.join(__dirname, '../cdk.out');
const CLI = path.join(__dirname, '../../dist/cli.js');

console.log('\n=== Test 3: Keep Hours Option ===\n');

// Clean up previous test
try {
  execSync('rm -rf cdk.out', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
} catch {}

// Step 1: CDK Synth
console.log('1. Running CDK synth...');
execSync('pnpm synth', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// Step 2: Add recent file
console.log('\n2. Adding recent file...');
fs.writeFileSync(path.join(CDK_OUT, 'recent-file.txt'), 'This is a recent file');
console.log('   ✓ Added recent-file.txt');

// Step 3: Cleanup with --keep-hours 1
console.log('\n3. Running cleanup with --keep-hours 1...');
execSync(`node ${CLI} -o ${CDK_OUT} -k 1`, { stdio: 'inherit' });

// Step 4: Verify recent file still exists
console.log('\n4. Verifying recent file is protected...');
const hasRecentFile = fs.existsSync(path.join(CDK_OUT, 'recent-file.txt'));

if (hasRecentFile) {
  console.log('   ✓ Recent file protected by --keep-hours option');
} else {
  console.error('   ✗ Recent file was deleted (should be protected)');
  process.exit(1);
}

// Step 5: Cleanup without protection
console.log('\n5. Running cleanup without --keep-hours...');
execSync(`node ${CLI} -o ${CDK_OUT}`, { stdio: 'inherit' });

// Step 6: Verify recent file is now deleted
console.log('\n6. Verifying recent file is now deleted...');
const stillHasRecentFile = fs.existsSync(path.join(CDK_OUT, 'recent-file.txt'));

if (!stillHasRecentFile) {
  console.log('   ✓ Recent file deleted without protection\n');
} else {
  console.error('   ✗ Recent file still exists (should be deleted)');
  process.exit(1);
}
