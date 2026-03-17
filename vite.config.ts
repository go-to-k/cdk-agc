import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    semi: true,
    printWidth: 100,
    trailingComma: "all",
  },
  lint: {
    rules: {
      typescript: "warn",
      correctness: "warn",
      suspicious: "warn",
      perf: "warn",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["dist/**", "node_modules/**", "**/*.config.ts", "src/cli.ts"],
    },
  },
  pack: {
    entry: ["src/**/*.ts", "!src/**/*.test.ts"],
    platform: "node",
    format: ["esm"],
    target: "node20",
    dts: true,
    clean: true,
    shims: true,
  },
  run: {
    tasks: {
      "test:integ": {
        command:
          "vp pack && pnpm --filter test-cdk test",
        cache: false,
      },
      "test:integ:basic": {
        command:
          "vp pack && pnpm --filter test-cdk test:basic",
        cache: false,
      },
      "test:integ:multiple": {
        command:
          "vp pack && pnpm --filter test-cdk test:multiple",
        cache: false,
      },
      "test:integ:keep-hours": {
        command:
          "vp pack && pnpm --filter test-cdk test:keep-hours",
        cache: false,
      },
    },
  },
});
