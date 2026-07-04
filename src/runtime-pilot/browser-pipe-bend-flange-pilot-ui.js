export function createPipeBendFlangePilotActionModel() {
  return { schema: 'BrowserPipeBendFlangePilotActionModel.v1', panelLabel: 'New-Core Pilot Export', buttonLabel: 'Generate Pipe+Bend+Flange Pilot Package', warningText: 'Pilot package:\n- straight pipe CYLINDER/code8 included\n- bend TORUS/code4 included\n- flange body FLANGE_CYLINDER/code8 included\n- ATT subset included\n- valves blocked\n- supports deferred\n- old production export unchanged', normalProductionExportReplaced: false, pilotRunsOnInit: false };
}

export async function executeBrowserPipeBendFlangePilotAction(state, services = {}, options = {}) {
  const adapter = services.generateBrowserPipeBendFlangePilotExport;
  if (typeof adapter !== 'function') return failure('browser pipe+bend+flange pilot adapter unavailable');
  const result = await adapter(state, { ...defaultOptions(), basename: state.basename, ...options, userGestureConfirmed: true, browserDownload: true });
  if (!result?.audit?.ok) return failure(result?.audit?.errors?.join('; ') || 'pipe+bend+flange pilot package blocked', result);
  const downloads = preparePipeBendFlangePilotDownloads(result, services.downloadHost || globalThis);
  return { schema: 'BrowserPipeBendFlangePilotUiResult.v1', ok: true, downloadCount: downloads.length, downloads, statusMessage: statusMessage(result.audit), audit: result.audit, result };
}

export function preparePipeBendFlangePilotDownloads(bundle, host = globalThis) {
  const files = [bundle?.rvmFile, bundle?.attFile, bundle?.auditFile].filter(Boolean);
  return files.map((file) => prepareDownload(file, host));
}

export function statusMessage(audit) {
  if (!audit?.ok) return `New-Core Pipe+Bend+Flange Pilot Package blocked: ${(audit?.errors || ['unknown error']).join('; ')}`;
  return `New-Core Pipe+Bend+Flange Pilot Package generated: ${audit.plannedCylinderCount} CYLINDER/code8 pipes, ${audit.plannedTorusCount} TORUS/code4 bends, and ${audit.plannedFlangeCylinderCount} FLANGE_CYLINDER/code8 flange bodies. ATT rows: ${audit.attRowCount}. Excluded: ${audit.blockedValveCount} valves, ${audit.deferredSupportCount} supports. Full RVM not ready.`;
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

function failure(message, result = null) { return { schema: 'BrowserPipeBendFlangePilotUiResult.v1', ok: false, downloadCount: 0, downloads: [], statusMessage: `New-Core Pipe+Bend+Flange Pilot Package blocked: ${message}`, audit: result?.audit || null, result }; }
function defaultOptions() { return { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true }; }
