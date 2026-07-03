import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { countValvePilotAttRows } from '../../src/runtime-pilot/new-core-valve-att-writer.js';
import { writeNewCoreValveRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-valve-artifact-writer.js';
import { assertNewCoreValveRuntimePilotAudit, buildNewCoreValveRuntimePilotAudit } from '../../src/runtime-pilot/new-core-valve-runtime-audit.js';
import { buildNewCoreValveRuntimePilotPlan } from '../../src/runtime-pilot/new-core-valve-runtime-pilot.js';

const outdir = await mkdtemp(join(tmpdir(), 'bm-cii-pbfv-'));
const state = await buildBmCiiPhase11aState();
const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, outdir };
const plan = buildNewCoreValveRuntimePilotPlan(state, options);
const generatedValveCount = plan.plannedValveBodyCount;
const artifact = await writeNewCoreValveRuntimePilotArtifact(plan, options);
const audit = buildNewCoreValveRuntimePilotAudit(plan, artifact, {});
const attText = await readFile(artifact.attArtifactPath, 'utf8');

assert.equal(plan.plannedCylinderCount, 19);
assert.equal(plan.plannedTorusCount, 7);
assert.equal(plan.plannedFlangeCylinderCount, 8);
assert.equal(plan.plannedValveBodyCount, generatedValveCount);
assert.equal(plan.blockedValveCount, 6 - generatedValveCount);
assert.equal(plan.deferredSupportCount, 12);
assert.equal(plan.plannedRvmPrimitiveCount, 34 + generatedValveCount);
assert.equal(plan.plannedAttRowCount, plan.plannedRvmPrimitiveCount);
assert.equal(plan.attRowsMatchRvmPrimitives, true);
assert.equal(plan.fullModelReady, false);
assert.equal(plan.subsetReady, true);
assert.equal(plan.valveFallbackCount, 0);
assert.equal(plan.guessedValveDimensionCount, 0);

assert.equal(assertNewCoreValveRuntimePilotAudit(audit, { ok: true, plannedCylinderCount: 19, plannedTorusCount: 7, plannedFlangeCylinderCount: 8, plannedValveBodyCount: generatedValveCount, blockedValveCount: 6 - generatedValveCount, plannedRvmPrimitiveCount: 34 + generatedValveCount, decodedPrimitiveCount: 34 + generatedValveCount, attRowCount: 34 + generatedValveCount, attRowsMatchRvmPrimitives: true, deferredSupportCount: 12, fullModelReady: false, subsetReady: true }).ok, true);
assert.equal((await stat(artifact.rvmArtifactPath)).size, artifact.rvmByteLength);
assert.equal((await stat(artifact.attArtifactPath)).size, artifact.attByteLength);
assert.match(artifact.checksumSha256, /^[0-9a-f]{64}$/);
assert.equal(countValvePilotAttRows(attText), 34 + generatedValveCount);

if (generatedValveCount === 6) {
  assert.equal(plan.blockedValveCount, 0);
  assert.equal(plan.plannedRvmPrimitiveCount, 40);
  assert.equal(plan.plannedAttRowCount, 40);
} else {
  assert.ok(plan.excludedItems.filter((entry) => entry.family === 'valve').every((entry) => entry.reason.includes('missing')));
}

assertNoRawRuntimePayload({ plan, artifact, audit });
await rm(outdir, { recursive: true, force: true });
console.log(`BM_CII new-core valve runtime pilot package test passed: generated=${generatedValveCount}, blocked=${6 - generatedValveCount}`);
