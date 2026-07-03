const SCHEMA = 'NewCorePilotRouteOptions.v1';

export function createNewCorePilotRouteOptions(overrides) {
  return { schema: SCHEMA, enabled: false, mode: 'explicit-runtime-pilot-route', routeName: 'new-core-pilot-package', defaultProductionPathUnchanged: true, oldExportPathModified: false, userGestureConfirmed: false, ...object(overrides) };
}

export function validateNewCorePilotRouteOptions(options) {
  const errors = [];
  if (!options || typeof options !== 'object') errors.push('options must be an object');
  if (options?.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  if (options?.mode !== 'explicit-runtime-pilot-route') errors.push('mode must be explicit-runtime-pilot-route');
  if (options?.routeName !== 'new-core-pilot-package') errors.push('routeName must be new-core-pilot-package');
  if (options?.defaultProductionPathUnchanged !== true) errors.push('default production path must remain unchanged');
  if (options?.oldExportPathModified !== false) errors.push('old export path must not be modified');
  return { schema: 'NewCorePilotRouteOptionsValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
