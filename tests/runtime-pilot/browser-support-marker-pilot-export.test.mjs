import assert from 'node:assert/strict';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { generateBrowserSupportMarkerPilotExport } from '../../src/runtime-pilot/browser-support-marker-pilot-export.js';

const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-support-marker-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true, userGestureConfirmed: true, browserDownload: true };

const defaultResult = await generateBrowserSupportMarkerPilotExport({}, {});
assert.equal(defaultResult.rvmFile, null);
assert.equal(defaultResult.audit.ok, false);

const state = await buildBmCiiPhase11aState();
const bundle = await generateBrowserSupportMarkerPilotExport(state, options);
const audit = JSON.parse(bundle.auditFile.text);

assert.equal(bundle.schema, 'BrowserSupportMarkerPilotDownloadBundle.v1');
assert.ok(bundle.rvmFile.bytes.byteLength > 0);
assert.ok(bundle.attFile.text.includes('PipeBendFlangeValveRuntimePilotAtt.v1'));
assert.equal(audit.supportMarkerCount, 12);
assert.equal(audit.blockedSupportMarkerCount, 0);
assert.equal(audit.supportGeometryGenerated, true);
assert.equal(audit.supportPrimitiveCount, 104);
assert.equal(audit.supportCylinderPrimitiveCount, 92);
assert.equal(audit.supportSpherePrimitiveCount, 12);
assert.equal(audit.supportFallbackCount, 0);
assert.equal(audit.fullModelReady, true);
assert.equal(audit.ok, true);

console.log('browser support marker pilot export test passed');
