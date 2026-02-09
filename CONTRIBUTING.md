# Contributing to cdk-agc

Thank you for your interest in contributing to cdk-agc!

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/goto/cdk-agc.git
cd cdk-agc

# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm test
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

```bash
# Development mode (auto-rebuild)
pnpm run dev
```

### 3. Code Quality Checks

```bash
# Format code
pnpm run format

# Lint
pnpm run lint

# Format check (used in CI)
pnpm run format:check
```

### 4. Run Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm run test:watch

# Generate coverage report
pnpm run test:coverage
```

### 5. Verify Build

```bash
# Production build
pnpm run build

# Test CLI execution
node dist/cli.js --help
node dist/cli.js -d
```

### 6. Create a Changeset

Create a changeset to document your changes:

```bash
pnpm changeset
```

Follow the interactive prompts:
- **Version type**:
  - `patch`: Bug fixes
  - `minor`: New features (backward compatible)
  - `major`: Breaking changes
- **Summary**: Description of changes for end-users (in English)

Example:
```
---
"cdk-agc": patch
---

Fix: Correctly handle nested asset directories in manifest parsing
```

### 7. Commit

```bash
git add .
git commit -m "feat: add support for custom manifest paths"
```

**Commit Message Convention:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes only
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Build process or tooling changes

### 8. Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Pull Request Guidelines

### Checklist

Before creating a pull request, ensure:

- [ ] Code is formatted (`pnpm run format`)
- [ ] No lint errors (`pnpm run lint`)
- [ ] All tests pass (`pnpm test`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated (if needed)
- [ ] Changeset is created (`pnpm changeset`)

### Writing Tests

Tests use [Vitest](https://vitest.dev/).

New test files should follow the `*.test.ts` naming convention.

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature name', () => {
  it('should work as expected', () => {
    expect(result).toBe(expected);
  });
});
```

## Release Process

Releases are **fully automated**.

### Automated Release Flow

1. **PR with changes + changeset**
   ```bash
   # Create feature branch
   git checkout -b feature/new-feature

   # Create changeset
   pnpm changeset

   # Push and create PR
   git push origin feature/new-feature
   ```

2. **Merge PR to main**
   - GitHub Actions automatically creates a **Version PR**
   - Version PR includes:
     - Updated `package.json` version
     - Auto-generated `CHANGELOG.md`
     - Removed changeset files

3. **Merge Version PR**
   - Automatically publishes to npm
   - Creates GitHub Release

### Version PR Example

```
Title: chore: release package

Changes:
- package.json: 0.1.0 → 0.2.0
- CHANGELOG.md: New entries added
- .changeset/*.md: Deleted
```

### Manual Release (Emergency Only)

If GitHub Actions fails:

```bash
# 1. Update version
pnpm version

# 2. Commit & push
git add .
git commit -m "chore: release v0.x.x"
git push

# 3. Manual publish
pnpm release
```

## CI/CD

### CI (Continuous Integration)

**`.github/workflows/ci.yml`** - Runs on PRs and pushes:
- Matrix build with Node.js 20, 22
- Lint check
- Format check
- Build
- Test execution
- Coverage upload (Node.js 22 only)

### Version & Release (Automated Versioning & Publishing)

**`.github/workflows/version.yml`** - Runs on pushes to main:
- Detects changesets
- Creates Version PR (initial)
- When Version PR is merged:
  - Automatically publishes to npm
  - Automatically creates GitHub Release

## Project Structure

```
cdk-agc/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── cleanup.ts       # Core functionality
│   └── cleanup.test.ts  # Tests
├── dist/                # Build artifacts
├── .changeset/          # Changesets
├── .github/workflows/   # CI/CD
└── package.json
```

## Tools & Libraries

- **TypeScript**: Type-safe development
- **Vitest**: Fast test framework
- **Oxlint**: Ultra-fast linter
- **Oxfmt**: Ultra-fast formatter
- **Commander**: CLI framework
- **Changesets**: Version management

## Questions & Support

- **Issues**: [GitHub Issues](https://github.com/goto/cdk-agc/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
