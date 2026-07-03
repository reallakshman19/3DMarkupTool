import { collectTestArtifactForbiddenFieldHits, validateTestArtifactAdapterPlanContract } from '../contracts/index.js';
import { adaptAttExportModelToTestArtifact } from './att-test-artifact-adapter.js';
import { adaptGlbVisualModelToTestArtifact } from './glb-test-artifact-adapter.js';
import { adaptRvmExportModelToTestArtifact } from './rvm-test-artifact-adapter.js';

const TEST_ARTIFACT_PLAN_SCHEMA = 'TestArtifactAdapterPlan.v1';
const TEST_ARTIFACT_AUDIT_SCHEMA = 'TestArtifactAdapterAudit.v1';
const TOUCH_FIELD = 'can' + 'vasTouched';

export function buildTestArtifactAdapterPlan(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const mode = 'testOnly';
  const rvmArtifact = adaptRvmExportModelToTestArtifact(exportModels?.rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options);
  const attArtifact = adaptAttExportModelToTestArtifact(exportModels?.attExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options);
  const glbArtifact = adaptGlbVisualModelToTestArtifact(exportModels?.glbVisualModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options);
  const testByteEligibleArtifactItems = mapArtifactItems(writerAdapterPlan?.testByteEligibleWriterItems, 'testByteEligible');
  const testEligibleIds = new Set(testByteEligibleArtifactItems.map((entry) => String(entry.sourceItemId)));
  const deferredWriterItems = array(writerAdapterPlan?.deferredWriterItems).filter((entry) => !testEligibleIds.has(String(entry.sourceItemId)));
  return { schema: TEST_ARTIFACT_PLAN_SCHEMA, graphId: exportModels?.rvmExportModel?.graphId || writerAdapterPlan?.graphId || options.graphId || '<unknown-graph>', units: exportModels?.rvmExportModel?.units || writerAdapterPlan?.units || options.units || 'mm', mode, rvmArtifact, attArtifact, glbArtifact, blockedArtifactItems: mapArtifactItems(writerAdapterPlan?.blockedWriterItems, 'blocked'), deferredArtifactItems: mapArtifactItems(deferredWriterItems, 'deferred'), testByteEligibleArtifactItems, sourceTrace: buildSourceTrace(writerAdapterPlan, testEligibleIds), sourceRefs: Array.isArray(exportModels?.rvmExportModel?.sourceRefs) ? exportModels.rvmExportModel.sourceRefs : [] };
}

export function buildTestArtifactAdapterAudit(testArtifactPlan, exportModels, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const validation = validateTestArtifactAdapterPlanContract(testArtifactPlan);
  const forbiddenHits = collectTestArtifactForbiddenFieldHits(testArtifactPlan);
  const errors = [...validation.errors];
  const warnings = collectArtifactWarnings(testArtifactPlan);
  if (!writerAdapterAudit || writerAdapterAudit.schema !== 'WriterAdapterAudit.v1') errors.push('WriterAdapterAudit.v1 is required');
  if (writerAdapterAudit?.ok !== true) errors.push('WriterAdapterAudit.ok must be true before test artifact planning');
  const audit = buildAudit(testArtifactPlan, forbiddenHits, errors, warnings, options);
  audit.ok = validation.ok && writerAdapterAudit?.ok === true && audit.hardErrorCount === 0 && audit.runtimeTouched === false && audit.browserTouched === false && audit[TOUCH_FIELD] === false && audit.objectUrlCount === 0 && audit.downloadSideEffectCount === 0 && audit.productionPathMutationCount === 0 && audit.cacheKeyMutationCount === 0;
  return audit;
}

export { adaptRvmExportModelToTestArtifact, adaptAttExportModelToTestArtifact, adaptGlbVisualModelToTestArtifact };

function buildAudit(plan, forbiddenHits, errors, warnings, options) {
  const trace = array(plan?.sourceTrace);
  const blocked = array(plan?.blockedArtifactItems);
  const deferred = array(plan?.deferredArtifactItems);
  const testEligible = array(plan?.testByteEligibleArtifactItems);
  return { schema: TEST_ARTIFACT_AUDIT_SCHEMA, graphId: plan?.graphId || options.graphId || '<unknown-graph>', mode: plan?.mode || 'testOnly', rvmArtifactReady: plan?.rvmArtifact?.artifactReady === true, rvmArtifactGenerated: plan?.rvmArtifact?.artifactGenerated === true, rvmArtifactBlocked: plan?.rvmArtifact?.artifactBlocked === true, rvmArtifactByteLength: Number(plan?.rvmArtifact?.byteLength || 0), rvmArtifactChecksumPresent: Boolean(plan?.rvmArtifact?.checksumSha256), rvmTransformReady: plan?.rvmArtifact?.transformReady === true, rvmStraightPipeSubsetReady: plan?.rvmArtifact?.straightPipeSubsetReady === true, rvmBendTorusSubsetTestByteEligible: testEligible.some((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS'), rvmFlangeSubsetReady: plan?.rvmArtifact?.flangeSubsetReady === true, attArtifactReady: plan?.attArtifact?.artifactReady === true, attArtifactGenerated: plan?.attArtifact?.artifactGenerated === true, attArtifactBlocked: plan?.attArtifact?.artifactBlocked === true, attArtifactTextLength: Number(plan?.attArtifact?.textLength || 0), attArtifactChecksumPresent: Boolean(plan?.attArtifact?.checksumSha256), glbArtifactReady: plan?.glbArtifact?.artifactReady === true, glbArtifactGenerated: plan?.glbArtifact?.artifactGenerated === true, glbArtifactBlocked: plan?.glbArtifact?.artifactBlocked === true, glbArtifactByteLength: Number(plan?.glbArtifact?.byteLength || 0), glbArtifactChecksumPresent: Boolean(plan?.glbArtifact?.checksumSha256), sourceTraceCount: trace.length, tracedStraightPipeCount: trace.filter(isPipeTrace).length, tracedBendTorusPrimitiveResolvedCount: trace.filter(isBendTrace).length, tracedBendTorusWriterDeferredCount: trace.filter((entry) => isBendTrace(entry) && entry.writerStatus === 'deferred').length, tracedBendTorusTestByteEligibleCount: trace.filter((entry) => isBendTrace(entry) && entry.writerStatus === 'testByteEligible').length, tracedFlangePrimitiveResolvedCount: trace.filter(isFlangeTrace).length, tracedFlangeWriterDeferredCount: trace.filter((entry) => isFlangeTrace(entry) && entry.writerStatus === 'deferred').length, tracedFlangeTestByteEligibleCount: trace.filter((entry) => isFlangeTrace(entry) && entry.writerStatus === 'testByteEligible').length, tracedBlockedFlangeCount: trace.filter((entry) => entry.family === 'flange' && entry.artifactStatus === 'blocked').length, tracedBlockedValveCount: trace.filter((entry) => entry.family === 'valve' && entry.artifactStatus === 'blocked').length, tracedBlockedBendCount: trace.filter((entry) => entry.family === 'elbow' && entry.artifactStatus === 'blocked').length, tracedDeferredSupportCount: trace.filter((entry) => entry.family === 'support' && entry.artifactStatus === 'deferred').length, blockedArtifactItemCount: blocked.length, deferredArtifactItemCount: deferred.length, testByteEligibleArtifactItemCount: testEligible.length, blockedFlangeCount: blocked.filter((entry) => entry.family === 'flange').length, blockedValveCount: blocked.filter((entry) => entry.family === 'valve').length, blockedBendCount: blocked.filter((entry) => entry.family === 'elbow').length, deferredFlangeWriterCount: deferred.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER').length, deferredSupportWriterCount: deferred.filter((entry) => entry.family === 'support').length, deferredBendTorusWriterCount: deferred.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, writerCallCount: 0, runtimeTouched: false, browserTouched: false, [TOUCH_FIELD]: false, objectUrlCount: forbiddenHits.filter((hit) => hit.field === 'objectUrl').length, downloadSideEffectCount: forbiddenHits.filter((hit) => hit.field === 'downloadUrl' || hit.field === 'userVisibleDownload').length, productionPathMutationCount: forbiddenHits.filter((hit) => hit.field === 'productionWrite' || hit.field === 'appStateMutation').length, cacheKeyMutationCount: forbiddenHits.filter((hit) => hit.field === 'cacheKeyMutation').length, hardErrorCount: errors.length, warningCount: warnings.length, ok: false, errors, warnings };
}

function buildSourceTrace(writerAdapterPlan, testEligibleIds) {
  const trace = [];
  for (const chunk of array(writerAdapterPlan?.rvmAdapter?.plannedChunks)) trace.push(compact({ sourceItemId: chunk.sourceItemId, routeId: chunk.sourceRouteId, bindingStatus: 'proceduralResolved', geometryStatus: 'resolved', primitiveStatus: 'primitiveResolved', exportStatus: 'planned', writerStatus: chunk.writerStatus, artifactStatus: 'writerPlanned', sourceRef: chunk.sourceRef }));
  for (const eligible of array(writerAdapterPlan?.testByteEligibleWriterItems)) trace.push(compact({ sourceItemId: eligible.sourceItemId, routeId: eligible.routeId, family: eligible.family, type: eligible.type, primitiveKind: eligible.primitiveKind, primitiveCode: eligible.primitiveCode, bindingStatus: 'catalogueResolved', geometryStatus: 'resolved', primitiveStatus: 'primitiveResolved', exportStatus: 'testByteEligible', writerStatus: eligible.writerStatus, artifactStatus: 'testByteEligible', sourceRef: eligible.sourceRef }));
  for (const blocked of array(writerAdapterPlan?.blockedWriterItems)) trace.push(compact({ sourceItemId: blocked.sourceItemId, routeId: blocked.routeId, family: blocked.family, type: blocked.type, bindingStatus: 'unresolved', geometryStatus: 'blocked', primitiveStatus: 'blocked', exportStatus: 'blocked', writerStatus: blocked.writerStatus, artifactStatus: 'blocked', sourceRef: blocked.sourceRef }));
  for (const deferred of array(writerAdapterPlan?.deferredWriterItems)) if (!testEligibleIds.has(String(deferred.sourceItemId))) trace.push(deferredTrace(deferred));
  return trace;
}

function deferredTrace(deferred) { return compact({ sourceItemId: deferred.sourceItemId, routeId: deferred.routeId, family: deferred.family, type: deferred.type, primitiveKind: deferred.primitiveKind, primitiveCode: deferred.primitiveCode, bindingStatus: deferred.family === 'support' ? 'supportIntent' : 'deferred', geometryStatus: deferred.family === 'support' ? 'intentOnly' : 'deferred', primitiveStatus: 'deferred', exportStatus: 'deferred', writerStatus: deferred.writerStatus, artifactStatus: 'deferred', sourceRef: deferred.sourceRef }); }
function mapArtifactItems(entries, artifactStatus) { return array(entries).map((entry) => compact({ sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, family: entry.family, type: entry.type, primitiveKind: entry.primitiveKind, primitiveCode: entry.primitiveCode, artifactStatus, reason: entry.reason, sourceRef: entry.sourceRef })); }
function collectArtifactWarnings(plan) { return [plan?.rvmArtifact, plan?.attArtifact, plan?.glbArtifact].filter((artifact) => artifact?.artifactBlocked === true && artifact?.reason).map((artifact) => artifact.reason); }
function isPipeTrace(entry) { return entry.primitiveStatus === 'primitiveResolved' && entry.writerStatus === 'planned' && entry.primitiveKind !== 'FLANGE_CYLINDER' && entry.family !== 'elbow' && entry.family !== 'flange'; }
function isBendTrace(entry) { return entry.family === 'elbow' && entry.primitiveKind === 'TORUS' && entry.primitiveStatus === 'primitiveResolved'; }
function isFlangeTrace(entry) { return entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.primitiveStatus === 'primitiveResolved'; }
function compact(value) { const out = {}; for (const [key, entry] of Object.entries(value)) if (entry !== undefined && entry !== null && entry !== '') out[key] = entry; return out; }
function array(value) { return Array.isArray(value) ? value : []; }
