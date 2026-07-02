import { validateRvmExportModelContract } from '../contracts/index.js';

const PLAN_SCHEMA = 'NewCorePipeBendRuntimePilotPlan.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const UNIT_EPSILON = 1e-6;
const FORBIDDEN_NODE_OPTIONS = Object.freeze(['browser', 'canvas', 'download', 'objectUrl', 'createObjectUrl', 'downloadUrl', 'dom', 'ui', 'appMutation']);

export function buildNewCorePipeBendRuntimePilotPlan(input, options = {}) {
  const rvm = input?.schema === 'RvmExportModel.v1' ? input : input?.rvmExportModel;
  const optionErrors = nodeOptionErrors(options);
  const base = basePlan(rvm, options);
  if (optionErrors.length) return withErrors(base, optionErrors);
  const inputErrors = validateRvmInput(rvm);
  const rows = collectRows(rvm);
  const cylinderErrors = rows.cylinders.flatMap((entry, index) => validateCylinder(entry, index));
  const torusErrors = rows.toruses.flatMap((entry, index) => validateTorus(entry, index));
  const fallbackErrors = [...rows.cylinders, ...rows.toruses].filter(hasFallback).map((entry) => `${entry.sourceItemId} uses fallback geometry`);
  const errors = [...inputErrors, ...cylinderErrors, ...torusErrors, ...fallbackErrors];
  return populatedPlan(base, rows, errors);
}

export function validateNewCorePipeBendRuntimePilotPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== PLAN_SCHEMA) errors.push(`schema must be ${PLAN_SCHEMA}`);
  if (plan?.mode !== 'explicit-runtime-pilot') errors.push('mode must be explicit-runtime-pilot');
  if (plan?.scope !== 'pipe-bend-subset') errors.push('scope must be pipe-bend-subset');
  if (plan?.sourceSchema !== 'RvmExportModel.v1') errors.push('sourceSchema must be RvmExportModel.v1');
  for (const key of booleanKeys()) if (typeof plan?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  for (const key of countKeys()) if (!nonNegativeInteger(plan?.[key])) errors.push(`${key} must be non-negative integer`);
  for (const key of ['cylinderPrimitives', 'torusPrimitives', 'excludedItems', 'sourceTrace', 'warnings', 'errors']) if (!Array.isArray(plan?.[key])) errors.push(`${key} must be array`);
  if (plan?.plannedCylinderCount !== plan?.cylinderPrimitives?.length) errors.push('plannedCylinderCount must match cylinderPrimitives length');
  if (plan?.plannedTorusCount !== plan?.torusPrimitives?.length) errors.push('plannedTorusCount must match torusPrimitives length');
  return { schema: 'NewCorePipeBendRuntimePilotPlanValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function populatedPlan(base, rows, errors) {
  const subsetReady = errors.length === 0 && rows.cylinders.length > 0 && rows.toruses.length > 0;
  return { ...base, subsetReady, plannedCylinderCount: rows.cylinders.length, plannedTorusCount: rows.toruses.length, excludedFlangeCount: rows.flanges.length, blockedValveCount: rows.blockedValves.length, deferredSupportCount: rows.deferredSupports.length, cylinderPrimitives: rows.cylinders.map(copy), torusPrimitives: rows.toruses.map(copy), excludedItems: excludedItems(rows), sourceTrace: sourceTrace(rows), warnings: rows.flanges.length ? ['FLANGE_CYLINDER remains excluded from Phase 14 pipe+bend runtime artifact generation.'] : [], errors };
}

function basePlan(rvm, options) {
  return { schema: PLAN_SCHEMA, graphId: rvm?.graphId || '<unknown-graph>', units: rvm?.units || 'mm', sourceSchema: 'RvmExportModel.v1', mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', enabled: options.enabled === true, fullModelReady: false, subsetReady: false, plannedCylinderCount: 0, plannedTorusCount: 0, excludedFlangeCount: 0, blockedValveCount: 0, deferredSupportCount: 0, productionWriterModified: false, runtimeRouteModified: false, browserTouched: false, canvasTouched: false, objectUrlCreated: false, downloadCreated: false, cylinderPrimitives: [], torusPrimitives: [], excludedItems: [], sourceTrace: [], warnings: [], errors: [] };
}

function nodeOptionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true };
  const errors = [];
  for (const [key, value] of Object.entries(required)) if (options[key] !== value) errors.push(`${key} must be ${value}`);
  for (const key of FORBIDDEN_NODE_OPTIONS) if (options[key] === true) errors.push(`${key} option is forbidden for Node runtime pilot`);
  return errors;
}

function validateRvmInput(rvm) {
  if (!rvm || rvm.schema !== 'RvmExportModel.v1') return ['RvmExportModel.v1 is required'];
  const contract = validateRvmExportModelContract(rvm);
  const errors = contract.ok ? [] : contract.errors.map((entry) => `RvmExportModel contract: ${entry}`);
  if (rvm.transformApplied !== true) errors.push('RvmExportModel must have transformApplied true');
  if (rvm.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('RvmExportModel must use final-review-transform.v1');
  return errors;
}

function collectRows(rvm) {
  return { cylinders: array(rvm?.primitives).filter((entry) => entry.primitiveKind === 'CYLINDER' && Number(entry.primitiveCode) === 8), toruses: array(rvm?.testByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'TORUS' && Number(entry.primitiveCode) === 4), flanges: array(rvm?.flangeTestByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER'), blockedValves: array(rvm?.blockedExports).filter((entry) => entry.family === 'valve'), deferredSupports: array(rvm?.deferredExports).filter((entry) => entry.family === 'support') };
}

function validateCylinder(primitive, index) {
  const label = `cylinderPrimitives[${index}]`;
  const errors = commonErrors(primitive, label);
  if (primitive.primitiveKind !== 'CYLINDER' || Number(primitive.primitiveCode) !== 8) errors.push(`${label} must be CYLINDER/code8`);
  if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
  if (!positive(primitive.lengthMm)) errors.push(`${label}.lengthMm must be positive`);
  if (!positive(primitive.radiusMm)) errors.push(`${label}.radiusMm must be positive`);
  return errors;
}

function validateTorus(primitive, index) {
  const label = `torusPrimitives[${index}]`;
  const errors = commonErrors(primitive, label);
  if (primitive.primitiveKind !== 'TORUS' || Number(primitive.primitiveCode) !== 4) errors.push(`${label} must be TORUS/code4`);
  for (const key of ['normal', 'startTangent', 'endTangent']) if (!unit(primitive[key])) errors.push(`${label}.${key} must be normalized finite vector`);
  for (const key of ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg']) if (!positive(primitive[key])) errors.push(`${label}.${key} must be positive`);
  if (primitive.writerReady !== false) errors.push(`${label}.writerReady must remain false`);
  if (primitive.testByteEligible !== true) errors.push(`${label}.testByteEligible must be true`);
  return errors;
}

function commonErrors(primitive, label) {
  const errors = [];
  if (!point3(primitive?.center)) errors.push(`${label}.center must be finite [x,y,z]`);
  if (primitive?.basis !== 'navis-review') errors.push(`${label}.basis must be navis-review`);
  if (primitive?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`${label}.transformPolicy must be final-review-transform.v1`);
  if (primitive?.transformApplied !== true && primitive?.writerReady === false) errors.push(`${label}.transformApplied must be true`);
  return errors;
}

function excludedItems(rows) { return [...rows.flanges.map((entry) => excluded(entry, 'flange-excluded')), ...rows.blockedValves.map((entry) => excluded(entry, 'valve-blocked')), ...rows.deferredSupports.map((entry) => excluded(entry, 'support-deferred'))]; }
function sourceTrace(rows) { return [...rows.cylinders.map((entry) => trace(entry, 'CYLINDER', 8)), ...rows.toruses.map((entry) => trace(entry, 'TORUS', 4))]; }
function trace(entry, primitiveKind, primitiveCode) { return { sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, primitiveKind, primitiveCode, runtimePilotStatus: 'selected', sourceRef: entry.sourceRef }; }
function excluded(entry, reason) { return { sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, family: entry.family, primitiveKind: entry.primitiveKind, primitiveCode: entry.primitiveCode, reason, sourceRef: entry.sourceRef }; }
function withErrors(plan, errors) { return { ...plan, errors: [...errors] }; }
function booleanKeys() { return ['enabled', 'fullModelReady', 'subsetReady', 'productionWriterModified', 'runtimeRouteModified', 'browserTouched', 'canvasTouched', 'objectUrlCreated', 'downloadCreated']; }
function countKeys() { return ['plannedCylinderCount', 'plannedTorusCount', 'excludedFlangeCount', 'blockedValveCount', 'deferredSupportCount']; }
function hasFallback(entry) { return entry?.evidence?.fallbackUsed === true || entry?.fallbackUsed === true || entry?.geometryStatus === 'fallback'; }
function point3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function unit(value) { return point3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= UNIT_EPSILON; }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function nonNegativeInteger(value) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
function array(value) { return Array.isArray(value) ? value : []; }
function copy(value) { return { ...value }; }
