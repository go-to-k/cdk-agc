# Contributing to cdk-agc

Thank you for your interest in contributing to cdk-agc!

## Development Setup

### Prerequisites

- **Node.js 24+** (recommended via [mise](https://mise.jdx.dev/))
- **pnpm >= 10.0.0**

### Node.js Version Management

This project uses Node.js 24 for development. We recommend using [mise](https://mise.jdx.dev/) for automatic version switching.

**With mise:**

```bash
# mise will automatically use Node.js 24 when you enter the project directory
cd cdk-agc
# Node.js 24 is automatically activated via .tool-versions
```

**Without mise:**

```bash
# Manually install and use Node.js 24
nvm install 24
nvm use 24
# or
n 24
```

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/go-to-k/cdk-agc.git
cd cdk-agc

# Install dependencies (workspace includes test-cdk)
pnpm install

# Build
pnpm run build

# Run unit tests
pnpm test

# Run integration tests (requires Node.js 24)
pnpm run test:integ
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

**Unit Tests:**

```bash
# Run unit tests
pnpm test

# Watch mode
pnpm run test:watch

# Generate coverage report
pnpm run test:coverage
```

**Integration Tests:**

```bash
# Run all integration tests (requires Node.js 24)
pnpm run test:integ

# Run specific integration test
pnpm run test:integ:basic       # Basic cleanup test
pnpm run test:integ:multiple    # Multiple synth test
pnpm run test:integ:keep-hours  # Keep hours option test
```

**Note:** Integration tests use native TypeScript support in Node.js 24 (`node --enable-source-maps *.ts`). If you're using Node.js 20-22, use mise or switch to Node.js 24 manually.

### 5. Verify Build

```bash
# Production build
pnpm run build

# Test CLI execution
node dist/cli.mjs --help
node dist/cli.mjs -d
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
- [ ] Code is formatted (`pnpm run format`)
- [ ] No lint errors (`pnpm run lint`)
- [ ] All tests pass (`pnpm test`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated (if needed)

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
npx semantic-release --no-ci
```

## CI/CD

### CI (Continuous Integration)

**`.github/workflows/ci.yml`** - Runs on PRs and pushes:

- Matrix build with Node.js 20, 22, 24
- Lint check
- Format check
- Build
- Unit test execution
- Integration test (Node.js 24 only)
- Coverage upload (Node.js 24 only)

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
- **tsdown**: Fast build tool (rolldown-based)
- **pnpm**: Fast, efficient package manager with workspace support

### Code Quality

- **Vitest**: Fast unit test framework
- **Oxlint**: Ultra-fast linter (Rust-based)
- **Oxfmt**: Ultra-fast formatter (Rust-based)

### Build & Release

- **Commander**: CLI framework
- **semantic-release**: Automated version management and publishing
- **GitHub Actions**: CI/CD automation

### Development Tools

- **mise**: Automatic Node.js version switching (optional but recommended)

## Questions & Support

- **Issues**: [GitHub Issues](https://github.com/go-to-k/cdk-agc/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
