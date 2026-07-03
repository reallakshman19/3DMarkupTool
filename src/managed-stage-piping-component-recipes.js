import { buildContractCylinderPrimitive } from './rvm-cylinder-primitive-builder.js?v=bust-cache-4';

export const MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA = 'ManagedStagePipingComponentRecipe.v1';

export function planManagedStagePipingComponentRecipe(contract, options = {}) {
  assertContract(contract);
  const materials = options.materials || {};
  const pipeRadius = positiveNumber(options.pipeRadiusMm ?? contract.radiusMm, 'pipeRadiusMm');
  const dtxr = contract.dtxr;
  const span = effectiveRecipeSpan(contract);
  if (dtxr === 'PIPE') return buildRecipe(contract, span, 'pipe-full-span', [segment(0, span.lengthMm, 'body', pipeRadius, materials.PIPE)]);
  if (dtxr === 'UNSPECIFIED') return buildRecipe(contract, span, 'unknown-pipelike-full-span', [segment(0, span.lengthMm, 'body', pipeRadius, materials.UNKNOWN_PIPELIKE)]);
  if (dtxr === 'FLANGE') return buildWeldNeckFlangeRecipe(contract, span, pipeRadius, materials);
  if (dtxr === 'REDUCER') return buildReducerRecipe(contract, span, pipeRadius, materials);
  if (dtxr === 'VALVE') return buildBallValveRecipe(contract, span, pipeRadius, materials, 'ball-valve-contiguous-5part');
  if (dtxr === 'FLANGE_PAIR') return buildFlangePairRecipe(contract, span, pipeRadius, materials);
  if (dtxr === 'FLANGED_VALVE') return buildBallValveRecipe(contract, span, pipeRadius, materials, 'flanged-ball-valve-contiguous-5part');
  throw new Error(`Unsupported cylinder recipe DTXR: ${dtxr}`);
}

export function assertManagedStagePipingComponentRecipe(recipe, expectations = {}) {
  if (!recipe || recipe.schema !== MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA) throw new Error('Expected managed-stage piping component recipe');
  if (!Array.isArray(recipe.primitives) || recipe.primitives.length !== recipe.primitiveCount) {
    throw new Error(`Recipe primitive count mismatch for ${recipe.componentName || 'UNNAMED_COMPONENT'}`);
  }
  if (recipe.continuous !== true) throw new Error(`Recipe is not continuous: ${recipe.componentName}`);
  const expectedCoverage = recipe.effectiveContractLengthMm ?? recipe.contractLengthMm;
  if (Math.abs(recipe.coveredLengthMm - expectedCoverage) > 1e-6) {
    throw new Error(`Recipe coverage mismatch for ${recipe.componentName}: ${recipe.coveredLengthMm} != ${expectedCoverage}`);
  }
  if (expectations.primitiveCount !== undefined && recipe.primitiveCount !== expectations.primitiveCount) {
    throw new Error(`Recipe primitive count expected ${expectations.primitiveCount}, got ${recipe.primitiveCount}`);
  }
  if (expectations.recipeName && recipe.recipeName !== expectations.recipeName) {
    throw new Error(`Recipe name expected ${expectations.recipeName}, got ${recipe.recipeName}`);
  }
  return true;
}

export function flangeRadius(pipeRadius) { return Math.max(positiveNumber(pipeRadius, 'pipeRadius') * 1.55, pipeRadius + 35); }
export function valveRadius(pipeRadius) { return Math.max(positiveNumber(pipeRadius, 'pipeRadius') * 1.35, pipeRadius + 25); }

function buildWeldNeckFlangeRecipe(contract, span, pipeRadius, materials) {
  const split = span.lengthMm * 0.46;
  const hubRadius = Math.max(pipeRadius * 1.18, pipeRadius + 8);
  return buildRecipe(contract, span, 'weldneck-flange-contiguous-2part', [
    segment(0, split, 'weldNeckHub', hubRadius, materials.FLANGE, {
      primitiveKind: 'snout',
      radiusBottomMm: pipeRadius,
      radiusTopMm: hubRadius
    }),
    segment(split, span.lengthMm, 'raisedFaceDisk', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildReducerRecipe(contract, span, pipeRadius, materials) {
  const radiusBottom = positiveNumber(contract.startRadiusMm || pipeRadius, 'contract.startRadiusMm');
  const radiusTop = positiveNumber(contract.endRadiusMm || pipeRadius, 'contract.endRadiusMm');
  return buildRecipe(contract, span, 'reducer-snout-full-span', [
    segment(0, span.lengthMm, 'reducerSnout', Math.max(radiusBottom, radiusTop), materials.FITTING, {
      primitiveKind: 'snout',
      radiusBottomMm: radiusBottom,
      radiusTopMm: radiusTop,
      offsetX: contract.reducerOffsetXMm || 0,
      offsetY: contract.reducerOffsetYMm || 0
    })
  ]);
}

function buildFlangePairRecipe(contract, span, pipeRadius, materials) {
  const split = span.lengthMm / 2;
  return buildRecipe(contract, span, 'flange-pair-contiguous-split', [
    segment(0, split, 'flangeA', flangeRadius(pipeRadius), materials.FLANGE),
    segment(split, span.lengthMm, 'flangeB', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildBallValveRecipe(contract, span, pipeRadius, materials, recipeName) {
  const length = span.lengthMm;
  const cuts = proportionalCuts(length, [0.14, 0.16, 0.40, 0.16, 0.14]);
  const ballRadius = valveRadius(pipeRadius);
  const ballLength = cuts[3] - cuts[2];
  return buildRecipe(contract, span, recipeName, [
    segment(cuts[0], cuts[1], 'leftEndFlange', flangeRadius(pipeRadius), materials.FLANGE),
    segment(cuts[1], cuts[2], 'leftSeat', Math.max(pipeRadius * 1.04, pipeRadius + 2), materials.VALVE),
    segment(cuts[2], cuts[3], 'centralBallBody', ballRadius, materials.VALVE, {
      primitiveKind: 'sphere',
      diameterMm: Math.max(ballRadius * 2, ballLength)
    }),
    segment(cuts[3], cuts[4], 'rightSeat', Math.max(pipeRadius * 1.04, pipeRadius + 2), materials.VALVE),
    segment(cuts[4], cuts[5], 'rightEndFlange', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function proportionalCuts(length, weights) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  const cuts = [0];
  let cursor = 0;
  for (const weight of weights) {
    cursor += length * (weight / total);
    cuts.push(cursor);
  }
  cuts[cuts.length - 1] = length;
  return cuts;
}

function buildRecipe(contract, span, recipeName, segments) {
  validateSegments(span, recipeName, segments);
  const primitives = segments.map((entry, index) => {
    const primitive = buildPrimitiveForSegment(contract, span, entry, recipeName);
    return {
      ...primitive,
      recipeName,
      recipeSegmentIndex: index,
      recipeSegmentCount: segments.length,
      recipeSegmentStartDistanceMm: entry.startDistanceMm,
      recipeSegmentEndDistanceMm: entry.endDistanceMm,
      recipeTrimStartOffsetMm: span.startOffsetMm,
      recipeTrimEndOffsetMm: span.endOffsetMm,
      recipeContinuous: true,
      exportedRvmGeometry: true,
      exportedManagedStageComponentSymbol: isPrimitiveSymbolRecipe(recipeName),
      componentPrimitiveBudgetCounted: true,
      componentPrimitiveBudgetLimit: primitiveBudgetLimit(recipeName),
      geometryPrimitivePolicy: geometryPrimitivePolicy(recipeName)
    };
  });
  return {
    schema: MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA,
    componentName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    dtxr: contract.dtxr,
    recipeName,
    contractLengthMm: contract.lengthMm,
    effectiveContractLengthMm: span.lengthMm,
    trimStartOffsetMm: span.startOffsetMm,
    trimEndOffsetMm: span.endOffsetMm,
    primitiveCount: primitives.length,
    primitiveBudgetLimit: primitiveBudgetLimit(recipeName),
    exportedRvmGeometry: true,
    exportedManagedStageComponentSymbol: isPrimitiveSymbolRecipe(recipeName),
    geometryPrimitivePolicy: geometryPrimitivePolicy(recipeName),
    coveredLengthMm: coveredLength(segments),
    continuous: true,
    segments: segments.map((entry) => ({ ...entry, lengthMm: entry.endDistanceMm - entry.startDistanceMm })),
    primitives
  };
}

function buildPrimitiveForSegment(contract, span, entry, recipeName) {
  const startOffsetMm = span.startOffsetMm + entry.startDistanceMm;
  const endOffsetMm = span.endOffsetMm + (span.lengthMm - entry.endDistanceMm);
  if (entry.primitiveKind === 'snout') {
    return buildContractSnoutPrimitive(contract, {
      localName: entry.localName,
      radiusBottomMm: entry.radiusBottomMm,
      radiusTopMm: entry.radiusTopMm,
      offsetX: entry.offsetX || 0,
      offsetY: entry.offsetY || 0,
      material: entry.material,
      primitiveRole: entry.localName,
      primitiveRoleTag: entry.primitiveRoleTag,
      startOffsetMm,
      endOffsetMm
    });
  }
  if (entry.primitiveKind === 'sphere') {
    return buildContractSpherePrimitive(contract, {
      localName: entry.localName,
      diameterMm: entry.diameterMm,
      material: entry.material,
      primitiveRole: entry.localName,
      primitiveRoleTag: entry.primitiveRoleTag,
      startOffsetMm,
      endOffsetMm,
      sphereSegmentSpanMm: entry.endDistanceMm - entry.startDistanceMm,
      sphereRecipeName: recipeName
    });
  }
  return buildContractCylinderPrimitive(contract, {
    localName: entry.localName,
    radiusMm: entry.radiusMm,
    material: entry.material,
    primitiveRole: entry.localName,
    primitiveRoleTag: entry.primitiveRoleTag,
    startOffsetMm,
    endOffsetMm
  });
}

function buildContractSnoutPrimitive(contract, options = {}) {
  assertLineLikeContract(contract);
  const startOffsetMm = nonNegativeNumber(options.startOffsetMm ?? 0, 'startOffsetMm');
  const endOffsetMm = nonNegativeNumber(options.endOffsetMm ?? 0, 'endOffsetMm');
  if (startOffsetMm + endOffsetMm >= contract.lengthMm - 1e-6) {
    throw new Error(`Snout offsets consume contract span for ${contract.name || 'UNNAMED_CONTRACT'}`);
  }
  const start = pointAlong(contract.startMm, contract.axis, startOffsetMm);
  const end = pointAlong(contract.endMm, contract.axis, -endOffsetMm);
  const delta = vsub(end, start);
  const height = Math.hypot(delta[0], delta[1], delta[2]);
  const localName = String(options.localName || 'snout');
  const radiusBottom = nonNegativeNumber(options.radiusBottomMm, `${localName}.radiusBottomMm`);
  const radiusTop = nonNegativeNumber(options.radiusTopMm, `${localName}.radiusTopMm`);
  if (radiusBottom <= 0 && radiusTop <= 0) throw new Error(`Invalid snout radii for ${contract.name}_${localName}`);
  const offsetX = finiteNumberOrDefault(options.offsetX, 0, `${localName}.offsetX`);
  const offsetY = finiteNumberOrDefault(options.offsetY, 0, `${localName}.offsetY`);
  return {
    kind: 'snout',
    name: options.name || `${contract.name}_${localName}`,
    localName,
    center: midpoint(start, end),
    direction: contract.axis,
    radiusBottom,
    radiusTop,
    radiusBottomMm: radiusBottom,
    radiusTopMm: radiusTop,
    height,
    offsetX,
    offsetY,
    material: options.material,
    endpointLocked: true,
    startMm: start,
    endMm: end,
    sourceContractName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    primitiveRole: options.primitiveRole || localName,
    primitiveRoleTag: options.primitiveRoleTag || roleTagForLocalName(localName, 'snout'),
    parentStartMm: contract.startMm,
    parentEndMm: contract.endMm,
    startOffsetMm,
    endOffsetMm,
    localBbox: [
      Math.min(-radiusBottom, offsetX - radiusTop),
      Math.min(-radiusBottom, offsetY - radiusTop),
      -height / 2,
      Math.max(radiusBottom, offsetX + radiusTop),
      Math.max(radiusBottom, offsetY + radiusTop),
      height / 2
    ],
    shapePrimitiveUpgrade: 'code7-snout',
    orientationAssumption: 'RVM code-7 Snout uses local Z as height axis; basis.z follows the component APOS->LPOS axis.'
  };
}

function buildContractSpherePrimitive(contract, options = {}) {
  assertLineLikeContract(contract);
  const startOffsetMm = nonNegativeNumber(options.startOffsetMm ?? 0, 'startOffsetMm');
  const endOffsetMm = nonNegativeNumber(options.endOffsetMm ?? 0, 'endOffsetMm');
  if (startOffsetMm + endOffsetMm >= contract.lengthMm - 1e-6) {
    throw new Error(`Sphere offsets consume contract span for ${contract.name || 'UNNAMED_CONTRACT'}`);
  }
  const start = pointAlong(contract.startMm, contract.axis, startOffsetMm);
  const end = pointAlong(contract.endMm, contract.axis, -endOffsetMm);
  const diameter = positiveNumber(options.diameterMm, 'diameterMm');
  const localName = String(options.localName || 'sphere');
  return {
    kind: 'sphere',
    name: options.name || `${contract.name}_${localName}`,
    localName,
    center: midpoint(start, end),
    direction: contract.axis,
    diameter,
    radius: diameter / 2,
    length: Math.hypot(...vsub(end, start)),
    material: options.material,
    endpointLocked: true,
    startMm: start,
    endMm: end,
    sourceContractName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    primitiveRole: options.primitiveRole || localName,
    primitiveRoleTag: options.primitiveRoleTag || roleTagForLocalName(localName, 'sphere'),
    parentStartMm: contract.startMm,
    parentEndMm: contract.endMm,
    startOffsetMm,
    endOffsetMm,
    sphereSegmentSpanMm: options.sphereSegmentSpanMm,
    sphereRecipeName: options.sphereRecipeName,
    shapePrimitiveUpgrade: 'code9-sphere'
  };
}

function segment(startDistanceMm, endDistanceMm, localName, radiusMm, material, extra = {}) {
  return { startDistanceMm, endDistanceMm, localName, radiusMm, material, ...extra };
}
function effectiveRecipeSpan(contract) {
  const startOffsetMm = nonNegativeNumber(contract.rvmTrimStartOffsetMm || 0, 'rvmTrimStartOffsetMm');
  const endOffsetMm = nonNegativeNumber(contract.rvmTrimEndOffsetMm || 0, 'rvmTrimEndOffsetMm');
  if (startOffsetMm + endOffsetMm >= contract.lengthMm - 1e-6) throw new Error(`Recipe trim offsets consume contract span for ${contract.name}`);
  return { startOffsetMm, endOffsetMm, lengthMm: contract.lengthMm - startOffsetMm - endOffsetMm };
}
function assertContract(contract) { if (!contract || contract.schema !== 'ManagedStageGeometryContract.v1') throw new Error('Expected ManagedStageGeometryContract.v1'); }
function assertLineLikeContract(contract) { assertContract(contract); if (!Array.isArray(contract.startMm) || !Array.isArray(contract.endMm) || !Array.isArray(contract.axis)) throw new Error(`Line-like contract missing geometry: ${contract.name || 'UNNAMED_CONTRACT'}`); }
function validateSegments(span, recipeName, segments) { for (const entry of segments) { if (!(entry.endDistanceMm > entry.startDistanceMm)) throw new Error(`Invalid segment span in ${recipeName}: ${entry.localName}`); if (entry.startDistanceMm < -1e-6 || entry.endDistanceMm > span.lengthMm + 1e-6) throw new Error(`Segment outside contract span in ${recipeName}: ${entry.localName}`); } }
function coveredLength(segments) { return segments.reduce((sum, entry) => sum + (entry.endDistanceMm - entry.startDistanceMm), 0); }
function primitiveBudgetLimit(recipeName) { if (recipeName.includes('5part')) return 5; if (recipeName.includes('2part')) return 2; if (recipeName.includes('split')) return 2; return 1; }
function isPrimitiveSymbolRecipe(recipeName = '') { return /flange|valve|reducer/i.test(recipeName); }
function geometryPrimitivePolicy(recipeName = '') { return isPrimitiveSymbolRecipe(recipeName) ? 'endpoint-locked-component-symbol' : 'full-span-primary-cylinder'; }
function positiveNumber(value, label) { const n = Number(value); if (!(n > 0)) throw new Error(`Expected positive ${label}`); return n; }
function nonNegativeNumber(value, label) { const n = Number(value); if (!(n >= 0)) throw new Error(`Expected non-negative ${label}`); return n; }
function finiteNumberOrDefault(value, fallback, label) { const n = Number(value); if (!Number.isFinite(n)) return fallback; return n; }
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function pointAlong(origin, direction, distanceMm) { return [origin[0] + direction[0] * distanceMm, origin[1] + direction[1] * distanceMm, origin[2] + direction[2] * distanceMm]; }
function roleTagForLocalName(localName, kind) { return `${kind}:${localName}`; }
