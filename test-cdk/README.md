# Test CDK Project for cdk-agc

TypeScript CDK project with real Lambda assets to test `cdk-agc` functionality.

## Quick Start

```bash
# Install dependencies
cd test-cdk
pnpm install

# Run all tests in one command
pnpm test
```

## Test Commands

```bash
# Run all tests (recommended)
pnpm test              # or pnpm run test:all

# Run individual tests
pnpm run test:basic      # Test 1: Basic cleanup with Lambda assets
pnpm run test:multiple   # Test 2: Multiple synths (old assets cleanup)
pnpm run test:keep-hours # Test 3: Keep-hours option
```

## Manual Testing

```bash
# Generate cdk.out with Lambda assets
pnpm synth

# View cdk.out structure (will have asset-* directories)
ls -la cdk.out/

# Dry-run cleanup
node ../src/cli.ts -d

# Actual cleanup
node ../src/cli.ts

# Verify CDK still works
pnpm synth
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

## Technology Stack

- **TypeScript** - Type-safe CDK code
- **pnpm** - Fast package manager
- **Node.js** - Direct TypeScript execution with `--enable-source-maps`
- **Apache-2.0** - License (matches main project)
