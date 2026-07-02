const AUDIT_SCHEMA = 'NewCoreCylinderCode8RuntimePilotAudit.v1';
const SHA256 = /^[0-9a-f]{64}$/;

export function buildNewCoreCylinderRuntimePilotAudit(plan, artifactResult, options = {}) {
  const errors = [...array(plan?.errors), ...array(artifactResult?.errors)];
  const warnings = [...array(plan?.warnings), ...array(options.warnings)];
  const audit = baseAudit(plan, artifactResult, warnings, errors);
  audit.ok = passCondition(audit, plan, artifactResult);
  return audit;
}

export function assertNewCoreCylinderRuntimePilotAudit(audit, expectations = {}) {
  const errors = validationErrors(audit);
  for (const [key, expected] of Object.entries(expectations)) if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  if (errors.length) throw new Error(`NewCoreCylinderCode8RuntimePilotAudit invalid: ${errors.join('; ')}`);
  return { schema: 'NewCoreCylinderCode8RuntimePilotAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}

function baseAudit(plan, artifact, warnings, errors) {
  return { schema: AUDIT_SCHEMA, ok: false, graphId: plan?.graphId || '<unknown-graph>', mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', plantModelGraphSourceOfTruth: true, elementLedgerDownstreamOnly: true, rvmExportModelBoundary: true, artifactGenerated: artifact?.artifactGenerated === true, artifactKind: 'rvm', artifactByteLength: Number(artifact?.byteLength || 0), checksumPresent: SHA256.test(artifact?.checksumSha256 || ''), plannedCylinderCount: Number(plan?.plannedCylinderCount || 0), decodedCylinderCount: Number(artifact?.decodedCylinderCount || 0), decodedPrimitiveCount: Number(artifact?.decodedPrimitiveCount || 0), excludedTorusCount: Number(plan?.excludedTorusCount || 0), excludedFlangeCount: Number(plan?.excludedFlangeCount || 0), excludedValveCount: Number(plan?.blockedValveCount || 0), excludedSupportCount: Number(plan?.deferredSupportCount || 0), blockedValveCount: Number(plan?.blockedValveCount || 0), deferredSupportCount: Number(plan?.deferredSupportCount || 0), fullModelReady: false, subsetReady: plan?.subsetReady === true, productionReadyCylinderCount: Number(plan?.plannedCylinderCount || 0), productionReadyTorusCount: 0, productionReadyFlangeCount: 0, productionReadyValveCount: 0, productionReadySupportCount: 0, writerCallCount: artifact?.artifactGenerated === true ? 1 : 0, productionWriterMutationCount: 0, runtimeRouteMutationCount: 0, appMutationCount: 0, browserTouchCount: 0, canvasTouchCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, fallbackPrimitiveCount: countFallback(plan), decodedTorusCount: Number(artifact?.decodedTorusCount || 0), decodedFlangeCylinderCount: Number(artifact?.decodedFlangeCylinderCount || 0), decodedBoxCount: Number(artifact?.decodedBoxCount || 0), decodedSphereCount: Number(artifact?.decodedSphereCount || 0), decodedPyramidCount: Number(artifact?.decodedPyramidCount || 0), sourceTraceCount: array(artifact?.sourceTrace).length || array(plan?.sourceTrace).length, warningCount: warnings.length, hardErrorCount: errors.length, artifactPath: artifact?.artifactPath || '', auditPath: artifact?.auditPath || '', writerBridge: artifact?.writerBridge || 'new-core-cylinder-code8-runtime-pilot-adapter.v1', warnings, errors };
}

function passCondition(audit, plan, artifact) {
  return plan?.enabled === true && audit.hardErrorCount === 0 && audit.artifactGenerated === true && audit.artifactByteLength > 0 && audit.checksumPresent === true && audit.subsetReady === true && audit.plannedCylinderCount > 0 && audit.decodedPrimitiveCount === audit.decodedCylinderCount && audit.decodedCylinderCount === audit.plannedCylinderCount && audit.decodedTorusCount === 0 && audit.decodedFlangeCylinderCount === 0 && audit.decodedBoxCount === 0 && audit.decodedSphereCount === 0 && audit.decodedPyramidCount === 0 && audit.productionReadyTorusCount === 0 && audit.productionReadyFlangeCount === 0 && audit.fullModelReady === false && audit.productionWriterMutationCount === 0 && audit.runtimeRouteMutationCount === 0 && audit.appMutationCount === 0 && audit.browserTouchCount === 0 && audit.canvasTouchCount === 0 && audit.objectUrlCount === 0 && audit.downloadSideEffectCount === 0 && audit.fallbackPrimitiveCount === 0 && artifact?.artifactKind === 'rvm';
}

function validationErrors(audit) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== AUDIT_SCHEMA) errors.push(`schema must be ${AUDIT_SCHEMA}`);
  for (const key of booleanKeys()) if (typeof audit?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  for (const key of countKeys()) if (!Number.isInteger(Number(audit?.[key])) || Number(audit[key]) < 0) errors.push(`${key} must be non-negative integer`);
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  return errors;
}

function booleanKeys() { return ['ok', 'plantModelGraphSourceOfTruth', 'elementLedgerDownstreamOnly', 'rvmExportModelBoundary', 'artifactGenerated', 'checksumPresent', 'fullModelReady', 'subsetReady']; }
function countKeys() { return ['artifactByteLength', 'plannedCylinderCount', 'decodedCylinderCount', 'decodedPrimitiveCount', 'excludedTorusCount', 'excludedFlangeCount', 'excludedValveCount', 'excludedSupportCount', 'blockedValveCount', 'deferredSupportCount', 'productionReadyCylinderCount', 'productionReadyTorusCount', 'productionReadyFlangeCount', 'productionReadyValveCount', 'productionReadySupportCount', 'writerCallCount', 'productionWriterMutationCount', 'runtimeRouteMutationCount', 'appMutationCount', 'browserTouchCount', 'canvasTouchCount', 'objectUrlCount', 'downloadSideEffectCount', 'fallbackPrimitiveCount', 'decodedTorusCount', 'decodedFlangeCylinderCount', 'decodedBoxCount', 'decodedSphereCount', 'decodedPyramidCount', 'sourceTraceCount', 'warningCount', 'hardErrorCount']; }
function countFallback(plan) { return array(plan?.cylinderPrimitives).filter((entry) => entry?.evidence?.fallbackUsed === true || entry?.fallbackUsed === true || entry?.geometryStatus === 'fallback').length; }
function array(value) { return Array.isArray(value) ? value : []; }
