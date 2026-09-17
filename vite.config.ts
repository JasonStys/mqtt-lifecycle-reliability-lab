/**
 * @file Browser dashboard build configuration.
 * @description Builds the dependency-light dashboard from the dashboard directory.
 * @exports Vite configuration.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'dashboard',
  build: {
    emptyOutDir: true,
    outDir: '../dist/dashboard',
    sourcemap: true,
  },
});
