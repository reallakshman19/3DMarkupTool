import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPipeBendFlangePilotDownloadBundle } from '../../src/runtime-pilot/browser-pipe-bend-flange-pilot-export.js';
import { createPipeBendFlangePilotActionModel, executeBrowserPipeBendFlangePilotAction } from '../../src/runtime-pilot/browser-pipe-bend-flange-pilot-ui.js';

const action = createPipeBendFlangePilotActionModel();
assert.equal(action.panelLabel, 'New-Core Pilot Export');
assert.equal(action.buttonLabel, 'Generate Pipe+Bend+Flange Pilot Package');
assert.equal(action.normalProductionExportReplaced, false);
assert.equal(action.pilotRunsOnInit, false);
assert.ok(action.warningText.includes('ATT subset included'));

let adapterCallCount = 0;
const audit = auditFixture();
const bundle = buildPipeBendFlangePilotDownloadBundle({ bytes: new Uint8Array([1, 2, 3]), attText: '# ATT Pilot Export\n# schema: PipeBendFlangeRuntimePilotAtt.v1\n# scope: pipe-bend-flange-subset\nelementId|sourceItemId|sourcePrimitiveId|exportPrimitiveId|primitiveKind|primitiveCode|family|catalogueItemId|tag|name|runtimePilotStatus|runtimePilotScope\nE|S|P|X|CYLINDER|8|pipe||||generated|pipe-bend-flange-subset\n', artifactGenerated: true }, audit, {});
const host = fakeDownloadHost();
const result = await executeBrowserPipeBendFlangePilotAction({}, { generateBrowserPipeBendFlangePilotExport: async () => { adapterCallCount += 1; return bundle; }, downloadHost: host });
assert.equal(adapterCallCount, 1, 'pilot package action calls pipe+bend+flange adapter once');
assert.equal(result.ok, true);
assert.equal(result.downloadCount, 3);
assert.equal(host.createdUrls.length, 3);
assert.equal(host.revokedUrls.length, 3);
assert.ok(result.statusMessage.includes('19 CYLINDER/code8 pipes, 7 TORUS/code4 bends, and 8 FLANGE_CYLINDER/code8 flange bodies'));
assert.ok(result.statusMessage.includes('ATT rows: 34'));
assert.ok(result.statusMessage.includes('Excluded: 6 valves, 12 supports'));

const failure = await executeBrowserPipeBendFlangePilotAction({}, { generateBrowserPipeBendFlangePilotExport: async () => ({ audit: { ok: false, errors: ['no managed-stage/new-core input loaded'] } }), downloadHost: fakeDownloadHost() });
assert.equal(failure.ok, false);
assert.ok(failure.statusMessage.includes('no managed-stage/new-core input loaded'));

const controllerSource = await readFile('src/managed-stage-json-ui-controller.js', 'utf8');
assert.ok(controllerSource.includes('Generate CYLINDER/code8 Pilot RVM'), 'cylinder-only action still exists');
assert.ok(controllerSource.includes('Generate Pipe+Bend Pilot RVM'), 'pipe+bend action still exists');
assert.ok(controllerSource.includes('Generate Pipe+Bend+Flange Pilot Package'), 'package action exists');
assert.ok(controllerSource.includes('downloadRvmBtn'), 'old RVM export button remains');
assert.ok(controllerSource.includes('downloadAttBtn'), 'old ATT export button remains');
assert.ok(controllerSource.includes('downloadAuditBtn'), 'old audit export button remains');
assert.ok(controllerSource.includes('runBrowserPipeBendFlangePilotExport(true)'), 'package pilot requires explicit click path');
assert.equal(controllerSource.includes('runBrowserPipeBendFlangePilotExport(true);\ninstall'), false, 'package pilot does not run during initialization');

console.log('browser pipe+bend+flange pilot UI action test passed');

function auditFixture() { return { schema: 'BrowserPipeBendFlangePilotExportAudit.v1', ok: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: true, rvmDownloadPrepared: true, attDownloadPrepared: true, auditDownloadPrepared: true, plannedCylinderCount: 19, plannedTorusCount: 7, plannedFlangeCylinderCount: 8, plannedRvmPrimitiveCount: 34, decodedCylinderCount: 19, decodedTorusCount: 7, decodedFlangeCylinderCount: 8, decodedPrimitiveCount: 34, attRowCount: 34, attRowsMatchRvmPrimitives: true, blockedValveCount: 6, deferredSupportCount: 12, fullModelReady: false, subsetReady: true, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, productionReadyValveCount: 0, productionReadySupportCount: 0, warningCount: 0, hardErrorCount: 0, warnings: [], errors: [] }; }
function fakeDownloadHost() { const host = { createdUrls: [], revokedUrls: [], Blob: globalThis.Blob, URL: { createObjectURL() { const url = `blob:pbf-${host.createdUrls.length + 1}`; host.createdUrls.push(url); return url; }, revokeObjectURL(url) { host.revokedUrls.push(url); } }, document: { createElement() { return { href: '', download: '', click() { host.clickCount = (host.clickCount || 0) + 1; } }; } } }; return host; }
