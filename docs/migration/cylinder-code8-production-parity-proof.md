# CYLINDER/code8 Production Parity Proof

## Decision status

This is a proof-only parity package for the straight-pipe `CYLINDER/code8` subset.

It does not implement a runtime switch. It does not modify the production runtime path. It does not modify the production RVM writer. It does not change UI behavior. It does not promote `RvmExportModel.v1` to source-of-truth.

## Core question

Can `CYLINDER/code8` straight-pipe output from the new-core path be treated as production-switch-candidate evidence without changing the production runtime?

## Verdict

`candidateReady` for the straight-pipe `CYLINDER/code8` subset only, when the `CylinderCode8ProductionParityAudit.v1` audit passes.

Reasons:

- `CYLINDER/code8` is a narrow straight-pipe primitive family with existing readiness evidence through `ResolvedPrimitiveModel.v1`, `RvmExportModel.v1`, writer adapters, and RVM byte proof.
- The parity audit fails closed unless transform policy, axis basis, units, and source trace are present.
- The parity audit rejects production runtime file changes and production writer file changes.
- The parity audit rejects TORUS/code4, FLANGE_CYLINDER/code8, valves, supports, fallback substitution, and non-cylinder primitives as candidate-ready evidence.
- `RvmExportModel.v1` remains downstream evidence only.

This verdict is not production switch approval. It only says the straight-pipe `CYLINDER/code8` subset can be carried forward as future switch-candidate evidence.

## 1. Scope statement

In scope:

- straight-pipe `CYLINDER/code8` only;
- source-traced cylinder candidates from the new-core readiness boundary;
- proof/audit evidence only.

Explicitly out of scope:

- no TORUS/code4;
- no FLANGE_CYLINDER/code8;
- no valves;
- no supports;
- no ATT production switch;
- no GLB production switch;
- no runtime switch;
- no production writer wiring;
- no UI behavior change.

TORUS/code4 remains test-only until production writer policy explicitly approves it.

FLANGE_CYLINDER/code8 remains deferred unless separate byte proof and production policy approve it.

Valves and supports remain blocked/deferred unless separately proven.

ATT and GLB remain separate export/preview boundaries.

## 2. Source-of-truth statement

`PlantModelGraph.v1` remains source-of-truth for engineering intent.

`RvmExportModel.v1` remains downstream evidence only. It is still an adapter/dry-run/test-byte boundary. It must not become the engineering source-of-truth.

The following must never replace `PlantModelGraph.v1`:

- `RvmExportModel.v1`;
- `ResolvedPrimitiveModel.v1`;
- byte proofs;
- previews;
- ledgers;
- writer chunks;
- output rows;
- managed/staged JSON children.

## 3. Current production writer boundary

The protected current production writer/runtime boundary includes:

```text
src/rvm-writer.js
src/att-writer.js
src/rvm-converter.js
src/rvm-preview.js
src/managed-stage-rvm-converter.js
src/managed-stage-json-ui-controller.js
src/app.js
src/main.js
src/safe-ui-loader.js
src/app-loader.js
index.html
```

For this proof package, the production writer files are not modified:

```text
src/rvm-writer.js
src/att-writer.js
```

The current production writer path is being compared/protected as the active output boundary. This package does not reroute production export, download, preview, writer, ATT, GLB, UI, or app boot behavior.

## 4. New-core boundary

The new-core proof boundary for this subset is:

```text
PlantModelGraph.v1
→ ResolvedPrimitiveModel.v1
→ RvmExportModel.v1
→ writer adapters
→ RVM byte proof
→ CylinderCode8ProductionParityAudit.v1
```

The audit treats `RvmExportModel.v1` as evidence from the adapter/dry-run/test-byte boundary only. It does not consume `RvmExportModel.v1` as source-of-truth and does not wire it into the production runtime.

## 5. Parity dimensions

The `CylinderCode8ProductionParityAudit.v1` audit verifies the following parity dimensions for the straight-pipe subset:

| Dimension | Required proof behavior |
|---|---|
| source item identity | each candidate cylinder must retain source identity and graph trace |
| primitive kind | candidate subset must be `CYLINDER` only |
| primitive code | candidate subset must use code `8` only |
| axis basis / transform policy | axis basis and transform policy must be present |
| center/axis/length/radius units | units must be `mm`; geometry fields must remain cylinder-intent evidence |
| count parity | cylinder count is reported explicitly and non-cylinder count is isolated |
| blocked/deferred item isolation | valves, supports, TORUS/code4, and FLANGE_CYLINDER/code8 must not become candidate-ready |
| no fallback primitive substitution | fallback substitutions are counted and fail the audit |
| no production runtime mutation | protected runtime changes fail the audit |
| no production writer mutation | protected writer changes fail the audit |
| source-of-truth protection | `RvmExportModel.v1` promotion to source-of-truth fails the audit |

## 6. Audit output contract

The proof module emits:

```text
CylinderCode8ProductionParityAudit.v1
```

Required fields:

```text
schema
graphId
scope
sourceOfTruth
candidateReady
productionRuntimeChanged
productionWriterChanged
runtimeSwitchImplemented
rvmExportModelPromotedToSource
cylinderCount
nonCylinderCount
torusCount
flangeCount
valveCount
supportCount
blockedCount
deferredCount
unsupportedPrimitiveCount
axisBasisOk
transformPolicyOk
unitsOk
sourceTraceOk
fallbackSubstitutionCount
hardErrorCount
warningCount
errors
warnings
ok
```

The audit is fail-closed. It returns `candidateReady: false` and `ok: false` if any hard rule is violated.

## 7. Fail-closed conditions

The audit fails closed if:

- production runtime files changed;
- production writer files changed;
- `RvmExportModel.v1` is described or marked as source-of-truth;
- any non-`CYLINDER/code8` primitive is treated as candidate-ready;
- TORUS/code4 is included in the candidate subset;
- FLANGE_CYLINDER/code8 is included in the candidate subset;
- valves are silently treated as ready;
- supports are silently treated as ready;
- transform policy is missing;
- axis basis is missing;
- units are missing or not `mm`;
- source trace is incomplete;
- fallback primitive substitution is detected;
- runtime switch implementation is detected.

## 8. Evidence interpretation

When the audit passes:

```text
candidateReady: true
ok: true
```

This means only that the straight-pipe `CYLINDER/code8` subset has enough proof to be considered future switch-candidate evidence.

When the audit fails:

```text
candidateReady: false
ok: false
```

This means the subset is `blocked` until the reported hard errors are resolved.

Non-cylinder items can be present only if they are isolated as blocked/deferred/non-candidate evidence. Their presence does not authorize them for production switching.

## 9. Required validation

Required validation for this proof package:

```bash
npm run test:cylinder-code8-parity
npm run test:runtime-switch-proposal
npm run test:writer-runtime-readiness
npm run test:new-core-readiness
npm run test:platform-contracts
```

The new narrow test is:

```bash
npm run test:cylinder-code8-parity
```

It proves:

- valid straight-pipe `CYLINDER/code8` subset can produce `candidateReady: true`;
- TORUS/code4 is excluded and does not become candidate-ready;
- FLANGE_CYLINDER/code8 is excluded and does not become candidate-ready;
- valves remain blocked unless separately proven;
- supports remain deferred unless separately proven;
- missing transform policy fails closed;
- missing source trace fails closed;
- production runtime file change fails closed;
- production writer file change fails closed;
- `RvmExportModel.v1` cannot be promoted to source-of-truth;
- runtime switch is not implemented.

## 10. Explicit non-authorization statement

This proof package does not approve runtime switch.

This proof package does not approve production writer wiring.

This proof package does not approve TORUS/code4, FLANGE_CYLINDER/code8, valves, supports, ATT production switch, or GLB production switch.

Agent 00 approval remains required before any future production runtime switch, writer wiring, feature-flag enablement, or default runtime path change.

## Final answer

`CYLINDER/code8` straight-pipe evidence is `candidateReady` only inside this proof/audit boundary.

Production runtime path changed: no.

Production writer changed: no.

Runtime switch implemented: no.

Agent 00 approval still required: yes.
