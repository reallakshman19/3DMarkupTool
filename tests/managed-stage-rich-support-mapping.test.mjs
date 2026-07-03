import assert from 'node:assert/strict';
import {
  assertRichTopologySupportMapping,
  buildRichTopologySupportMapping,
  classifySupportMappingState,
  validateRichTopologySupportMapping
} from '../src/managed-stage-rich-support-mapping.js';

const point = (x, y, z) => ({ x, y, z });
const pipe = () => ({
  name: 'PIPE P-1',
  type: 'PIPE',
  attributes: {
    TYPE: 'PIPE', DTXR: 'PIPE', SOURCE_ELEMENT_ID: 'P-1', REF: 'P-1', NAME: 'P-1',
    FROM_NODE: '10', TO_NODE: '20', APOS: point(0, 0, 0), LPOS: point(1000, 0, 0), DIAMETER: '100mm'
  }
});
const support = (kind, tag, extra = {}) => ({
  name: tag || 'SUPPORT',
  type: 'ATTA',
  attributes: {
    TYPE: 'ATTA', DTXR: kind, SUPPORT_KIND: kind, SUPPORT_TAG: tag, SOURCE_RESTRAINT_ID: tag,
    NODE: '20', SUPPORT_AXIS: '+Y', SUPPORTCOORD: point(1000, 0, 0), ...extra
  }
});

function rich(children, stats = { components: 1, children: children.length, emittedSupports: children.length - 1, bends: 0 }) {
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'TEST_INPUT.XML',
    converter: 'INPUTXML->STAGEDJSON',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    stats,
    hierarchy: [{ name: '/INPUTXML/TEST/BRANCH-001', type: 'BRANCH', attributes: { TYPE: 'BRAN' }, children }]
  };
}

function mappingFor(model) { return buildRichTopologySupportMapping(model, 'x.json'); }
function messages(mapping) { return `${mapping.errors.join('\n')}\n${mapping.warnings.join('\n')}`; }

const pass = mappingFor(rich([pipe(), support('REST', 'PS-REST-001')], { components: 1, children: 2, emittedSupports: 1, bends: 0 }));
assert.equal(pass.ok, true);
assert.equal(pass.counts.sourceSupportRecords, 1);
assert.equal(pass.counts.mappedSupportRecords, 1);
assert.equal(pass.counts.readySupportMarkers, 1);
assert.equal(pass.supports[0].mappingState, 'marker-ready');
assert.equal(pass.readiness.supportMarkerReady, true);
assert.equal(pass.supports[0].visualPolicy.supportMarkerOnly, true);
assert.equal(pass.supports[0].visualPolicy.catalogueSupport, false);
assert.equal(pass.supports[0].visualPolicy.structuralSteel, false);

const unknown = mappingFor(rich([pipe(), support('MYSTERY_SUPPORT', 'PS-UNK-001')], { components: 1, children: 2, emittedSupports: 1, bends: 0 }));
assert.equal(unknown.ok, true);
assert.equal(unknown.counts.unknownFamilyCount, 1);
assert.equal(unknown.supports[0].mappingState, 'warning-ready');
assert.match(messages(unknown), /unknown support families/);

const missingPosition = rich([pipe(), support('REST', 'PS-NOPOS-001')], { components: 1, children: 2, emittedSupports: 1, bends: 0 });
delete missingPosition.hierarchy[0].children[1].attributes.SUPPORTCOORD;
const missingPositionMapping = mappingFor(missingPosition);
assert.equal(missingPositionMapping.ok, false);
assert.match(messages(missingPositionMapping), /position/);

const missingIdState = classifySupportMappingState({ supportId: '', supportMarkerId: 'M-1', positionMm: point(0, 0, 0), diagnostics: [] });
assert.equal(missingIdState, 'blocked');
const gapCarryForwardState = classifySupportMappingState({ supportId: 'S-1', supportMarkerId: 'M-1', positionMm: point(0, 0, 0), sourceAttributes: { SUPPORT_GAP_CARRY_FORWARD: 'TRUE' }, diagnostics: [] });
assert.equal(gapCarryForwardState, 'blocked');
const gapValidation = validateRichTopologySupportMapping({ counts: { fatalSupportRecords: 1, sourceSupportRecords: 1, mappedSupportRecords: 1, unknownFamilyCount: 0 }, supports: [{ supportMarkerId: 'M-1', position: { hasPosition: true }, gap: { carryForward: true } }] });
assert.equal(gapValidation.ok, false);
assert.match(gapValidation.errors.join('\n'), /gap carry-forward/);

const family = mappingFor(rich([
  pipe(),
  support('REST', 'PS-REST'),
  support('GUIDE', 'PS-GUIDE'),
  support('LINESTOP', 'PS-LS', { SUPPORT_AXIS: '+X' }),
  support('HOLDDOWN', 'PS-HD'),
  support('SPRING_CAN', 'PS-SC')
], { components: 1, children: 6, emittedSupports: 5, bends: 0 }));
assert.equal(family.counts.restCount, 1);
assert.equal(family.counts.guideCount, 1);
assert.equal(family.counts.lineStopCount, 1);
assert.equal(family.counts.holdDownCount, 1);
assert.equal(family.counts.springCanCount, 1);

const asserted = assertRichTopologySupportMapping(JSON.stringify(rich([pipe(), support('REST', 'PS-REST-002')], { components: 1, children: 2, emittedSupports: 1, bends: 0 })), 'x.json');
assert.equal(asserted.ok, true);
assert.throws(
  () => assertRichTopologySupportMapping(JSON.stringify(missingPosition), 'x.json'),
  /x\.json rich topology support mapping rejected:.*position/
);
