import assert from 'node:assert/strict';
import { buildNewCoreValveRuntimePilotPlan, validateNewCoreValveRuntimePilotPlan } from '../../src/runtime-pilot/new-core-valve-runtime-pilot.js';

const validOptions = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true };
const invalidOptions = [undefined, {}, { ...validOptions, enabled: false }, { ...validOptions, mode: 'bad' }, { ...validOptions, scope: 'bad' }, { ...validOptions, writeArtifact: false }, { ...validOptions, writeAtt: false }, { ...validOptions, deterministicValveOnly: false }, { ...validOptions, browser: true }, { ...validOptions, canvas: true }, { ...validOptions, download: true }, { ...validOptions, objectUrl: true }];

for (const options of invalidOptions) assert.equal(buildNewCoreValveRuntimePilotPlan(exportModels(), options).subsetReady, false);

for (const badValve of [
  valve({ lengthMm: undefined }),
  valve({ bodyRadiusMm: undefined }),
  valve({ axis: [0, 2, 0] }),
  valve({ fallbackUsed: true }),
  valve({ guessedDimension: true }),
  valve({ sourceItemId: '' })
]) {
  const plan = buildNewCoreValveRuntimePilotPlan(exportModels([badValve]), validOptions);
  assert.equal(plan.plannedValveBodyCount, 0);
  assert.equal(plan.blockedValveCount, 1);
}

const deterministicPlan = buildNewCoreValveRuntimePilotPlan(exportModels([valve()]), validOptions);
assert.equal(deterministicPlan.schema, 'NewCorePipeBendFlangeValveRuntimePilotPlan.v1');
assert.equal(deterministicPlan.subsetReady, true);
assert.equal(deterministicPlan.fullModelReady, false);
assert.equal(deterministicPlan.plannedCylinderCount, 1);
assert.equal(deterministicPlan.plannedTorusCount, 1);
assert.equal(deterministicPlan.plannedFlangeCylinderCount, 1);
assert.equal(deterministicPlan.plannedValveBodyCount, 1);
assert.equal(deterministicPlan.generatedValveCount, 1);
assert.equal(deterministicPlan.blockedValveCount, 0);
assert.equal(deterministicPlan.plannedRvmPrimitiveCount, 4);
assert.equal(deterministicPlan.plannedAttRowCount, 4);
assert.equal(deterministicPlan.attRowsMatchRvmPrimitives, true);
assert.equal(deterministicPlan.deterministicValveOnly, true);
assert.equal(deterministicPlan.valveFallbackCount, 0);
assert.equal(deterministicPlan.guessedValveDimensionCount, 0);
assert.equal(deterministicPlan.productionWriterModified, false);
assert.equal(deterministicPlan.productionAttWriterModified, false);
assert.equal(deterministicPlan.browserTouched, false);
assert.equal(validateNewCoreValveRuntimePilotPlan(deterministicPlan).ok, true);
assert.equal(validateNewCoreValveRuntimePilotPlan({ ...deterministicPlan, attRows: deterministicPlan.attRows.slice(1), plannedAttRowCount: 3 }).ok, false);

console.log('new-core valve runtime pilot unit test passed');

function exportModels(valves = [valve()]) {
  return { rvmExportModel: rvmWith([cylinder()], [torus()], [flange()], valves), attExportModel: { schema: 'AttExportModel.v1', graphId: 'unit-pbfv', units: 'mm', records: [{ recordId: 'ATT-PIPE-1', sourceItemId: 'PIPE-1', exportStatus: 'recordPlanned' }], blockedRecords: [], deferredRecords: [], sourceRefs: [] } };
}

function rvmWith(cylinders, toruses, flanges, valves) {
  return { schema: 'RvmExportModel.v1', graphId: 'unit-pbfv', units: 'mm', sourceAxisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: cylinders, testByteEligiblePrimitives: toruses, flangeTestByteEligiblePrimitives: flanges, blockedExports: valves, deferredExports: [], sourceRefs: [] };
}

function cylinder(overrides = {}) {
  return { exportPrimitiveId: 'RVM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 1000, radiusMm: 57.15, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'unit/PIPE-1', ...overrides };
}

function torus(overrides = {}) {
  return { exportPrimitiveId: 'RVM-BEND-1', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 0, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 150, tubeRadiusMm: 57.15, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', sourceRef: 'unit/BEND-1', ...overrides };
}

function flange(overrides = {}) {
  return { exportPrimitiveId: 'RVM-FLANGE-1', sourcePrimitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, family: 'flange', center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 50, outerRadiusMm: 100, boreRadiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', catalogueItemId: 'flange', catalogueRef: 'flange', sourceRef: 'unit/FLANGE-1', ...overrides };
}

function valve(overrides = {}) {
  return { exportPrimitiveId: 'RVM-VALVE-1', sourcePrimitiveId: 'PRIM-VALVE-1', sourceItemId: 'VALVE-1', primitiveKind: 'VALVE_BODY_CYLINDER', primitiveCode: 8, family: 'valve', center: [0, 100, 0], axis: [0, 1, 0], lengthMm: 180, bodyRadiusMm: 90, boreRadiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, catalogueItemId: 'valve-catalogue-1', dimensionSource: 'unit-explicit-valve-body', writerReady: false, deterministicGeometry: true, fallbackUsed: false, sourceRef: 'unit/VALVE-1', exportStatus: 'blocked', reason: 'complete deterministic valve body supplied for runtime pilot', ...overrides };
}
