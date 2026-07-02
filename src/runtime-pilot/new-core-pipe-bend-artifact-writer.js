import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeRvmTorusCode4TestBytes } from '../artifact-adapters/rvm-code4-torus-test-byte-writer.js';
import { validateNewCorePipeBendRuntimePilotPlan } from './new-core-pipe-bend-runtime-pilot.js';

const ARTIFACT_SCHEMA = 'NewCorePipeBendRuntimePilotArtifact.v1';
const BRIDGE = 'new-core-pipe-bend-runtime-pilot-adapter.v1';

export async function writeNewCorePipeBendRuntimePilotArtifact(plan, options = {}) {
  const optionErrors = writerOptionErrors(options);
  const validation = validateNewCorePipeBendRuntimePilotPlan(plan);
  if (optionErrors.length || !validation.ok || plan?.subsetReady !== true) return blockedArtifact(plan, optionErrors, validation, options);
  const outdir = resolve(options.outdir || 'artifacts/new-core-pipe-bend-runtime-pilot');
  const basename = options.basename || 'BM_CII_pipe_bend_runtime_pilot';
  const artifactPath = join(outdir, `${basename}.rvm`);
  const auditPath = join(outdir, `${basename}.audit.json`);
  const bytes = writeRvmTorusCode4TestBytes(pipeBendRvmModel(plan), { mode: 'testOnly', createdAt: '2026-07-02T00:00:00.000Z' });
  await mkdir(outdir, { recursive: true });
  await writeFile(artifactPath, Buffer.from(new Uint8Array(bytes.data)));
  return resultFromMetadata(plan, bytes.metadata, artifactPath, auditPath);
}

function resultFromMetadata(plan, metadata, artifactPath, auditPath) {
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm', mode: plan.mode, scope: plan.scope, writerBridge: BRIDGE, artifactGenerated: true, artifactPath, auditPath, byteLength: metadata.byteLength, checksumSha256: metadata.checksumSha256, decodedPrimitiveCount: metadata.primitiveCount, decodedCylinderCount: metadata.cylinderCount, decodedTorusCount: metadata.torusCount, decodedFlangeCylinderCount: 0, decodedBoxCount: metadata.boxCount, decodedSphereCount: metadata.sphereCount, decodedPyramidCount: metadata.pyramidCount, sourceTrace: plan.sourceTrace.map((entry) => ({ ...entry, runtimePilotStatus: 'artifactWritten' })) };
}

function blockedArtifact(plan, optionErrors, validation, options) {
  const outdir = resolve(options.outdir || 'artifacts/new-core-pipe-bend-runtime-pilot');
  const basename = options.basename || 'BM_CII_pipe_bend_runtime_pilot';
  const errors = [...optionErrors, ...(validation.errors || []), ...(plan?.errors || [])];
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm', mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', writerBridge: BRIDGE, artifactGenerated: false, artifactPath: join(outdir, `${basename}.rvm`), auditPath: join(outdir, `${basename}.audit.json`), byteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, sourceTrace: [], errors };
}

function pipeBendRvmModel(plan) {
  return { schema: 'RvmExportModel.v1', graphId: plan.graphId, units: plan.units, sourceAxisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, primitives: plan.cylinderPrimitives.map((entry) => ({ ...entry })), testByteEligiblePrimitives: plan.torusPrimitives.map((entry) => ({ ...entry })), flangeTestByteEligiblePrimitives: [], blockedExports: [], deferredExports: [], sourceRefs: [] };
}

function writerOptionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true };
  const errors = [];
  for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`);
  return errors;
}
