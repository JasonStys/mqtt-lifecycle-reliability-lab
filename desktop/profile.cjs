/** File: desktop/profile.cjs
 * Author: Jason Stys
 * Purpose: Own a bounded plaintext local blueprint with optimistic revision and explicit prior-revision recovery.
 * Functions: openProfile admits the whole path before writes; load/save/close keep one owned lock through completion.
 * State: trusted OS-owner static namespace only; hashes/markers are not authentication or concurrent-race protection.
 */
'use strict';
const fs = require('node:fs');
const { createHash, randomBytes } = require('node:crypto');
const { resolve, join, relative, isAbsolute, sep } = require('node:path');
const { ancestors, readRegular, readUtf8, newFile } = require('./files.cjs');
const PRODUCT = 'mqtt-lifecycle-reliability-lab';
const MAX = 65_536;
const names = ['workspace-owner.json', 'workspace.lock', 'project.json', 'project.previous.json'];

/** Compare canonical layout boundaries before creating any directory or ownership file. */
function admittedPath(path, forbidden = []) {
  if (!isAbsolute(path)) throw new Error('Choose an absolute local profile directory.');
  const directory = resolve(path);
  ancestors(directory);
  for (const program of forbidden) {
    const inside = relative(resolve(program), directory);
    if (!inside || (!inside.startsWith('..' + sep) && inside !== '..' && !isAbsolute(inside)))
      throw new Error('Keep durable profiles outside application and runtime directories.');
  }
  if (fs.existsSync(directory)) {
    const entries = fs.readdirSync(directory);
    if (entries.length > names.length || entries.some((name) => !names.includes(name)))
      throw new Error(
        'Unknown profile content is preserved; choose an empty or identified workspace.',
      );
    for (const name of entries)
      readRegular(
        join(directory, name),
        name === 'project.json' || name === 'project.previous.json' ? MAX : 4096,
      );
    if (entries.length && !entries.includes('workspace-owner.json'))
      throw new Error('Profile identity is missing; nothing was reset.');
  }
  return directory;
}

/** Open with no stale-lock adoption and no initial project substitution. Validation stays the real authoring core. */
function openProfile(path, validate, forbidden = []) {
  const directory = admittedPath(path, forbidden);
  const marker = join(directory, names[0]),
    lock = join(directory, names[1]);
  if (fs.existsSync(marker)) {
    const identity = JSON.parse(readUtf8(marker, 4096));
    if (
      Object.keys(identity).sort().join('|') !== 'id|product|schema' ||
      identity.schema !== 1 ||
      identity.product !== PRODUCT ||
      !/^[0-9a-f]{32}$/.test(identity.id)
    )
      throw new Error('Unknown profile identity; original bytes are preserved.');
  } else {
    fs.mkdirSync(directory, { recursive: true });
    newFile(
      marker,
      JSON.stringify({
        schema: 1,
        product: PRODUCT,
        id: randomBytes(16).toString('hex'),
      }) + '\n',
    );
  }
  const token = randomBytes(32).toString('hex');
  try {
    newFile(lock, token);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        'This workspace is already owned or has a retained interrupted-owner lock. Preserve it for review.',
        { cause: error },
      );
    throw error;
  }
  let closed = false;
  const file = join(directory, 'project.json'),
    previous = join(directory, 'project.previous.json');
  function owned() {
    if (closed || readUtf8(lock, 4096) !== token)
      throw new Error('Local workspace ownership no longer matches.');
    admittedPath(directory, forbidden);
  }
  /** Read complete current bytes every time; a revision is an accidental-concurrency guard, not a signature. */
  function load() {
    owned();
    if (!fs.existsSync(file)) return { revision: 'none', project: null };
    const bytes = readRegular(file, MAX);
    const project = validate(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return {
      revision: createHash('sha256').update(bytes).digest('hex'),
      project,
    };
  }
  /** Flush one new temporary file then rename; preserve interrupted temporary evidence rather than cleaning it away. */
  function replace(destination, bytes) {
    if (fs.existsSync(destination)) readRegular(destination, MAX);
    const pending = join(directory, 'pending-' + randomBytes(16).toString('hex') + '.json');
    newFile(pending, bytes);
    fs.renameSync(pending, destination);
  }
  function save(request) {
    owned();
    if (
      !request ||
      Object.keys(request).sort().join('|') !== 'revision|serialized' ||
      typeof request.serialized !== 'string' ||
      typeof request.revision !== 'string'
    )
      throw new Error('Invalid local save request.');
    const current = load();
    if (current.revision !== request.revision)
      throw new Error('Saved project changed. Load its current revision before replacing it.');
    const project = validate(request.serialized),
      text = JSON.stringify(project, null, 2) + '\n';
    if (Buffer.byteLength(text) > MAX) throw new Error('Canonical project exceeds64KiB.');
    if (current.project !== null) replace(previous, readRegular(file, MAX));
    replace(file, text);
    return load();
  }
  function close() {
    if (closed) return;
    owned();
    fs.unlinkSync(lock);
    closed = true;
  }
  return { directory, load, save, close };
}

module.exports = { PRODUCT, MAX, admittedPath, openProfile };
