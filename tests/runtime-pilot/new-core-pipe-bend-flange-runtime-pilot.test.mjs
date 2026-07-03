import assert from 'node:assert/strict';
import { buildNewCorePipeBendFlangeRuntimePilotPlan, validateNewCorePipeBendFlangeRuntimePilotPlan } from '../../src/runtime-pilot/new-core-pipe-bend-flange-runtime-pilot.js';

const validOptions = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true };
const invalidOptions = [{}, { ...validOptions, enabled: false }, { ...validOptions, mode: 'bad' }, { ...validOptions, scope: 'bad' }, { ...validOptions, allowPartialModel: false }, { ...validOptions, writeArtifact: false }, { ...validOptions, writeAtt: false }, { ...validOptions, browser: true }, { ...validOptions, canvas: true }, { ...validOptions, download: true }, { ...validOptions, objectUrl: true }];
for (const options of invalidOptions) assert.equal(buildNewCorePipeBendFlangeRuntimePilotPlan(exportModels(), options).subsetReady, false);
for (const bad of [rvmWith([cylinder()], [], []), rvmWith([], [torus()], []), rvmWith([], [], [flange()]), rvmWith([cylinder()], [torus()], []), rvmWith([cylinder()], [], [flange()]), rvmWith([cylinder({ evidence: { fallbackUsed: true } })], [torus()], [flange()]), rvmWith([cylinder()], [torus({ evidence: { fallbackUsed: true } })], [flange()]), rvmWith([cylinder()], [torus()], [flange({ evidence: { fallbackUsed: true } })]), rvmWith([cylinder({ basis: 'authoring' })], [torus()], [flange()])]) assert.equal(buildNewCorePipeBendFlangeRuntimePilotPlan(bad, validOptions).subsetReady, false);

const plan = buildNewCorePipeBendFlangeRuntimePilotPlan(exportModels(), validOptions);
assert.equal(plan.schema, 'NewCorePipeBendFlangeRuntimePilotPlan.v1');
assert.equal(plan.subsetReady, true);
assert.equal(plan.fullModelReady, false);
assert.equal(plan.plannedCylinderCount, 1);
assert.equal(plan.plannedTorusCount, 1);
assert.equal(plan.plannedFlangeCylinderCount, 1);
assert.equal(plan.plannedRvmPrimitiveCount, 3);
assert.equal(plan.plannedAttRowCount, 3);
assert.equal(plan.attRowsMatchRvmPrimitives, true);
assert.equal(plan.productionWriterModified, false);
assert.equal(plan.productionAttWriterModified, false);
assert.equal(plan.browserTouched, false);
assert.equal(validateNewCorePipeBendFlangeRuntimePilotPlan(plan).ok, true);
assert.equal(validateNewCorePipeBendFlangeRuntimePilotPlan({ ...plan, attRows: plan.attRows.slice(1), plannedAttRowCount: 2 }).ok, false, 'ATT row mismatch fails validation');

console.log('new-core pipe+bend+flange runtime pilot unit test passed');

function exportModels() { return { rvmExportModel: rvmWith([cylinder()], [torus()], [flange()]), attExportModel: { schema: 'AttExportModel.v1', graphId: 'unit-pbf', units: 'mm', records: [{ recordId: 'ATT-PIPE-1', sourceItemId: 'PIPE-1', exportStatus: 'recordPlanned' }], blockedRecords: [], deferredRecords: [], sourceRefs: [] } }; }
function rvmWith(cylinders, toruses, flanges) { return { schema: 'RvmExportModel.v1', graphId: 'unit-pbf', units: 'mm', sourceAxisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: cylinders, testByteEligiblePrimitives: toruses, flangeTestByteEligiblePrimitives: flanges, blockedExports: [], deferredExports: [], sourceRefs: [] }; }
function cylinder(overrides = {}) { return { exportPrimitiveId: 'RVM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 1000, radiusMm: 57.15, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'unit/PIPE-1', ...overrides }; }
function torus(overrides = {}) { return { exportPrimitiveId: 'RVM-BEND-1', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 0, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 150, tubeRadiusMm: 57.15, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', sourceRef: 'unit/BEND-1', ...overrides }; }
function flange(overrides = {}) { return { exportPrimitiveId: 'RVM-FLANGE-1', sourcePrimitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, family: 'flange', center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 50, outerRadiusMm: 100, boreRadiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', catalogueItemId: 'flange', catalogueRef: 'flange', sourceRef: 'unit/FLANGE-1', ...overrides }; }
