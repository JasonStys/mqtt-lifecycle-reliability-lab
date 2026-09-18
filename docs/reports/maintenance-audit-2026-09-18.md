# Maintenance audit — 2026-09-18

## Result

The validated source baseline was `5a5e46d`. Hosted [CI](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions/runs/35385686196) and [CodeQL](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions/runs/35385685907) both passed.

## Dependency decisions

- Pinned pnpm setup and CodeQL action updates were reviewed, validated, and merged.
- The TypeScript 7 development-tooling group was rejected because typescript-eslint does not yet support that compiler major.
- Node-type and TypeScript major updates are now held until their runtime and lint compatibility gates can pass together.
- No open pull request or non-default maintenance branch remained when this report was prepared.

The final CI run covers formatting, type-aware linting, tests, integration scenarios, build, benchmarks, and both supported Node versions.
