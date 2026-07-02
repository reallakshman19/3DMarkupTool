import { collectWriterAdapterForbiddenFieldHits, validateWriterAdapterPlanContract } from '../contracts/index.js';
import { adaptAttExportModelForWriter } from './att-writer-adapter.js';
import { adaptGlbVisualModelForWriter } from './glb-writer-adapter.js';
import { adaptRvmExportModelForWriter } from './rvm-writer-adapter.js';

const WRITER_ADAPTER_PLAN_SCHEMA = 'WriterAdapterPlan.v1';
const WRITER_ADAPTER_AUDIT_SCHEMA = 'WriterAdapterAudit.v1';

export function buildWriterAdapterPlan(exportModels, exportAudit, options = {}) {
  const mode = options.mode || 'dryRun';
  const rvmAdapter = adaptRvmExportModelForWriter(exportModels?.rvmExportModel, exportAudit, { ...options, mode });
  const attAdapter = adaptAttExportModelForWriter(exportModels?.attExportModel, exportAudit, { ...options, mode });
  const glbAdapter = adaptGlbVisualModelForWriter(exportModels?.glbVisualModel, exportAudit, { ...options, mode });
  return { schema: WRITER_ADAPTER_PLAN_SCHEMA, graphId: exportModels?.rvmExportModel?.graphId || exportModels?.attExportModel?.graphId || exportModels?.glbVisualModel?.graphId || options.graphId || '<unknown-graph>', units: exportModels?.rvmExportModel?.units || exportModels?.attExportModel?.units || exportModels?.glbVisualModel?.units || options.units || 'mm', mode, rvmAdapter, attAdapter, glbAdapter, blockedWriterItems: array(rvmAdapter.blockedItems), deferredWriterItems: array(rvmAdapter.deferredItems), testByteEligibleWriterItems: array(rvmAdapter.testByteEligibleItems), sourceRefs: Array.isArray(exportModels?.rvmExportModel?.sourceRefs) ? exportModels.rvmExportModel.sourceRefs : [] };
}

export function buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit, options = {}) {
  const validation = validateWriterAdapterPlanContract(writerAdapterPlan);
  const forbiddenHits = collectWriterAdapterForbiddenFieldHits(writerAdapterPlan);
  const errors = [...validation.errors];
  const warnings = collectWarnings(writerAdapterPlan);
  if (!exportAudit || exportAudit.schema !== 'ExportModelCompilationAudit.v1') errors.push('ExportModelCompilationAudit.v1 is required');
  if (exportAudit?.ok !== true) errors.push('ExportModelCompilationAudit.ok must be true before writer adapter planning');
  const audit = buildAudit(writerAdapterPlan, options, forbiddenHits, errors, warnings);
  audit.ok = validation.ok && exportAudit?.ok === true && audit.hardErrorCount === 0 && audit.writerCallCount === 0 && audit.binaryPayloadCount === 0 && audit.textPayloadCount === 0 && audit.glbPayloadCount === 0 && audit.downloadSideEffectCount === 0 && audit.runtimeMutationCount === 0 && audit.productionReadyTorusCount === 0 && audit.flangeWriterReadyCount === 0 && audit.productionReadyFlangeCount === 0;
  return audit;
}

function buildAudit(plan, options, forbiddenHits, errors, warnings) {
  const rvmChunks = array(plan?.rvmAdapter?.plannedChunks);
  const blocked = array(plan?.blockedWriterItems);
  const deferred = array(plan?.deferredWriterItems);
  const testItems = array(plan?.testByteEligibleWriterItems);
  return { schema: WRITER_ADAPTER_AUDIT_SCHEMA, graphId: plan?.graphId || options.graphId || '<unknown-graph>', mode: plan?.mode || options.mode || 'dryRun', rvmWriterReady: plan?.rvmAdapter?.writerReady === true, rvmPipeBendSubsetTestByteReady: plan?.rvmAdapter?.pipeBendSubsetTestByteReady === true, flangeSubsetTestByteReady: plan?.rvmAdapter?.flangeSubsetTestByteReady === true, attWriterReady: plan?.attAdapter?.writerReady === true, glbWriterReady: plan?.glbAdapter?.writerReady === true, rvmPlannedChunkCount: rvmChunks.length, rvmPlannedPrimChunkCount: rvmChunks.filter((entry) => entry.chunkKind === 'PRIM').length, rvmPlannedCylinderCount: rvmChunks.filter((entry) => entry.primitiveKind === 'CYLINDER').length, rvmPlannedTorusCount: rvmChunks.filter((entry) => entry.primitiveKind === 'TORUS').length, testByteEligibleTorusCount: testItems.filter((entry) => entry.primitiveKind === 'TORUS').length, testByteEligibleBendTorusCount: testItems.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, productionReadyTorusCount: plan?.rvmAdapter?.productionReadyTorusCount || 0, deferredFlangeWriterCount: deferred.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER').length, flangeWriterReadyCount: plan?.rvmAdapter?.flangeWriterReadyCount || 0, flangeTestByteEligibleCount: plan?.rvmAdapter?.flangeTestByteEligibleCount || 0, productionReadyFlangeCount: plan?.rvmAdapter?.productionReadyFlangeCount || 0, rvmPlannedBoxCount: rvmChunks.filter((entry) => entry.primitiveKind === 'BOX').length, rvmPlannedSphereCount: rvmChunks.filter((entry) => entry.primitiveKind === 'SPHERE').length, rvmPlannedPyramidCount: rvmChunks.filter((entry) => entry.primitiveKind === 'PYRAMID').length, attPlannedRecordCount: plan?.attAdapter?.plannedRecordCount || 0, glbPlannedVisualCount: plan?.glbAdapter?.plannedVisualCount || 0, blockedWriterItemCount: blocked.length, deferredWriterItemCount: deferred.length, blockedUnresolvedWriterCount: blocked.length, blockedFlangeWriterCount: blocked.filter((entry) => entry.family === 'flange').length, blockedValveWriterCount: blocked.filter((entry) => entry.family === 'valve').length, blockedBendWriterCount: blocked.filter((entry) => entry.family === 'elbow').length, deferredSupportWriterCount: deferred.filter((entry) => entry.family === 'support').length, deferredBendTorusWriterCount: deferred.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, writerCallCount: 0, binaryPayloadCount: forbiddenHits.filter((hit) => ['binary', 'bytes', 'buffer', 'arrayBuffer', 'chunkBytes', 'cntbBytes', 'primBody', 'fileBlob', 'writerPayload', 'writeResult'].includes(hit.field)).length, textPayloadCount: forbiddenHits.filter((hit) => hit.field === 'attText').length, glbPayloadCount: forbiddenHits.filter((hit) => hit.field === 'glbBytes' || hit.field === 'gltfJson').length, downloadSideEffectCount: forbiddenHits.filter((hit) => hit.field === 'objectUrl' || hit.field === 'downloadUrl' || hit.field === 'filePath').length, runtimeMutationCount: forbiddenHits.filter((hit) => ['threeObject', 'threeGeometry', 'meshGeometry'].includes(hit.field)).length, hardErrorCount: errors.length, warningCount: warnings.length, ok: false, errors, warnings };
}

export { adaptRvmExportModelForWriter, adaptAttExportModelForWriter, adaptGlbVisualModelForWriter };
function collectWarnings(plan) { return [...array(plan?.rvmAdapter?.warnings), ...array(plan?.attAdapter?.warnings), ...array(plan?.glbAdapter?.warnings)]; }
function array(value) { return Array.isArray(value) ? value : []; }
