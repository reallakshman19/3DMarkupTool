import assert from 'node:assert/strict';
import { buildNewCoreSupportMarkerRuntimePilotPlan, validateNewCoreSupportMarkerRuntimePilotPlan } from '../../src/runtime-pilot/new-core-support-marker-runtime-pilot.js';

const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-support-marker-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true };

const plan = buildNewCoreSupportMarkerRuntimePilotPlan(inputWithSupport({ itemId: 'SUPPORT-1', position: [10, 20, 30], axis: '+Y', supportFamily: 'REST', sourceRef: 'SUPPORT-1' }), options);
assert.equal(plan.schema, 'NewCoreSupportMarkerRuntimePilotPlan.v1');
assert.equal(plan.subsetReady, true);
assert.equal(plan.fullModelReady, true);
assert.equal(plan.supportMarkerCount, 1);
assert.equal(plan.blockedSupportMarkerCount, 0);
assert.equal(plan.supportGeometryGenerated, true);
assert.equal(plan.supportPrimitiveCount, 6);
assert.equal(plan.supportCylinderPrimitiveCount, 5);
assert.equal(plan.supportSpherePrimitiveCount, 1);
assert.equal(plan.supportFallbackCount, 0);
assert.equal(plan.plannedRvmPrimitiveCount, 9);
assert.equal(plan.plannedAttRowCount, 9);
assert.equal(plan.attRowsMatchRvmPrimitives, true);
assert.equal(plan.supportMarkers[0].markerKind, 'SUPPORT_PLACEMENT_MARKER');
assert.equal(plan.supportMarkers[0].deterministicPlacement, true);
assert.equal(plan.supportMarkers[0].rvmGeometryGenerated, true);
assert.equal(validateNewCoreSupportMarkerRuntimePilotPlan(plan).ok, true);

const blocked = buildNewCoreSupportMarkerRuntimePilotPlan(inputWithSupport({ itemId: 'SUPPORT-2', axis: '+Y' }), options);
assert.equal(blocked.supportMarkerCount, 0);
assert.equal(blocked.blockedSupportMarkerCount, 1);
assert.equal(blocked.subsetReady, false);
assert.equal(blocked.supportGeometryGenerated, false);

const invalid = buildNewCoreSupportMarkerRuntimePilotPlan(inputWithSupport({ itemId: 'SUPPORT-3', position: [1, 2, 3] }), { ...options, includeSupportMarkers: false });
assert.equal(invalid.subsetReady, false);

console.log('new-core support marker runtime pilot unit test passed');

function inputWithSupport(support) {
  return { exportModels: { rvmExportModel: rvmModel(), attExportModel: attModel() }, resolvedGeometry: { supportPlacements: [support] } };
}

function rvmModel() {
  return { schema: 'RvmExportModel.v1', graphId: 'unit-support', units: 'mm', sourceAxisBasis: { authoring: 'canvas-current' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: [cylinder()], testByteEligiblePrimitives: [torus()], flangeTestByteEligiblePrimitives: [flange()], blockedExports: [], deferredExports: [], sourceRefs: [] };
}

function attModel() {
  return { schema: 'AttExportModel.v1', graphId: 'unit-support', units: 'mm', records: [{ recordId: 'ATT-PIPE-1', sourceItemId: 'PIPE-1', resolutionMode: 'procedural', exportStatus: 'recordPlanned' }], blockedRecords: [], deferredRecords: [], sourceRefs: [] };
}

function cylinder() {
  return { exportPrimitiveId: 'RVM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 1000, radiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1' };
}

function torus() {
  return { exportPrimitiveId: 'RVM-BEND-1', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [0, 0, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 100, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1' };
}

function flange() {
  return { exportPrimitiveId: 'RVM-FLANGE-1', sourcePrimitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, family: 'flange', center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 50, outerRadiusMm: 90, boreRadiusMm: 45, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', catalogueItemId: 'flange', catalogueRef: 'flange' };
}
