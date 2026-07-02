import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRvmFlangeCylinderTestInput, writeRvmFlangeCylinderTestBytes } from '../../src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
const model = flangeOnlyModel(state.exportModels.rvmExportModel);
const validation = validateRvmFlangeCylinderTestInput(model, { mode: 'testOnly' });
assert.equal(validation.ok, true);
assert.equal(validation.flangeCount, 8);
const result = writeRvmFlangeCylinderTestBytes(model, { mode: 'testOnly' });
assert.ok(result.data.byteLength > 0);
assert.equal(result.metadata.primitiveCount, 8);
assert.equal(result.metadata.cylinderCount, 8);
assert.equal(result.metadata.pipeCylinderCount, 0);
assert.equal(result.metadata.flangeCylinderCount, 8);
assert.equal(result.metadata.torusCount, 0);
assert.equal(result.metadata.boxCount, 0);
assert.equal(result.metadata.sphereCount, 0);
assert.equal(result.metadata.pyramidCount, 0);
assert.match(result.metadata.checksumSha256, /^[0-9a-f]{64}$/);

const withPipe = structuredClone(state.exportModels.rvmExportModel);
assert.equal(validateRvmFlangeCylinderTestInput(withPipe, { mode: 'testOnly' }).ok, false);
assert.equal(validateRvmFlangeCylinderTestInput(model, { mode: 'testOnly', runtime: true }).ok, false);
const fallback = structuredClone(model);
fallback.flangeTestByteEligiblePrimitives[0].evidence = { fallbackUsed: true };
assert.equal(validateRvmFlangeCylinderTestInput(fallback, { mode: 'testOnly' }).ok, false);
const missingCatalogue = structuredClone(model);
delete missingCatalogue.flangeTestByteEligiblePrimitives[0].catalogueItemId;
assert.equal(validateRvmFlangeCylinderTestInput(missingCatalogue, { mode: 'testOnly' }).ok, false);
assertNoRawRuntimePayload({ validation, metadata: result.metadata });

const bridgeSource = await readFile('src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js', 'utf8');
assert.equal(bridgeSource.includes('../rvm-writer.js'), false);
assert.equal(bridgeSource.includes('src/rvm-writer.js'), false);
assert.equal(bridgeSource.includes('createObjectURL'), false);
assert.equal(bridgeSource.includes("from 'three'"), false);

console.log('RVM flange cylinder test byte writer test passed');

function flangeOnlyModel(rvm) { return { ...rvm, primitives: [], testByteEligiblePrimitives: [] }; }
