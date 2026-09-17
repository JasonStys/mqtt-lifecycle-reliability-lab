/**
 * @file Integration-test configuration.
 * @description Runs end-to-end lifecycle scenarios through the in-memory broker boundary.
 * @exports Vitest configuration.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    sequence: { concurrent: false },
    testTimeout: 10_000,
  },
});
