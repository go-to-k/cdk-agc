# Contributing to cdk-agc

Thank you for your interest in contributing to cdk-agc!

## Development Setup

### Prerequisites

- **Node.js 24+**
- **[Vite+](https://vite.plus/)** (`vp`)

### Node.js Version Management

This project pins Node.js in [`.node-version`](.node-version). Enable Vite+'s managed runtime once, then let `vp env` install and select that pinned version for you.

```bash
# Install Vite+
curl -fsSL https://vite.plus | bash

# Use Vite+'s managed Node.js for this machine
vp env on

# Install the version pinned in .node-version
vp env install
```

`pnpm` is pinned in [`package.json`](package.json) via `packageManager`, and Vite+ resolves that automatically when you run `vp install`.

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/go-to-k/cdk-agc.git
cd cdk-agc

# Install the pinned Node.js version from .node-version
vp env install

# Install dependencies (workspace includes test-cdk)
vp install

# Package the CLI
vp pack

# Run unit tests
vp test

# Run integration tests (requires Node.js 24)
vp run test:integ
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
vp pack --watch
```

### 3. Code Quality Checks

```bash
# Run the default verification flow
vp check

# Format only
vp fmt

# Lint only
vp lint

# Format check (used in CI)
vp fmt --check
```

### 4. Run Tests

**Unit Tests:**

```bash
# Run unit tests
vp test

# Watch mode
vp test --watch

# Generate coverage report
vp test --coverage
```

**Integration Tests:**

```bash
# Run all integration tests (requires Node.js 24)
vp run test:integ

# Run specific integration test
vp run test:integ:basic       # Basic cleanup test
vp run test:integ:multiple    # Multiple synth test
vp run test:integ:keep-hours  # Keep hours option test
```

**Note:** Integration tests use Node.js 24's TypeScript execution support with `--experimental-strip-types`. If `vp env current` does not show the pinned Node.js version, run `vp env install` again before testing.

### 5. Verify Build

```bash
# Production build
vp pack

# Test CLI execution
vp run cli
```

### 6. Commit

```bash
git add .
git commit -m "feat: add support for custom manifest paths"
```

**Commit Message Convention (Conventional Commits):**

- `feat:` New feature → **Minor version bump** (1.1.0 → 1.2.0)
- `fix:` Bug fix → **Patch version bump** (1.1.0 → 1.1.1)
- `feat!:` or `BREAKING CHANGE:` → **Major version bump** (1.1.0 → 2.0.0)
- `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `ci:` → No release

**Examples:**

```bash
git commit -m "feat: add support for custom manifest paths"
git commit -m "fix: correctly handle nested asset directories"
git commit -m "feat!: remove deprecated --force option"
```

### 7. Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Pull Request Guidelines

### PR Title Format (Required)

**Your PR title MUST follow Conventional Commits format, or CI will fail.**

Format: `<type>(<scope>): <description>`

**Allowed types:**

- `feat`: New feature → Minor version bump
- `fix`: Bug fix → Patch version bump
- `docs`: Documentation only
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes (dependencies, tooling, etc.)
- `revert`: Revert a previous commit

**Scope** (optional): Component or area affected (e.g., `api`, `cli`, `parser`)

**Breaking changes:** Add `!` after type (e.g., `feat!:`) or include `BREAKING CHANGE:` in description

**Examples:**

- ✅ `feat: add support for custom manifest paths`
- ✅ `fix: correctly handle nested asset directories`
- ✅ `feat(cli): add --verbose flag`
- ✅ `feat!: remove deprecated --force option`
- ❌ `Add new feature` (missing type)
- ❌ `feature: add something` (invalid type)

### Checklist

Before creating a pull request, ensure:

- [ ] PR title follows Conventional Commits format
- [ ] Code passes checks (`vp check`)
- [ ] All tests pass (`vp test`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated (if needed)

### Writing Tests

Tests use [Vitest](https://vitest.dev/) through [Vite+](https://vite.plus/).

New test files should follow the `*.test.ts` naming convention.

```typescript
import { describe, it, expect } from "vite-plus/test";

describe("Feature name", () => {
  it("should work as expected", () => {
    expect(result).toBe(expected);
  });
});
```

## Release Process

Releases are **fully automated** using [semantic-release](https://semantic-release.gitbook.io/).

### Automated Release Flow

1. **Create PR with Conventional Commits**

   ```bash
   # Create feature branch
   git checkout -b feature/new-feature

   # Make changes and commit with conventional format
   git commit -m "feat: add new feature"

   # Push and create PR
   git push origin feature/new-feature
   ```

2. **Merge PR to main**
   - semantic-release analyzes all commits since last release
   - Automatically determines version bump based on commit types:
     - `feat:` → Minor version (0.1.0 → 0.2.0)
     - `fix:` → Patch version (0.1.0 → 0.1.1)
     - `feat!:` or `BREAKING CHANGE:` → Major version (0.1.0 → 1.0.0)
   - Updates `package.json` and `CHANGELOG.md`
   - Publishes to npm with provenance
   - Creates GitHub Release with release notes

### Example Release Output

```
Analyzing commits...
✔ Found 3 commits since last release
✔ Determined next version: 0.2.0
✔ Updated package.json and CHANGELOG.md
✔ Published to npm: cdk-agc@0.2.0
✔ Created GitHub Release: v0.2.0
```

### Manual Release (Emergency Only)

If GitHub Actions fails:

```bash
# Run semantic-release locally
vp exec semantic-release --no-ci
```

## CI/CD

### CI (Continuous Integration)

**`.github/workflows/ci.yml`** - Runs on PRs and pushes:

- Lint & format check, build, unit tests, integration tests, coverage upload

### Release (Automated Publishing)

**`.github/workflows/release.yml`** - Runs on pushes to main:

- Analyzes commits with semantic-release
- Determines version based on Conventional Commits
- Updates package.json and CHANGELOG.md
- Publishes to npm with provenance
- Creates GitHub Release with auto-generated notes

## Tools & Libraries

### Core Development

- **TypeScript**: Type-safe development
- **Node.js 24+**: Native TypeScript support for integration tests
- **[Vite+](https://vite.plus/)**: Unified toolchain (build, test, lint, format)
- **pnpm**: Fast, efficient package manager with workspace support

### Code Quality

- **Vitest** (via Vite+): Fast unit test framework
- **Oxlint** (via Vite+): Ultra-fast linter (Rust-based)
- **Oxfmt** (via Vite+): Ultra-fast formatter (Rust-based)

### Build & Release

- **Commander**: CLI framework
- **semantic-release**: Automated version management and publishing
- **GitHub Actions**: CI/CD automation

## Questions & Support

- **Issues**: [GitHub Issues](https://github.com/go-to-k/cdk-agc/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
