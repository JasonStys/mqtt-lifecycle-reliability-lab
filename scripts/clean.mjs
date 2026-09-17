/**
 * @file Cross-platform build cleanup utility.
 * @description Removes only repository-generated output directories.
 * @exports No public exports; invoked by `pnpm clean`.
 */
import { rm } from 'node:fs/promises';

const generatedDirectories = ['artifacts', 'coverage', 'dist'];

await Promise.all(
  generatedDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
);
