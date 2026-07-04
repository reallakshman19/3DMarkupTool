import assert from 'node:assert/strict';
import { createBmCiiManagedStageFixture } from '../managed-stage-bm-cii-profile-fixture.mjs';
import { generateBrowserManagedStageExportV2Package } from '../../src/runtime-pilot/browser-managed-stage-export-v2-package.js';

const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', includeSupportMarkers: true, userGestureConfirmed: true, browserDownload: true };
const state = { sourceText: JSON.stringify(createBmCiiManagedStageFixture()), sourceName: 'BM_CII_INPUT_managed_stage.json', basename: 'BM_CII_INPUT_managed_stage' };

const blocked = await generateBrowserManagedStageExportV2Package({}, options);
assert.equal(blocked.audit.ok, false);
assert.ok(blocked.audit.errors.some((entry) => entry.includes('no managed-stage/new-core input loaded')));

const bundle = await generateBrowserManagedStageExportV2Package(state, options);
assert.equal(bundle.schema, 'BrowserManagedStageExportV2DownloadBundle.v1');
assert.equal(bundle.audit.ok, true);
assert.equal(bundle.audit.scope, 'managed-stage-rich-export-v2-full-package');
assert.equal(bundle.audit.oldProductionExportPathTouched, false);
assert.equal(bundle.audit.legacyManagedStageArtifactRead, false);
assert.equal(bundle.audit.fullModelReady, true);
assert.ok(bundle.rvmFile.bytes.byteLength > 0);
assert.ok(bundle.attFile.text.includes('CADC_Attributes_File'));
assert.ok(bundle.audit.hierarchyNodeCount > 2);
assert.equal(bundle.audit.code4BendCount, 7);
assert.equal(bundle.audit.missingCode4PrimitiveCount, 0);
assert.equal(bundle.audit.supportMarkerCount, 12);
assert.ok(bundle.audit.supportPrimitiveCount > 0);
assert.equal(bundle.audit.flangeNodeCount, 11);
assert.equal(bundle.audit.valveNodeCount, 6);
assert.ok(bundle.audit.plannedValveBodyCount > 0);

console.log('browser managed-stage Export V2 rich package test passed');
