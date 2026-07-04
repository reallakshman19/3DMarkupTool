const SCOPE = 'pipe-bend-flange-valve-subset';

export function createValvePilotActionModel() {
  return {
    schema: 'BrowserPipeBendFlangeValvePilotActionModel.v1',
    panelLabel: 'New-Core Pilot Export',
    buttonLabel: 'Generate Pipe+Bend+Flange+Valve Pilot Package',
    warningText: 'Pilot package:\n- straight pipe CYLINDER/code8 included\n- bend TORUS/code4 included\n- flange body FLANGE_CYLINDER/code8 included\n- deterministic inline valve body included only when dimensions exist\n- ATT subset included\n- supports deferred\n- old production export unchanged',
    normalProductionExportReplaced: false,
    pilotRunsOnInit: false
  };
}

export async function executeBrowserValvePilotAction(state, services, options) {
  const adapter = services?.generateBrowserValvePilotExport;
  if (typeof adapter !== 'function') return failure('browser pipe+bend+flange+valve pilot adapter unavailable');
  const result = await adapter(state, { ...defaultOptions(), basename: state.basename, ...object(options), userGestureConfirmed: true, browserDownload: true });
  if (!result?.audit?.ok) return failure(result?.audit?.errors?.join('; ') || 'pipe+bend+flange+valve pilot package blocked', result);
  const downloads = prepareValvePilotDownloads(result, services?.downloadHost || globalThis);
  return { schema: 'BrowserPipeBendFlangeValvePilotUiResult.v1', ok: true, downloadCount: downloads.length, downloads, statusMessage: statusMessage(result.audit), audit: result.audit, result };
}

export function prepareValvePilotDownloads(bundle, host) {
  const files = [bundle?.rvmFile, bundle?.attFile, bundle?.auditFile].filter(Boolean);
  return files.map((file) => prepareDownload(file, host || globalThis));
}

export function statusMessage(audit) {
  if (!audit?.ok) return `New-Core Pipe+Bend+Flange+Valve Pilot Package blocked: ${(audit?.errors || ['unknown error']).join('; ')}`;
  if (Number(audit.blockedValveCount || 0) > 0) return blockedValveStatus(audit);
  return `New-Core Pipe+Bend+Flange+Valve Pilot Package generated: ${audit.plannedCylinderCount} pipes, ${audit.plannedTorusCount} bends, ${audit.plannedFlangeCylinderCount} flanges, ${audit.plannedValveBodyCount} deterministic valve bodies. ATT rows: ${audit.attRowCount}. Deferred: ${audit.deferredSupportCount} supports. Full RVM not ready.`;
}

function blockedValveStatus(audit) {
  const reason = reasonSummary(audit);
  return `Valve pilot generated ${audit.generatedValveCount} deterministic valve bodies. Blocked: ${audit.blockedValveCount} valves${reason}. No placeholder geometry generated. ATT rows: ${audit.attRowCount}. Deferred: ${audit.deferredSupportCount} supports. Full RVM not ready.`;
}

function reasonSummary(audit) {
  const tokens = new Set();
  for (const warning of audit.warnings || []) {
    const match = String(warning).match(/missing ([A-Za-z0-9_/.-]+)/);
    if (match) for (const token of match[1].split('/')) tokens.add(token);
  }
  return tokens.size ? ` due to missing ${[...tokens].join('/')}` : '';
}

function prepareDownload(file, host) {
  const BlobCtor = host.Blob || globalThis.Blob;
  const URLApi = host.URL || globalThis.URL;
  const documentApi = host.document || globalThis.document;
  const blob = file.bytes ? new BlobCtor([file.bytes], { type: file.mimeType }) : new BlobCtor([file.text], { type: file.mimeType });
  const url = URLApi.createObjectURL(blob);
  const anchor = documentApi.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URLApi.revokeObjectURL(url);
  return { filename: file.filename, mimeType: file.mimeType, objectUrlRevoked: true };
}

function failure(message, result) {
  return { schema: 'BrowserPipeBendFlangeValvePilotUiResult.v1', ok: false, downloadCount: 0, downloads: [], statusMessage: `New-Core Pipe+Bend+Flange+Valve Pilot Package blocked: ${message}`, audit: result?.audit || null, result };
}

function defaultOptions() {
  return { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true };
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
