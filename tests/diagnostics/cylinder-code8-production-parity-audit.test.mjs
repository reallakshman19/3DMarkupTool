import assert from 'node:assert/strict';
import { buildCylinderCode8ProductionParityAudit, assertCylinderCode8ProductionParityAudit } from '../../src/diagnostics/cylinder-code8-production-parity-audit.js';

const graphId = 'BM_CII_GRAPH_SEED';

const valid = buildCylinderCode8ProductionParityAudit(baseInput());
assert.equal(valid.schema, 'CylinderCode8ProductionParityAudit.v1');
assert.equal(valid.ok, true, valid.errors.join('; '));
assert.equal(valid.candidateReady, true);
assert.equal(valid.cylinderCount, 2);
assert.equal(valid.nonCylinderCount, 0);
assert.equal(valid.productionRuntimeChanged, false);
assert.equal(valid.productionWriterChanged, false);
assert.equal(valid.runtimeSwitchImplemented, false);
assert.equal(valid.rvmExportModelPromotedToSource, false);
assert.equal(assertCylinderCode8ProductionParityAudit(valid).ok, true);

const withTorusExcluded = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [torus('blocked')]
}));
assert.equal(withTorusExcluded.ok, true, withTorusExcluded.errors.join('; '));
assert.equal(withTorusExcluded.candidateReady, true);
assert.equal(withTorusExcluded.torusCount, 1);
assert.equal(withTorusExcluded.unsupportedPrimitiveCount, 0, 'TORUS/code4 remains excluded from candidate subset');

const withTorusCandidate = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [torus('candidate')]
}));
assert.equal(withTorusCandidate.ok, false);
assert.equal(withTorusCandidate.candidateReady, false);
assert.match(withTorusCandidate.errors.join('; '), /TORUS\/code4 is included in the candidate subset/);

const withFlangeExcluded = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [flange('blocked')]
}));
assert.equal(withFlangeExcluded.ok, true, withFlangeExcluded.errors.join('; '));
assert.equal(withFlangeExcluded.candidateReady, true);
assert.equal(withFlangeExcluded.flangeCount, 1);
assert.equal(withFlangeExcluded.unsupportedPrimitiveCount, 0, 'FLANGE_CYLINDER/code8 remains excluded from candidate subset');

const withFlangeCandidate = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [flange('candidate')]
}));
assert.equal(withFlangeCandidate.ok, false);
assert.equal(withFlangeCandidate.candidateReady, false);
assert.match(withFlangeCandidate.errors.join('; '), /FLANGE_CYLINDER\/code8 is included in the candidate subset/);

const withBlockedValve = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [valve('blocked')]
}));
assert.equal(withBlockedValve.ok, true, withBlockedValve.errors.join('; '));
assert.equal(withBlockedValve.valveCount, 1);
assert.equal(withBlockedValve.blockedCount, 1);
assert.equal(withBlockedValve.candidateReady, true);

const withReadyValve = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [valve('candidate')]
}));
assert.equal(withReadyValve.ok, false);
assert.equal(withReadyValve.candidateReady, false);
assert.match(withReadyValve.errors.join('; '), /valves are silently treated as ready/);

const withDeferredSupport = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [support('deferred')]
}));
assert.equal(withDeferredSupport.ok, true, withDeferredSupport.errors.join('; '));
assert.equal(withDeferredSupport.supportCount, 1);
assert.equal(withDeferredSupport.deferredCount, 1);
assert.equal(withDeferredSupport.candidateReady, true);

const withReadySupport = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [support('candidate')]
}));
assert.equal(withReadySupport.ok, false);
assert.equal(withReadySupport.candidateReady, false);
assert.match(withReadySupport.errors.join('; '), /supports are silently treated as ready/);

const missingTransformPolicy = buildCylinderCode8ProductionParityAudit(baseInput({ omitTransformPolicy: true }));
assert.equal(missingTransformPolicy.ok, false);
assert.equal(missingTransformPolicy.candidateReady, false);
assert.equal(missingTransformPolicy.transformPolicyOk, false);
assert.match(missingTransformPolicy.errors.join('; '), /transform policy is missing/);

const missingSourceTrace = buildCylinderCode8ProductionParityAudit(baseInput({ omitSourceTrace: true }));
assert.equal(missingSourceTrace.ok, false);
assert.equal(missingSourceTrace.candidateReady, false);
assert.equal(missingSourceTrace.sourceTraceOk, false);
assert.match(missingSourceTrace.errors.join('; '), /source trace is incomplete/);

const runtimeFileChanged = buildCylinderCode8ProductionParityAudit(baseInput({
  changedFiles: ['src/app.js']
}));
assert.equal(runtimeFileChanged.ok, false);
assert.equal(runtimeFileChanged.productionRuntimeChanged, true);
assert.equal(runtimeFileChanged.candidateReady, false);
assert.match(runtimeFileChanged.errors.join('; '), /production runtime files changed/);

const writerFileChanged = buildCylinderCode8ProductionParityAudit(baseInput({
  changedFiles: ['src/rvm-writer.js']
}));
assert.equal(writerFileChanged.ok, false);
assert.equal(writerFileChanged.productionWriterChanged, true);
assert.equal(writerFileChanged.candidateReady, false);
assert.match(writerFileChanged.errors.join('; '), /production writer files changed/);

const promotedRvmExportModel = buildCylinderCode8ProductionParityAudit(baseInput({
  sourceOfTruth: 'RvmExportModel.v1'
}));
assert.equal(promotedRvmExportModel.ok, false);
assert.equal(promotedRvmExportModel.rvmExportModelPromotedToSource, true);
assert.equal(promotedRvmExportModel.candidateReady, false);
assert.match(promotedRvmExportModel.errors.join('; '), /RvmExportModel\.v1 must remain downstream evidence/);

const switchImplemented = buildCylinderCode8ProductionParityAudit(baseInput({
  runtimeSwitchImplemented: true
}));
assert.equal(switchImplemented.ok, false);
assert.equal(switchImplemented.runtimeSwitchImplemented, true);
assert.equal(switchImplemented.candidateReady, false);
assert.match(switchImplemented.errors.join('; '), /runtime switch implementation detected/);

const fallbackSubstitution = buildCylinderCode8ProductionParityAudit(baseInput({
  extraPrimitives: [{ primitiveKind: 'BOX', primitiveCode: 8, status: 'blocked', fallback: true, sourceItemId: 'FALLBACK-1', sourceTrace: trace('FALLBACK-1') }]
}));
assert.equal(fallbackSubstitution.ok, false);
assert.equal(fallbackSubstitution.fallbackSubstitutionCount, 1);
assert.equal(fallbackSubstitution.candidateReady, false);
assert.match(fallbackSubstitution.errors.join('; '), /fallback primitive substitution detected/);

console.log('CYLINDER/code8 production parity audit tests passed');

function baseInput({ extraPrimitives = [], changedFiles = [], sourceOfTruth = 'PlantModelGraph.v1', runtimeSwitchImplemented = false, omitTransformPolicy = false, omitSourceTrace = false } = {}) {
  const primitives = [
    cylinder('PIPE-1', omitSourceTrace),
    cylinder('PIPE-2', omitSourceTrace),
    ...extraPrimitives
  ];
  return {
    graphId,
    sourceOfTruth,
    units: 'mm',
    axisBasis: { authoring: 'PlantModelGraph.v1', rvmExport: 'navis-review' },
    transformPolicy: omitTransformPolicy ? null : { policy: 'review-axis-basis', units: 'mm' },
    changedFiles,
    runtimeSwitchImplemented,
    rvmExportModel: {
      schema: 'RvmExportModel.v1',
      graphId,
      units: 'mm',
      axisBasis: { authoring: 'PlantModelGraph.v1', rvmExport: 'navis-review' },
      transformPolicy: omitTransformPolicy ? null : { policy: 'review-axis-basis', units: 'mm' },
      primitives
    }
  };
}
function cylinder(sourceItemId, omitSourceTrace = false) {
  return {
    primitiveKind: 'CYLINDER',
    primitiveCode: 8,
    rvmElementUnitStatus: 'candidate',
    sourceItemId,
    center: [0, 0, 0],
    axis: [1, 0, 0],
    lengthMm: 1000,
    radiusMm: 50,
    sourceTrace: omitSourceTrace ? null : trace(sourceItemId)
  };
}
function torus(status) {
  return { primitiveKind: 'TORUS', primitiveCode: 4, rvmElementUnitStatus: status, sourceItemId: 'BEND-1', sourceTrace: trace('BEND-1') };
}
function flange(status) {
  return { primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, rvmElementUnitStatus: status, sourceItemId: 'FLANGE-1', sourceTrace: trace('FLANGE-1') };
}
function valve(status) {
  return { primitiveKind: 'VALVE_BODY', primitiveCode: null, rvmElementUnitStatus: status, sourceElementType: 'VALV', sourceItemId: 'VALVE-1', sourceTrace: trace('VALVE-1') };
}
function support(status) {
  return { primitiveKind: 'SUPPORT_MARKER', primitiveCode: null, rvmElementUnitStatus: status, sourceElementType: 'ATTA', sourceItemId: 'SUPPORT-1', sourceTrace: trace('SUPPORT-1') };
}
function trace(sourceItemId) {
  return { sourceOfTruth: 'PlantModelGraph.v1', graphId, sourceItemId };
}
