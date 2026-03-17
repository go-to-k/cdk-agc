# Test CDK Project for cdk-agc

TypeScript CDK project with real Lambda assets to test `cdk-agc` functionality.

## Quick Start

```bash
# Install dependencies from the workspace root
cd ..
vp install

# Run all integration tests in one command
vp run test:integ
```

## Test Commands

Run from the **root directory**:

```bash
# Run all integration tests (recommended)
vp run test:integ

# Run individual tests
vp run test:integ:basic      # Test 1: Basic cleanup with Lambda assets
vp run test:integ:multiple   # Test 2: Multiple synths (old assets cleanup)
vp run test:integ:keep-hours # Test 3: Keep-hours option
```

## Manual Testing

```bash
# Generate cdk.out with Lambda assets
vp exec --filter test-cdk -- cdk synth

# View cdk.out structure (will have asset-* directories)
ls -la cdk.out/

# Build the CLI first (from parent directory)
cd .. && vp pack && cd test-cdk

# Dry-run cleanup
node ../dist/cli.mjs -d

# Actual cleanup
node ../dist/cli.mjs

# Verify CDK still works
vp exec --filter test-cdk -- cdk synth
```

## What Gets Generated

- **manifest.json** - Protected (CDK metadata)
- **tree.json** - Protected (CDK metadata)
- **TestStack.template.json** - Protected (CloudFormation template)
- **TestStack.assets.json** - Protected (Asset manifest)
- **asset.xxx/** - Protected if referenced in current manifest
- **Old asset.xxx/** - Deleted if not in current manifest

## Test Details

### Test 1: Basic Cleanup

- Generates CDK assets
- Adds dummy unused files
- Verifies cdk-agc removes only unused files
- Confirms CDK still works after cleanup

### Test 2: Multiple Synths

- Simulates multiple `cdk synth` runs
- Tests cleanup of old assets
- Verifies only current assets are kept

### Test 3: Keep Hours Option

- Tests `--keep-hours` protection
- Verifies recent files are protected
- Confirms cleanup works without protection
