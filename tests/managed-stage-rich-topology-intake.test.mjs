import assert from 'node:assert/strict';
import {
  assertRichTopologyManagedStageJson,
  looksLikeRichTopologyManagedStageJson,
  validateRichTopologyManagedStageJson
} from '../src/managed-stage-rich-topology-intake.js';

const validRich = {
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  source: 'TEST_INPUT.XML',
  converter: 'INPUTXML->STAGEDJSON',
  converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
  units: { length: 'mm' },
  stats: {
    components: 1,
    children: 1,
    emittedSupports: 0,
    bends: 0
  },
  hierarchy: [
    {
      name: '/INPUTXML/TEST/BRANCH-001',
      type: 'BRANCH',
      attributes: { TYPE: 'BRAN' },
      children: []
    }
  ]
};

function text(value) { return JSON.stringify(value); }
function withPatch(patch) { return { ...validRich, ...patch }; }
function errorsFor(value) { return validateRichTopologyManagedStageJson(value, 'x.json').errors.join('\n'); }

const pass = validateRichTopologyManagedStageJson(validRich, 'rich.json');
assert.equal(pass.ok, true);
assert.equal(pass.errors.length, 0);
assert.equal(pass.converterSchema, 'inputxml-direct-managed-stage/v2-rich-topology');
assert.equal(pass.branchCount, 1);

const basicGlb = withPatch({ converter: 'INPUTXML->GLB' });
const basicGlbErrors = errorsFor(basicGlb);
assert.match(basicGlbErrors, /INPUTXML->GLB basic staged JSON is not supported/);

const schemaProfileOnly = {
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  units: { length: 'mm' },
  stats: { components: 1, children: 1 },
  hierarchy: [{ name: '/X', type: 'BRANCH', children: [] }]
};
assert.match(errorsFor(schemaProfileOnly), /converterSchema/);

assert.match(errorsFor(withPatch({ units: { length: 'm' } })), /units\.length/);
assert.match(errorsFor(withPatch({ stats: { ...validRich.stats, children: 0 } })), /stats\.children/);
assert.match(errorsFor(withPatch({ stats: { ...validRich.stats, components: 2, children: 1 } })), /stats\.children < stats\.components/);

const validRichJsonText = text(validRich);
const basicGlbText = text(basicGlb);
assert.equal(looksLikeRichTopologyManagedStageJson(validRichJsonText, 'x.json'), true);
assert.equal(looksLikeRichTopologyManagedStageJson(basicGlbText, 'x.json'), false);
assert.equal(looksLikeRichTopologyManagedStageJson('{bad json', 'x.json'), false);

const asserted = assertRichTopologyManagedStageJson(validRichJsonText, 'x.json');
assert.equal(asserted.ok, true);
assert.throws(
  () => assertRichTopologyManagedStageJson(basicGlbText, 'x.json'),
  /x\.json rejected.*INPUTXML->GLB basic staged JSON is not supported/
);
