import assert from 'node:assert/strict';
import {
  assertManagedStageRichArtifactPackage,
  buildManagedStageRichArtifactPackage,
  byteLengthOfArtifact,
  hashArtifactContent
} from '../src/managed-stage-rich-artifact-package.js';

function validParts(overrides = {}) {
  const richTopologyInventory = { ok: true };
  const richTopologyGeometryContract = { ok: true };
  const richTopologySupportMapping = { ok: true, warnings: [] };
  const richTopologyPreviewExportParity = { ok: true };
  return {
    sourceText: '{"schema":"inputxml-managed-stage/v1"}',
    sourceName: 'TEST_INPUT_managed_stage.json',
    basename: 'TEST_INPUT_managed_stage',
    rvm: new Uint8Array([1, 2, 3, 4]),
    att: 'ATT\nDATA\n',
    audit: { richTopologyInventory, richTopologyGeometryContract, richTopologySupportMapping, richTopologyPreviewExportParity },
    exportModel: { root: {} },
    sourceContract: { supports: [] },
    richTopologyInventory,
    richTopologyGeometryContract,
    richTopologySupportMapping,
    richTopologyPreviewExportParity,
    ...overrides
  };
}

const options = { generatedAt: '2026-07-03T00:00:00.000Z', packageName: 'TEST_INPUT_package' };
const pass = buildManagedStageRichArtifactPackage(validParts(), options);
assert.equal(pass.ok, true);
assert.equal(pass.files.length, 3);
assert.equal(pass.counts.fileCount, 3);
assert.equal(pass.counts.presentFileCount, 3);
assert.equal(pass.readiness.packageReady, true);
assert.equal(pass.readiness.evidenceComplete, true);
assert.equal(pass.integrity.algorithm, 'fnv1a-32');
assert.match(pass.integrity.rvmHash, /^[0-9a-f]{8}$/);
assert.match(pass.integrity.attHash, /^[0-9a-f]{8}$/);
assert.match(pass.integrity.auditHash, /^[0-9a-f]{8}$/);
assert.deepEqual(pass.files.map((file) => file.filename), [
  'TEST_INPUT_managed_stage.rvm',
  'TEST_INPUT_managed_stage.att',
  'TEST_INPUT_managed_stage.audit.json'
]);

const missingRvm = buildManagedStageRichArtifactPackage(validParts({ rvm: null }), options);
assert.equal(missingRvm.ok, false);
assert.match(missingRvm.errors.join('\n'), /RVM artifact missing/);
assert.equal(missingRvm.readiness.rvmReady, false);

const missingAtt = buildManagedStageRichArtifactPackage(validParts({ att: '' }), options);
assert.equal(missingAtt.ok, false);
assert.match(missingAtt.errors.join('\n'), /ATT artifact missing/);

const noSupportMapping = validParts({ richTopologySupportMapping: undefined });
noSupportMapping.audit = { ...noSupportMapping.audit, richTopologySupportMapping: undefined };
const missingEvidence = buildManagedStageRichArtifactPackage(noSupportMapping, options);
assert.equal(missingEvidence.ok, false);
assert.match(missingEvidence.errors.join('\n'), /required rich evidence block missing/);
assert.equal(missingEvidence.readiness.evidenceComplete, false);

const parityFailed = buildManagedStageRichArtifactPackage(validParts({ richTopologyPreviewExportParity: { ok: false } }), options);
assert.equal(parityFailed.ok, true);
assert.match(parityFailed.warnings.join('\n'), /preview\/export parity failed/);

assert.equal(byteLengthOfArtifact('abc'), 3);
assert.equal(byteLengthOfArtifact(new Uint8Array([1, 2, 3])), 3);
assert.equal(hashArtifactContent('abc'), hashArtifactContent('abc'));
assert.match(hashArtifactContent('abc'), /^[0-9a-f]{8}$/);

const asserted = assertManagedStageRichArtifactPackage(validParts(), options);
assert.equal(asserted.ok, true);
assert.throws(
  () => assertManagedStageRichArtifactPackage(validParts({ rvm: null }), options),
  /managed-stage rich artifact package rejected:.*RVM artifact missing/
);
