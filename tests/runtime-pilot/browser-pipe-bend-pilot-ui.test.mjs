import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPipeBendPilotDownloadBundle } from '../../src/runtime-pilot/browser-pipe-bend-pilot-export.js';
import { createPipeBendPilotActionModel, executeBrowserPipeBendPilotAction } from '../../src/runtime-pilot/browser-pipe-bend-pilot-ui.js';

const action = createPipeBendPilotActionModel();
assert.equal(action.panelLabel, 'New-Core Pilot Export');
assert.equal(action.buttonLabel, 'Generate Pipe+Bend Pilot RVM');
assert.equal(action.normalProductionExportReplaced, false);
assert.equal(action.pilotRunsOnInit, false);
assert.ok(action.warningText.includes('bend TORUS/code4 included'));

let adapterCallCount = 0;
const audit = auditFixture();
const bundle = buildPipeBendPilotDownloadBundle({ bytes: new Uint8Array([1, 2, 3]), artifactGenerated: true }, audit, {});
const host = fakeDownloadHost();
const result = await executeBrowserPipeBendPilotAction({}, { generateBrowserPipeBendPilotExport: async () => { adapterCallCount += 1; return bundle; }, downloadHost: host });
assert.equal(adapterCallCount, 1, 'pilot action calls pipe+bend adapter once');
assert.equal(result.ok, true);
assert.equal(result.downloadCount, 2);
assert.equal(host.createdUrls.length, 2);
assert.equal(host.revokedUrls.length, 2);
assert.ok(result.statusMessage.includes('19 CYLINDER/code8 primitives and 7 TORUS/code4 bend primitives'));
assert.ok(result.statusMessage.includes('Excluded: 8 flanges, 6 valves, 12 supports'));

const failure = await executeBrowserPipeBendPilotAction({}, { generateBrowserPipeBendPilotExport: async () => ({ audit: { ok: false, errors: ['no managed-stage/new-core input loaded'] } }), downloadHost: fakeDownloadHost() });
assert.equal(failure.ok, false);
assert.ok(failure.statusMessage.includes('no managed-stage/new-core input loaded'));

const controllerSource = await readFile('src/managed-stage-json-ui-controller.js', 'utf8');
assert.ok(controllerSource.includes('Generate CYLINDER/code8 Pilot RVM'), 'cylinder-only action still exists');
assert.ok(controllerSource.includes('Generate Pipe+Bend Pilot RVM'), 'pipe+bend action exists');
assert.ok(controllerSource.includes('downloadRvmBtn'), 'old RVM export button remains');
assert.ok(controllerSource.includes('downloadAttBtn'), 'old ATT export button remains');
assert.ok(controllerSource.includes('downloadAuditBtn'), 'old audit export button remains');
assert.ok(controllerSource.includes('runBrowserPipeBendPilotExport(true)'), 'pipe+bend pilot requires explicit click path');
assert.equal(controllerSource.includes('runBrowserPipeBendPilotExport(true);\ninstall'), false, 'pipe+bend pilot does not run during initialization');

console.log('browser pipe+bend pilot UI action test passed');

function auditFixture() { return { schema: 'BrowserPipeBendPilotExportAudit.v1', ok: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: true, rvmDownloadPrepared: true, auditDownloadPrepared: true, plannedCylinderCount: 19, plannedTorusCount: 7, decodedCylinderCount: 19, decodedTorusCount: 7, decodedPrimitiveCount: 26, excludedFlangeCount: 8, blockedValveCount: 6, deferredSupportCount: 12, fullModelReady: false, subsetReady: true, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, productionReadyValveCount: 0, productionReadySupportCount: 0, warningCount: 0, hardErrorCount: 0, warnings: [], errors: [] }; }
function fakeDownloadHost() { const host = { createdUrls: [], revokedUrls: [], Blob: globalThis.Blob, URL: { createObjectURL() { const url = `blob:pipe-bend-${host.createdUrls.length + 1}`; host.createdUrls.push(url); return url; }, revokeObjectURL(url) { host.revokedUrls.push(url); } }, document: { createElement() { return { href: '', download: '', click() { host.clickCount = (host.clickCount || 0) + 1; } }; } } }; return host; }
