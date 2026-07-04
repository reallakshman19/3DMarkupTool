import { buildNewCorePilotRouteAudit } from './new-core-pilot-route-audit.js';
import { createNewCorePilotRouteOptions, validateNewCorePilotRouteOptions } from './new-core-pilot-route-options.js';

export async function executeNewCorePilotRoute(state, services, options) {
  const routeOptions = createNewCorePilotRouteOptions(options);
  const validation = validateNewCorePilotRouteOptions(routeOptions);
  const errors = [...validation.errors];
  if (routeOptions.enabled !== true) errors.push('new-core pilot route must be explicitly enabled');
  if (routeOptions.userGestureConfirmed !== true) errors.push('new-core pilot route requires explicit user action');
  if (errors.length) return blocked(routeOptions, errors);
  const adapter = services?.generatePilotPackage;
  if (typeof adapter !== 'function') return blocked(routeOptions, ['pilot package adapter is required']);
  const packageResult = await adapter(state, { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true, userGestureConfirmed: true, browserDownload: true, basename: routeOptions.basename || state?.basename, catalogueItems: routeOptions.catalogueItems, fetchImpl: routeOptions.fetchImpl });
  const result = { schema: 'NewCorePilotRouteResult.v1', ok: packageResult?.audit?.ok === true, oldProductionPathCalled: false, pilotAdapterCalled: true, artifactPrepared: packageResult?.rvmFile !== null && packageResult?.attFile !== null && packageResult?.auditFile !== null, packageResult };
  return { ...result, audit: buildNewCorePilotRouteAudit(routeOptions, result, result.ok ? [] : packageResult?.audit?.errors || ['pilot package blocked']) };
}

export function defaultProductionRouteDescriptor() {
  return { schema: 'ProductionRouteDescriptor.v1', routeName: 'old-production-export', defaultRoute: true, modifiedByNewCorePilotRoute: false };
}

function blocked(routeOptions, errors) {
  const result = { schema: 'NewCorePilotRouteResult.v1', ok: false, oldProductionPathCalled: false, pilotAdapterCalled: false, artifactPrepared: false, packageResult: null };
  return { ...result, audit: buildNewCorePilotRouteAudit(routeOptions, result, errors) };
}
