import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { countPipeBendFlangePilotAttRows } from '../../src/runtime-pilot/new-core-pipe-bend-flange-att-writer.js';
import { writeNewCorePipeBendFlangeRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-pipe-bend-flange-artifact-writer.js';
import { buildNewCorePipeBendFlangeRuntimePilotAudit, assertNewCorePipeBendFlangeRuntimePilotAudit } from '../../src/runtime-pilot/new-core-pipe-bend-flange-runtime-audit.js';
import { buildNewCorePipeBendFlangeRuntimePilotPlan } from '../../src/runtime-pilot/new-core-pipe-bend-flange-runtime-pilot.js';

const outdir = await mkdtemp(join(tmpdir(), 'bm-cii-pbf-'));
const state = await buildBmCiiPhase11aState();
const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, outdir };
const plan = buildNewCorePipeBendFlangeRuntimePilotPlan(state.exportModels, options);
const artifact = await writeNewCorePipeBendFlangeRuntimePilotArtifact(plan, options);
const audit = buildNewCorePipeBendFlangeRuntimePilotAudit(plan, artifact);
const attText = await readFile(artifact.attArtifactPath, 'utf8');

assert.equal(assertNewCorePipeBendFlangeRuntimePilotAudit(audit, { ok: true, plannedCylinderCount: 19, plannedTorusCount: 7, plannedFlangeCylinderCount: 8, plannedRvmPrimitiveCount: 34, decodedCylinderCount: 19, decodedTorusCount: 7, decodedFlangeCylinderCount: 8, decodedPrimitiveCount: 34, attRowCount: 34, attRowsMatchRvmPrimitives: true, blockedValveCount: 6, deferredSupportCount: 12, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, fullModelReady: false, subsetReady: true, artifactGenerated: true, checksumPresent: true, sourceTraceCount: 34 }).ok, true);
assert.equal((await stat(artifact.rvmArtifactPath)).size, artifact.rvmByteLength);
assert.equal((await stat(artifact.attArtifactPath)).size, artifact.attByteLength);
assert.match(artifact.checksumSha256, /^[0-9a-f]{64}$/);
assert.equal(countPipeBendFlangePilotAttRows(attText), 34);
assertNoRawRuntimePayload({ plan, artifact, audit });
await rm(outdir, { recursive: true, force: true });
console.log('BM_CII new-core pipe+bend+flange runtime pilot package test passed');
