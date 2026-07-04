const SCOPE = 'pipe-bend-flange-valve-support-marker-subset';

export function createSupportMarkerPilotActionModel() {
  return { schema: 'BrowserSupportMarkerPilotActionModel.v1', panelLabel: 'New-Core Pilot Export', buttonLabel: 'Generate Pipe+Bend+Flange+Valve+Support Marker Pilot Package', toggleLabel: 'Include deterministic support markers', normalProductionExportReplaced: false, pilotRunsOnInit: false };
}

export async function executeBrowserSupportMarkerPilotAction(state, services, options) {
  const adapter = services?.generateBrowserSupportMarkerPilotExport;
  if (typeof adapter !== 'function') return failure('browser support marker pilot adapter unavailable');
  const result = await adapter(state, { ...defaultOptions(), ...object(options), userGestureConfirmed: true, browserDownload: true });
  if (!result?.audit?.ok) return failure(result?.audit?.errors?.join('; ') || 'support marker pilot package blocked', result);
  const downloads = prepareSupportMarkerPilotDownloads(result, services?.downloadHost || globalThis);
  return { schema: 'BrowserSupportMarkerPilotUiResult.v1', ok: true, downloadCount: downloads.length, downloads, statusMessage: `Support marker pilot generated ${result.audit.supportMarkerCount} deterministic support markers and ${result.audit.supportPrimitiveCount || 0} support primitives. Blocked: ${result.audit.blockedSupportMarkerCount}. Full RVM ready: ${result.audit.fullModelReady === true}.`, audit: result.audit, result };
}

export function prepareSupportMarkerPilotDownloads(bundle, host) {
  return [bundle?.rvmFile, bundle?.attFile, bundle?.auditFile].filter(Boolean).map((file) => prepareDownload(file, host || globalThis));
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
  return { schema: 'BrowserSupportMarkerPilotUiResult.v1', ok: false, downloadCount: 0, downloads: [], statusMessage: `Support marker pilot blocked: ${message}`, audit: result?.audit || null, result };
}

function defaultOptions() {
  return { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true };
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
