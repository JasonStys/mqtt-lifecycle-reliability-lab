/**
 * @file Read the fixed locked Zod license for packaging, including legitimate pnpm content-store hardlinks.
 * @description Build-only read boundary; never used for profile/import admission or any write.
 * @exports lockedNotice; @data a resolved package notice must remain inside this repository's dependency tree.
 */
import { realpathSync, openSync, closeSync, fstatSync, readSync, constants } from 'node:fs';
import { join, sep, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
const MAX = 1_000_000;

/** Fixed package path, bounded actual descriptor read; nlink may exceed one in the pnpm read-only pool. */
export function lockedNotice(root, name) {
  if (name !== 'zod')
    throw new Error('Only the actual locked runtime package notice is supported.');
  const dependency = join(resolve(root), 'node_modules');
  const path = realpathSync(join(dependency, name, 'LICENSE'));
  if (!path.startsWith(dependency + sep))
    throw new Error('Runtime notice escaped the project dependency tree.');
  const descriptor = openSync(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.size > MAX) throw new Error('Invalid runtime notice file.');
    const bytes = Buffer.alloc(Math.min(before.size + 1, MAX + 1));
    let length = 0;
    while (length < bytes.length) {
      const received = readSync(descriptor, bytes, length, bytes.length - length, length);
      if (!received) break;
      length += received;
    }
    if (length !== before.size || length > MAX)
      throw new Error('Runtime notice changed or exceeded its bound.');
    return bytes.subarray(0, length);
  } finally {
    closeSync(descriptor);
  }
}
