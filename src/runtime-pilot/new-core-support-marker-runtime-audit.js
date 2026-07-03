const AUDIT_SCHEMA = 'NewCoreSupportMarkerRuntimePilotAudit.v1';

export function buildNewCoreSupportMarkerRuntimePilotAudit(plan, artifact, options) {
  const errors = [...array(plan?.errors), ...array(artifact?.errors), ...array(options?.errors)];
  const warnings = [...array(plan?.warnings), ...array(options?.warnings)];
  const audit = { schema: AUDIT_SCHEMA, ok: false, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-support-marker-subset', baseRuntimePilotScope: plan?.baseRuntimePilotScope || 'pipe-bend-flange-valve-subset', artifactGenerated: artifact?.artifactGenerated === true, supportMarkersOptional: true, supportMarkerCount: Number(plan?.supportMarkerCount || 0), blockedSupportMarkerCount: Number(plan?.blockedSupportMarkerCount || 0), supportGeometryGenerated: false, supportFallbackCount: Number(plan?.supportFallbackCount || 0), plannedRvmPrimitiveCount: Number(plan?.plannedRvmPrimitiveCount || 0), plannedAttRowCount: Number(plan?.plannedAttRowCount || 0), fullModelReady: false, subsetReady: plan?.subsetReady === true, productionSupportGeometryReady: false, productionWriterMutationCount: 0, runtimeRouteMutationCount: 0, warningCount: warnings.length, hardErrorCount: errors.length, warnings, errors };
  audit.ok = audit.artifactGenerated && audit.subsetReady && audit.hardErrorCount === 0 && audit.supportGeometryGenerated === false && audit.supportFallbackCount === 0 && audit.fullModelReady === false;
  return audit;
}

export function assertNewCoreSupportMarkerRuntimePilotAudit(audit, expectations) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== AUDIT_SCHEMA) errors.push(`schema must be ${AUDIT_SCHEMA}`);
  for (const [key, expected] of Object.entries(object(expectations))) if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  if (errors.length) throw new Error(`NewCoreSupportMarkerRuntimePilotAudit invalid: ${errors.join('; ')}`);
  return { schema: 'NewCoreSupportMarkerRuntimePilotAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}

function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' ? value : {}; }
