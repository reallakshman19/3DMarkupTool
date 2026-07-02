import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCylinderCode8PilotDownloadBundle } from '../../src/runtime-pilot/browser-cylinder-code8-pilot-export.js';
import { createCylinderCode8PilotActionModel, executeBrowserCylinderCode8PilotAction } from '../../src/runtime-pilot/browser-cylinder-code8-pilot-ui.js';

const action = createCylinderCode8PilotActionModel();
assert.equal(action.panelLabel, 'New-Core Pilot Export');
assert.equal(action.buttonLabel, 'Generate CYLINDER/code8 Pilot RVM');
assert.equal(action.normalProductionExportReplaced, false);
assert.equal(action.pilotRunsOnInit, false);
assert.ok(action.warningText.includes('bends excluded'));

let adapterCallCount = 0;
const audit = auditFixture();
const bundle = buildCylinderCode8PilotDownloadBundle({ bytes: new Uint8Array([1, 2, 3]), artifactGenerated: true }, audit, {});
const host = fakeDownloadHost();
const result = await executeBrowserCylinderCode8PilotAction({}, { generateBrowserCylinderCode8PilotExport: async () => { adapterCallCount += 1; return bundle; }, downloadHost: host });
assert.equal(adapterCallCount, 1, 'clicking pilot action calls browser pilot adapter once');
assert.equal(result.ok, true);
assert.equal(result.downloadCount, 2);
assert.equal(host.createdUrls.length, 2);
assert.equal(host.revokedUrls.length, 2);
assert.ok(result.statusMessage.includes('19 CYLINDER/code8 primitives'));
assert.ok(result.statusMessage.includes('Excluded: 7 bends, 8 flanges, 6 valves, 12 supports'));

const failure = await executeBrowserCylinderCode8PilotAction({}, { generateBrowserCylinderCode8PilotExport: async () => ({ audit: { ok: false, errors: ['no managed-stage/new-core input loaded'] } }), downloadHost: fakeDownloadHost() });
assert.equal(failure.ok, false);
assert.ok(failure.statusMessage.includes('no managed-stage/new-core input loaded'));

const controllerSource = await readFile('src/managed-stage-json-ui-controller.js', 'utf8');
assert.ok(controllerSource.includes('downloadRvmBtn'), 'old RVM export button remains');
assert.ok(controllerSource.includes('downloadAttBtn'), 'old ATT export button remains');
assert.ok(controllerSource.includes('downloadAuditBtn'), 'old audit export button remains');
assert.ok(controllerSource.includes('Generate CYLINDER/code8 Pilot RVM'), 'advanced pilot button exists');
assert.ok(controllerSource.includes('runBrowserCylinderCode8PilotExport(true)'), 'pilot requires explicit click path');
assert.equal(controllerSource.includes('runBrowserCylinderCode8PilotExport(true);\ninstall'), false, 'pilot does not run during initialization');
assert.equal(controllerSource.includes('defaultRuntimeSwitchEnabled = true'), false, 'default runtime config not enabled');

console.log('browser CYLINDER/code8 pilot UI action test passed');

function auditFixture() { return { schema: 'BrowserCylinderCode8PilotExportAudit.v1', ok: true, mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: true, rvmDownloadPrepared: true, auditDownloadPrepared: true, plannedCylinderCount: 19, decodedCylinderCount: 19, decodedPrimitiveCount: 19, excludedTorusCount: 7, excludedFlangeCount: 8, blockedValveCount: 6, deferredSupportCount: 12, fullModelReady: false, subsetReady: true, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, productionReadyValveCount: 0, productionReadySupportCount: 0, warningCount: 0, hardErrorCount: 0, warnings: [], errors: [] }; }
function fakeDownloadHost() { const host = { createdUrls: [], revokedUrls: [], Blob: globalThis.Blob, URL: { createObjectURL() { const url = `blob:pilot-${host.createdUrls.length + 1}`; host.createdUrls.push(url); return url; }, revokeObjectURL(url) { host.revokedUrls.push(url); } }, document: { createElement() { return { href: '', download: '', click() { host.clickCount = (host.clickCount || 0) + 1; } }; } } }; return host; }
