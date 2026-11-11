# Practical offline lifecycle application validation

By Jason Stys. The new full application composes the original broker, publisher,
consumer, queue and independent fault-scenario implementations. It does not invoke
the real MQTT.js adapter or claim a production broker, Sparkplug compatibility or
live monitoring.

## Observed local source checks

The complete original `pnpm verify` recipe passed with the exact declared pnpm
11.19.0, isolated from global tooling. Its archive was fetched from the official
npm registry and SHA-512 verified before use. Node was 24.18.1; hosted toolchain
checks and exact-main release acceptance are separate.

- **82 unit tests passed**, including 27 independently authored campaign cases.
  Measured source includes the original `src/core`/`src/lab` plus
  `src/workbench/campaign.ts`: 97.59% lines, 97.52% statements, 91.77% branches and
  97.70% functions. The original 90/90/85/90 floors respectively remain. This
  denominator does **not** cover the entire GUI, native owner or file picker.
- Both original integration tests passed. All seven original fault scenarios
  passed, and the original real checkpoint-file rehearsal recovered two live
  batches with one TTL expiry and one capacity-shrink loss.
- The unchanged 20,000-message ingestion benchmark passed its 5,000/s floor at
  109,426/s in one local observation. This is a microbenchmark, not a live-broker
  throughput or cross-machine guarantee.
- Strict TypeScript, type-aware ESLint, formatted source, production browser
  build and generated actual declaration/parameter anchors passed.
- Thirteen native boundary cases passed with actual filesystem aliases,
  revision/previous-byte preservation, cold reopen, public-only HTTP and resource
  hash checks. Separate archive/notice and hosted gates remain explicit.

## Actual complete package use

A complete relocated Windows ZIP over development baseline
`9394847b1ff7ecf0f0006a54e6908804c6fd5b82`, honestly marked dirty, passed two
actual compiled-app launches with normal exits 0 and 0. It exercised:

1. Editable cold-chain form settings and exact Previous/Next/full replay. Actual
   restore evidence showed one expired batch, one shrink loss and two replays;
   the final temperature was 4.4 with original source timestamps retained.
2. A separately imported factory campaign with real retained bootstrap,
   duplicate detection and rebirth, without silently replacing saved input.
3. A utility campaign with the actual reject-newest policy, two earlier batches
   retained, final value 202 and three explicit connections/birth sequences.
4. Literal filtering with complete-prefix export, original seven scenarios,
   project/report/checkpoint exports to new files, existing-file refusal,
   invalid model and malformed UTF-8 preservation, current/previous revision and
   durable cold reopen.
5. An accepted asynchronous export held behind a real file-choice promise while
   repeated native Close requests retained the visible owner and profile lock.
   Releasing that choice completed the real new-file write before normal exit.

The native test used only fresh marked synthetic profiles and a system-only
child PATH. Recorded outside-session requests and inherited-proxy requests were
zero. It did not install an application, open normal user data, change Docker,
modify a system service or prove a default-profile shortcut/clean-machine launch.
Clean committed-source, hosted and installed-executable proofs are distinct later
acceptance steps; no passing result is inferred for them here.

## Failures that improved the implementation

The first package build refused pnpm's legitimate linked/hardlinked dependency
notice. A separate fixed-package, bounded read-only notice reader now admits the
locked Zod license within the dependency tree. User profile/import alias guards
remain unchanged. Actual inert hardlink and directory-alias fixtures verify that
separation; no global directory or dependency admission exception was added.

Real native use caught an unstable implicit select name. Explicit accessible
names now identify the outcome, prepared input and literal search controls. The
UI also keeps form/JSON changes unapplied until deliberate application, refuses
silent replacement and disables competing edits during accepted local file work.
Earlier failed staging and acceptance outputs were retained; deadlines were not
increased and tests were not retried until the underlying issue was corrected.

## Practical limits

This is an unsigned Windows x64 portable candidate, not a cross-platform native
installer or production identity service. One trusted OS owner controls plaintext
project/import/export files. There is one current configuration and a complete
previous revision; replay evidence is recomputed or explicitly exported, not an
unbounded persistent event history. Hashes and static alias admission are not
authentication or protection from a malicious concurrent same-owner writer.

The strict project bounds, closed event vocabulary, exact prefix, current-process
counters, queue-operation-driven TTL and original JSON lifecycle profile are
documented in the [application guide](../native-application.md). A rejected event
is reported as such; it is never converted into a successful scenario or a claim
of complete delivery. Current native workflow builds the full relocated package,
retains bounded proof by default and adds actual Python/Actions CodeQL coverage
without replacing the original JavaScript/TypeScript analysis identity.

## Locked tooling advisory repaired

The fresh full root audit identified the moderate [minimatch glob-amplification advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) in ESLint transitives at 10.2.6. A high-severity-only view had filtered its advisory details; the full audit was inspected rather than described as zero. The narrow workspace override `minimatch@>=7 <11.0.1` selects the upstream patched 11.0.1. Only that package and its required `@isaacs/nonrecursive-glob-match` helper changed in the lock graph. Actual locked lint/tests remain required; there is no suppression or dependency downgrade. The fresh corrected root audit and separate native graph report zero known findings, and a moderate-level root audit is now mandatory in CI.
