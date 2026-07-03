import assert from 'node:assert/strict';
import { assertRichTopologySourceInventory, buildRichTopologySourceInventory } from '../src/managed-stage-rich-topology-inventory.js';

const point = (x, y, z) => ({ x, y, z });
const child = (type, id, from, to, extra = {}) => ({
  name: `${type} ${id}`,
  type,
  attributes: { TYPE: type, DTXR: type, SOURCE_ELEMENT_ID: id, REF: id, NAME: id, FROM_NODE: from, TO_NODE: to, APOS: point(0, 0, from), LPOS: point(0, 0, to), ...extra }
});

function validRich() {
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'TEST_INPUT.XML',
    converter: 'INPUTXML->STAGEDJSON',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    stats: { components: 4, children: 5, emittedSupports: 1, bends: 1 },
    hierarchy: [{
      name: '/INPUTXML/TEST/BRANCH-001',
      type: 'BRANCH',
      attributes: { TYPE: 'BRAN' },
      children: [
        child('PIPE', 'P-1', 0, 100),
        child('BEND', 'B-1', 100, 200),
        child('FLAN', 'F-1', 200, 260),
        child('VALV', 'V-1', 260, 360),
        { name: 'SUPPORT S-1', type: 'ATTA', attributes: { TYPE: 'ATTA', SUPPORT_KIND: 'REST', SOURCE_RESTRAINT_ID: 'S-1' } }
      ]
    }]
  };
}

function inventoryFor(model) { return buildRichTopologySourceInventory(model, 'x.json'); }
function messages(inventory) { return `${inventory.errors.join('\n')}\n${inventory.warnings.join('\n')}`; }

const pass = inventoryFor(validRich());
assert.equal(pass.ok, true);
assert.equal(pass.actualCounts.sourceChildRecords, 5);
assert.equal(pass.actualCounts.geometryRecords, 4);
assert.equal(pass.actualCounts.supportRecords, 1);
assert.equal(pass.actualCounts.pipeRecords, 1);
assert.equal(pass.actualCounts.bendRecords, 1);
assert.equal(pass.actualCounts.flangeRecords, 1);
assert.equal(pass.actualCounts.valveRecords, 1);
assert.equal(pass.noDrop.pass, true);
assert.equal(pass.errors.length, 0);

const duplicate = validRich();
duplicate.hierarchy[0].children[1].attributes.SOURCE_ELEMENT_ID = 'P-1';
const duplicateInventory = inventoryFor(duplicate);
assert.equal(duplicateInventory.ok, false);
assert.equal(duplicateInventory.noDrop.duplicateSourceElementIdCount, 1);
assert.match(messages(duplicateInventory), /duplicate/);

const missingSpan = validRich();
delete missingSpan.hierarchy[0].children[0].attributes.LPOS;
const missingSpanInventory = inventoryFor(missingSpan);
assert.equal(missingSpanInventory.ok, false);
assert.equal(missingSpanInventory.noDrop.missingAposLposGeometryCount, 1);
assert.match(messages(missingSpanInventory), /APOS/);

const zeroLength = validRich();
zeroLength.hierarchy[0].children[0].attributes.LPOS = point(0, 0, 0);
const zeroLengthInventory = inventoryFor(zeroLength);
assert.equal(zeroLengthInventory.ok, false);
assert.equal(zeroLengthInventory.noDrop.zeroLengthGeometryCount, 1);
assert.match(messages(zeroLengthInventory), /zero-length/);

const childrenMismatch = validRich();
childrenMismatch.stats.children = 4;
const childrenMismatchInventory = inventoryFor(childrenMismatch);
assert.equal(childrenMismatchInventory.ok, false);
assert.equal(childrenMismatchInventory.noDrop.statsChildrenMismatch, true);
assert.match(messages(childrenMismatchInventory), /stats\.children/);

const componentsMismatch = validRich();
componentsMismatch.stats.components = 3;
const componentsMismatchInventory = inventoryFor(componentsMismatch);
assert.equal(componentsMismatchInventory.ok, false);
assert.equal(componentsMismatchInventory.noDrop.statsComponentsMismatch, true);
assert.match(messages(componentsMismatchInventory), /stats\.components/);

const unknown = validRich();
unknown.stats.children = 6;
unknown.hierarchy[0].children.push({ name: 'UNKNOWN U-1', type: 'MISC', attributes: { TYPE: 'MISC', NAME: 'U-1' } });
const unknownInventory = inventoryFor(unknown);
assert.equal(unknownInventory.ok, true);
assert.equal(unknownInventory.actualCounts.unknownRecords, 1);
assert.match(messages(unknownInventory), /unknown records/);

const asserted = assertRichTopologySourceInventory(JSON.stringify(validRich()), 'x.json');
assert.equal(asserted.ok, true);
assert.throws(
  () => assertRichTopologySourceInventory(JSON.stringify(duplicate), 'x.json'),
  /x\.json rich topology inventory rejected:.*duplicate/
);
