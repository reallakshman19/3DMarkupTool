import assert from 'node:assert/strict';
import { buildSupportMarkerPilotDownloadBundle } from '../../src/runtime-pilot/browser-support-marker-pilot-export.js';
import { createSupportMarkerPilotActionModel, executeBrowserSupportMarkerPilotAction } from '../../src/runtime-pilot/browser-support-marker-pilot-ui.js';

const action = createSupportMarkerPilotActionModel();
assert.equal(action.buttonLabel, 'Generate Pipe+Bend+Flange+Valve+Support Marker Pilot Package');
assert.equal(action.toggleLabel, 'Include deterministic support markers');
assert.equal(action.normalProductionExportReplaced, false);
assert.equal(action.pilotRunsOnInit, false);

let adapterCallCount = 0;
const bundle = buildSupportMarkerPilotDownloadBundle({ bytes: new Uint8Array([1, 2, 3]), attText: 'att', artifactGenerated: true }, auditFixture(), {});
const host = fakeDownloadHost();
const result = await executeBrowserSupportMarkerPilotAction({}, { generateBrowserSupportMarkerPilotExport: async () => { adapterCallCount += 1; return bundle; }, downloadHost: host });

assert.equal(adapterCallCount, 1);
assert.equal(result.ok, true);
assert.equal(result.downloadCount, 3);
assert.equal(host.createdUrls.length, 3);
assert.equal(host.revokedUrls.length, 3);
assert.ok(result.statusMessage.includes('12 deterministic support markers'));
assert.ok(result.statusMessage.includes('104 support primitives'));
assert.ok(result.statusMessage.includes('Full RVM ready: true'));

console.log('browser support marker pilot UI test passed');

function auditFixture() {
  return { schema: 'NewCoreSupportMarkerRuntimePilotAudit.v1', ok: true, scope: 'pipe-bend-flange-valve-support-marker-subset', artifactGenerated: true, supportMarkerCount: 12, blockedSupportMarkerCount: 0, supportPrimitiveCount: 104, supportGeometryGenerated: true, supportFallbackCount: 0, fullModelReady: true, subsetReady: true, errors: [], warnings: [] };
}

function fakeDownloadHost() {
  const host = { createdUrls: [], revokedUrls: [], Blob: globalThis.Blob, URL: { createObjectURL() { const url = `blob:support-${host.createdUrls.length + 1}`; host.createdUrls.push(url); return url; }, revokeObjectURL(url) { host.revokedUrls.push(url); } }, document: { createElement() { return { click() { host.clickCount = (host.clickCount || 0) + 1; } }; } } };
  return host;
}
