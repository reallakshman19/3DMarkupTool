import assert from 'node:assert/strict';

import { createManagedStageGeometryContract } from '../src/managed-stage-geometry-contract.js';
import { planManagedStagePipingComponentRecipe } from '../src/managed-stage-piping-component-recipes.js';
import { planManagedStagePrimitives } from '../src/managed-stage-rvm-primitive-planner.js';

const point = (x, y, z = 0) => ({ x, y, z });

function record(type, attrs = {}) {
  const name = attrs.NAME || `${type}-TEST`;
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

function approx(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
}

const pipe = createManagedStageGeometryContract(record('PIPE', {
  NAME: 'PIPE-RICH-OD',
  OUTSIDE_DIAMETER_MM: 168.3
}));
assert.equal(pipe.diameterMm, 168.3);
assert.equal(pipe.radiusMm, 84.15);
assert.equal(pipe.richGeometryEvidence.diameterField, 'OUTSIDE_DIAMETER_MM');

const reducer = createManagedStageGeometryContract(record('REDUCER', {
  NAME: 'REDUCER-RICH-TAPER',
  ABORE_MM: 100,
  LBORE_MM: 50
}));
assert.equal(reducer.startDiameterMm, 100);
assert.equal(reducer.endDiameterMm, 50);
assert.equal(reducer.startRadiusMm, 50);
assert.equal(reducer.endRadiusMm, 25);
assert.equal(reducer.richGeometryEvidence.startDiameterField, 'ABORE_MM');
assert.equal(reducer.richGeometryEvidence.endDiameterField, 'LBORE_MM');

const recipe = planManagedStagePipingComponentRecipe(reducer, {
  pipeRadiusMm: reducer.radiusMm,
  materials: { FITTING: 5 }
});
assert.equal(recipe.recipeName, 'reducer-snout-full-span');
assert.equal(recipe.primitives[0].radiusBottomMm, 50);
assert.equal(recipe.primitives[0].radiusTopMm, 25);

const richBend = createManagedStageGeometryContract(record('BEND', {
  NAME: 'BEND-RICH-RADIUS-ANGLE',
  LPOS: point(100, 0, 0),
  BEND_RADIUS_MM: 150,
  BEND_ANGLE_DEG: 90,
  DIAMETER_MM: 100
}));
assert.equal(richBend.centerlineKind, 'arc');
assert.equal(richBend.arc.bendRadiusMm, 150);
assert.equal(richBend.arc.bendAngleDeg, 90);
assert.ok(richBend.arc.sweepAngleRad > 0);
assert.equal(richBend.richGeometryEvidence.bendRadiusField, 'BEND_RADIUS_MM');
assert.equal(richBend.richGeometryEvidence.bendAngleField, 'BEND_ANGLE_DEG');

const derivedBend = createManagedStageGeometryContract(record('BEND', {
  NAME: 'BEND-RICH-DERIVED-ANGLE',
  LPOS: point(100, 0, 0),
  BEND_RADIUS_MM: 100,
  BEND_ELEMENT_LENGTH_MM: 157.079632679,
  DIAMETER_MM: 50
}));
approx(derivedBend.arc.bendAngleDeg, 90);
assert.equal(derivedBend.richGeometryEvidence.bendAngleDerivedFromElementLength, true);

const primitives = planManagedStagePrimitives(richBend);
assert.ok(primitives.length > 0);
assert.ok(primitives.every((primitive) => primitive.sourceElementId === 'BEND-RICH-RADIUS-ANGLE'));
assert.ok(primitives.some((primitive) => /bend/i.test(`${primitive.recipeName || ''} ${primitive.primitiveRole || ''} ${primitive.primitiveRoleTag || ''}`)));
