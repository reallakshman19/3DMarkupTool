import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  compareManagedStageRichRegressionResult,
  runManagedStageRichRegressionGate
} from '../src/managed-stage-rich-regression-gate.js';

const fixturePath = 'fixtures/managed-stage-rich/golden-rich-topology-managed-stage.json';
const expectedPath = 'fixtures/managed-stage-rich/golden-rich-topology-expected.json';

async function loadJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const result = await runManagedStageRichRegressionGate();
assert.equal(result.ok, true, result.errors.join('\n'));
for (const [key, value] of Object.entries(result.gates)) assert.equal(value, true, `${key} should pass`);
assert.equal(result.counts.sourceChildRecords, 7);
assert.equal(result.counts.geometryRecords, 5);
assert.equal(result.counts.supportRecords, 2);
assert.equal(result.counts.bendRecords, 1);
assert.equal(result.counts.geometryContracts, 5);
assert.equal(result.counts.supportContracts, 2);
assert.equal(result.counts.supportMappedRecords, 2);
assert.equal(result.counts.packageFileCount, 3);
assert.equal(result.counts.packagePresentFileCount, 3);
assert.ok(result.artifacts.rvmBytes > 0);
assert.ok(result.artifacts.attBytes > 0);
assert.deepEqual(Object.keys(result), ['schema', 'ok', 'fixture', 'gates', 'counts', 'artifacts', 'errors', 'warnings']);

const fixture = await loadJson(fixturePath);
const expected = await loadJson(expectedPath);

const missingConverter = clone(fixture);
delete missingConverter.converterSchema;
const wp1Fail = await runManagedStageRichRegressionGate({ fixtureObject: missingConverter, expectedManifest: null, fixtureName: 'missing-converter.json' });
assert.equal(wp1Fail.ok, false);
assert.equal(wp1Fail.gates.intakeOk, false);
assert.match(wp1Fail.errors.join('\n'), /intake|converterSchema/i);

const missingBendEvidence = clone(fixture);
const bend = missingBendEvidence.hierarchy[0].children.find((child) => child.type === 'BEND');
delete bend.attributes.BEND_RADIUS_MM;
delete bend.attributes.BEND_ANGLE_DEG;
const wp3Fail = await runManagedStageRichRegressionGate({ fixtureObject: missingBendEvidence, expectedManifest: null, fixtureName: 'missing-bend-evidence.json' });
assert.equal(wp3Fail.ok, false);
assert.match(wp3Fail.errors.join('\n'), /geometryContract|bend evidence/i);

const missingSupportPosition = clone(fixture);
const support = missingSupportPosition.hierarchy[0].children.find((child) => child.type === 'ATTA');
delete support.attributes.SUPPORTCOORD;
const wp4Fail = await runManagedStageRichRegressionGate({ fixtureObject: missingSupportPosition, expectedManifest: null, fixtureName: 'missing-support-position.json' });
assert.equal(wp4Fail.ok, false);
assert.match(wp4Fail.errors.join('\n'), /supportMapping|position/i);

const badExpected = clone(expected);
badExpected.expected.geometryRecords = 999;
const mismatch = compareManagedStageRichRegressionResult(result, badExpected);
assert.equal(mismatch.ok, false);
assert.match(mismatch.errors.join('\n'), /counts\.geometryRecords/);
