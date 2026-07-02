import assert from 'node:assert/strict';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { countPipeBendFlangePilotAttRows } from '../../src/runtime-pilot/new-core-pipe-bend-flange-att-writer.js';
import { assertBrowserPipeBendFlangePilotBoundary, generateBrowserPipeBendFlangePilotExport } from '../../src/runtime-pilot/browser-pipe-bend-flange-pilot-export.js';

const validOptions = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, userGestureConfirmed: true, browserDownload: true };
const state = await buildBmCiiPhase11aState();
const browserState = { exportModels: state.exportModels };

for (const options of [{}, { ...validOptions, userGestureConfirmed: false }, { ...validOptions, scope: 'wrong' }, { ...validOptions, browserDownload: false }]) {
  const blocked = await generateBrowserPipeBendFlangePilotExport(browserState, options);
  assert.equal(blocked.audit.ok, false, 'invalid browser invocation fails closed');
  assert.equal(blocked.rvmFile, null, 'no RVM download file when blocked');
}

const bundle = await generateBrowserPipeBendFlangePilotExport(browserState, validOptions);
assert.equal(assertBrowserPipeBendFlangePilotBoundary(bundle), bundle);
assert.equal(bundle.rvmFile.filename, 'BM_CII_pipe_bend_flange_runtime_pilot.rvm');
assert.equal(bundle.attFile.filename, 'BM_CII_pipe_bend_flange_runtime_pilot.att');
assert.equal(bundle.auditFile.filename, 'BM_CII_pipe_bend_flange_runtime_pilot.audit.json');
assert.equal(bundle.rvmFile.bytes.byteLength > 0, true);
assert.equal(countPipeBendFlangePilotAttRows(bundle.attFile.text), 34);
const audit = JSON.parse(bundle.auditFile.text);
assert.equal(audit.schema, 'BrowserPipeBendFlangePilotExportAudit.v1');
assert.equal(audit.ok, true);
assert.equal(audit.plannedCylinderCount, 19);
assert.equal(audit.plannedTorusCount, 7);
assert.equal(audit.plannedFlangeCylinderCount, 8);
assert.equal(audit.plannedRvmPrimitiveCount, 34);
assert.equal(audit.decodedCylinderCount, 19);
assert.equal(audit.decodedTorusCount, 7);
assert.equal(audit.decodedFlangeCylinderCount, 8);
assert.equal(audit.decodedPrimitiveCount, 34);
assert.equal(audit.attRowCount, 34);
assert.equal(audit.attRowsMatchRvmPrimitives, true);
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

console.log('browser pipe+bend+flange pilot export adapter test passed');
