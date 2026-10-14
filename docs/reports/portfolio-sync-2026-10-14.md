# Portfolio synchronization — 2026-10-14

Created by Jason Stys.

This candidate combines the reviewed proposals below while preserving their
commit ancestry and the existing main-branch security fixes. Conflicting
version declarations are combined explicitly; affected locks are regenerated
from the reviewed manifests. No audit or coverage budget is lowered.

- [Original proposal #12](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/pull/12).
- [Original proposal #13](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/pull/13).
- [Original proposal #14](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/pull/14).
- [Original proposal #15](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/pull/15).
- [Original proposal #16](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/pull/16).

Coordinated CodeQL steps use the same reviewed immutable release where present.
Source and generated-symbol contracts remain enforced by the existing workflows.
The complete candidate must pass its applicable native CI before promotion.
[Inspect candidate checks](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions?query=branch%3Amaintenance%2Fportfolio-sync-20261014).

This maintenance does not add production deployments, user-data access, automatic
source promotion or new guarantees of security. Existing release tags and assets
are retained. Platform and model-quality limitations remain in the project README.
