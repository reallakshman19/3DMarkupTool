import { validateRvmExportModelContract } from '../contracts/index.js';
import { validCylinderRuntimePilotOptions } from './new-core-cylinder-code8-options.js';

const PLAN_SCHEMA = 'NewCoreCylinderCode8RuntimePilotPlan.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const AXIS_EPSILON = 1e-6;

export function buildNewCoreCylinderRuntimePilotPlan(input, options = {}) {
  const optionResult = validCylinderRuntimePilotOptions(options, 'plan');
  const rvm = input?.schema === 'RvmExportModel.v1' ? input : input?.rvmExportModel;
  const base = basePlan(rvm, optionResult);
  if (!optionResult.ok) return withErrors(base, optionResult.errors);
  const errors = validateRvmInput(rvm);
  const rows = collectRows(rvm);
  const selectedErrors = rows.cylinders.flatMap((entry, index) => validateCylinder(entry, index));
  const fallbackErrors = rows.cylinders.filter(hasFallback).map((entry) => `${entry.sourceItemId} uses fallback geometry`);
  const allErrors = [...errors, ...selectedErrors, ...fallbackErrors];
  return populatedPlan(base, rows, allErrors);
}

function populatedPlan(base, rows, errors) {
  const subsetReady = errors.length === 0;
  return { ...base, subsetReady, plannedCylinderCount: rows.cylinders.length, excludedTorusCount: rows.toruses.length, excludedFlangeCount: rows.flanges.length, blockedValveCount: rows.blockedValves.length, deferredSupportCount: rows.deferredSupports.length, cylinderPrimitives: rows.cylinders.map(copy), excludedItems: excludedItems(rows), sourceTrace: sourceTrace(rows), warnings: rows.toruses.length || rows.flanges.length ? ['Bends and flanges remain excluded from Phase 13 cylinder-only runtime artifact generation.'] : [], errors: errors };
}

export function validateNewCoreCylinderRuntimePilotPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== PLAN_SCHEMA) errors.push(`schema must be ${PLAN_SCHEMA}`);
  if (plan?.mode !== 'explicit-runtime-pilot') errors.push('mode must be explicit-runtime-pilot');
  if (plan?.scope !== 'cylinder-code8-subset') errors.push('scope must be cylinder-code8-subset');
  if (plan?.enabled !== true) errors.push('enabled must be true');
  if (plan?.sourceSchema !== 'RvmExportModel.v1') errors.push('sourceSchema must be RvmExportModel.v1');
  for (const key of ['fullModelReady', 'productionWriterModified', 'runtimeRouteModified', 'browserTouched', 'canvasTouched', 'objectUrlCreated', 'downloadCreated']) if (typeof plan?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  for (const key of ['plannedCylinderCount', 'excludedTorusCount', 'excludedFlangeCount', 'blockedValveCount', 'deferredSupportCount']) if (!nonNegativeInteger(plan?.[key])) errors.push(`${key} must be non-negative integer`);
  for (const key of ['cylinderPrimitives', 'excludedItems', 'sourceTrace', 'warnings', 'errors']) if (!Array.isArray(plan?.[key])) errors.push(`${key} must be array`);
  if (plan?.plannedCylinderCount !== plan?.cylinderPrimitives?.length) errors.push('plannedCylinderCount must match cylinderPrimitives length');
  return { schema: 'NewCoreCylinderCode8RuntimePilotPlanValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function basePlan(rvm, optionResult) {
  return { schema: PLAN_SCHEMA, graphId: rvm?.graphId || '<unknown-graph>', units: rvm?.units || 'mm', sourceSchema: 'RvmExportModel.v1', mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', enabled: optionResult.enabled === true, fullModelReady: false, subsetReady: false, plannedCylinderCount: 0, excludedTorusCount: 0, excludedFlangeCount: 0, blockedValveCount: 0, deferredSupportCount: 0, productionWriterModified: false, runtimeRouteModified: false, browserTouched: false, canvasTouched: false, objectUrlCreated: false, downloadCreated: false, cylinderPrimitives: [], excludedItems: [], sourceTrace: [], warnings: [], errors: [] };
}

function validateRvmInput(rvm) {
  const errors = [];
  if (!rvm || rvm.schema !== 'RvmExportModel.v1') return ['RvmExportModel.v1 is required'];
  const contract = validateRvmExportModelContract(rvm);
  if (!contract.ok) errors.push(...contract.errors.map((entry) => `RvmExportModel contract: ${entry}`));
  if (rvm.transformApplied !== true) errors.push('RvmExportModel must have transformApplied true');
  if (rvm.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('RvmExportModel must use final-review-transform.v1');
  return errors;
}

function collectRows(rvm) {
  return { cylinders: array(rvm?.primitives).filter((entry) => entry.primitiveKind === 'CYLINDER' && Number(entry.primitiveCode) === 8), toruses: array(rvm?.testByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'TORUS'), flanges: array(rvm?.flangeTestByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER'), blockedValves: array(rvm?.blockedExports).filter((entry) => entry.family === 'valve'), deferredSupports: array(rvm?.deferredExports).filter((entry) => entry.family === 'support') };
}

function validateCylinder(primitive, index) {
  const errors = [];
  if (primitive.primitiveKind !== 'CYLINDER' || Number(primitive.primitiveCode) !== 8) errors.push(`cylinderPrimitives[${index}] must be CYLINDER/code8`);
  if (primitive.basis !== 'navis-review') errors.push(`cylinderPrimitives[${index}] basis must be navis-review`);
  if (primitive.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`cylinderPrimitives[${index}] transformPolicy must be final-review-transform.v1`);
  if (!isPoint3(primitive.center)) errors.push(`cylinderPrimitives[${index}] center must be finite [x,y,z]`);
  if (!isPoint3(primitive.axis) || !isUnit(primitive.axis)) errors.push(`cylinderPrimitives[${index}] axis must be normalized finite vector`);
  if (!positive(primitive.lengthMm)) errors.push(`cylinderPrimitives[${index}] lengthMm must be positive`);
  if (!positive(primitive.radiusMm)) errors.push(`cylinderPrimitives[${index}] radiusMm must be positive`);
  return errors;
}

function excludedItems(rows) { return [...rows.toruses.map((entry) => excluded(entry, 'torus-excluded-test-byte-only')), ...rows.flanges.map((entry) => excluded(entry, 'flange-excluded-test-byte-only')), ...rows.blockedValves.map((entry) => excluded(entry, 'valve-blocked')), ...rows.deferredSupports.map((entry) => excluded(entry, 'support-deferred'))]; }
function sourceTrace(rows) { return rows.cylinders.map((entry) => ({ sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, primitiveKind: 'CYLINDER', primitiveCode: 8, runtimePilotStatus: 'selected', sourceRef: entry.sourceRef })); }
function excluded(entry, reason) { return { sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, family: entry.family, primitiveKind: entry.primitiveKind, primitiveCode: entry.primitiveCode, reason, sourceRef: entry.sourceRef }; }
function withErrors(plan, errors) { return { ...plan, errors: [...errors] }; }
function copy(value) { return { ...value }; }
function array(value) { return Array.isArray(value) ? value : []; }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function isUnit(value) { return isPoint3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= AXIS_EPSILON; }
function hasFallback(value) { return value?.evidence?.fallbackUsed === true || value?.fallbackUsed === true || value?.geometryStatus === 'fallback'; }
function nonNegativeInteger(value) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
