import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmPipeBendSubsetArtifactReady: true, rvmStraightPipeSubsetArtifactReady: true, rvmBendTorusSubsetArtifactReady: true, rvmFlangeSubsetArtifactReady: true, rvmFullModelArtifactReady: false, artifactGenerated: true, primitiveWriteCount: 34, cylinderWriteCount: 27, pipeCylinderWriteCount: 19, flangeCylinderWriteCount: 8, torusWriteCount: 7, flangeWriteCount: 8, boxWriteCount: 0, sphereWriteCount: 0, pyramidWriteCount: 0, supportWriteCount: 0, decodedPrimitiveCount: 34, decodedCylinderCount: 27, decodedPipeCylinderCount: 19, decodedFlangeCylinderCount: 8, decodedTorusCount: 7, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, blockedValveCount: 6, deferredSupportWriterCount: 12, deferredFlangeWriterCount: 0, productionWriterCallCount: 0, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.rvmByteProof.writerBridge, 'composite-pipe-bend-flange-test-byte-proof.v1');
assert.deepEqual(state.rvmByteProof.writerBridges, ['src/artifact-adapters/rvm-code4-torus-test-byte-writer.js', 'src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js']);
assert.equal(state.rvmByteProof.artifactSegments.length, 2);
assert.equal(state.rvmByteProof.artifactSegments.find((entry) => entry.segmentKind === 'pipe-bend').decodedPipeCylinderCount, 19);
assert.equal(state.rvmByteProof.artifactSegments.find((entry) => entry.segmentKind === 'flange').decodedFlangeCylinderCount, 8);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerStatus === 'byteProven').length, 8);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'valve' && entry.artifactStatus === 'blocked').length, 6);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'support' && entry.artifactStatus === 'deferred').length, 12);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });

for (const runtimePath of ['src/app.js', 'src/app-loader.js', 'src/safe-ui-loader.js', 'src/managed-stage-json-ui-controller.js', 'src/managed-stage-rvm-converter.js', 'src/rvm-writer.js', 'src/att-writer.js']) {
  const source = await readFile(runtimePath, 'utf8');
  assert.equal(source.includes('rvm-flange-cylinder-test-byte-writer'), false, `${runtimePath} must not import flange byte bridge`);
}

console.log('BM CII RVM flange byte proof integration test passed');
