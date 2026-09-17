/**
 * @file Unit-test and coverage configuration.
 * @description Enforces deterministic tests and meaningful coverage thresholds.
 * @exports Vitest configuration.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/cli.ts', 'src/mqtt/**', 'src/reporting/**'],
      include: ['src/core/**', 'src/lab/**'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    include: ['tests/unit/**/*.test.ts'],
    sequence: { concurrent: false },
  },
});
