import assert from 'node:assert/strict';

import { writeAtt } from '../src/att-writer.js';
import { buildManagedStageRvmExportModel } from '../src/managed-stage-rvm-export-model.js';

const point = (x, y, z = 0) => ({ x, y, z });

function record(type, attrs = {}) {
  const name = attrs.NAME || `${type}-ATT-TEST`;
  return {
    name,
    type,
    attributes: {
      SOURCE_ELEMENT_ID: name,
      REF: name,
      NAME: name,
      TYPE: type,
      RAW_TYPE: type,
      DTXR: type,
      FROM_NODE: '10',
      TO_NODE: '20',
      APOS: point(0, 0, 0),
      LPOS: point(1000, 0, 0),
      OUTSIDE_DIAMETER_MM: 100,
      MATERIAL: 'A106 B',
      ...attrs
    }
  };
}

function profile(records) {
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'WP10_ATT_TEST.XML',
    converter: 'INPUTXML->STAGEDJSON',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    geometryRecords: records,
    supportRecords: [],
    branches: []
  };
}

function buildAtt(records, options = {}) {
  return writeAtt(buildManagedStageRvmExportModel(profile(records), options));
}

function assertContains(att, value) {
  assert.ok(att.includes(value), `ATT should contain ${value}`);
}

const pipeBendAtt = buildAtt([
  record('PIPE', { NAME: 'PIPE_10_TO_20' }),
  record('BEND', {
    NAME: 'BEND_20_TO_30',
    FROM_NODE: '20',
    TO_NODE: '30',
    APOS: point(1000, 0, 0),
    LPOS: point(1000, 1000, 0),
    BEND_RADIUS_MM: 150,
    BEND_ANGLE_DEG: 90
  })
]);
assertContains(pipeBendAtt, "SOURCE_ELEMENT_ID := 'PIPE_10_TO_20'");
assertContains(pipeBendAtt, "CENTERLINE_KIND := 'line'");
assertContains(pipeBendAtt, "CENTERLINE_KIND := 'arc'");
assertContains(pipeBendAtt, "START_X_MM := '0'");
assertContains(pipeBendAtt, "END_X_MM := '1000'");
assertContains(pipeBendAtt, "DIAMETER_MM := '100'");
assertContains(pipeBendAtt, "RICH_DIAMETER_FIELD := 'OUTSIDE_DIAMETER_MM'");
assertContains(pipeBendAtt, "RICH_BEND_RADIUS_FIELD := 'BEND_RADIUS_MM'");
assertContains(pipeBendAtt, "RICH_BEND_ANGLE_FIELD := 'BEND_ANGLE_DEG'");
assertContains(pipeBendAtt, "BEND_RADIUS_MM := '150'");
assertContains(pipeBendAtt, "BEND_ANGLE_DEG := '90'");
assertContains(pipeBendAtt, 'RVM_RECIPE_NAMES :=');
assertContains(pipeBendAtt, 'RVM_PRIMITIVE_KINDS :=');

const recipeAtt = buildAtt([
  record('FLANGE', {
    NAME: 'FLANGE_RICH',
    FLANGE_FACE_OD_MM: 220,
    HUB_OD_MM: 130
  }),
  record('VALVE', {
    NAME: 'VALVE_RICH',
    VALVE_BODY_OD_MM: 180,
    VALVE_SEAT_OD_MM: 120,
    VALVE_END_FLANGE_OD_MM: 220
  }),
  record('REDUCER', {
    NAME: 'REDUCER_RICH',
    ABORE_MM: 100,
    LBORE_MM: 50,
    ECC_OFFSET_X: 12,
    ECC_OFFSET_Y: -6
  })
]);
assertContains(recipeAtt, 'RICH_COMPONENT_EVIDENCE_JSON :=');
assertContains(recipeAtt, 'RVM_RECIPE_NAMES :=');
assertContains(recipeAtt, 'weldneck-flange-contiguous-2part');
assertContains(recipeAtt, 'ball-valve-contiguous-5part');
assertContains(recipeAtt, 'reducer-snout-full-span');
assertContains(recipeAtt, 'RVM_SNOUT_COUNT :=');
assertContains(recipeAtt, 'RVM_SPHERE_COUNT :=');

const support = {
  supportMarkerId: 'SUPPORT_MARKER/stagedJson/20/GUIDE/SUPPORT-20',
  supportId: 'SUPPORT-20',
  supportName: 'Guide Support 20',
  supportKindRaw: 'Guide',
  supportKindNormalized: 'GUIDE',
  supportFamily: 'GUIDE',
  nodeNumber: '20',
  axisRaw: 'Y',
  axisCanvas: '+Y',
  axisVector: { x: 0, y: 1, z: 0 },
  pipeAxis: '+X',
  pipeOdMm: 100,
  pipeRadiusMm: 50,
  positionMm: point(10, 20, 30),
  matchedPipeRef: 'PIPE_10_TO_20',
  matchMethod: 'node-exact',
  confidence: 0.91,
  popupRequired: true,
  warningCode: 'SUPPORT_TEST_WARNING',
  warningMessage: 'Traceable support warning',
  sourcePath: '/INPUTXML/RESTRAINTS/1',
  sourceAttributes: { RESTRAINT: 'GUIDE' },
  diagnostics: [{ code: 'TRACE' }]
};
const supportAtt = buildAtt([record('PIPE', { NAME: 'PIPE_WITH_SUPPORT' })], {
  sourceContract: { supports: [support] }
});
assertContains(supportAtt, "SUPPORT_ID := 'SUPPORT-20'");
assertContains(supportAtt, "SUPPORT_NAME := 'Guide Support 20'");
assertContains(supportAtt, "SUPPORT_KIND_RAW := 'Guide'");
assertContains(supportAtt, "SUPPORT_KIND_NORMALIZED := 'GUIDE'");
assertContains(supportAtt, "SUPPORT_FAMILY := 'GUIDE'");
assertContains(supportAtt, "SUPPORT_POSITION_X_MM := '10'");
assertContains(supportAtt, "SUPPORT_MATCHED_PIPE_REF := 'PIPE_10_TO_20'");
assertContains(supportAtt, 'SUPPORT_SOURCE_TRACE_JSON :=');

const customAtt = writeAtt({
  root: {
    name: 'ROOT',
    attributes: { CUSTOM_FIELD: 'ABC' },
    children: []
  }
});
assertContains(customAtt, "CUSTOM_FIELD := 'ABC'");
