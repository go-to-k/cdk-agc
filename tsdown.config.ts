import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts', 'src/cleanup.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
});
