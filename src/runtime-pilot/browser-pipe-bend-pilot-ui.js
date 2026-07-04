export function createPipeBendPilotActionModel() {
  return { schema: 'BrowserPipeBendPilotActionModel.v1', panelLabel: 'New-Core Pilot Export', buttonLabel: 'Generate Pipe+Bend Pilot RVM', warningText: 'Pilot export only:\n- straight pipe CYLINDER/code8 included\n- bend TORUS/code4 included\n- flanges excluded\n- valves blocked\n- supports deferred\n- old production export unchanged', normalProductionExportReplaced: false, pilotRunsOnInit: false };
}

export async function executeBrowserPipeBendPilotAction(state, services = {}, options = {}) {
  const adapter = services.generateBrowserPipeBendPilotExport;
  if (typeof adapter !== 'function') return failure('browser pipe+bend pilot adapter unavailable');
  const result = await adapter(state, { ...defaultOptions(), basename: state.basename, ...options, userGestureConfirmed: true, browserDownload: true });
  if (!result?.audit?.ok) return failure(result?.audit?.errors?.join('; ') || 'pipe+bend pilot export blocked', result);
  const downloads = preparePipeBendPilotDownloads(result, services.downloadHost || globalThis);
  return { schema: 'BrowserPipeBendPilotUiResult.v1', ok: true, downloadCount: downloads.length, downloads, statusMessage: statusMessage(result.audit), audit: result.audit, result };
}

export function preparePipeBendPilotDownloads(bundle, host = globalThis) {
  const files = [bundle?.rvmFile, bundle?.auditFile].filter(Boolean);
  return files.map((file) => prepareDownload(file, host));
}

export function statusMessage(audit) {
  if (!audit?.ok) return `New-Core Pipe+Bend Pilot Export blocked: ${(audit?.errors || ['unknown error']).join('; ')}`;
  return `New-Core Pipe+Bend Pilot Export generated: ${audit.plannedCylinderCount} CYLINDER/code8 primitives and ${audit.plannedTorusCount} TORUS/code4 bend primitives. Excluded: ${audit.excludedFlangeCount} flanges, ${audit.blockedValveCount} valves, ${audit.deferredSupportCount} supports. Full RVM not ready.`;
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

function failure(message, result = null) { return { schema: 'BrowserPipeBendPilotUiResult.v1', ok: false, downloadCount: 0, downloads: [], statusMessage: `New-Core Pipe+Bend Pilot Export blocked: ${message}`, audit: result?.audit || null, result }; }
function defaultOptions() { return { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true }; }
