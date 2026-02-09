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

### 6. Commit

```bash
git add .
git commit -m "feat: add support for custom manifest paths"
```

**Commit Message Convention (Conventional Commits):**
- `feat:` New feature → **Minor version bump** (0.1.0 → 0.2.0)
- `fix:` Bug fix → **Patch version bump** (0.1.0 → 0.1.1)
- `feat!:` or `BREAKING CHANGE:` → **Major version bump** (0.1.0 → 1.0.0)
- `docs:`, `style:`, `refactor:`, `test:`, `chore:` → No release

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

### Checklist

Before creating a pull request, ensure:

- [ ] Code is formatted (`pnpm run format`)
- [ ] No lint errors (`pnpm run lint`)
- [ ] All tests pass (`pnpm test`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated (if needed)
- [ ] PR title follows Conventional Commits format (e.g., `feat:`, `fix:`)

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

## Project Structure

```
cdk-agc/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── cleanup.ts       # Core functionality
│   └── cleanup.test.ts  # Tests
├── test-cdk/            # Integration tests
├── dist/                # Build artifacts
├── .github/workflows/   # CI/CD
├── .releaserc.json      # semantic-release config
└── package.json
```

## Tools & Libraries

- **TypeScript**: Type-safe development
- **tsdown**: Fast build tool (rolldown-based)
- **Vitest**: Fast test framework
- **Oxlint**: Ultra-fast linter
- **Oxfmt**: Ultra-fast formatter
- **Commander**: CLI framework
- **semantic-release**: Automated version management and publishing

## Questions & Support

- **Issues**: [GitHub Issues](https://github.com/goto/cdk-agc/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
