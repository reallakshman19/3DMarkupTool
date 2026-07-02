import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeCylinderRuntimePilotOptions } from '../../src/runtime-pilot/new-core-cylinder-code8-options.js';
import { buildNewCoreCylinderRuntimePilotPlan, validateNewCoreCylinderRuntimePilotPlan } from '../../src/runtime-pilot/new-core-cylinder-code8-runtime-pilot.js';
import { writeNewCoreCylinderRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-cylinder-code8-artifact-writer.js';

const validOptions = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', allowPartialModel: true, writeArtifact: true };

assert.equal(normalizeCylinderRuntimePilotOptions().ok, false, 'disabled by default');
for (const options of [{ ...validOptions, enabled: false }, { ...validOptions, mode: 'bad' }, { ...validOptions, scope: 'bad' }, { ...validOptions, allowPartialModel: false }, { ...validOptions, browser: true }, { ...validOptions, canvas: true }, { ...validOptions, download: true }, { ...validOptions, objectUrl: true }]) {
  assert.equal(normalizeCylinderRuntimePilotOptions(options).ok, false, 'invalid options fail closed');
  const plan = buildNewCoreCylinderRuntimePilotPlan(rvmWith([cylinder()]), options);
  assert.equal(plan.subsetReady, false, 'invalid options cannot build ready plan');
  const artifact = await writeNewCoreCylinderRuntimePilotArtifact(plan, { ...options, outdir: join(await mkdtemp(join(tmpdir(), 'ncc8-invalid-')), 'out') });
  assert.equal(artifact.artifactGenerated, false, 'invalid options do not generate artifacts');
}

const plan = buildNewCoreCylinderRuntimePilotPlan(rvmWith([cylinder()]), validOptions);
assert.equal(plan.schema, 'NewCoreCylinderCode8RuntimePilotPlan.v1');
assert.equal(plan.subsetReady, true);
assert.equal(plan.plannedCylinderCount, 1);
assert.equal(plan.browserTouched, false);
assert.equal(plan.canvasTouched, false);
assert.equal(plan.objectUrlCreated, false);
assert.equal(plan.downloadCreated, false);
assert.equal(validateNewCoreCylinderRuntimePilotPlan(plan).ok, true);

for (const bad of [rvmWith([], { testByteEligiblePrimitives: [torus()] }), rvmWith([], { flangeTestByteEligiblePrimitives: [flange()] }), rvmWith([cylinder({ evidence: { fallbackUsed: true } })]), rvmWith([cylinder({ basis: 'authoring' })]), rvmWith([{ ...cylinder(), primitiveKind: 'BOX', primitiveCode: 2 }]), rvmWith([{ ...cylinder(), primitiveKind: 'SPHERE', primitiveCode: 9 }]), rvmWith([{ ...cylinder(), primitiveKind: 'PYRAMID', primitiveCode: 1 }]), rvmWith([{ ...cylinder(), primitiveKind: 'SUPPORT', family: 'support' }])]) {
  const badPlan = buildNewCoreCylinderRuntimePilotPlan(bad, validOptions);
  assert.equal(badPlan.subsetReady, false, 'unsupported or invalid RVM input fails closed');
}

await rm(join(tmpdir(), 'ncc8-invalid-nonexistent'), { recursive: true, force: true });
console.log('new-core CYLINDER/code8 runtime pilot unit test passed');

function rvmWith(primitives, extra = {}) { return { schema: 'RvmExportModel.v1', graphId: 'unit-runtime-pilot', units: 'mm', transformPolicy: 'final-review-transform.v1', transformApplied: true, primitives, testByteEligiblePrimitives: [], flangeTestByteEligiblePrimitives: [], blockedExports: [], deferredExports: [], sourceRefs: [], ...extra }; }
function cylinder(overrides = {}) { return { exportPrimitiveId: 'RVM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [0, 1, 0], lengthMm: 1000, radiusMm: 57.15, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'unit/PIPE-1', ...overrides }; }
function torus() { return { sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, family: 'elbow' }; }
function flange() { return { sourceItemId: 'FLANGE-1', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, family: 'flange' }; }
