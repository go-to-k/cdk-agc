# cdk-agc

**CDK Assembly Garbage Collector** - Clean up unused assets in your `cdk.out` directory.

## Overview

`cdk-agc` is a fast CLI tool that scans your AWS CDK cloud assembly directory and helps you reclaim disk space:

- **Clean `cdk.out` directories**: Remove unused assets while protecting referenced files
- **Clean temporary directories**: Delete accumulated temporary CDK directories in `$TMPDIR` (can save GBs of disk space)

Safe cleanup with intelligent protection:

- Assets referenced in `manifest.json` or `*.assets.json`
- Recently modified files (configurable retention period)
- Essential metadata files (`manifest.json`, `tree.json`, `*.template.json`, etc.)

This helps optimize storage and streamline CI/CD caching.

## Why?

### Problems

- CDK asset directories can grow to multiple GBs over time
- Temporary directories in `$TMPDIR` accumulate
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

## Requirements

- Node.js >= 20.0.0

## Usage

### Basic Examples

```bash
# Default: Clean cdk.out, keeping only active manifest assets
npx cdk-agc

# Clean temporary directories in $TMPDIR (can save GBs)
npx cdk-agc -t

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
| `-t, --cleanup-tmp` | Clean up all temporary CDK directories in `$TMPDIR` | `false` |
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
  run: npx cdk synth

- name: Clean unused assets
  run: npx cdk-agc

- name: Cache CDK output
  uses: actions/cache@v3
  with:
    path: cdk.out
    key: cdk-${{ github.sha }}
```

### Monorepo

```bash
# Clean multiple CDK projects
npx cdk-agc -o ./apps/api/cdk.out
npx cdk-agc -o ./apps/web/cdk.out
```

### Clean Temporary Directories

CDK creates temporary directories in `$TMPDIR` during synthesis (directories starting with `cdk.out`, `cdk-`, or `.cdk`), which can accumulate over time (especially after failed synths or interruptions). Use `-t/--cleanup-tmp` to reclaim disk space.

**Note**: This option deletes entire directories, not individual assets. Time-based protection with `-k/--keep-hours` is the only protection applied.

```bash
# Clean all temporary CDK directories (dry-run first)
npx cdk-agc -t -d

# Actually clean them
npx cdk-agc -t

# Protect recent directories (last 24 hours)
npx cdk-agc -t -k 24
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.
