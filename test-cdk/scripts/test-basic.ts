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
console.log('\n2. Adding dummy asset and user files...');
fs.mkdirSync(path.join(CDK_OUT, 'asset.unused'), { recursive: true });
fs.writeFileSync(path.join(CDK_OUT, 'asset.unused/test.txt'), 'This should be deleted');
fs.writeFileSync(path.join(CDK_OUT, 'user-file.txt'), 'This should NOT be deleted');
console.log('   ✓ Added asset.unused/ and user-file.txt');

// Step 3: Dry run
console.log('\n3. Running cdk-agc in dry-run mode...');
execSync(`node ${CLI} -o ${CDK_OUT} -d`, { stdio: 'inherit' });

// Step 4: Actual cleanup
console.log('\n4. Running actual cleanup...');
execSync(`node ${CLI} -o ${CDK_OUT}`, { stdio: 'inherit' });

// Step 5: Verify
console.log('\n5. Verifying cleanup...');
const hasUnusedAsset = fs.existsSync(path.join(CDK_OUT, 'asset.unused'));
const hasUserFile = fs.existsSync(path.join(CDK_OUT, 'user-file.txt'));
const hasManifest = fs.existsSync(path.join(CDK_OUT, 'manifest.json'));
const hasTemplate = fs.existsSync(path.join(CDK_OUT, 'TestStack.template.json'));

// Verify asset files and directories are protected
const assetsJsonFiles = fs.readdirSync(CDK_OUT).filter(f => f.endsWith('.assets.json'));
let allAssetsProtected = true;
let protectedAssetCount = 0;

for (const assetsFile of assetsJsonFiles) {
  const stackName = assetsFile.replace('.assets.json', '');
  const assetsContent = JSON.parse(fs.readFileSync(path.join(CDK_OUT, assetsFile), 'utf-8'));

  // Check file assets
  if (assetsContent.files) {
    for (const fileEntry of Object.values(assetsContent.files)) {
      const entry = fileEntry as { source?: { path?: string } };
      if (entry.source?.path) {
        const assetPath = path.join(CDK_OUT, entry.source.path);
        if (!fs.existsSync(assetPath)) {
          console.error(`   ✗ Asset ${entry.source.path} (used in ${stackName}) was deleted`);
          allAssetsProtected = false;
        } else {
          protectedAssetCount++;
        }
      }
    }
  }

  // Check docker image assets
  if (assetsContent.dockerImages) {
    for (const imageEntry of Object.values(assetsContent.dockerImages)) {
      const entry = imageEntry as { source?: { directory?: string } };
      if (entry.source?.directory) {
        const assetPath = path.join(CDK_OUT, entry.source.directory);
        if (!fs.existsSync(assetPath)) {
          console.error(`   ✗ Docker asset ${entry.source.directory} (used in ${stackName}) was deleted`);
          allAssetsProtected = false;
        } else {
          protectedAssetCount++;
        }
      }
    }
  }
}

if (protectedAssetCount > 0) {
  console.log(`   ✓ ${protectedAssetCount} asset(s) protected`);
}

if (!hasUnusedAsset && hasUserFile && hasManifest && hasTemplate && allAssetsProtected) {
  console.log('   ✓ Cleanup successful!');
  console.log('   ✓ Protected files still exist');
  console.log('   ✓ Unused asset removed');
  console.log('   ✓ User file preserved');
} else {
  console.error('   ✗ Verification failed!');
  if (hasUnusedAsset) console.error('   ✗ Unused asset was not deleted');
  if (!hasUserFile) console.error('   ✗ User file was deleted (should be preserved)');
  process.exit(1);
}

// Step 6: Re-synth to verify CDK still works
console.log('\n6. Re-running CDK synth to verify...');
execSync('pnpm synth > /dev/null 2>&1', { cwd: path.join(__dirname, '..') });
console.log('   ✓ CDK synth still works after cleanup\n');
