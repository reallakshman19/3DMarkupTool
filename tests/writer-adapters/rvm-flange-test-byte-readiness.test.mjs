import assert from 'node:assert/strict';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
const plan = state.writerAdapterPlan.rvmAdapter;

assert.equal(state.writerAdapterAudit.ok, true);
assert.equal(assertWriterAdapterAudit(state.writerAdapterAudit, { ok: true, rvmWriterReady: true, rvmPipeBendSubsetTestByteReady: true, flangeSubsetTestByteReady: true, rvmPlannedCylinderCount: 19, testByteEligibleBendTorusCount: 7, flangeTestByteEligibleCount: 8, flangeWriterReadyCount: 0, productionReadyFlangeCount: 0, blockedValveWriterCount: 6, deferredSupportWriterCount: 12, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0 }).ok, true);
assert.equal(plan.plannedChunks.filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER').length, 0);
assert.equal(plan.testByteEligibleItems.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER').length, 8);
assert.equal(plan.flangeWriterReadyCount, 0);
assert.equal(plan.productionReadyFlangeCount, 0);
assert.equal(plan.flangeSubsetTestByteReady, true);
assert.equal(plan.deferredItems.filter((entry) => entry.family === 'flange').length, 0);

console.log('RVM flange test-byte writer readiness test passed');
