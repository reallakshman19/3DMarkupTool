import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { writeNewCoreSupportMarkerRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-support-marker-artifact-writer.js';
import { assertNewCoreSupportMarkerRuntimePilotAudit, buildNewCoreSupportMarkerRuntimePilotAudit } from '../../src/runtime-pilot/new-core-support-marker-runtime-audit.js';
import { buildNewCoreSupportMarkerRuntimePilotPlan } from '../../src/runtime-pilot/new-core-support-marker-runtime-pilot.js';

const outdir = await mkdtemp(join(tmpdir(), 'bm-cii-support-marker-'));
const state = await buildBmCiiPhase11aState();
const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-support-marker-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true, outdir };
const plan = buildNewCoreSupportMarkerRuntimePilotPlan(state, options);
const artifact = await writeNewCoreSupportMarkerRuntimePilotArtifact(plan, options);
const audit = buildNewCoreSupportMarkerRuntimePilotAudit(plan, artifact, {});

assert.equal(plan.supportMarkerCount, 12);
assert.equal(plan.blockedSupportMarkerCount, 0);
assert.equal(plan.supportGeometryGenerated, true);
assert.equal(plan.supportPrimitiveCount, 104);
assert.equal(plan.supportCylinderPrimitiveCount, 92);
assert.equal(plan.supportSpherePrimitiveCount, 12);
assert.equal(plan.supportFallbackCount, 0);
assert.equal(plan.fullModelReady, true);
assert.equal(plan.basePlan.plannedCylinderCount, 19);
assert.equal(plan.basePlan.plannedTorusCount, 7);
assert.equal(plan.basePlan.plannedFlangeCylinderCount, 8);
assert.equal(plan.plannedRvmPrimitiveCount, plan.basePlan.plannedRvmPrimitiveCount + plan.supportPrimitiveCount);
assert.equal(plan.plannedAttRowCount, plan.plannedRvmPrimitiveCount);
assert.equal(artifact.supportMarkerCount, 12);
assert.equal(artifact.supportPrimitiveCount, 104);
assert.equal(assertNewCoreSupportMarkerRuntimePilotAudit(audit, { ok: true, supportMarkerCount: 12, blockedSupportMarkerCount: 0, supportPrimitiveCount: 104, supportGeometryGenerated: true, supportFallbackCount: 0, fullModelReady: true }).ok, true);

await rm(outdir, { recursive: true, force: true });
console.log('BM_CII new-core support marker runtime pilot test passed');
