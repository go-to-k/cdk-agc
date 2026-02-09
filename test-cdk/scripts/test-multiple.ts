#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDK_OUT = path.join(__dirname, '../cdk.out');
const CLI = path.join(__dirname, '../../dist/cli.js');
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

// Step 4: Add some old assets manually
console.log('\n4. Simulating old assets...');
fs.writeFileSync(path.join(CDK_OUT, 'old-asset.txt'), 'old content');
console.log('   ✓ Added old-asset.txt');

// Step 5: Cleanup
console.log('\n5. Running cleanup...');
execSync(`node ${CLI} -o ${CDK_OUT}`, { stdio: 'inherit' });

// Step 6: Restore original file
console.log('\n6. Restoring original stack...');
fs.writeFileSync(APP_TS, appContent);
console.log('   ✓ Stack restored\n');
