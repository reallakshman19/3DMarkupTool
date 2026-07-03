import assert from 'node:assert/strict';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { countValvePilotAttRows } from '../../src/runtime-pilot/new-core-valve-att-writer.js';
import { generateBrowserValvePilotExport } from '../../src/runtime-pilot/browser-valve-pilot-export.js';

const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, userGestureConfirmed: true, browserDownload: true };

const defaultResult = await generateBrowserValvePilotExport();
assert.equal(defaultResult.rvmFile, null);
assert.equal(defaultResult.audit.ok, false);

const missingGesture = await generateBrowserValvePilotExport({}, { ...options, userGestureConfirmed: false });
assert.equal(missingGesture.audit.ok, false);
assert.ok(missingGesture.audit.errors.some((entry) => entry.includes('userGestureConfirmed')));

const wrongScope = await generateBrowserValvePilotExport({}, { ...options, scope: 'bad' });
assert.equal(wrongScope.audit.ok, false);
assert.ok(wrongScope.audit.errors.some((entry) => entry.includes('scope')));

const state = await buildBmCiiPhase11aState();
const bundle = await generateBrowserValvePilotExport(state, options);
const auditJson = JSON.parse(bundle.auditFile.text);

assert.equal(bundle.schema, 'BrowserPipeBendFlangeValvePilotDownloadBundle.v1');
assert.ok(bundle.rvmFile.bytes.byteLength > 0);
assert.equal(typeof bundle.attFile.text, 'string');
assert.equal(auditJson.schema, 'BrowserPipeBendFlangeValvePilotExportAudit.v1');
assert.equal(countValvePilotAttRows(bundle.attFile.text), bundle.audit.attRowCount);
assert.equal(bundle.audit.plannedCylinderCount, 19);
assert.equal(bundle.audit.plannedTorusCount, 7);
assert.equal(bundle.audit.plannedFlangeCylinderCount, 8);
assert.equal(bundle.audit.blockedValveCount, 6 - bundle.audit.plannedValveBodyCount);
assert.equal(bundle.audit.deferredSupportCount, 12);
assert.equal(bundle.audit.plannedRvmPrimitiveCount, 34 + bundle.audit.plannedValveBodyCount);
assert.equal(bundle.audit.attRowCount, bundle.audit.plannedRvmPrimitiveCount);
assert.equal(bundle.audit.attRowsMatchRvmPrimitives, true);
assert.equal(bundle.audit.fullModelReady, false);
assert.equal(bundle.audit.canvasTouched, false);
assert.equal(bundle.audit.threeGeometryCreated, false);
assert.equal(bundle.audit.cacheKeyMutated, false);
assert.equal(bundle.audit.appStartupBehaviorChanged, false);

console.log('browser valve pilot export test passed');
