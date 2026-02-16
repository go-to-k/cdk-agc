# cdk-agc

**CDK Assembly Garbage Collector** - Clean up unused assets in your `cdk.out` directory, remove locally built Docker images, and delete temporary CDK directories.

```txt
❯ npx cdk-agc
Scanning /Users/goto/cdk-sample/cdk.out

Found 3 unused item(s):
  - asset.1b74676f43a7db3c2b7b40ca7b8ae1cffa9314da05f888ba85f0e5bdbba35091 (1.12 KB)
  - asset.7f5b2d8f2821e1a7ee63c1c38d8f426be6e9fdd7af690d39ec195cafb65268d5 (269.82 MB)
  - asset.f2b4b696b62c99483eae61ae7dba459c039b020077a8058a61252b5cb50f93e9 (269.82 MB)

Total assets size to reclaim: 539.64 MB


Found Docker image with 2 tag(s) [asset.7f5b2d8f...] (436.00 MB):
  - 123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:7f5b2d8f2821e1a7ee63c1c38d8f426be6e9fdd7af690d39ec195cafb65268d5
  - cdkasset-7f5b2d8f2821e1a7ee63c1c38d8f426be6e9fdd7af690d39ec195cafb65268d5:latest

Found Docker image with 2 tag(s) [asset.f2b4b696...] (436.00 MB):
  - 123456789012.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-123456789012-us-east-1:f2b4b696b62c99483eae61ae7dba459c039b020077a8058a61252b5cb50f93e9
  - cdkasset-f2b4b696b62c99483eae61ae7dba459c039b020077a8058a61252b5cb50f93e9:latest

Total Docker image size to reclaim: 872.00 MB


Total size to reclaim (assets + Docker images): 1.38 GB

✓ Cleanup completed successfully.
```

## Overview

`cdk-agc` is a fast CLI tool that helps you reclaim disk space from AWS CDK builds:

- **Clean `cdk.out` directories**: Remove unused assets while protecting referenced files
  - Only deletes unreferenced `asset.*` directories and files - all other files are automatically protected
  - Protects recently modified files (configurable with `-k/--keep-hours`)

- **Remove locally built Docker images**: Clean up orphaned Docker images from CDK builds
  - Automatically removes Docker images associated with deleted asset directories
  - Displays size information for each image and total space to reclaim

- **Clean temporary directories** (`-t/--cleanup-tmp`): Delete accumulated temporary CDK directories in `$TMPDIR`
  - Deletes entire directories
  - Only time-based protection with `-k/--keep-hours`

This helps optimize storage and streamline CI/CD caching.

## Why?

### Problems

- CDK asset directories can grow to multiple GBs over time
- Docker images from CDK builds accumulate in local Docker daemon
- Temporary directories in `$TMPDIR` accumulate
- Disk space exhaustion from accumulated build artifacts
- Slow CI/CD pipelines due to large cache sizes

### Solution

`cdk-agc` provides safe, intelligent cleanup with:

- **Reference-based protection**: Only removes assets not referenced in `*.assets.json` files
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
# Default: Clean cdk.out, keeping only referenced assets
npx cdk-agc

# Dry-run: Preview what would be deleted
npx cdk-agc -d

# Custom directory (useful for monorepos)
npx cdk-agc -o ./packages/infra/cdk.out

# Keep assets modified within the last 24 hours
npx cdk-agc -k 24

# Clean temporary directories in $TMPDIR
npx cdk-agc -t
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

`cdk-agc` **only deletes `asset.*` directories and files** that are not actively referenced. All CDK metadata files are always preserved.

### Deletion Candidates

- `asset.{hash}/` - Unreferenced asset directories
- `asset.{hash}.{ext}` - Unreferenced asset files (e.g., `.txt`, `.zip`)
- **Docker images** - Local Docker images associated with deleted asset directories
  - Searches for both ECR format (`{account}.dkr.ecr.{region}.amazonaws.com/cdk-*:hash`) and local format (`cdkasset-{hash}:latest`)
  - Only removes images for assets that are being deleted

### Always Protected

**CDK metadata** (never deleted):

- `manifest.json`
- `tree.json`
- `cdk.out`
- `*.template.json`
- `*.assets.json`
- etc.

### Protection Policy

`asset.*` files/directories are **protected** from deletion if they meet **any** of these criteria:

1. **Active References**: Referenced in `*.assets.json` files
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
    key: cdk-${{ github.head_ref || github.ref_name }}
```

### Monorepo

```bash
# Clean multiple CDK projects
npx cdk-agc -o ./apps/api/cdk.out
npx cdk-agc -o ./apps/web/cdk.out
```

### Clean Temporary Directories

CDK creates temporary directories in `$TMPDIR` during synthesis (directories starting with `cdk.out`, `cdk-`, or `.cdk`), which can accumulate over time. Use `-t/--cleanup-tmp` to reclaim disk space.

**Note**: This option deletes entire directories. Time-based protection with `-k/--keep-hours` is the only protection applied.

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
