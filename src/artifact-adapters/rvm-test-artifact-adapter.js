const RVM_TRANSFORM_BLOCK_REASON = 'RVM artifact blocked until final review transform policy is implemented';
const RVM_BRIDGE_BLOCK_REASON = 'RVM full model artifact remains blocked; straight-pipe subset transform readiness proven; subset proof remains test-only';

export function adaptRvmExportModelToTestArtifact(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1' && exportAudit.ok === true && writerAdapterPlan?.schema === 'WriterAdapterPlan.v1' && writerAdapterAudit?.schema === 'WriterAdapterAudit.v1' && writerAdapterAudit.ok === true;
  const primitiveCount = primitivePlanCount(rvmExportModel);
  if (!canPlan) return blockedRvmArtifact('Writer adapter audit must be ok before test artifact planning', primitiveCount, false, false, false);
  const straightReady = transformReady(rvmExportModel, writerAdapterPlan);
  const bendReady = writerAdapterPlan?.rvmAdapter?.pipeBendSubsetTestByteReady === true && Number(writerAdapterPlan?.rvmAdapter?.testByteEligibleBendTorusCount || 0) > 0;
  const flangeReady = writerAdapterPlan?.rvmAdapter?.flangeSubsetTestByteReady === true && Number(writerAdapterPlan?.rvmAdapter?.flangeTestByteEligibleCount || 0) > 0;
  if (!straightReady) return blockedRvmArtifact(RVM_TRANSFORM_BLOCK_REASON, primitiveCount, false, false, false);
  return blockedRvmArtifact(options.reason || RVM_BRIDGE_BLOCK_REASON, primitiveCount, true, bendReady, flangeReady);
}

function primitivePlanCount(model) { return array(model?.primitives).length + array(model?.testByteEligiblePrimitives).length + array(model?.flangeTestByteEligiblePrimitives).length; }
function transformReady(model, plan) { return model?.transformApplied === true && model?.transformPolicy === 'final-review-transform.v1' && plan?.rvmAdapter?.transformApplied === true && plan?.rvmAdapter?.transformPolicy === 'final-review-transform.v1' && plan?.rvmAdapter?.writerReady === true; }
function blockedRvmArtifact(reason, primitiveCount, transformReady, bendTorusReady, flangeReady) { return { artifactKind: 'rvm', artifactReady: false, artifactGenerated: false, artifactBlocked: true, reason, byteLength: 0, primitiveCount, transformReady, straightPipeSubsetReady: transformReady, bendTorusSubsetReady: bendTorusReady, flangeSubsetReady: flangeReady, pipeBendSubsetReady: transformReady && bendTorusReady }; }
function array(value) { return Array.isArray(value) ? value : []; }
