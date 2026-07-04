import { validateRvmExportModelContract } from '../contracts/index.js';

const PLAN_SCHEMA = 'NewCorePipeBendFlangeRuntimePilotPlan.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const UNIT_EPSILON = 1e-6;
const FORBIDDEN_NODE_OPTIONS = Object.freeze(['browser', 'canvas', 'download', 'objectUrl', 'createObjectUrl', 'downloadUrl', 'dom', 'ui', 'appMutation']);

export function buildNewCorePipeBendFlangeRuntimePilotPlan(input, options = {}) {
  const { rvmExportModel, attExportModel, directRvm } = normalizeInput(input);
  const optionErrors = nodeOptionErrors(options);
  const base = basePlan(rvmExportModel, options, directRvm);
  if (optionErrors.length) return withErrors(base, optionErrors);
  const inputErrors = validateRvmInput(rvmExportModel);
  const rows = collectRows(rvmExportModel);
  const errors = [...inputErrors, ...validateAll(rows)];
  const attRows = buildAttRows([...rows.cylinders, ...rows.toruses, ...rows.flanges], attExportModel);
  return populatedPlan(base, rows, attRows, errors);
}

export function validateNewCorePipeBendFlangeRuntimePilotPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== PLAN_SCHEMA) errors.push(`schema must be ${PLAN_SCHEMA}`);
  if (plan?.mode !== 'explicit-runtime-pilot') errors.push('mode must be explicit-runtime-pilot');
  if (plan?.scope !== 'pipe-bend-flange-subset') errors.push('scope must be pipe-bend-flange-subset');
  for (const key of booleanKeys()) if (typeof plan?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  for (const key of countKeys()) if (!nonNegativeInteger(plan?.[key])) errors.push(`${key} must be non-negative integer`);
  for (const key of ['cylinderPrimitives', 'torusPrimitives', 'flangeCylinderPrimitives', 'attRows', 'excludedItems', 'sourceTrace', 'warnings', 'errors']) if (!Array.isArray(plan?.[key])) errors.push(`${key} must be array`);
  if (plan?.plannedRvmPrimitiveCount !== plan?.plannedCylinderCount + plan?.plannedTorusCount + plan?.plannedFlangeCylinderCount) errors.push('plannedRvmPrimitiveCount mismatch');
  if (plan?.plannedAttRowCount !== plan?.plannedRvmPrimitiveCount) errors.push('plannedAttRowCount must equal plannedRvmPrimitiveCount');
  if (plan?.attRows?.length !== plan?.plannedRvmPrimitiveCount) errors.push('attRows length must match plannedRvmPrimitiveCount');
  if (plan?.attRowsMatchRvmPrimitives !== true) errors.push('attRowsMatchRvmPrimitives must be true');
  return { schema: 'NewCorePipeBendFlangeRuntimePilotPlanValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function populatedPlan(base, rows, attRows, errors) {
  const plannedRvmPrimitiveCount = rows.cylinders.length + rows.toruses.length + rows.flanges.length;
  const attRowsMatchRvmPrimitives = attRows.length === plannedRvmPrimitiveCount;

  if (!attRowsMatchRvmPrimitives && !errors.includes('att row count mismatch')) errors.push('att row count mismatch');

  const subsetReady = errors.length === 0 && attRowsMatchRvmPrimitives;
  return { ...base, subsetReady, plannedCylinderCount: rows.cylinders.length, plannedTorusCount: rows.toruses.length, plannedFlangeCylinderCount: rows.flanges.length, plannedRvmPrimitiveCount, plannedAttRowCount: attRows.length, attRowsMatchRvmPrimitives, blockedValveCount: rows.blockedValves.length, deferredSupportCount: rows.deferredSupports.length, cylinderPrimitives: rows.cylinders.map(copy), torusPrimitives: rows.toruses.map(copy), flangeCylinderPrimitives: rows.flanges.map(copy), attRows, excludedItems: excludedItems(rows), sourceTrace: sourceTrace(rows), errors };
}

function basePlan(rvm, options, directRvm) {
  const warnings = directRvm ? ['AttExportModel.v1 not supplied; pilot ATT rows are derived from primitive/source trace.'] : [];
  return { schema: PLAN_SCHEMA, graphId: rvm?.graphId || '<unknown-graph>', units: rvm?.units || 'mm', sourceSchema: 'RvmExportModel.v1', attSourceSchema: 'AttExportModel.v1', mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', enabled: options.enabled === true, fullModelReady: false, subsetReady: false, plannedCylinderCount: 0, plannedTorusCount: 0, plannedFlangeCylinderCount: 0, plannedRvmPrimitiveCount: 0, plannedAttRowCount: 0, attRowsMatchRvmPrimitives: false, blockedValveCount: 0, deferredSupportCount: 0, productionWriterModified: false, productionAttWriterModified: false, runtimeRouteModified: false, browserTouched: false, canvasTouched: false, objectUrlCreated: false, downloadCreated: false, cylinderPrimitives: [], torusPrimitives: [], flangeCylinderPrimitives: [], attRows: [], excludedItems: [], sourceTrace: [], warnings, errors: [] };
}

function normalizeInput(input) {
  if (input?.schema === 'RvmExportModel.v1') return { rvmExportModel: input, attExportModel: null, directRvm: true };
  return { rvmExportModel: input?.rvmExportModel || input?.exportModels?.rvmExportModel || null, attExportModel: input?.attExportModel || input?.exportModels?.attExportModel || null, directRvm: false };
}

function nodeOptionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true };
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
  return { cylinders: array(rvm?.primitives).filter((entry) => entry.primitiveKind === 'CYLINDER' && Number(entry.primitiveCode) === 8), toruses: array(rvm?.testByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'TORUS' && Number(entry.primitiveCode) === 4), flanges: array(rvm?.flangeTestByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER' && Number(entry.primitiveCode) === 8), blockedValves: array(rvm?.blockedExports).filter((entry) => entry.family === 'valve'), deferredSupports: array(rvm?.deferredExports).filter((entry) => entry.family === 'support') };
}

function validateAll(rows) { return [...rows.cylinders.flatMap((entry, index) => validateCylinder(entry, index)), ...rows.toruses.flatMap((entry, index) => validateTorus(entry, index)), ...rows.flanges.flatMap((entry, index) => validateFlange(entry, index)), ...[...rows.cylinders, ...rows.toruses, ...rows.flanges].filter(hasFallback).map((entry) => `${entry.sourceItemId} uses fallback geometry`)]; }
function validateCylinder(primitive, index) { const label = `cylinderPrimitives[${index}]`; const errors = commonErrors(primitive, label); if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`); if (!positive(primitive.lengthMm)) errors.push(`${label}.lengthMm must be positive`); if (!positive(primitive.radiusMm)) errors.push(`${label}.radiusMm must be positive`); return errors; }
function validateTorus(primitive, index) { const label = `torusPrimitives[${index}]`; const errors = commonErrors(primitive, label); for (const key of ['normal', 'startTangent', 'endTangent']) if (!unit(primitive[key])) errors.push(`${label}.${key} must be normalized finite vector`); for (const key of ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg']) if (!positive(primitive[key])) errors.push(`${label}.${key} must be positive`); if (primitive.writerReady !== false) errors.push(`${label}.writerReady must remain false`); return errors; }
function validateFlange(primitive, index) { const label = `flangeCylinderPrimitives[${index}]`; const errors = commonErrors(primitive, label); if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`); for (const key of ['lengthMm', 'outerRadiusMm', 'boreRadiusMm']) if (!positive(primitive[key])) errors.push(`${label}.${key} must be positive`); if (Number(primitive.outerRadiusMm) <= Number(primitive.boreRadiusMm)) errors.push(`${label}.outerRadiusMm must be greater than boreRadiusMm`); if (!primitive.catalogueItemId) errors.push(`${label}.catalogueItemId is required`); if (primitive.writerReady !== false) errors.push(`${label}.writerReady must remain false`); return errors; }
function commonErrors(primitive, label) { const errors = []; if (!point3(primitive?.center)) errors.push(`${label}.center must be finite [x,y,z]`); if (primitive?.basis !== 'navis-review') errors.push(`${label}.basis must be navis-review`); if (primitive?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`${label}.transformPolicy must be final-review-transform.v1`); if (primitive?.transformApplied !== true && primitive?.writerReady === false) errors.push(`${label}.transformApplied must be true`); return errors; }

function buildAttRows(primitives, attModel) { return primitives.map((primitive, index) => attRow(primitive, findAttRecord(primitive, attModel), index)); }
function findAttRecord(primitive, attModel) { return array(attModel?.records).find((row) => [primitive.sourceItemId, primitive.sourcePrimitiveId, primitive.exportPrimitiveId].some((id) => id && [row.sourceItemId, row.sourcePrimitiveId, row.exportPrimitiveId, row.recordId].includes(id))) || null; }
function attRow(primitive, record, index) { return { elementId: record?.recordId || primitive.exportPrimitiveId || `PILOT-${index + 1}`, sourceItemId: primitive.sourceItemId || '', sourcePrimitiveId: primitive.sourcePrimitiveId || '', exportPrimitiveId: primitive.exportPrimitiveId || '', primitiveKind: primitive.primitiveKind || '', primitiveCode: Number(primitive.primitiveCode || 0), family: primitive.family || inferFamily(primitive), catalogueItemId: primitive.catalogueItemId || '', tag: record?.tag || primitive.tag || '', name: record?.name || primitive.name || '', runtimePilotStatus: 'generated', runtimePilotScope: 'pipe-bend-flange-subset' }; }
function excludedItems(rows) { return [...rows.blockedValves.map((entry) => excluded(entry, 'valve-blocked')), ...rows.deferredSupports.map((entry) => excluded(entry, 'support-deferred'))]; }
function sourceTrace(rows) { return [...rows.cylinders.map((entry) => trace(entry, 'CYLINDER', 8)), ...rows.toruses.map((entry) => trace(entry, 'TORUS', 4)), ...rows.flanges.map((entry) => trace(entry, 'FLANGE_CYLINDER', 8))]; }
function trace(entry, primitiveKind, primitiveCode) { return { sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, primitiveKind, primitiveCode, runtimePilotStatus: 'generated', sourceRef: entry.sourceRef }; }
function excluded(entry, reason) { return { sourceItemId: entry.sourceItemId, family: entry.family, primitiveKind: entry.primitiveKind, reason, sourceRef: entry.sourceRef }; }
function inferFamily(primitive) { return primitive.primitiveKind === 'TORUS' ? 'bend' : primitive.primitiveKind === 'FLANGE_CYLINDER' ? 'flange' : 'pipe'; }
function withErrors(plan, errors) { return { ...plan, errors: [...errors] }; }
function booleanKeys() { return ['enabled', 'fullModelReady', 'subsetReady', 'attRowsMatchRvmPrimitives', 'productionWriterModified', 'productionAttWriterModified', 'runtimeRouteModified', 'browserTouched', 'canvasTouched', 'objectUrlCreated', 'downloadCreated']; }
function countKeys() { return ['plannedCylinderCount', 'plannedTorusCount', 'plannedFlangeCylinderCount', 'plannedRvmPrimitiveCount', 'plannedAttRowCount', 'blockedValveCount', 'deferredSupportCount']; }
function hasFallback(entry) { return entry?.evidence?.fallbackUsed === true || entry?.fallbackUsed === true || entry?.geometryStatus === 'fallback'; }
function point3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function unit(value) { return point3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= UNIT_EPSILON; }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function nonNegativeInteger(value) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
function array(value) { return Array.isArray(value) ? value : []; }
function copy(value) { return { ...value }; }
