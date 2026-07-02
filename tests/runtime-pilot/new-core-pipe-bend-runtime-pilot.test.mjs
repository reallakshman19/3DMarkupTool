import assert from 'node:assert/strict';
import { buildNewCorePipeBendRuntimePilotPlan, validateNewCorePipeBendRuntimePilotPlan } from '../../src/runtime-pilot/new-core-pipe-bend-runtime-pilot.js';

const validOptions = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true };
const invalidOptions = [{}, { ...validOptions, enabled: false }, { ...validOptions, mode: 'bad' }, { ...validOptions, scope: 'bad' }, { ...validOptions, allowPartialModel: false }, { ...validOptions, writeArtifact: false }, { ...validOptions, browser: true }, { ...validOptions, canvas: true }, { ...validOptions, download: true }, { ...validOptions, objectUrl: true }];

for (const options of invalidOptions) assert.equal(buildNewCorePipeBendRuntimePilotPlan(rvmWith([cylinder()], [torus()]), options).subsetReady, false);
for (const bad of [rvmWith([cylinder()], []), rvmWith([], [torus()]), rvmWith([], [], { flangeTestByteEligiblePrimitives: [flange()] }), rvmWith([cylinder({ evidence: { fallbackUsed: true } })], [torus()]), rvmWith([cylinder()], [torus({ evidence: { fallbackUsed: true } })]), rvmWith([cylinder({ basis: 'authoring' })], [torus()])]) assert.equal(buildNewCorePipeBendRuntimePilotPlan(bad, validOptions).subsetReady, false);

const plan = buildNewCorePipeBendRuntimePilotPlan(rvmWith([cylinder()], [torus()]), validOptions);
assert.equal(plan.schema, 'NewCorePipeBendRuntimePilotPlan.v1');
assert.equal(plan.subsetReady, true);
assert.equal(plan.fullModelReady, false);
assert.equal(plan.plannedCylinderCount, 1);
assert.equal(plan.plannedTorusCount, 1);
assert.equal(plan.productionWriterModified, false);
assert.equal(plan.runtimeRouteModified, false);
assert.equal(plan.browserTouched, false);
assert.equal(plan.canvasTouched, false);
assert.equal(plan.objectUrlCreated, false);
assert.equal(plan.downloadCreated, false);
assert.equal(validateNewCorePipeBendRuntimePilotPlan(plan).ok, true);

console.log('new-core pipe+bend runtime pilot unit test passed');

function rvmWith(cylinders, toruses, extra = {}) { return { schema: 'RvmExportModel.v1', graphId: 'unit-pipe-bend-pilot', units: 'mm', sourceAxisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: cylinders, testByteEligiblePrimitives: toruses, flangeTestByteEligiblePrimitives: [], blockedExports: [], deferredExports: [], sourceRefs: [], ...extra }; }
function cylinder(overrides = {}) { return { exportPrimitiveId: 'RVM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 1000, radiusMm: 57.15, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'unit/PIPE-1', ...overrides }; }
function torus(overrides = {}) { return { exportPrimitiveId: 'RVM-BEND-1', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 0, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 150, tubeRadiusMm: 57.15, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', sourceRef: 'unit/BEND-1', ...overrides }; }
function flange() { return { exportPrimitiveId: 'RVM-FLANGE-1', sourceItemId: 'FLANGE-1', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, family: 'flange', center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 50, outerRadiusMm: 100, boreRadiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', catalogueItemId: 'flange', catalogueRef: 'flange', reason: 'excluded' }; }
