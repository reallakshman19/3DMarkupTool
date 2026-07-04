const SCHEMA = 'NewCorePilotRouteAudit.v1';

export function buildNewCorePilotRouteAudit(routeOptions, result, errors) {
  const auditErrors = array(errors);
  const audit = { schema: SCHEMA, ok: false, routeName: routeOptions?.routeName || 'new-core-pilot-package', enabled: routeOptions?.enabled === true, explicitUserAction: routeOptions?.userGestureConfirmed === true, oldProductionPathTouched: false, defaultProductionPathChanged: false, productionWriterModified: false, defaultRuntimeSwitchEnabled: false, pilotAdapterCalled: result?.pilotAdapterCalled === true, artifactPrepared: result?.artifactPrepared === true, fullModelReady: result?.packageResult?.audit?.fullModelReady === true, hardErrorCount: auditErrors.length, errors: auditErrors };
  audit.ok = audit.enabled && audit.explicitUserAction && audit.pilotAdapterCalled && audit.artifactPrepared && audit.hardErrorCount === 0 && audit.oldProductionPathTouched === false && audit.defaultProductionPathChanged === false && audit.defaultRuntimeSwitchEnabled === false;
  return audit;
}

export function assertNewCorePilotRouteAudit(audit, expectations) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  for (const [key, expected] of Object.entries(object(expectations))) if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  if (errors.length) throw new Error(`NewCorePilotRouteAudit invalid: ${errors.join('; ')}`);
  return { schema: 'NewCorePilotRouteAuditAssertion.v1', ok: true };
}

function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' ? value : {}; }
