import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { buildNewCoreCylinderRuntimePilotPlan } from '../../src/runtime-pilot/new-core-cylinder-code8-runtime-pilot.js';
import { writeNewCoreCylinderRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-cylinder-code8-artifact-writer.js';
import { buildNewCoreCylinderRuntimePilotAudit, assertNewCoreCylinderRuntimePilotAudit } from '../../src/runtime-pilot/new-core-cylinder-code8-runtime-audit.js';

const outdir = await mkdtemp(join(tmpdir(), 'bm-cii-ncc8-'));
const state = await buildBmCiiPhase11aState();
const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', allowPartialModel: true, writeArtifact: true, outdir };
const plan = buildNewCoreCylinderRuntimePilotPlan(state.exportModels.rvmExportModel, options);
const artifact = await writeNewCoreCylinderRuntimePilotArtifact(plan, options);
const audit = buildNewCoreCylinderRuntimePilotAudit(plan, artifact);

assert.equal(assertNewCoreCylinderRuntimePilotAudit(audit, { ok: true, plannedCylinderCount: 19, decodedCylinderCount: 19, decodedPrimitiveCount: 19, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, excludedTorusCount: 7, excludedFlangeCount: 8, blockedValveCount: 6, deferredSupportCount: 12, productionReadyFlangeCount: 0, productionReadyTorusCount: 0, fullModelReady: false, subsetReady: true, artifactGenerated: true, checksumPresent: true, sourceTraceCount: 19, productionWriterMutationCount: 0, runtimeRouteMutationCount: 0, appMutationCount: 0, browserTouchCount: 0, canvasTouchCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, fallbackPrimitiveCount: 0 }).ok, true);
assert.equal((await stat(artifact.artifactPath)).size, artifact.byteLength);
assert.match(artifact.checksumSha256, /^[0-9a-f]{64}$/);
assert.ok((await readFile(artifact.artifactPath)).byteLength > 0, 'RVM artifact exists');
assertNoRawRuntimePayload({ plan, artifact, audit });
for (const forbidden of ['objectUrl', 'downloadUrl', 'domNode', 'canvas', 'threeObject', 'threeGeometry', 'meshGeometry', 'appStateMutation', 'runtimeMutation', 'browserMutation', 'fallbackCube', 'fallbackBox', 'fallbackSphere', 'fallbackPyramid']) assert.equal(hasOwnKeyDeep({ plan, artifact, audit }, forbidden), false, `no ${forbidden}`);
await rm(outdir, { recursive: true, force: true });
console.log('BM_CII new-core CYLINDER/code8 runtime pilot test passed');

function hasOwnKeyDeep(value, key) { if (!value || typeof value !== 'object') return false; if (Object.hasOwn(value, key)) return true; if (Array.isArray(value)) return value.some((entry) => hasOwnKeyDeep(entry, key)); return Object.values(value).some((entry) => hasOwnKeyDeep(entry, key)); }
