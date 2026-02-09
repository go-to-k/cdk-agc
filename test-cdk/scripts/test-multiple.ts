#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDK_OUT = path.join(__dirname, '../cdk.out');
const CLI = path.join(__dirname, '../../dist/cli.mjs');
const APP_TS = path.join(__dirname, '../app.ts');

console.log('\n=== Test 2: Multiple Synths (Old Assets) ===\n');

// Clean up previous test
try {
  execSync('rm -rf cdk.out', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
} catch {}

// Step 1: First synth
console.log('1. First CDK synth...');
execSync('pnpm synth', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// Step 2: Modify stack
console.log('\n2. Modifying stack...');
const appContent = fs.readFileSync(APP_TS, 'utf-8');
const modifiedContent = appContent.replace(
  '// S3 Bucket with large assets',
  '// S3 Bucket with large assets - Modified',
);
fs.writeFileSync(APP_TS, modifiedContent);
console.log('   ✓ Stack modified');

// Step 3: Second synth
console.log('\n3. Second CDK synth...');
execSync('pnpm synth', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// Step 4: Add some old assets manually (simulating old/unused assets)
console.log('\n4. Simulating old assets...');
fs.mkdirSync(path.join(CDK_OUT, 'asset.old123'), { recursive: true });
fs.writeFileSync(path.join(CDK_OUT, 'asset.old123/index.js'), 'old content');
console.log('   ✓ Added asset.old123/');

// Step 5: Cleanup
console.log('\n5. Running cleanup...');
execSync(`node ${CLI} -o ${CDK_OUT}`, { stdio: 'inherit' });

// Step 6: Verify old asset was removed
console.log('\n6. Verifying old asset was removed...');
const hasOldAsset = fs.existsSync(path.join(CDK_OUT, 'asset.old123'));
if (hasOldAsset) {
  console.error('   ✗ Old asset was not deleted');
  process.exit(1);
}
console.log('   ✓ Old asset removed');

// Step 7: Restore original file
console.log('\n7. Restoring original stack...');
fs.writeFileSync(APP_TS, appContent);
console.log('   ✓ Stack restored\n');
