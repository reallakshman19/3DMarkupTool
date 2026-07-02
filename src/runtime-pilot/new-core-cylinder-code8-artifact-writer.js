import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeRvmTorusCode4TestBytes } from '../artifact-adapters/rvm-code4-torus-test-byte-writer.js';
import { validCylinderRuntimePilotOptions } from './new-core-cylinder-code8-options.js';
import { validateNewCoreCylinderRuntimePilotPlan } from './new-core-cylinder-code8-runtime-pilot.js';

const ARTIFACT_SCHEMA = 'NewCoreCylinderCode8RuntimePilotArtifact.v1';
const BRIDGE = 'new-core-cylinder-code8-runtime-pilot-adapter.v1';

export async function writeNewCoreCylinderRuntimePilotArtifact(plan, options = {}) {
  const optionResult = validCylinderRuntimePilotOptions(options, 'write');
  const validation = validateNewCoreCylinderRuntimePilotPlan(plan);
  if (!optionResult.ok || !validation.ok || plan?.subsetReady !== true) return blockedArtifact(plan, optionResult, validation, options);
  const outdir = resolve(options.outdir || 'artifacts/new-core-cylinder-runtime-pilot');
  const basename = options.basename || 'BM_CII_cylinder_code8_runtime_pilot';
  const artifactPath = join(outdir, `${basename}.rvm`);
  const auditPath = join(outdir, `${basename}.audit.json`);
  const bytes = writeRvmTorusCode4TestBytes(cylinderOnlyRvmModel(plan), { mode: 'testOnly', createdAt: '2026-07-02T00:00:00.000Z' });
  await mkdir(outdir, { recursive: true });
  await writeFile(artifactPath, Buffer.from(new Uint8Array(bytes.data)));
  return resultFromMetadata(plan, bytes.metadata, artifactPath, auditPath);
}

function resultFromMetadata(plan, metadata, artifactPath, auditPath) {
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm', mode: plan.mode, scope: plan.scope, writerBridge: BRIDGE, artifactGenerated: true, artifactPath, auditPath, byteLength: metadata.byteLength, checksumSha256: metadata.checksumSha256, decodedPrimitiveCount: metadata.primitiveCount, decodedCylinderCount: metadata.cylinderCount, decodedTorusCount: metadata.torusCount, decodedFlangeCylinderCount: 0, decodedBoxCount: metadata.boxCount, decodedSphereCount: metadata.sphereCount, decodedPyramidCount: metadata.pyramidCount, sourceTrace: plan.sourceTrace.map((entry) => ({ ...entry, runtimePilotStatus: 'artifactWritten' })) };
}

function blockedArtifact(plan, optionResult, validation, options) {
  const outdir = resolve(options.outdir || 'artifacts/new-core-cylinder-runtime-pilot');
  const basename = options.basename || 'BM_CII_cylinder_code8_runtime_pilot';
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm', mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', writerBridge: BRIDGE, artifactGenerated: false, artifactPath: join(outdir, `${basename}.rvm`), auditPath: join(outdir, `${basename}.audit.json`), byteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, sourceTrace: [], errors: [...(optionResult.errors || []), ...(validation.errors || []), ...(plan?.errors || [])] };
}

function cylinderOnlyRvmModel(plan) {
  return { schema: 'RvmExportModel.v1', graphId: plan.graphId, units: plan.units, transformPolicy: 'final-review-transform.v1', transformApplied: true, primitives: plan.cylinderPrimitives.map((entry) => ({ ...entry })), testByteEligiblePrimitives: [], blockedExports: [], deferredExports: [], sourceRefs: [] };
}
