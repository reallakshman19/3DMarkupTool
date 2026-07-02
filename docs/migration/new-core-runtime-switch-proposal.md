# New-Core Runtime Switch Proposal

## Decision status

This document is a production runtime switch proposal package only.

The runtime switch is not implemented and not authorized. The production runtime path remains unchanged.

Current answer: the existing production runtime path must not be switched to consume the new-core export model yet. The merged Phase 01 and Phase 02 proofs are sufficient to prepare a strict proposal, but they do not by themselves approve a production switch.

Agent 00 approval is still required before any production runtime switch, writer integration, converter path change, preview path change, UI behavior change, download behavior change, or default feature-flag enablement.

## 1. Current approved baseline

The current approved baseline is the merged Phase 01 plus Phase 02 readiness proof after PR #487 merged to `main`.

Approved readiness evidence includes these gates from the `New Core Runtime Readiness` workflow:

```text
Phase 01 platform contracts
managed-stage importer
catalogue binding
resolved geometry
primitive compiler
export models
new-core readiness
Phase 02 writer adapters
artifact adapters
diagnostic preview
controlled preview
RVM byte proof
RVM TORUS byte proof
writer runtime readiness
```

This baseline proves that the new-core pipeline is traceable and testable as a shadow/readiness path. It does not prove or authorize production runtime replacement.

## 2. Source-of-truth rule

`PlantModelGraph.v1` remains the engineering-intent source of truth.

The following artifacts are downstream evidence only and must never replace `PlantModelGraph.v1`:

- output rows;
- managed/staged JSON children;
- byte proofs;
- diagnostic previews;
- controlled previews;
- ledgers, including `ElementRvmLedger.v1`;
- writer chunks;
- stitched byte payloads;
- `RvmExportModel.v1`;
- `AttExportModel.v1`;
- `GlbVisualModel.v1`.

Catalogue binding stays separate from graph placement. `ResolvedGeometryModel.v1` must contain solved geometry only. `ResolvedPrimitiveModel.v1` must contain primitive intent only. `RvmExportModel.v1` must not become the engineering source of truth.

## 3. RvmExportModel.v1 boundary statement

`RvmExportModel.v1` is currently an adapter/dry-run/test-byte boundary only.

It is allowed to support writer-adapter planning, artifact-adapter testing, diagnostic preview, controlled preview, and test-byte proof. It is not allowed to become a production runtime input until a separate switch proposal is approved by Agent 00 and all pre-switch gates in this document pass.

TORUS/code4 byte proof is test-only until production writer policy explicitly approves it.

FLANGE_CYLINDER/code8 remains deferred unless separate byte proof and production policy approve it.

## 4. Production runtime path inventory

The existing production runtime path remains unchanged and is outside the scope of this proposal package.

Current production/runtime-sensitive files are treated as protected boundaries:

```text
src/app.js
src/managed-stage-rvm-converter.js
src/rvm-writer.js
src/att-writer.js
src/managed-stage-json-ui-controller.js
src/safe-ui-loader.js
src/app-loader.js
src/rvm-converter.js
src/rvm-preview.js
index.html
```

Runtime-sensitive behavior currently includes:

- app bootstrapping and safe loader behavior;
- managed-stage JSON UI/controller behavior;
- active converter path used by production export;
- active RVM writer behavior;
- active ATT writer behavior;
- active preview behavior;
- download/object URL behavior;
- cache busting and module loading behavior.

This proposal does not modify any of those files or behaviors.

## 5. Runtime switch candidate path

The candidate path for a future switch is:

```text
Managed/Staged JSON
→ managed-stage import adapter
→ PlantModelGraph.v1
→ CatalogueBindingAudit.v1
→ ResolvedGeometryModel.v1
→ ResolvedPrimitiveModel.v1
→ RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
→ writer adapters
→ production-policy-approved writer boundary
→ production export/download path
```

The candidate path may only be considered after the new-core export model is proven equivalent or intentionally better under explicit acceptance rules. It must not bypass `PlantModelGraph.v1`, catalogue binding, resolved geometry, resolved primitives, writer adapters, or approval gates.

## 6. Blocker matrix

| Area | Current readiness status | Production switch blocker | Required resolution before switch |
|---|---|---|---|
| CYLINDER/code8 | Strongest candidate boundary. Existing proofs show cylinder primitive/export/test-byte readiness in the new-core path. | Production parity and regression proof are still required before using the new-core model as active runtime input. | Golden fixture parity for geometry, hierarchy, naming, material/layer metadata, bytes where applicable, preview behavior, and ATT linkage. |
| TORUS/code4 | Test-byte proof exists as readiness evidence. | TORUS/code4 remains test-only. It is not production writer authorization. | Explicit production writer policy approval, Review-compatible byte proof, fixture corpus, fallback behavior, and rollback trigger coverage. |
| FLANGE_CYLINDER/code8 | New-core readiness may represent flange primitive intent, but production-byte approval is not complete. | FLANGE_CYLINDER/code8 remains deferred unless separate byte proof and production policy approve it. | Separate flange byte proof, writer payload review, preview parity, and Agent 00 approval. |
| valves | Valves remain unresolved/deferred unless explicitly proven. | No complete catalogue-backed valve solver and production writer proof are approved. | Valve catalogue resolution, primitive intent, geometry, writer adapter, byte proof, preview proof, ATT linkage, and fallback/block policy. |
| supports | Supports remain unresolved/deferred unless explicitly proven. | Support/restraint representation must not be silently converted into primitive-only placeholders. | Support compiler policy, explicit support primitive/unit rules, ATT/linkage proof, GLB/preview proof, and production writer approval. |
| ATT | ATT must remain a separate export boundary. | RVM switch must not collapse ATT identity, tag mapping, or metadata into RVM-only output. | ATT export parity, tag continuity proof, source trace proof, and no regression in existing ATT writer behavior. |
| GLB | GLB must remain a separate preview/visual boundary. | GLB preview readiness does not authorize production RVM writing. | Visual parity gates, controlled-preview acceptance, no mutation of engineering source of truth, and independent failure isolation. |

## 7. Required pre-switch proof gates

A future runtime switch PR must pass all of the following before review can consider approval:

1. `npm run test:platform-contracts`
2. `npm run test:managed-stage-importer`
3. `npm run test:catalogue-binding`
4. `npm run test:resolved-geometry`
5. `npm run test:primitive-compiler`
6. `npm run test:export-models`
7. `npm run test:new-core-readiness`
8. `npm run test:writer-adapters`
9. `npm run test:artifact-adapters`
10. `npm run test:diagnostic-preview`
11. `npm run test:controlled-preview`
12. `npm run test:rvm-byte-proof`
13. `npm run test:rvm-torus-byte-proof`
14. `npm run test:writer-runtime-readiness`
15. `npm run test:runtime-switch-proposal`

Additional required switch-specific gates:

- production runtime path remains unchanged until the actual switch PR;
- explicit feature flag is OFF by default;
- old and new paths can run side-by-side in diagnostic/shadow mode;
- golden BM_CII fixture parity is documented;
- branch/line/component hierarchy parity is documented;
- byte-level compatibility or accepted byte-difference policy is documented;
- ATT tag continuity is documented;
- GLB/preview non-authority is documented;
- warnings and blocked/deferred items remain visible;
- no output row, staged JSON child, byte proof, preview, ledger, or writer chunk replaces `PlantModelGraph.v1`;
- Agent 00 approval is recorded explicitly.

## 8. Required post-switch rollback criteria

Rollback must be immediate if any of these occur after a future approved switch:

- generated RVM fails Review compatibility validation;
- exported geometry count, primitive code count, or hierarchy differs outside accepted policy;
- CYLINDER/code8 parity regresses;
- TORUS/code4 creates invalid or unstable Review geometry;
- FLANGE_CYLINDER/code8 emits unapproved payloads;
- valves or supports silently downgrade to placeholder geometry;
- ATT tags, source IDs, or line/branch mapping regress;
- GLB or preview behavior masks an export/runtime error;
- production export/download fails;
- browser performance or load stability regresses materially;
- diagnostics indicate source-trace loss;
- any path treats `RvmExportModel.v1`, byte proof, preview, ledger, staged JSON child, or writer chunk as source of truth.

Rollback strategy must be feature-flag based: disable the new-core runtime path and restore the existing production runtime path without code revert when possible. Code revert remains mandatory if the feature flag cannot restore exact prior behavior.

## 9. Runtime feature-flag strategy

A future switch must use an explicit runtime feature flag.

Required feature-flag behavior:

- default state is OFF;
- OFF means the existing production runtime path is used exactly as before;
- ON means the candidate new-core runtime path is used only for approved fixture classes and approved primitive families;
- partial family enablement must be supported, for example CYLINDER/code8 separately from TORUS/code4 and FLANGE_CYLINDER/code8;
- unsupported valves and supports must remain blocked/deferred with visible diagnostics;
- ATT and GLB boundaries must not be implicitly switched by an RVM feature flag;
- diagnostics must record which path generated each artifact;
- feature-flag state must be visible in audit output.

No feature flag is added or enabled by this proposal package.

## 10. No-regression criteria for the existing production path

A future switch PR must prove that the existing production path remains available and unchanged when the feature flag is OFF.

No-regression criteria:

- existing converter behavior remains unchanged;
- existing RVM writer behavior remains unchanged;
- existing ATT writer behavior remains unchanged;
- existing preview behavior remains unchanged;
- existing UI behavior remains unchanged;
- existing downloads/object URLs remain unchanged;
- existing managed-stage JSON loading remains unchanged;
- existing tests remain green;
- all new-core readiness tests remain green;
- the proposal-policy test remains green.

## 11. Agent 00 approval checklist

Agent 00 approval is required and must be explicit. Approval must not be inferred from merged readiness proofs.

Checklist:

- [ ] Confirm PR #487 and current main baseline are included in the reviewed baseline.
- [ ] Confirm `New Core Runtime Readiness` is green for the exact switch candidate commit.
- [ ] Confirm `PlantModelGraph.v1` remains the engineering-intent source of truth.
- [ ] Confirm `RvmExportModel.v1` remains adapter/dry-run/test-byte boundary until approved.
- [ ] Confirm production runtime path remains unchanged before the switch PR.
- [ ] Confirm CYLINDER/code8 parity proof is sufficient.
- [ ] Confirm TORUS/code4 has explicit production writer policy approval, not only test-byte proof.
- [ ] Confirm FLANGE_CYLINDER/code8 has separate byte proof and production writer policy approval.
- [ ] Confirm valves are solved or explicitly blocked/deferred.
- [ ] Confirm supports are solved or explicitly blocked/deferred.
- [ ] Confirm ATT remains a separate export boundary.
- [ ] Confirm GLB remains a separate preview/visual boundary.
- [ ] Confirm feature flag defaults OFF and rollback is possible without code revert.
- [ ] Confirm no output row, byte proof, preview, ledger, staged JSON child, or writer chunk replaces `PlantModelGraph.v1`.
- [ ] Confirm switch implementation PR is separate from this proposal package.

## Final proposal verdict

The switch is not approved by this document.

The next acceptable step is an Agent 00 review of this proposal package. Only after Agent 00 approval may a separate implementation PR propose a guarded runtime switch.