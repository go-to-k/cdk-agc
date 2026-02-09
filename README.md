# cdk-agc

**CDK Assembly Garbage Collector** - Clean up unused assets in your `cdk.out` directory.

## Overview

`cdk-agc` is a fast CLI tool that scans your AWS CDK cloud assembly directory (default: `cdk.out`) and removes unused assets while protecting:

- Assets referenced in the latest `manifest.json`
- Recently modified files (configurable retention period)
- Essential metadata files (`manifest.json`, `tree.json`, `*.template.json`, etc.)

This helps optimize storage and streamline CI/CD caching.

## Why?

### Problems

- CDK asset directories can grow to multiple GBs over time
- Disk space exhaustion from accumulated build artifacts
- Slow CI/CD pipelines due to large cache sizes
- No official local cleanup tool (AWS CDK's `cdk gc` only handles cloud-side resources)

### Solution

`cdk-agc` provides safe, intelligent cleanup with:

- **Manifest-based protection**: Only removes assets not referenced by the current configuration
- **Time-based protection**: Keeps recent assets for quick rollbacks

## Installation

```bash
# Run directly with npx (no installation needed)
npx cdk-agc

# Or install globally
npm install -g cdk-agc
```

## Usage

### Basic Examples

```bash
# Default: Clean cdk.out, keeping only active manifest assets
npx cdk-agc

# Dry-run: Preview what would be deleted
npx cdk-agc -d

# Custom directory (useful for monorepos)
npx cdk-agc -o ./packages/infra/cdk.out

# Keep assets modified within the last 24 hours
npx cdk-agc -k 24
```

### Options

| Option | Description | Default |
| -------- | ------------- | --------- |
| `-o, --outdir <path>` | CDK output directory to clean | `cdk.out` |
| `-d, --dry-run` | Show what would be deleted without deleting | `false` |
| `-k, --keep-hours <number>` | Protect files modified within N hours | `0` |
| `-h, --help` | Display help | |
| `-V, --version` | Display version | |

## What Gets Deleted?

`cdk-agc` **only deletes `asset.*` directories and files** that are not actively referenced. All CDK metadata files and user-created files are always preserved.

### Deletion Candidates

- `asset.{hash}/` - Unreferenced asset directories

### Always Protected

**CDK metadata** (never deleted):

- `manifest.json`
- `tree.json`
- `cdk.out`
- `*.template.json`
- `*.assets.json`

**User files** (never deleted):

- Any file/directory not starting with `asset.`
- Examples: `my-notes.txt`, `debug/`, etc.

### Protection Policy

`asset.*` files/directories are **protected** from deletion if they meet **any** of these criteria:

1. **Active References**: Referenced in `manifest.json` or `*.assets.json` files
2. **Recent Modifications**: Modified within the last N hours (when using `-k/--keep-hours`)

## Use Cases

### Local Development

```bash
# After switching branches or reverting commits
git checkout feature-branch
npx cdk-agc -k 1  # Keep last hour's assets for quick rollback
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: CDK Synth
  run: cdk synth

- name: Clean unused assets
  run: npx cdk-agc

- name: Cache CDK output
  uses: actions/cache@v3
  with:
    path: cdk.out
    key: cdk-${{ hashFiles('**/cdk.json') }}
```

### Monorepo

```bash
# Clean multiple CDK projects
npx cdk-agc -o ./apps/api/cdk.out
npx cdk-agc -o ./apps/web/cdk.out
```

## How It Works

1. **Read Manifest**: Parse `manifest.json` and recursively collect all referenced paths
2. **Scan Directory**: List all files/directories in the output directory
3. **Apply Protection Policy**: Check each item against protection criteria
4. **Calculate Savings**: Compute total size to be reclaimed
5. **Execute Cleanup**: Delete unprotected items (or show preview in dry-run mode)

All file operations use `Promise.all()` for concurrent execution and optimal performance.

## Safety

- **Non-destructive by default**: Use `-d/--dry-run` to preview before actual deletion
- **Conservative protection**: Keeps all CDK metadata files
- **Rollback support**: Use `-k/--keep-hours` to maintain recent history

## Requirements

- Node.js >= 20.0.0

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.
