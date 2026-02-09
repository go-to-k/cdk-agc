#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDK_OUT = path.join(__dirname, '../cdk.out');
const CLI = path.join(__dirname, '../../dist/cli.mjs');

console.log('\n=== Test 3: Keep Hours Option ===\n');

// Clean up previous test
try {
  execSync('rm -rf cdk.out', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
} catch {}

// Step 1: CDK Synth
console.log('1. Running CDK synth...');
execSync('pnpm synth', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// Step 2: Add recent asset (simulating recently created but unused asset)
console.log('\n2. Adding recent asset...');
fs.mkdirSync(path.join(CDK_OUT, 'asset.recent123'), { recursive: true });
fs.writeFileSync(path.join(CDK_OUT, 'asset.recent123/index.js'), 'This is a recent asset');
console.log('   ✓ Added asset.recent123/');

// Step 3: Cleanup with --keep-hours 1
console.log('\n3. Running cleanup with --keep-hours 1...');
execSync(`node ${CLI} -o ${CDK_OUT} -k 1`, { stdio: 'inherit' });

// Step 4: Verify recent asset still exists
console.log('\n4. Verifying recent asset is protected...');
const hasRecentAsset = fs.existsSync(path.join(CDK_OUT, 'asset.recent123'));

if (hasRecentAsset) {
  console.log('   ✓ Recent asset protected by --keep-hours option');
} else {
  console.error('   ✗ Recent asset was deleted (should be protected)');
  process.exit(1);
}

// Step 5: Cleanup without protection
console.log('\n5. Running cleanup without --keep-hours...');
execSync(`node ${CLI} -o ${CDK_OUT}`, { stdio: 'inherit' });

// Step 6: Verify recent asset is now deleted
console.log('\n6. Verifying recent asset is now deleted...');
const stillHasRecentAsset = fs.existsSync(path.join(CDK_OUT, 'asset.recent123'));

if (!stillHasRecentAsset) {
  console.log('   ✓ Recent asset deleted without protection\n');
} else {
  console.error('   ✗ Recent asset still exists (should be deleted)');
  process.exit(1);
}
