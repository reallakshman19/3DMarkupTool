import assert from 'node:assert/strict';

import { createManagedStageGeometryContract } from '../src/managed-stage-geometry-contract.js';
import { planManagedStagePipingComponentRecipe } from '../src/managed-stage-piping-component-recipes.js';

const point = (x, y, z = 0) => ({ x, y, z });
const radiusOf = (primitive) => primitive.radiusMm ?? primitive.radius;
const flangeRadius = (pipeRadius) => Math.max(pipeRadius * 1.55, pipeRadius + 35);
const valveRadius = (pipeRadius) => Math.max(pipeRadius * 1.35, pipeRadius + 25);

function record(type, attrs = {}) {
  const name = attrs.NAME || `${type}-RICH-TEST`;
  return {
    name,
    type,
    attributes: {
      SOURCE_ELEMENT_ID: name,
      REF: name,
      NAME: name,
      TYPE: type,
      DTXR: type,
      FROM_NODE: '10',
      TO_NODE: '20',
      APOS: point(0, 0, 0),
      LPOS: point(1000, 0, 0),
      ...attrs
    }
  };
}

function recipeFor(contract) {
  return planManagedStagePipingComponentRecipe(contract, {
    pipeRadiusMm: contract.radiusMm,
    materials: { FITTING: 5, FLANGE: 6, VALVE: 7 }
  });
}

const richFlange = createManagedStageGeometryContract(record('FLANGE', {
  OUTSIDE_DIAMETER_MM: 100,
  FLANGE_FACE_OD_MM: 220,
  HUB_OD_MM: 130
}));
assert.equal(richFlange.richComponentEvidence.flangeFaceDiameterField, 'FLANGE_FACE_OD_MM');
assert.equal(richFlange.richComponentEvidence.flangeFaceDiameterMm, 220);
assert.equal(richFlange.richComponentEvidence.flangeHubDiameterField, 'HUB_OD_MM');
assert.equal(richFlange.richComponentEvidence.flangeHubDiameterMm, 130);
const richFlangeRecipe = recipeFor(richFlange);
assert.equal(richFlangeRecipe.recipeName, 'weldneck-flange-contiguous-2part');
assert.equal(richFlangeRecipe.primitiveCount, 2);
assert.equal(richFlangeRecipe.primitives[0].radiusTopMm, 65);
assert.equal(radiusOf(richFlangeRecipe.primitives[1]), 110);

const fallbackFlange = createManagedStageGeometryContract(record('FLANGE', {
  OUTSIDE_DIAMETER_MM: 100
}));
const fallbackFlangeRecipe = recipeFor(fallbackFlange);
assert.equal(fallbackFlangeRecipe.primitiveCount, 2);
assert.equal(radiusOf(fallbackFlangeRecipe.primitives[1]), flangeRadius(50));
assert.equal(fallbackFlangeRecipe.primitives[0].radiusTopMm, Math.max(50 * 1.18, 50 + 8));

const richValve = createManagedStageGeometryContract(record('VALVE', {
  OUTSIDE_DIAMETER_MM: 100,
  VALVE_BODY_OD_MM: 180,
  VALVE_SEAT_OD_MM: 120,
  VALVE_END_FLANGE_OD_MM: 220
}));
assert.equal(richValve.richComponentEvidence.valveBodyDiameterMm, 180);
assert.equal(richValve.richComponentEvidence.valveSeatDiameterMm, 120);
assert.equal(richValve.richComponentEvidence.valveEndFlangeDiameterMm, 220);
const richValveRecipe = recipeFor(richValve);
assert.equal(richValveRecipe.recipeName, 'ball-valve-contiguous-5part');
assert.equal(richValveRecipe.primitiveCount, 5);
assert.equal(radiusOf(richValveRecipe.primitives[0]), 110);
assert.equal(radiusOf(richValveRecipe.primitives[1]), 60);
assert.equal(richValveRecipe.primitives[2].diameter, 180);
assert.equal(radiusOf(richValveRecipe.primitives[3]), 60);
assert.equal(radiusOf(richValveRecipe.primitives[4]), 110);

const fallbackValve = createManagedStageGeometryContract(record('VALVE', {
  OUTSIDE_DIAMETER_MM: 100
}));
const fallbackValveRecipe = recipeFor(fallbackValve);
const cuts = [0, 140, 300, 700, 860, 1000];
const ballLength = cuts[3] - cuts[2];
assert.equal(fallbackValveRecipe.primitiveCount, 5);
assert.equal(fallbackValveRecipe.primitives[2].diameter, Math.max(valveRadius(50) * 2, ballLength));
assert.equal(radiusOf(fallbackValveRecipe.primitives[0]), flangeRadius(50));
assert.equal(radiusOf(fallbackValveRecipe.primitives[4]), flangeRadius(50));
assert.equal(radiusOf(fallbackValveRecipe.primitives[1]), Math.max(50 * 1.04, 50 + 2));
assert.equal(radiusOf(fallbackValveRecipe.primitives[3]), Math.max(50 * 1.04, 50 + 2));

const richReducer = createManagedStageGeometryContract(record('REDUCER', {
  ABORE_MM: 100,
  LBORE_MM: 50,
  ECC_OFFSET_X: 12,
  ECC_OFFSET_Y: -6
}));
assert.equal(richReducer.richComponentEvidence.reducerOffsetXField, 'ECC_OFFSET_X');
assert.equal(richReducer.richComponentEvidence.reducerOffsetYField, 'ECC_OFFSET_Y');
const reducerRecipe = recipeFor(richReducer);
const reducerPrimitive = reducerRecipe.primitives[0];
assert.equal(reducerRecipe.recipeName, 'reducer-snout-full-span');
assert.equal(reducerPrimitive.radiusBottomMm, 50);
assert.equal(reducerPrimitive.radiusTopMm, 25);
assert.equal(reducerPrimitive.offsetX, 12);
assert.equal(reducerPrimitive.offsetY, -6);
