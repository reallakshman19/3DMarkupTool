import assert from 'node:assert/strict';
import { assertNewCoreReadinessAudit, CONTRACT_SCHEMA_SET, validateNewCoreReadinessAudit } from '../../src/contracts/index.js';
import { buildNewCoreReadinessAudit } from '../../src/export-models/new-core-readiness-audit.js';

const input = buildFixture();
const audit = buildNewCoreReadinessAudit(input, { sourceName: 'new-core-readiness-fixture.managed-stage.json' });

assert.equal(CONTRACT_SCHEMA_SET.newCoreReadinessAudit, 'NewCoreReadinessAudit.v1');
assert.equal(audit.ok, true, audit.errors.join('\n'));
assert.equal(assertNewCoreReadinessAudit(audit, { expectedItemIds: input.graph.items.map((item) => item.id) }).ok, true);
assert.equal(audit.traceRows.length, input.graph.items.length);
assert.deepEqual(audit.traceRows.map((traceRow) => traceRow.itemId), input.graph.items.map((item) => item.id));

assertRow(row(audit, 'PIPE-1'), ['proceduralResolved', 'primitiveResolved', 'exportPlanned', 'production-ready']);
assertRow(row(audit, 'BEND-1'), ['catalogueResolved', 'primitiveResolved', 'test-byte-only', 'test-byte-only']);
assertRow(row(audit, 'FLANGE-1'), ['catalogueResolved', 'primitiveResolved', 'deferred', 'deferred']);
assertRow(row(audit, 'SUPPORT-1'), ['supportIntent', 'deferred', 'deferred', 'support-intent-only']);
assert.equal(row(audit, 'UNKNOWN-1').readinessStatus, 'unresolved');

assert.equal(audit.productionReadyCount, 1);
assert.equal(audit.testByteOnlyCount, 1);
assert.equal(audit.deferredCount, 1);
assert.equal(audit.supportIntentOnlyCount, 1);
assert.equal(audit.unresolvedCount, 1);
assert.equal(audit.blockedCount, 0);
assert.equal(audit.rvmExportPrimitiveCount, 1);
assert.equal(audit.rvmDeferredExportCount, 3);
assert.equal(audit.rvmBlockedExportCount, 1);
assert.equal(audit.attRecordCount, 3);
assert.equal(audit.glbVisualCount, 1);

const missingTraceAudit = { ...audit, traceRows: audit.traceRows.slice(0, -1), errors: [], hardErrorCount: 0, ok: true };
const missingTraceValidation = validateNewCoreReadinessAudit(missingTraceAudit, { expectedItemIds: input.graph.items.map((item) => item.id) });
assert.equal(missingTraceValidation.ok, false);

const tainted = buildFixture();
tainted.primitiveModel.primitives[0]['by' + 'tes'] = [1, 2, 3];
const taintedAudit = buildNewCoreReadinessAudit(tainted, { sourceName: 'tainted.managed-stage.json' });
assert.equal(taintedAudit.ok, false);
assert.ok(taintedAudit.errors.some((entry) => entry.includes('writer') && entry.includes('payload')));

const missingPrimitive = buildFixture();
missingPrimitive.primitiveModel.primitives = missingPrimitive.primitiveModel.primitives.filter((primitive) => primitive.sourceItemId !== 'PIPE-1');
const missingPrimitiveAudit = buildNewCoreReadinessAudit(missingPrimitive, { sourceName: 'missing-primitive.managed-stage.json' });
const missingPrimitivePipe = row(missingPrimitiveAudit, 'PIPE-1');
assert.equal(missingPrimitivePipe.rvmExportStatus, 'exportPlanned');
assert.equal(missingPrimitivePipe.primitiveStatus, 'missing');
assert.equal(missingPrimitivePipe.readinessStatus, 'blocked');
assert.equal(missingPrimitiveAudit.productionReadyCount, 0);
assert.equal(missingPrimitiveAudit.blockedCount, 1);

console.log('new-core readiness audit tests passed');

await import('./new-core-readiness-pipeline-smoke.test.mjs');

function assertRow(traceRow, expected) {
  assert.equal(traceRow.bindingStatus, expected[0]);
  assert.equal(traceRow.primitiveStatus, expected[1]);
  assert.equal(traceRow.rvmExportStatus, expected[2]);
  assert.equal(traceRow.readinessStatus, expected[3]);
}

function row(auditValue, itemId) {
  const found = auditValue.traceRows.find((entry) => entry.itemId === itemId);
  assert.ok(found, `missing trace row for ${itemId}`);
  return found;
}

function buildFixture() {
  const sourceRefs = [{ sourceType: 'managed-stage-json', name: 'new-core-readiness-fixture.managed-stage.json' }];
  const graph = graphFixture(sourceRefs);
  return {
    graph,
    bindingAudit: bindingAuditFor(graph),
    resolvedGeometry: geometryFor(graph, sourceRefs),
    primitiveModel: primitivesFor(graph, sourceRefs),
    rvmExportModel: rvmFor(graph, sourceRefs),
    attExportModel: attFor(graph, sourceRefs),
    glbVisualModel: glbFor(graph, sourceRefs)
  };
}

function graphFixture(sourceRefs) {
  return {
    schema: 'PlantModelGraph.v1',
    id: 'NEW-CORE-FIXTURE',
    project: { name: 'New Core Fixture', units: 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' } },
    catalogues: [{ id: 'base-piping', version: '0.1.0' }],
    nodes: [{ id: 'N1', coord: [0, 0, 0] }, { id: 'N2', coord: [1000, 0, 0] }, { id: 'N3', coord: [1000, 1000, 0] }],
    routes: [{ id: 'R-PIPE', from: 'N1', to: 'N2', bore: 100, schedule: 6.02 }, { id: 'R-BEND', from: 'N2', to: 'N3', bore: 100, schedule: 6.02 }],
    items: [
      { id: 'PIPE-1', kind: 'generated', generator: 'straightPipe.v1', route: 'R-PIPE', sourceRef: 'SRC-PIPE-1' },
      { id: 'BEND-1', kind: 'component', tagged: true, family: 'elbow', type: 'bend', route: 'R-BEND', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, sourceRef: 'SRC-BEND-1' },
      { id: 'FLANGE-1', kind: 'component', tagged: true, family: 'flange', type: 'weld-neck', route: 'R-BEND', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, sourceRef: 'SRC-FLANGE-1' },
      { id: 'SUPPORT-1', kind: 'support', tagged: false, node: 'N2', supportFamily: 'GUIDE', sourceRef: 'SRC-SUPPORT-1' },
      { id: 'UNKNOWN-1', kind: 'component', tagged: false, family: 'valve', type: 'unknown', route: 'R-BEND', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };
}

function bindingAuditFor(graph) {
  return { schema: 'CatalogueBindingAudit.v1', graphId: graph.id, itemCount: 5, catalogueResolvedCount: 2, proceduralResolvedCount: 1, fallbackBlockedCount: 0, unresolvedCount: 1, supportIntentCount: 1, nearestMatchCount: 0, exportDecisionCount: 0, bindings: [binding('PIPE-1', 'generated', 'proceduralResolved', 'pipe', 'straight'), binding('BEND-1', 'component', 'catalogueResolved', 'elbow', 'bend', 'CAT-BEND'), binding('FLANGE-1', 'component', 'catalogueResolved', 'flange', 'weld-neck', 'CAT-FLANGE'), binding('SUPPORT-1', 'support', 'supportIntent', 'support', 'GUIDE'), binding('UNKNOWN-1', 'component', 'unresolved', 'valve', 'unknown')] };
}

function geometryFor(graph, sourceRefs) {
  return { schema: 'ResolvedGeometryModel.v1', graphId: graph.id, units: 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }, nodes: graph.nodes, routeFrames: [], itemFrames: [{ itemId: 'PIPE-1', geometryStatus: 'resolved', sourceRef: 'SRC-PIPE-1' }, { itemId: 'BEND-1', geometryStatus: 'resolved', sourceRef: 'SRC-BEND-1' }, { itemId: 'FLANGE-1', geometryStatus: 'resolved', sourceRef: 'SRC-FLANGE-1' }], supportPlacements: [{ itemId: 'SUPPORT-1', geometryStatus: 'intentOnly', sourceRef: 'SRC-SUPPORT-1' }], unresolvedGeometry: [{ itemId: 'UNKNOWN-1', geometryStatus: 'blocked', reason: 'no deterministic resolver', sourceRef: 'SRC-UNKNOWN-1' }], sourceRefs };
}

function primitivesFor(graph, sourceRefs) {
  return { schema: 'ResolvedPrimitiveModel.v1', graphId: graph.id, sourceGraphId: graph.id, sourceGeometryId: graph.id, units: 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }, items: graph.items.map((item) => ({ id: item.id, sourceGraphItemId: item.id, resolutionMode: 'test', sourceRef: item.sourceRef })), primitives: [pipePrimitive(), bendPrimitive(), flangePrimitive()], deferredPrimitives: [{ sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', geometryStatus: 'deferred', reason: 'support deferred', sourceRef: 'SRC-SUPPORT-1' }], blockedPrimitives: [{ sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', geometryStatus: 'blocked', reason: 'unresolved geometry', sourceRef: 'SRC-UNKNOWN-1' }], sourceRefs };
}

function rvmFor(graph, sourceRefs) {
  return { schema: 'RvmExportModel.v1', graphId: graph.id, units: 'mm', sourceAxisBasis: { authoring: 'authoring' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: [{ exportPrimitiveId: 'RVM-PIPE', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, sourceRef: 'SRC-PIPE-1' }], testByteEligiblePrimitives: [{ exportPrimitiveId: 'RVM-BEND', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [0, 0, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', reason: 'TORUS/code4 test-byte-only', sourceRef: 'SRC-BEND-1' }], deferredExports: [{ sourceItemId: 'BEND-1', primitiveKind: 'TORUS', exportStatus: 'deferred', testByteEligible: true, reason: 'TORUS/code4 test-byte-only', sourceRef: 'SRC-BEND-1' }, { sourceItemId: 'FLANGE-1', family: 'flange', primitiveKind: 'FLANGE_CYLINDER', exportStatus: 'deferred', reason: 'FLANGE_CYLINDER/code8 writer bridge not implemented', sourceRef: 'SRC-FLANGE-1' }, { sourceItemId: 'SUPPORT-1', family: 'support', exportStatus: 'deferred', reason: 'support deferred', sourceRef: 'SRC-SUPPORT-1' }], blockedExports: [{ sourceItemId: 'UNKNOWN-1', family: 'valve', exportStatus: 'blocked', reason: 'unresolved geometry', sourceRef: 'SRC-UNKNOWN-1' }], sourceRefs };
}

function attFor(graph, sourceRefs) {
  return { schema: 'AttExportModel.v1', graphId: graph.id, units: 'mm', records: ['PIPE-1', 'BEND-1', 'FLANGE-1'].map((id) => ({ recordId: `ATT-${id}`, sourceItemId: id, exportStatus: 'recordPlanned', sourceRef: `SRC-${id}` })), deferredRecords: [{ sourceItemId: 'SUPPORT-1', recordStatus: 'deferred', reason: 'support ATT deferred' }], blockedRecords: [{ sourceItemId: 'UNKNOWN-1', recordStatus: 'blocked', reason: 'unresolved ATT' }], sourceRefs };
}

function glbFor(graph, sourceRefs) {
  return { schema: 'GlbVisualModel.v1', graphId: graph.id, units: 'mm', sourceAxisBasis: { authoring: 'canvas-current' }, visualItems: [{ visualItemId: 'GLB-PIPE-1', sourceItemId: 'PIPE-1', visualKind: 'cylinder', visualStatus: 'visualPlanned', sourceRef: 'SRC-PIPE-1' }], deferredVisuals: [{ sourceItemId: 'BEND-1', visualStatus: 'deferred', reason: 'bend GLB deferred' }, { sourceItemId: 'FLANGE-1', visualStatus: 'deferred', reason: 'flange GLB deferred' }, { sourceItemId: 'SUPPORT-1', visualStatus: 'deferred', reason: 'support GLB deferred' }], blockedVisuals: [{ sourceItemId: 'UNKNOWN-1', visualStatus: 'blocked', reason: 'unresolved GLB' }], sourceRefs };
}

function binding(itemId, itemKind, status, family, type, catalogueItemId) { return { itemId, itemKind, sourceRef: `SRC-${itemId}`, status, family, type, catalogueItemId, catalogueRef: catalogueItemId ? { catalogue: 'base-piping', family, type } : undefined, reason: status }; }
function pipePrimitive() { return { primitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'authoring', resolver: 'straightPipeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', sourceRef: 'SRC-PIPE-1' }; }
function bendPrimitive() { return { primitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [0, 0, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'authoring', resolver: 'bendArcTorusPrimitive.v1', geometryStatus: 'primitiveResolved', family: 'elbow', type: 'bend', catalogueItemId: 'CAT-BEND', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, sourceRef: 'SRC-BEND-1' }; }
function flangePrimitive() { return { primitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', family: 'flange', type: 'weld-neck', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [1, 0, 0], lengthMm: 200, boreRadiusMm: 50, outerRadiusMm: 90, basis: 'authoring', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', catalogueItemId: 'CAT-FLANGE', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, sourceRef: 'SRC-FLANGE-1', evidence: { fallbackUsed: false } }; }
