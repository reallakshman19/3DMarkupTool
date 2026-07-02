# Current New-Core Migration Status - July 2026

## 1. Decision status

This document is a status/gate artifact only.

The runtime switch is not implemented and not authorized.

This document does not implement a runtime switch.

This document does not authorize a runtime switch.

Canvas authoring is not started or authorized.

This document does not start canvas authoring.

This document does not promote any downstream artifact to source-of-truth.

No downstream artifact replaces `PlantModelGraph.v1` as the engineering source-of-truth.

## 2. Current merged baseline

The current merged baseline records these readiness and proof families:

- Phase 01 new-core readiness audit.
- Phase 02 writer/runtime readiness proof.
- Runtime switch proposal package.
- New Core Runtime Readiness workflow/install gate cleanup.
- CYLINDER/code8 production parity proof.
- Bend TORUS/code4 primitive and test-byte proof.
- Flange primitive compiler proof.

These are readiness/proof artifacts unless explicitly approved for production. A merged proof does not authorize a production writer change, runtime switch, converter reroute, preview change, UI behavior change, canvas authoring, browser download change, object URL change, or default feature-flag enablement.

## 3. Open PR gate

### PR #481 - ElementRvmLedger architecture gate

PR #481 is architecture-sensitive.

ElementRvmLedger.v1 is downstream trace/readiness ledger only.

PR #481 must preserve staged JSON child identity as source-import evidence only.

Staged JSON children are source-import evidence only, not master model.

PR #481 must confirm PlantModelGraph.v1 remains source-of-truth.

PR #481 must not introduce staged JSON child, element ledger, byte row, or element unit as master model.

PR #481 must be resolved before PR #480.

### PR #480 - flange byte proof gate

PR #480 remains a test-only flange byte proof if accepted.

PR #480 may be accepted only if test-only.

PR #480 must not change production writer/runtime/canvas/UI behavior.

PR #480 must not put flange bodies into the production-ready writer path.

PR #480 must keep FLANGE_CYLINDER/code8 separate from straight-pipe CYLINDER/code8 readiness.

PR #480 must keep productionReadyFlangeCount or equivalent production-readiness status false/zero unless separately approved.

## 4. Source-of-truth rule

PlantModelGraph.v1 remains the engineering source-of-truth.

The following are downstream evidence only:

- managed/staged JSON children;
- staged JSON children;
- ElementRvmLedger.v1;
- RvmElementUnit.v1 candidates, if introduced later;
- stitch manifests;
- output rows;
- byte proofs;
- diagnostic previews;
- controlled previews;
- writer chunks;
- stitched byte payloads;
- RvmExportModel.v1;
- AttExportModel.v1;
- GlbVisualModel.v1;
- Three.js/canvas objects;
- GLB visual meshes.

No downstream evidence item may become the engineering source-of-truth, master model, production authority, or replacement for `PlantModelGraph.v1`.

## 5. Current pipeline status

The current approved conceptual pipeline is:

```text
Managed/Staged JSON
-> managed-stage import adapter
-> PlantModelGraph.v1
-> catalogue binding
-> ResolvedGeometryModel.v1
-> ResolvedPrimitiveModel.v1
-> RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
-> writer adapters / artifact adapters / preview diagnostics
-> production writer only after explicit approval
```

Managed-stage importer exists.

Catalogue binder exists.

Geometry solver exists for straight pipe, bend/flange/generic frames, and support intent.

Primitive compiler exists for straight pipe CYLINDER/code8, bend TORUS/code4, and flange FLANGE_CYLINDER/code8 intent.

Export models exist as adapter/dry-run/test-byte/readiness boundary.

RvmExportModel.v1 is adapter/dry-run/test-byte boundary.

Valves are not production solved.

Valves are blocked/deferred unless separately proven.

Supports are intent/deferred unless separately proven.

Supports are blocked/deferred unless separately proven.

ATT remains a separate boundary.

GLB remains visual/preview only and not authority.

GLB remains visual/preview only and is not authority.

## 6. Runtime switch status

Runtime switch is not approved.

Feature flag must be OFF by default in any future switch PR.

Existing production path must remain unchanged when OFF.

Agent/Owner approval is mandatory before any switch implementation.

CYLINDER/code8 is candidate evidence only, not switch approval.

TORUS/code4 remains test-only until policy approval.

TORUS/code4 remains test-only until production writer policy approves.

FLANGE_CYLINDER/code8 remains test-only/deferred until policy approval.

FLANGE_CYLINDER/code8 remains byte-proof/test-only until separate production policy approves.

Valves/supports remain blocked/deferred unless separately solved.

Valves are blocked/deferred unless separately proven.

Supports are blocked/deferred unless separately proven.

ATT remains separate boundary.

GLB remains visual/preview only and not authority.

## 7. Protected files

The protected files are exactly:

- src/app.js
- src/main.js
- src/managed-stage-rvm-converter.js
- src/rvm-writer.js
- src/att-writer.js
- src/managed-stage-json-ui-controller.js
- src/safe-ui-loader.js
- src/app-loader.js
- src/rvm-converter.js
- src/rvm-preview.js
- index.html

Loaders, preview runtime, UI, browser download/object URL behavior, canvas behavior, feature flags, and converter routing are protected.

## 8. Next allowed work

The next allowed order is:

1. Resolve PR #481 first.
2. Resolve PR #480 second.
3. Then harden PlantModelGraph.v1 contracts.
4. Then harden catalogue locks/hashes/normalized binding audit.
5. Then harden managed-stage importer source parity.
6. Then harden geometry solver continuity and port/frame audits.
7. Then prove ATT identity/tag continuity.
8. Only then consider a CYLINDER/code8-only guarded runtime switch review.
9. Canvas preview adapter and canvas authoring must wait until export/readiness gates are stable.

## 9. Explicit forbidden next work

Forbidden next work includes:

- no full runtime switch;
- no runtime switch;
- no default feature flag enablement;
- no writer rewrite;
- no converter reroute;
- no UI/canvas authoring;
- no fallback cubes;
- no support placeholder downgrade;
- no valve placeholder downgrade;
- no support/valve placeholder downgrade;
- no GLB-as-authority behavior;
- no ATT collapse into RVM-only output.

## 10. Agent operating rule

Project Owner / Orchestrator owns decisions.

Labor agents implement only assigned scope.

No splitting unless vertical ownership is naturally separate.

No agent may broaden scope from docs/tests into runtime or writer code.
