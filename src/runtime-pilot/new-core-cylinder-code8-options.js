const REQUIRED_MODE = 'explicit-runtime-pilot';
const REQUIRED_SCOPE = 'cylinder-code8-subset';
const FORBIDDEN_TRUE_OPTIONS = ['browser', 'runtime', 'canvas', 'download', 'objectUrl', 'createObjectUrl', 'downloadUrl', 'dom', 'ui', 'appMutation'];

export function normalizeCylinderRuntimePilotOptions(options = {}) {
  const normalized = { ...options, mode: options.mode || '', scope: options.scope || '', enabled: options.enabled === true, allowPartialModel: options.allowPartialModel === true, writeArtifact: options.writeArtifact === true };
  const errors = optionErrors(normalized);
  return { ...normalized, schema: 'NewCoreCylinderCode8RuntimePilotOptions.v1', ok: errors.length === 0, errors, errorCount: errors.length };
}

export function validCylinderRuntimePilotOptions(options = {}, purpose = 'plan') {
  const normalized = normalizeCylinderRuntimePilotOptions(options);
  const errors = [...normalized.errors];
  if (purpose === 'write' && normalized.writeArtifact !== true) errors.push('writeArtifact must be true when writing bytes');
  return { ...normalized, ok: errors.length === 0, errors, errorCount: errors.length };
}

function optionErrors(options) {
  const errors = [];
  if (options.enabled !== true) errors.push('enabled must be true');
  if (options.mode !== REQUIRED_MODE) errors.push(`mode must be ${REQUIRED_MODE}`);
  if (options.scope !== REQUIRED_SCOPE) errors.push(`scope must be ${REQUIRED_SCOPE}`);
  if (options.allowPartialModel !== true) errors.push('allowPartialModel must be true');
  for (const key of FORBIDDEN_TRUE_OPTIONS) if (options[key] === true) errors.push(`${key} option is forbidden for runtime pilot`);
  return errors;
}
