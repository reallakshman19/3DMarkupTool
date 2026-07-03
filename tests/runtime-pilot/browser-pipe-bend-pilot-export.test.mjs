import assert from 'node:assert/strict';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { assertBrowserPipeBendPilotBoundary, generateBrowserPipeBendPilotExport } from '../../src/runtime-pilot/browser-pipe-bend-pilot-export.js';

const validOptions = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true, userGestureConfirmed: true, browserDownload: true };
const state = await buildBmCiiPhase11aState();
const browserState = { rvmExportModel: state.exportModels.rvmExportModel };

for (const options of [{}, { ...validOptions, userGestureConfirmed: false }, { ...validOptions, scope: 'wrong' }, { ...validOptions, browserDownload: false }]) {
  const blocked = await generateBrowserPipeBendPilotExport(browserState, options);
  assert.equal(blocked.audit.ok, false, 'invalid browser invocation fails closed');
  assert.equal(blocked.rvmFile, null, 'no RVM download file when blocked');
}

const bundle = await generateBrowserPipeBendPilotExport(browserState, validOptions);
assert.equal(assertBrowserPipeBendPilotBoundary(bundle), bundle);
assert.equal(bundle.rvmFile.filename, 'BM_CII_pipe_bend_runtime_pilot.rvm');
assert.equal(bundle.auditFile.filename, 'BM_CII_pipe_bend_runtime_pilot.audit.json');
assert.equal(bundle.rvmFile.bytes.byteLength > 0, true);
const audit = JSON.parse(bundle.auditFile.text);
assert.equal(audit.schema, 'BrowserPipeBendPilotExportAudit.v1');
assert.equal(audit.ok, true);
assert.equal(audit.plannedCylinderCount, 19);
assert.equal(audit.plannedTorusCount, 7);
assert.equal(audit.decodedCylinderCount, 19);
assert.equal(audit.decodedTorusCount, 7);
assert.equal(audit.decodedPrimitiveCount, 26);
assert.equal(audit.excludedFlangeCount, 8);
assert.equal(audit.blockedValveCount, 6);
assert.equal(audit.deferredSupportCount, 12);
assert.equal(audit.fullModelReady, false);
assert.equal(audit.subsetReady, true);
assert.equal(audit.productionReadyTorusCount, 0);
assert.equal(audit.productionReadyFlangeCount, 0);
assert.equal(audit.canvasTouched, false);
assert.equal(audit.threeGeometryCreated, false);
assert.equal(audit.cacheKeyMutated, false);
assert.equal(audit.oldProductionExportPathTouched, false);
assert.equal(audit.defaultRuntimeSwitchEnabled, false);
assertNoRawRuntimePayload({ audit });
for (const key of ['canvas', 'threeObject', 'threeGeometry', 'meshGeometry', 'appStateMutation', 'runtimeMutation', 'browserMutation', 'fallbackCube', 'fallbackBox', 'fallbackSphere', 'fallbackPyramid']) assert.equal(hasKey({ bundle, audit }, key), false, `no ${key}`);

console.log('browser pipe+bend pilot export adapter test passed');

function hasKey(value, key) { if (!value || typeof value !== 'object') return false; if (Object.hasOwn(value, key)) return true; if (Array.isArray(value)) return value.some((entry) => hasKey(entry, key)); return Object.values(value).some((entry) => hasKey(entry, key)); }
