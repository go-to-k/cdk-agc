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
    root: "src",
    platform: "node",
    format: ["esm"],
    target: "node20",
    dts: true,
    clean: true,
    fixedExtension: true,
    sourcemap: true,
    shims: true,
  },
  run: {
    tasks: {
      cli: {
        command: "node dist/cli.mjs",
        cache: false,
      },
      "test:integ": {
        command:
          "vp pack && vp exec --filter test-cdk -- node --enable-source-maps scripts/test-all.ts",
        cache: false,
      },
      "test:integ:basic": {
        command:
          "vp pack && vp exec --filter test-cdk -- node --enable-source-maps scripts/test-basic.ts",
        cache: false,
      },
      "test:integ:multiple": {
        command:
          "vp pack && vp exec --filter test-cdk -- node --enable-source-maps scripts/test-multiple.ts",
        cache: false,
      },
      "test:integ:keep-hours": {
        command:
          "vp pack && vp exec --filter test-cdk -- node --enable-source-maps scripts/test-keep-hours.ts",
        cache: false,
      },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
