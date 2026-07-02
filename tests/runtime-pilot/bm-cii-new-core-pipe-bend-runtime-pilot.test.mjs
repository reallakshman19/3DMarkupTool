import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { writeNewCorePipeBendRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-pipe-bend-artifact-writer.js';
import { buildNewCorePipeBendRuntimePilotAudit, assertNewCorePipeBendRuntimePilotAudit } from '../../src/runtime-pilot/new-core-pipe-bend-runtime-audit.js';
import { buildNewCorePipeBendRuntimePilotPlan } from '../../src/runtime-pilot/new-core-pipe-bend-runtime-pilot.js';

const outdir = await mkdtemp(join(tmpdir(), 'bm-cii-pipe-bend-'));
const state = await buildBmCiiPhase11aState();
const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true, outdir };
const plan = buildNewCorePipeBendRuntimePilotPlan(state.exportModels.rvmExportModel, options);
const artifact = await writeNewCorePipeBendRuntimePilotArtifact(plan, options);
const audit = buildNewCorePipeBendRuntimePilotAudit(plan, artifact);

assert.equal(assertNewCorePipeBendRuntimePilotAudit(audit, { ok: true, plannedCylinderCount: 19, plannedTorusCount: 7, decodedCylinderCount: 19, decodedTorusCount: 7, decodedPrimitiveCount: 26, decodedFlangeCylinderCount: 0, excludedFlangeCount: 8, blockedValveCount: 6, deferredSupportCount: 12, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, fullModelReady: false, subsetReady: true, artifactGenerated: true, checksumPresent: true, sourceTraceCount: 26 }).ok, true);
assert.equal((await stat(artifact.artifactPath)).size, artifact.byteLength);
assert.ok((await readFile(artifact.artifactPath)).byteLength > 0, 'RVM artifact exists');
assert.match(artifact.checksumSha256, /^[0-9a-f]{64}$/);
assertNoRawRuntimePayload({ plan, artifact, audit });
for (const key of ['objectUrl', 'downloadUrl', 'domNode', 'canvas', 'threeObject', 'threeGeometry', 'meshGeometry', 'appStateMutation', 'runtimeMutation', 'fallbackCube', 'fallbackBox', 'fallbackSphere', 'fallbackPyramid']) assert.equal(hasKey({ plan, artifact, audit }, key), false, `no ${key}`);
await rm(outdir, { recursive: true, force: true });
console.log('BM_CII new-core pipe+bend runtime pilot test passed');

function hasKey(value, key) { if (!value || typeof value !== 'object') return false; if (Object.hasOwn(value, key)) return true; if (Array.isArray(value)) return value.some((entry) => hasKey(entry, key)); return Object.values(value).some((entry) => hasKey(entry, key)); }
