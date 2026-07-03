import assert from 'node:assert/strict';
import {
  assertManagedStagePreviewExportParity,
  buildManagedStagePreviewExportParityAudit,
  collectExportModelPrimitiveEvidence,
  collectPreviewScenePrimitiveEvidence
} from '../src/managed-stage-preview-export-parity-audit.js';

const primitive = (name, kind, code, family = 'PIPE') => ({ name, kind, code, family, sourceElementId: name });
const preview = (name, kind, code, family = 'PIPE') => ({
  name,
  userData: { TYPE: 'RVM_PRIMITIVE', primitiveKind: kind, primitiveCode: code, sourceName: name, sourceElementId: name, family },
  children: []
});
const supportPrimitive = (name, kind, code) => ({ name, kind, code, family: 'SUPPORT_MARKER', sourceElementId: name });
const supportPreview = (name, kind, code) => ({
  name: `SUPPORT_GROUP_${name}`,
  userData: { TYPE: 'SUPPORT_MARKER', family: 'SUPPORT_MARKER', sourceElementId: name },
  children: [preview(name, kind, code, 'SUPPORT_MARKER')]
});

function scene(children) {
  return {
    name: 'preview',
    children,
    traverse(callback) {
      const walk = (node) => {
        callback(node);
        for (const child of node.children || []) walk(child);
      };
      walk(this);
    }
  };
}

function exportModel(primitives) {
  return { root: { name: 'ROOT', primitives, children: [] } };
}

const validExport = exportModel([
  primitive('P-1', 'cylinder', 8, 'PIPE'),
  primitive('F-1', 'cylinder', 8, 'FLANGE'),
  primitive('B-1', 'elbow', 4, 'BEND'),
  supportPrimitive('S-1', 'cylinder', 8)
]);
const validScene = scene([
  preview('P-1', 'cylinder', 8, 'PIPE'),
  preview('F-1', 'cylinder', 8, 'FLANGE'),
  preview('B-1', 'elbow', 4, 'BEND'),
  supportPreview('S-1', 'cylinder', 8)
]);

const pass = buildManagedStagePreviewExportParityAudit(validExport, validScene, { sourceName: 'x.json' });
assert.equal(pass.ok, true);
assert.equal(pass.counts.exportPrimitiveCount, 4);
assert.equal(pass.counts.previewPrimitiveCount, 4);
assert.equal(pass.counts.exportCode8Count, 2);
assert.equal(pass.counts.exportCode4Count, 1);
assert.equal(pass.counts.previewCode8Count, 2);
assert.equal(pass.counts.previewCode4Count, 1);
assert.equal(pass.counts.exportSupportMarkerCount, 1);
assert.equal(pass.counts.previewSupportMarkerCount, 1);
assert.equal(pass.readiness.previewRepresentsExportModel, true);

const missing = buildManagedStagePreviewExportParityAudit(validExport, scene(validScene.children.slice(0, 3)), { sourceName: 'x.json' });
assert.equal(missing.ok, false);
assert.equal(missing.counts.missingPreviewPrimitiveCount, 1);
assert.match(missing.errors.join('\n'), /missing preview/);

const extra = buildManagedStagePreviewExportParityAudit(validExport, scene([...validScene.children, preview('EXTRA-1', 'cylinder', 8, 'PIPE')]), { sourceName: 'x.json' });
assert.equal(extra.ok, false);
assert.equal(extra.counts.extraPreviewPrimitiveCount, 1);
assert.match(extra.errors.join('\n'), /extra preview/);

const supportMismatch = buildManagedStagePreviewExportParityAudit(validExport, scene(validScene.children.slice(0, 3)), { sourceName: 'x.json' });
assert.equal(supportMismatch.ok, false);
assert.match(supportMismatch.errors.join('\n'), /support marker count mismatch/);

const zeroExport = buildManagedStagePreviewExportParityAudit(exportModel([]), validScene, { sourceName: 'x.json' });
assert.equal(zeroExport.ok, false);
assert.match(zeroExport.errors.join('\n'), /export primitive count is zero/);

const nestedExport = { root: { name: 'ROOT', primitives: [], children: [{ name: 'N1', primitives: [primitive('NEST-1', 'cylinder', 8, 'PIPE')], children: [] }] } };
const nestedScene = scene([{ name: 'G1', userData: {}, children: [preview('NEST-1', 'cylinder', 8, 'PIPE')] }]);
assert.equal(collectExportModelPrimitiveEvidence(nestedExport).length, 1);
assert.equal(collectPreviewScenePrimitiveEvidence(nestedScene).length, 1);
assert.equal(buildManagedStagePreviewExportParityAudit(nestedExport, nestedScene).ok, true);

const asserted = assertManagedStagePreviewExportParity(validExport, validScene, { sourceName: 'x.json' });
assert.equal(asserted.ok, true);
assert.throws(
  () => assertManagedStagePreviewExportParity(exportModel([]), validScene, { sourceName: 'x.json' }),
  /managed-stage preview\/export parity rejected:.*export primitive count is zero/
);
