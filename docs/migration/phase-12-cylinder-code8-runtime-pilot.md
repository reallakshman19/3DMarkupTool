# Phase 12 - CYLINDER/code8 guarded runtime export pilot

## Status

This phase is the first controlled runtime/export pilot for the new-core path.

It is explicit opt-in only. It does not enable the new-core runtime path by default and does not change the existing browser/app export path.

## Product movement

This phase adds an executable Node command that generates a real RVM subset artifact from the new-core pipeline:

```bash
npm run artifact:new-core-cylinder-runtime-pilot -- --fixture=bm-cii --outdir=artifacts/new-core-cylinder-runtime-pilot
```

The command writes:

```text
BM_CII_cylinder_code8_runtime_pilot.rvm
BM_CII_cylinder_code8_runtime_pilot.audit.json
```

Generated `.rvm` artifacts are local outputs only and must not be committed.

## Pipeline

```text
Managed/Staged JSON or new-core pipeline fixture
-> PlantModelGraph.v1
-> catalogue binding
-> ResolvedGeometryModel.v1
-> ResolvedPrimitiveModel.v1
-> RvmExportModel.v1
-> CYLINDER/code8-only guarded runtime pilot
-> real RVM subset artifact bytes
-> runtime pilot audit JSON
```

`PlantModelGraph.v1` remains the engineering source-of-truth.

Managed/staged JSON child identity remains source-import evidence only.

`ElementRvmLedger.v1` remains downstream trace/readiness evidence only.

`RvmExportModel.v1` remains the runtime-pilot boundary.

## Explicit gate

The runtime pilot fails closed unless all of these are provided:

```js
{
  enabled: true,
  mode: "explicit-runtime-pilot",
  scope: "cylinder-code8-subset",
  allowPartialModel: true,
  writeArtifact: true
}
```

The pilot rejects browser, runtime-route, canvas, download, object URL, DOM, UI, and app-mutation options.

## Scope

This phase may generate only straight-pipe `CYLINDER/code8` subset bytes.

Bends, flanges, valves, and supports are excluded from runtime artifact generation in this phase.

- TORUS remains test-byte proof only.
- Flanges remain Phase 11C-B test-byte proof only.
- Valves remain blocked.
- Supports remain deferred.
- ATT remains separate.
- GLB remains separate and visual/preview only.

Full RVM readiness remains false while valves/supports are unresolved/deferred.

## Safety boundaries

This phase does not touch production writer/browser/UI/canvas/download/object URL behavior.

This phase does not modify:

```text
src/rvm-writer.js
src/att-writer.js
src/app.js
src/main.js
src/app-loader.js
src/safe-ui-loader.js
src/managed-stage-rvm-converter.js
src/managed-stage-json-ui-controller.js
src/rvm-converter.js
src/rvm-preview.js
index.html
```

No fallback cube, box, sphere, pyramid, valve placeholder, or support placeholder is introduced.

Unsupported primitives are excluded with audit counts. They are not silently downgraded.

## Audit pass condition

The runtime pilot audit may pass only when:

```text
explicit options are valid
RvmExportModel.v1 is valid
at least one CYLINDER/code8 primitive is selected
selected cylinders are final-review transformed to navis-review basis
artifact bytes are generated
all decoded primitives are CYLINDER/code8
no TORUS, FLANGE_CYLINDER, valve, support, box, sphere, or pyramid is generated
productionReadyTorusCount = 0
productionReadyFlangeCount = 0
fullModelReady = false
no browser/canvas/object URL/download/runtime route/app mutation occurs
```

## BM_CII expected state

```text
plannedCylinderCount = 19
decodedCylinderCount = 19
decodedPrimitiveCount = 19
excludedTorusCount = 7
excludedFlangeCount = 8
blockedValveCount = 6
deferredSupportCount = 12
fullModelReady = false
subsetReady = true
```
