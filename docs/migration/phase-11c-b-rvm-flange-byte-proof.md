# Phase 11C-B - RVM flange test-only byte proof

## Decision status

This phase is a test-only byte proof rebuild from current `main`.

PR #480 is superseded and is used only as design reference. This phase does not reuse the old PR branch.

This phase does not implement a runtime switch, does not authorize a runtime switch, and does not change production writer/runtime/canvas/UI/export behavior.

`PlantModelGraph.v1` remains the engineering source-of-truth. `ElementRvmLedger.v1`, managed/staged JSON child identity, byte proofs, writer chunks, export rows, previews, ATT export models, and GLB visual models remain downstream evidence only.

## Purpose

Phase 11C-B proves that already-resolved catalogue-backed `FLANGE_CYLINDER` flange body primitives can be serialized as RVM code-8 cylinder PRIM records through an isolated test-only bridge.

The proof is metadata/audit-facing only. It is not a production RVM artifact, not a browser-visible file, and not a runtime writer integration.

## Pipeline boundary

The valid test-only pipeline is:

```text
ResolvedPrimitiveModel.v1
-> RvmExportModel.v1
-> writer adapter dry-run/test-byte metadata
-> test artifact adapter
-> isolated flange byte bridge
-> RvmTestArtifactByteProof.v1 metadata/audit
-> diagnostic/controlled-preview status only
```

`RvmExportModel.v1` remains an adapter/dry-run/test-byte boundary until separate production approval.

## Separate primitive lanes

The RVM export model keeps the primitive lanes separate:

```text
rvmExportModel.primitives
  -> straight pipe CYLINDER/code8 only

rvmExportModel.testByteEligiblePrimitives
  -> bend TORUS/code4 only

rvmExportModel.flangeTestByteEligiblePrimitives
  -> flange FLANGE_CYLINDER/code8 only
```

`FLANGE_CYLINDER/code8` must not enter `rvmExportModel.primitives`.

`FLANGE_CYLINDER/code8` is not pipe cylinder readiness. The byte-level code is 8, but the engineering family remains flange.

## Flange test-byte eligibility

A flange body can enter `flangeTestByteEligiblePrimitives` only when it has:

- `primitiveKind: "FLANGE_CYLINDER"`;
- `primitiveCode: 8`;
- `family: "flange"`;
- `resolver: "flangeCylinderPrimitive.v1"`;
- `geometryStatus: "primitiveResolved"`;
- `basis: "navis-review"`;
- `transformPolicy: "final-review-transform.v1"`;
- `transformApplied: true`;
- finite center;
- normalized finite axis;
- positive `lengthMm`, `outerRadiusMm`, and `boreRadiusMm`;
- `outerRadiusMm > boreRadiusMm`;
- `writerReady: false`;
- `testByteEligible: true`;
- `byteBridge: "test-only-phase-11c-b"`;
- catalogue identity and catalogue reference;
- source trace/reference;
- no fallback evidence.

## Byte proof aggregation

The byte proof is segmented:

```js
writerBridge: "composite-pipe-bend-flange-test-byte-proof.v1"
writerBridges: [
  "src/artifact-adapters/rvm-code4-torus-test-byte-writer.js",
  "src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js"
]
artifactSegments: [
  { segmentKind: "pipe-bend" },
  { segmentKind: "flange" }
]
```

The audit keeps pipe and flange code-8 counts separate:

```text
decodedCylinderCount = decodedPipeCylinderCount + decodedFlangeCylinderCount
decodedPipeCylinderCount = 19
decodedFlangeCylinderCount = 8
decodedTorusCount = 7
```

## Expected BM_CII state

The BM_CII proof locks this state:

```text
19 pipe CYLINDER/code8 byte-proven
7 bend TORUS/code4 byte-proven
8 flange body FLANGE_CYLINDER/code8 byte-proven through isolated flange bridge
6 valves blocked
12 supports deferred
full RVM readiness false
ATT blocked
GLB blocked
productionReadyFlangeCount = 0
flangeWriterReadyCount = 0
writerCallCount = 0 at production boundary
no runtime/canvas/browser/object URL/download behavior
```

## Safety boundaries

This phase does not modify `src/rvm-writer.js` or `src/att-writer.js`.

This phase does not change:

- production RVM writer behavior;
- production ATT writer behavior;
- runtime switch behavior;
- converter routing;
- app or loader behavior;
- canvas or Three.js geometry generation;
- browser download links;
- object URLs;
- GLB writer/export behavior;
- valve solving;
- support solving.

No `.rvm` binary file is committed.

No fallback cube, box, sphere, pyramid, valve placeholder, or support placeholder is introduced.

## Production readiness

`FLANGE_CYLINDER/code8` remains production-writer deferred.

`flangeWriterReadyCount` remains zero.

`productionReadyFlangeCount` remains zero.

The flange subset can be `flangeSubsetTestByteReady: true` only as isolated test-byte proof readiness.

Full RVM readiness remains false because valves are blocked and supports are deferred. ATT and GLB remain separate blocked/deferred boundaries for this phase.

## Verification note

The Phase 11C-B checks must pass on the latest PR head before merge. A stale or failed workflow result is not sufficient for approval.
