import assert from 'node:assert/strict';
import {
  assertRichTopologyGeometryContract,
  buildRichTopologyGeometryContract
} from '../src/managed-stage-rich-topology-contract.js';

const point = (x, y, z) => ({ x, y, z });
const component = (type, id, from, to, extra = {}) => ({
  name: `${type} ${id}`,
  type,
  attributes: {
    TYPE: type,
    DTXR: type,
    SOURCE_ELEMENT_ID: id,
    REF: id,
    NAME: id,
    FROM_NODE: String(from),
    TO_NODE: String(to),
    APOS: point(0, 0, from),
    LPOS: point(0, 0, to),
    DIAMETER: '100mm',
    ...extra
  }
});

function validRich() {
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'TEST_INPUT.XML',
    converter: 'INPUTXML->STAGEDJSON',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    stats: { components: 5, children: 6, emittedSupports: 1, bends: 1 },
    hierarchy: [{
      name: '/INPUTXML/TEST/BRANCH-001',
      type: 'BRANCH',
      attributes: { TYPE: 'BRAN' },
      children: [
        component('PIPE', 'P-1', 0, 100),
        component('BEND', 'B-1', 100, 200, { BEND_RADIUS: '150mm' }),
        component('FLAN', 'F-1', 200, 260),
        component('VALV', 'V-1', 260, 360),
        component('REDU', 'R-1', 360, 420),
        { name: 'SUPPORT S-1', type: 'ATTA', attributes: { TYPE: 'ATTA', SUPPORT_KIND: 'REST', SOURCE_RESTRAINT_ID: 'S-1' } }
      ]
    }]
  };
}

function contractFor(model) { return buildRichTopologyGeometryContract(model, 'x.json'); }
function messages(contract) { return `${contract.errors.join('\n')}\n${contract.warnings.join('\n')}`; }

const pass = contractFor(validRich());
assert.equal(pass.ok, true);
assert.equal(pass.counts.geometryContracts, 5);
assert.equal(pass.counts.supportContracts, 1);
assert.equal(pass.counts.pipeContracts, 1);
assert.equal(pass.counts.bendContracts, 1);
assert.equal(pass.counts.flangeContracts, 1);
assert.equal(pass.counts.valveContracts, 1);
assert.equal(pass.counts.reducerContracts, 1);
assert.equal(pass.readiness.primitivePlanningReady, true);
assert.equal(pass.readiness.supportMappingDeferred, true);

const noDiameter = validRich();
delete noDiameter.hierarchy[0].children[0].attributes.DIAMETER;
const noDiameterContract = contractFor(noDiameter);
assert.equal(noDiameterContract.ok, false);
assert.match(messages(noDiameterContract), /diameter/);
assert.equal(noDiameterContract.contracts.find((item) => item.sourceElementId === 'P-1').contractState, 'blocked');

const noBendEvidence = validRich();
delete noBendEvidence.hierarchy[0].children[1].attributes.BEND_RADIUS;
const noBendEvidenceContract = contractFor(noBendEvidence);
assert.equal(noBendEvidenceContract.ok, false);
assert.match(messages(noBendEvidenceContract), /bend evidence/);

const noNodes = validRich();
delete noNodes.hierarchy[0].children[2].attributes.FROM_NODE;
const noNodesContract = contractFor(noNodes);
assert.equal(noNodesContract.ok, false);
assert.match(messages(noNodesContract), /fromNode\/toNode/);

const unknown = validRich();
unknown.stats.children = 7;
unknown.hierarchy[0].children.push({ name: 'UNKNOWN U-1', type: 'MISC', attributes: { TYPE: 'MISC', NAME: 'U-1' } });
const unknownContract = contractFor(unknown);
assert.equal(unknownContract.ok, false);
assert.equal(unknownContract.counts.unknownContracts, 1);
assert.match(messages(unknownContract), /unknown records/);

const valveContract = pass.contracts.find((item) => item.family === 'valve');
assert.equal(valveContract.contractState, 'primitive-ready');
assert.match(messages(pass), /visual-derived/);

const supportContract = pass.contracts.find((item) => item.family === 'support');
assert.equal(supportContract.contractState, 'support-deferred');
assert.match(messages(pass), /support records deferred/);
assert.equal(pass.ok, true);

const asserted = assertRichTopologyGeometryContract(JSON.stringify(validRich()), 'x.json');
assert.equal(asserted.ok, true);
assert.throws(
  () => assertRichTopologyGeometryContract(JSON.stringify(noDiameter), 'x.json'),
  /x\.json rich topology geometry contract rejected:.*diameter/
);
