# MQTT Lifecycle Workbench application

Created by Jason Stys · [GitHub/contact](https://github.com/JasonStys).

The full application uses the original `EdgeNode`, `InMemoryBroker`,
`StateConsumer`, checkpoint queue and seven-scenario suite. Prepared cold-chain,
factory and utility inputs are editable data inside that application. They are
not separate demo programs, and no live MQTT adapter is invoked.

## Practical workflow

1. Choose an editable prepared input or import a bounded UTF-8 project JSON file.
   Set the title, group/node identities, original and replacement capacities,
   TTL and overflow policy. Event JSON permits the original validated metric
   types, values, qualities, units and explicit source timestamps.
2. Apply form settings or validate/apply JSON. Unapplied input is kept separate
   from last-good evidence; Save, export and replay refuse to discard it silently.
   Explicit Discard resets the editor/form to the applied configuration.
3. Use Next/Previous or Replay all. Every position rebuilds a fresh exact event
   prefix with the real original engine. An illegal transition is a **rejected
   operation**, not a successful analysis. Inspect a row for original state,
   queue counters, restore-loss details and the actual event.
4. Search literal event text or filter rejected operations. The visible filter
   never changes the complete selected-prefix report or its denominator. Open
   current consumer state separately from publisher queue statistics.
5. Load the current saved revision before Save. Import applies input but never
   silently saves it. Export a project, complete prefix report or actual
   checkpoint to a **new** file. Quit normally; accepted file operations finish
   before the owner releases its lock. Reopen and replay saved configuration.

The cold-chain case expires one batch and records one capacity-shrink loss before
two live batches replay with their original timestamps. The factory case exposes
late retained-state bootstrap, duplicate detection, will/offline state and rebirth.
The utility case rejects the newest excess batch and distinguishes broker restart
from process replacement. The original seven independent reliability scenarios
remain separately available below the editor.

## Event semantics and bounds

Projects are schema 1 data, at most 64 KiB UTF-8, with 1–128 nondecreasing `atMs`
events within one simulated day. Capacity is 1–1000 batches; TTL is 1–86,400,000 ms.
Each publish has 1–16 metrics satisfying the existing strict metric schema.
Supported operations are `connect`, `disconnect`, `crash`, `subscribe`,
`unsubscribe`, `new-consumer`, `publish`, `checkpoint`, `restore`,
`restart-broker`, `duplicate-last` and `inspect`.

A checkpoint requires a disconnected publisher. Restore requires a prior
checkpoint and a disconnected old publisher; it creates a fresh process with the
selected replacement capacity. Expiry occurs on the original queue's operations,
not an autonomous wall-clock timer. Current counters belong to the current
simulated publisher/consumer; earlier rows retain process-replacement loss
evidence. A rejected event records actual original-engine behavior; it does not
promise a transaction rollback around that engine. Browser memory and native
replays use the same validated project and original implementations.

## Durable files and native boundary

The Windows x64 unsigned portable candidate bundles Electron and the compiled
full website/engine. End users do not install Node, Python, an IDE or a broker.
Extract the entire ZIP into a new versioned directory and keep companion files.
No currently published native release or clean-machine test is inferred merely
from a local build; release and installation acceptance are separate.

Default data lives outside the application under
`%LOCALAPPDATA%/JasonStysPortfolio/mqtt-lifecycle-reliability-lab/workspace`.
An explicit absolute `--profile` may select another identified owner-local
directory. The profile contains one current project and a complete previous
revision, a marker and an exclusive owner lock. Unknown nonempty folders,
interrupted pending files, aliases, installation trees and stale revisions are
refused without resetting or adopting their data. Preserve a stopped-profile
backup before any manual recovery; do not remove a retained interrupted lock
without reviewing its owner/state. Imported originals and export destinations
are never automatically overwritten.

Profiles, imports and exports are **plaintext** and accessible to their trusted OS
owner. This is not production authentication, tenant separation or encryption.
Static alias admission and revision hashes are not protection against a malicious
same-owner namespace race. Package hashes describe provenance, not signatures.

The renderer has no Node/filesystem authority. Only five sender-checked IPC
operations cross into the owner. Its numeric-loopback listener serves verified
immutable public assets only; it has no private HTTP API or profile route. Proxy
policy is direct-only, and outside requests, navigation, popups and permissions
are refused. A temporary Chromium session is separate from the durable project.

## Source/build and verification

The root remains pnpm-locked; the private desktop tool graph is separately
npm-locked. `node scripts/build-native.mjs` with a fresh `MLW_NATIVE_OUTPUT`
builds the actual site and model, includes applicable runtime notices and binds
owned source/resource hashes. `python scripts/archive_native.py
release/NEW/win-unpacked artifacts/native/NEW` safely relocates the complete ZIP
and uses its actual executable twice with fresh marked synthetic data. Python,
TSX and build tools are **build/test-only**, not end-user app dependencies.

`scripts/locked-notice.mjs` permits legitimate hardlinks only when reading the
fixed locked Zod notice from the project's dependency tree. Profile/import
single-link admission is independent and unchanged. No arbitrary plugin,
executable, endpoint, password or real broker configuration exists in a campaign.

The Windows native workflow retains bounded receipts/screenshots by default;
the full unsigned package requires explicit trusted-main manual opt-in. All
original unit/integration/benchmark gates remain. Coverage includes the original
core/lab plus the campaign model, **not** the entire native renderer/owner.

Primary implementation references: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation),
[sandboxed renderers](https://www.electronjs.org/docs/latest/tutorial/sandbox).
The lab remains an original JSON lifecycle profile, **not Sparkplug wire
compatibility, MQTT broker conformance, live monitoring or a production system**.
