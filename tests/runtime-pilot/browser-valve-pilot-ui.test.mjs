import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildValvePilotDownloadBundle } from '../../src/runtime-pilot/browser-valve-pilot-export.js';
import { createValvePilotActionModel, executeBrowserValvePilotAction } from '../../src/runtime-pilot/browser-valve-pilot-ui.js';

const action = createValvePilotActionModel();
assert.equal(action.panelLabel, 'New-Core Pilot Export');
assert.equal(action.buttonLabel, 'Generate Pipe+Bend+Flange+Valve Pilot Package');
assert.equal(action.normalProductionExportReplaced, false);
assert.equal(action.pilotRunsOnInit, false);
assert.ok(action.warningText.includes('deterministic inline valve body included only when dimensions exist'));

let valveAdapterCallCount = 0;
let otherAdapterCallCount = 0;
const audit = auditFixture();
const bundle = buildValvePilotDownloadBundle({ bytes: new Uint8Array([1, 2, 3]), attText: attFixture(), artifactGenerated: true }, audit, {});
const host = fakeDownloadHost();
const result = await executeBrowserValvePilotAction({}, { generateBrowserValvePilotExport: async () => { valveAdapterCallCount += 1; return bundle; }, generateBrowserPipeBendFlangePilotExport: async () => { otherAdapterCallCount += 1; }, downloadHost: host });

assert.equal(valveAdapterCallCount, 1, 'valve package action calls valve adapter once');
assert.equal(otherAdapterCallCount, 0, 'valve package action does not call pipe+bend+flange adapter');
assert.equal(result.ok, true);
assert.equal(result.downloadCount, 3);
assert.equal(host.createdUrls.length, 3);
assert.equal(host.revokedUrls.length, 3);
assert.ok(result.statusMessage.includes('Valve pilot generated 0 deterministic valve bodies'));
assert.ok(result.statusMessage.includes('Blocked: 6 valves'));

const failure = await executeBrowserValvePilotAction({}, { generateBrowserValvePilotExport: async () => ({ audit: { ok: false, errors: ['no managed-stage/new-core input loaded'] } }), downloadHost: fakeDownloadHost() });
assert.equal(failure.ok, false);
assert.ok(failure.statusMessage.includes('no managed-stage/new-core input loaded'));

const controllerSource = await readFile('src/managed-stage-json-ui-controller.js', 'utf8');
assert.ok(controllerSource.includes('newCorePilotExportPanel'), 'advanced panel exists');
assert.ok(controllerSource.includes('Export Cylinders (RVM)'), 'cylinder-only action still exists');
assert.ok(controllerSource.includes('Export Pipes + Bends (RVM)'), 'pipe+bend action still exists');
assert.ok(controllerSource.includes('Export Pipes + Bends + Flanges (Package)'), 'pipe+bend+flange action still exists');
assert.ok(controllerSource.includes('Export Full Pilot Package'), 'Export V2 full package action exists');
assert.ok(controllerSource.includes('Export Support Markers Only (Package)'), 'support-marker-only action exists');
assert.ok(controllerSource.includes('downloadRvmBtn'), 'old RVM export button remains');
assert.ok(controllerSource.includes('downloadAttBtn'), 'old ATT export button remains');
assert.ok(controllerSource.includes('downloadAuditBtn'), 'old audit export button remains');
assert.ok(controllerSource.includes('runBrowserExportV2FullPilotPackage'), 'Export V2 full package uses its own route');
assert.ok(controllerSource.includes('executeNewCorePilotRoute'), 'Export V2 full package uses new-core route controller');
assert.ok(controllerSource.includes('runBrowserValvePilotExport(true)'), 'valve pilot requires explicit click path');
assert.equal(controllerSource.includes('runBrowserValvePilotExport(true);\ninstall'), false, 'valve pilot does not run during initialization');

console.log('browser valve pilot UI action test passed');

function auditFixture() {
  return { schema: 'BrowserPipeBendFlangeValvePilotExportAudit.v1', ok: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: true, rvmDownloadPrepared: true, attDownloadPrepared: true, auditDownloadPrepared: true, plannedCylinderCount: 19, plannedTorusCount: 7, plannedFlangeCylinderCount: 8, plannedValveBodyCount: 0, generatedValveCount: 0, blockedValveCount: 6, plannedRvmPrimitiveCount: 34, decodedCylinderCount: 19, decodedTorusCount: 7, decodedFlangeCylinderCount: 8, decodedValveBodyCount: 0, decodedPrimitiveCount: 34, attRowCount: 34, attRowsMatchRvmPrimitives: true, deferredSupportCount: 12, fullModelReady: false, subsetReady: true, valveFallbackCount: 0, guessedValveDimensionCount: 0, warningCount: 6, hardErrorCount: 0, warnings: ['PE_008 blocked: missing bodyLengthMm/bodyRadiusMm'], errors: [] };
}

function attFixture() {
  return '# ATT Pilot Export\n# schema: PipeBendFlangeValveRuntimePilotAtt.v1\n# scope: pipe-bend-flange-valve-subset\nelementId|sourceItemId|sourcePrimitiveId|exportPrimitiveId|primitiveKind|primitiveCode|family|catalogueItemId|tag|name|runtimePilotStatus|runtimePilotScope|deterministicGeometry\nE|S|P|X|CYLINDER|8|pipe||||generated|pipe-bend-flange-valve-subset|true\n';
}

function fakeDownloadHost() {
  const host = { createdUrls: [], revokedUrls: [], Blob: globalThis.Blob, URL: { createObjectURL() { const url = `blob:pbfv-${host.createdUrls.length + 1}`; host.createdUrls.push(url); return url; }, revokeObjectURL(url) { host.revokedUrls.push(url); } }, document: { createElement() { return { href: '', download: '', click() { host.clickCount = (host.clickCount || 0) + 1; } }; } } };
  return host;
}
