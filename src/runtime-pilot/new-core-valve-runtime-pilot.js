import { validateRvmExportModelContract } from '../contracts/index.js';
import { FINAL_REVIEW_TRANSFORM_POLICY, transformAuthoringPointToReview, transformAuthoringVectorToReview } from '../export-models/review-transform-policy.js';

const PLAN_SCHEMA = 'NewCorePipeBendFlangeValveRuntimePilotPlan.v1';
const SCOPE = 'pipe-bend-flange-valve-subset';
const UNIT_EPSILON = 1e-6;
const FORBIDDEN_NODE_OPTIONS = Object.freeze(['browser', 'canvas', 'download', 'objectUrl', 'createObjectUrl', 'downloadUrl', 'dom', 'ui', 'appMutation']);

export function buildNewCoreValveRuntimePilotPlan(input, options) {
  const source = normalizeInput(input);
  const bag = object(options);
  const optionErrors = nodeOptionErrors(bag);
  const base = basePlan(source.rvmExportModel, bag, source.directRvm);
  if (optionErrors.length) return withErrors(base, optionErrors);
  const inputErrors = validateRvmInput(source.rvmExportModel);
  const rows = collectRows(source);
  const errors = [...inputErrors, ...validateGeneratedFamilies(rows)];
  const primitives = [...rows.cylinders, ...rows.toruses, ...rows.flanges, ...rows.valves];
  const attRows = buildAttRows(primitives, source.attExportModel);
  return populatedPlan(base, rows, attRows, errors);
}

export function validateNewCoreValveRuntimePilotPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== PLAN_SCHEMA) errors.push(`schema must be ${PLAN_SCHEMA}`);
  if (plan?.mode !== 'explicit-runtime-pilot') errors.push('mode must be explicit-runtime-pilot');
  if (plan?.scope !== SCOPE) errors.push(`scope must be ${SCOPE}`);
  for (const key of booleanKeys()) if (typeof plan?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  for (const key of countKeys()) if (!nonNegativeInteger(plan?.[key])) errors.push(`${key} must be non-negative integer`);
  for (const key of arrayKeys()) if (!Array.isArray(plan?.[key])) errors.push(`${key} must be array`);
  const expected = Number(plan?.plannedCylinderCount || 0) + Number(plan?.plannedTorusCount || 0) + Number(plan?.plannedFlangeCylinderCount || 0) + Number(plan?.plannedValveBodyCount || 0);
  if (Number(plan?.plannedRvmPrimitiveCount) !== expected) errors.push('plannedRvmPrimitiveCount mismatch');
  if (plan?.plannedAttRowCount !== plan?.plannedRvmPrimitiveCount) errors.push('plannedAttRowCount must equal plannedRvmPrimitiveCount');
  if (plan?.attRows?.length !== plan?.plannedRvmPrimitiveCount) errors.push('attRows length must match plannedRvmPrimitiveCount');
  if (plan?.attRowsMatchRvmPrimitives !== true) errors.push('attRowsMatchRvmPrimitives must be true');
  if (plan?.fullModelReady !== false) errors.push('fullModelReady must remain false');
  if (plan?.valveFallbackCount !== 0) errors.push('valveFallbackCount must be 0');
  if (plan?.guessedValveDimensionCount !== 0) errors.push('guessedValveDimensionCount must be 0');
  return { schema: 'NewCorePipeBendFlangeValveRuntimePilotPlanValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function populatedPlan(base, rows, attRows, errors) {
  const plannedRvmPrimitiveCount = rows.cylinders.length + rows.toruses.length + rows.flanges.length + rows.valves.length;
  const attRowsMatchRvmPrimitives = attRows.length === plannedRvmPrimitiveCount;
  const subsetReady = errors.length === 0 && rows.cylinders.length > 0 && rows.toruses.length > 0 && rows.flanges.length > 0 && attRowsMatchRvmPrimitives;
  return { ...base, subsetReady, plannedCylinderCount: rows.cylinders.length, plannedTorusCount: rows.toruses.length, plannedFlangeCylinderCount: rows.flanges.length, plannedValveBodyCount: rows.valves.length, generatedValveCount: rows.valves.length, blockedValveCount: rows.blockedValves.length, plannedRvmPrimitiveCount, plannedAttRowCount: attRows.length, attRowsMatchRvmPrimitives, deferredSupportCount: rows.deferredSupports.length, cylinderPrimitives: rows.cylinders.map(copy), torusPrimitives: rows.toruses.map(copy), flangeCylinderPrimitives: rows.flanges.map(copy), valveBodyPrimitives: rows.valves.map(copy), attRows, excludedItems: excludedItems(rows), sourceTrace: sourceTrace(rows), warnings: [...base.warnings, ...rows.warnings], errors };
}

function basePlan(rvm, options, directRvm) {
  const warnings = directRvm ? ['AttExportModel.v1 not supplied; pilot ATT rows are derived from primitive/source trace.'] : [];
  return { schema: PLAN_SCHEMA, graphId: rvm?.graphId || '<unknown-graph>', units: rvm?.units || 'mm', sourceSchema: 'RvmExportModel.v1', attSourceSchema: 'AttExportModel.v1', mode: 'explicit-runtime-pilot', scope: SCOPE, enabled: options.enabled === true, fullModelReady: false, subsetReady: false, plannedCylinderCount: 0, plannedTorusCount: 0, plannedFlangeCylinderCount: 0, plannedValveBodyCount: 0, blockedValveCount: 0, generatedValveCount: 0, plannedRvmPrimitiveCount: 0, plannedAttRowCount: 0, attRowsMatchRvmPrimitives: false, deferredSupportCount: 0, deterministicValveOnly: true, valveFallbackCount: 0, guessedValveDimensionCount: 0, productionWriterModified: false, productionAttWriterModified: false, runtimeRouteModified: false, browserTouched: false, canvasTouched: false, objectUrlCreated: false, downloadCreated: false, cylinderPrimitives: [], torusPrimitives: [], flangeCylinderPrimitives: [], valveBodyPrimitives: [], attRows: [], excludedItems: [], sourceTrace: [], warnings, errors: [] };
}

function normalizeInput(input) {
  if (input?.schema === 'RvmExportModel.v1') return { rvmExportModel: input, attExportModel: null, directRvm: true };
  return { rvmExportModel: input?.rvmExportModel || input?.exportModels?.rvmExportModel || null, attExportModel: input?.attExportModel || input?.exportModels?.attExportModel || null, graph: input?.graph || null, resolvedGeometry: input?.resolvedGeometry || null, primitiveModel: input?.primitiveModel || null, directRvm: false };
}

function nodeOptionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true };
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

function collectRows(source) {
  const rvm = source.rvmExportModel;
  const selected = selectValveBodies(source);
  return { cylinders: array(rvm?.primitives).filter((entry) => entry.primitiveKind === 'CYLINDER' && Number(entry.primitiveCode) === 8), toruses: array(rvm?.testByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'TORUS' && Number(entry.primitiveCode) === 4), flanges: array(rvm?.flangeTestByteEligiblePrimitives).filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER' && Number(entry.primitiveCode) === 8), valves: selected.generated, blockedValves: selected.blocked, deferredSupports: array(rvm?.deferredExports).filter((entry) => entry.family === 'support'), warnings: selected.warnings };
}

function selectValveBodies(source) {
  const context = sourceContext(source);
  const generated = [];
  const blocked = [];
  for (const entry of valveCandidates(source)) {
    const result = normalizeValveCandidate(entry, context);
    if (result.primitive && validateValve(result.primitive, generated.length).length === 0) generated.push(result.primitive);
    else blocked.push(blockedValve(entry, result.missingFields, result.reason));
  }
  return { generated, blocked, warnings: blocked.map((entry) => `${entry.sourceItemId || '<unknown-valve>'} blocked: ${entry.reason}`) };
}

function valveCandidates(source) {
  const rvm = source.rvmExportModel;
  const explicit = [...array(rvm?.valveBodyPrimitives), ...array(rvm?.valveBodyTestByteEligiblePrimitives), ...array(rvm?.primitives).filter(isValveBody), ...array(rvm?.testByteEligiblePrimitives).filter(isValveBody)];
  const blocked = array(rvm?.blockedExports).filter((entry) => entry.family === 'valve');
  const deferred = array(rvm?.deferredExports).filter((entry) => entry.family === 'valve');
  const primitives = array(source.primitiveModel?.primitives).filter(isValveBody);
  return uniqueBySource([...explicit, ...primitives, ...blocked, ...deferred]);
}

function normalizeValveCandidate(entry, context) {
  const source = context.bySourceItemId.get(String(entry.sourceItemId || entry.itemId || '')) || {};
  const merged = { ...source, ...entry };
  const missingFields = requiredValveMissingFields(merged);
  if (missingFields.length) return { primitive: null, missingFields, reason: `missing ${missingFields.join('/')}` };
  const primitive = valvePrimitive(merged);
  return { primitive, missingFields: [], reason: '' };
}

function valvePrimitive(entry) {
  const center = entry.basis === 'navis-review' || entry.transformApplied === true ? point(entry.center) : transformAuthoringPointToReview(entry.center, { fieldName: 'valve.center' });
  const axis = entry.basis === 'navis-review' || entry.transformApplied === true ? point(entry.axis) : transformAuthoringVectorToReview(entry.axis, { fieldName: 'valve.axis' });
  return copyDefined({ primitiveKind: 'VALVE_BODY_CYLINDER', primitiveCode: 8, basis: 'navis-review', transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY, transformApplied: true, center, axis, lengthMm: scalar(entry.lengthMm ?? entry.bodyLengthMm), bodyRadiusMm: scalar(entry.bodyRadiusMm ?? entry.outerRadiusMm ?? half(entry.bodyOuterDiameterMm ?? entry.outerDiameterMm)), boreRadiusMm: optionalScalar(entry.boreRadiusMm ?? half(entry.boreDiameterMm)), sourceItemId: entry.sourceItemId || entry.itemId, sourcePrimitiveId: entry.sourcePrimitiveId || entry.primitiveId, exportPrimitiveId: entry.exportPrimitiveId || `RVM-VALVE-BODY-${entry.sourceItemId || entry.itemId}`, catalogueItemId: entry.catalogueItemId, family: 'valve', tag: entry.tag, name: entry.name, deterministicGeometry: true, dimensionSource: entry.dimensionSource || 'explicit-valve-body-dimensions', writerReady: false, runtimePilotReady: true, fallbackUsed: false });
}

function requiredValveMissingFields(entry) {
  const missing = [];
  if (!point3(entry.center)) missing.push('center');
  if (!unit(entry.axis)) missing.push('axis');
  if (!positive(entry.lengthMm ?? entry.bodyLengthMm)) missing.push('bodyLengthMm');
  if (!positive(entry.bodyRadiusMm ?? entry.outerRadiusMm ?? half(entry.bodyOuterDiameterMm ?? entry.outerDiameterMm))) missing.push('bodyRadiusMm');
  if (!entry.sourceItemId && !entry.itemId) missing.push('sourceItemId');
  if (!entry.sourcePrimitiveId && !entry.primitiveId) missing.push('sourcePrimitiveId');
  if (!entry.exportPrimitiveId && !entry.sourceItemId && !entry.itemId) missing.push('exportPrimitiveId');
  if (!entry.catalogueItemId) missing.push('catalogueItemId');
  if (entry.fallbackUsed === true || entry.evidence?.fallbackUsed === true) missing.push('fallbackUsed=false');
  if (entry.guessedDimension === true || entry.guessedDimensions === true || entry.dimensionSource === 'guessed') missing.push('noGuessedDimensions');
  return missing;
}

function sourceContext(source) {
  const map = new Map();
  const nodes = new Map(array(source.graph?.nodes).map((node) => [String(node.id), node.coord]));
  const routes = new Map(array(source.graph?.routes).map((route) => [String(route.id), route]));
  for (const item of array(source.graph?.items).filter((entry) => entry.family === 'valve')) map.set(String(item.id), graphValveCandidate(item, routes, nodes));
  return { bySourceItemId: map };
}

function graphValveCandidate(item, routes, nodes) {
  const route = routes.get(String(item.route));
  const start = route ? pointOrNull(nodes.get(String(route.from))) : null;
  const end = route ? pointOrNull(nodes.get(String(route.to))) : null;
  return copyDefined({ itemId: item.id, sourceItemId: item.id, family: 'valve', type: item.type, center: item.placement?.position || (start && end ? midpoint(start, end) : undefined), axis: start && end ? unitVector(subtract(end, start)) : undefined, lengthMm: item.dimensions?.bodyLengthMm, bodyRadiusMm: item.dimensions?.bodyRadiusMm, outerDiameterMm: item.dimensions?.bodyOuterDiameterMm || item.dimensions?.outerDiameterMm, boreDiameterMm: item.dimensions?.boreDiameterMm, sourceRef: item.sourceRef, dimensionSource: 'plant-model-graph-explicit-valve-dimensions' });
}

function validateGeneratedFamilies(rows) {
  return [...rows.cylinders.flatMap(validateCylinder), ...rows.toruses.flatMap(validateTorus), ...rows.flanges.flatMap(validateFlange), ...rows.valves.flatMap(validateValve), ...[...rows.cylinders, ...rows.toruses, ...rows.flanges, ...rows.valves].filter(hasFallback).map((entry) => `${entry.sourceItemId} uses fallback geometry`)];
}

function validateCylinder(primitive, index) {
  const label = `cylinderPrimitives[${index}]`;
  const errors = commonErrors(primitive, label);
  if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
  if (!positive(primitive.lengthMm)) errors.push(`${label}.lengthMm must be positive`);
  if (!positive(primitive.radiusMm)) errors.push(`${label}.radiusMm must be positive`);
  return errors;
}

function validateTorus(primitive, index) {
  const label = `torusPrimitives[${index}]`;
  const errors = commonErrors(primitive, label);
  for (const key of ['normal', 'startTangent', 'endTangent']) if (!unit(primitive[key])) errors.push(`${label}.${key} must be normalized finite vector`);
  for (const key of ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg']) if (!positive(primitive[key])) errors.push(`${label}.${key} must be positive`);
  if (primitive.writerReady !== false) errors.push(`${label}.writerReady must remain false`);
  return errors;
}

function validateFlange(primitive, index) {
  const label = `flangeCylinderPrimitives[${index}]`;
  const errors = commonErrors(primitive, label);
  if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
  for (const key of ['lengthMm', 'outerRadiusMm', 'boreRadiusMm']) if (!positive(primitive[key])) errors.push(`${label}.${key} must be positive`);
  if (Number(primitive.outerRadiusMm) <= Number(primitive.boreRadiusMm)) errors.push(`${label}.outerRadiusMm must be greater than boreRadiusMm`);
  if (primitive.writerReady !== false) errors.push(`${label}.writerReady must remain false`);
  return errors;
}

function validateValve(primitive, index) {
  const label = `valveBodyPrimitives[${index}]`;
  const errors = commonErrors(primitive, label);
  if (primitive?.primitiveKind !== 'VALVE_BODY_CYLINDER') errors.push(`${label}.primitiveKind must be VALVE_BODY_CYLINDER`);
  if (Number(primitive?.primitiveCode) !== 8) errors.push(`${label}.primitiveCode must be 8`);
  if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
  if (!positive(primitive.lengthMm)) errors.push(`${label}.lengthMm must be positive`);
  if (!positive(primitive.bodyRadiusMm)) errors.push(`${label}.bodyRadiusMm must be positive`);
  if (primitive.boreRadiusMm !== undefined && (!nonNegative(primitive.boreRadiusMm) || Number(primitive.bodyRadiusMm) <= Number(primitive.boreRadiusMm))) errors.push(`${label}.bodyRadiusMm must be greater than boreRadiusMm`);
  if (!primitive.sourceItemId || !primitive.sourcePrimitiveId || !primitive.exportPrimitiveId || !primitive.catalogueItemId) errors.push(`${label}.source identity is required`);
  if (primitive.deterministicGeometry !== true || primitive.fallbackUsed !== false || primitive.writerReady !== false) errors.push(`${label}.deterministic runtime-pilot policy invalid`);
  if (primitive.guessedDimension === true || primitive.guessedDimensions === true || primitive.dimensionSource === 'guessed') errors.push(`${label}.guessed dimensions are forbidden`);
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

function buildAttRows(primitives, attModel) {
  return primitives.map((primitive, index) => attRow(primitive, findAttRecord(primitive, attModel), index));
}

function findAttRecord(primitive, attModel) {
  return array(attModel?.records).find((row) => [primitive.sourceItemId, primitive.sourcePrimitiveId, primitive.exportPrimitiveId].some((id) => id && [row.sourceItemId, row.sourcePrimitiveId, row.exportPrimitiveId, row.recordId].includes(id))) || null;
}

function attRow(primitive, record, index) {
  return { elementId: record?.recordId || primitive.exportPrimitiveId || `PILOT-${index + 1}`, sourceItemId: primitive.sourceItemId || '', sourcePrimitiveId: primitive.sourcePrimitiveId || '', exportPrimitiveId: primitive.exportPrimitiveId || '', primitiveKind: primitive.primitiveKind || '', primitiveCode: Number(primitive.primitiveCode || 0), family: primitive.family || inferFamily(primitive), catalogueItemId: primitive.catalogueItemId || '', tag: record?.tag || primitive.tag || '', name: record?.name || primitive.name || '', runtimePilotStatus: 'generated', runtimePilotScope: SCOPE, deterministicGeometry: true };
}

function excludedItems(rows) {
  return [...rows.blockedValves, ...rows.deferredSupports.map((entry) => excluded(entry, 'support-deferred'))];
}

function sourceTrace(rows) {
  return [...rows.cylinders.map((entry) => trace(entry, 'CYLINDER', 8)), ...rows.toruses.map((entry) => trace(entry, 'TORUS', 4)), ...rows.flanges.map((entry) => trace(entry, 'FLANGE_CYLINDER', 8)), ...rows.valves.map((entry) => trace(entry, 'VALVE_BODY_CYLINDER', 8))];
}

function trace(entry, primitiveKind, primitiveCode) {
  return { sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, primitiveKind, primitiveCode, family: entry.family || inferFamily(entry), runtimePilotStatus: 'generated', sourceRef: entry.sourceRef };
}

function blockedValve(entry, missingFields, reason) {
  return { sourceItemId: entry.sourceItemId || entry.itemId || '', family: 'valve', primitiveKind: 'VALVE_BODY_CYLINDER', reason, missingFields, sourceRef: entry.sourceRef };
}

function excluded(entry, reason) {
  return { sourceItemId: entry.sourceItemId, family: entry.family, primitiveKind: entry.primitiveKind, reason, sourceRef: entry.sourceRef };
}

function inferFamily(primitive) {
  if (primitive.primitiveKind === 'TORUS') return 'bend';
  if (primitive.primitiveKind === 'FLANGE_CYLINDER') return 'flange';
  if (primitive.primitiveKind === 'VALVE_BODY_CYLINDER') return 'valve';
  return 'pipe';
}

function booleanKeys() { return ['enabled', 'fullModelReady', 'subsetReady', 'attRowsMatchRvmPrimitives', 'deterministicValveOnly', 'productionWriterModified', 'productionAttWriterModified', 'runtimeRouteModified', 'browserTouched', 'canvasTouched', 'objectUrlCreated', 'downloadCreated']; }
function countKeys() { return ['plannedCylinderCount', 'plannedTorusCount', 'plannedFlangeCylinderCount', 'plannedValveBodyCount', 'blockedValveCount', 'generatedValveCount', 'plannedRvmPrimitiveCount', 'plannedAttRowCount', 'deferredSupportCount', 'valveFallbackCount', 'guessedValveDimensionCount']; }
function arrayKeys() { return ['cylinderPrimitives', 'torusPrimitives', 'flangeCylinderPrimitives', 'valveBodyPrimitives', 'attRows', 'excludedItems', 'sourceTrace', 'warnings', 'errors']; }
function isValveBody(entry) { return entry?.primitiveKind === 'VALVE_BODY_CYLINDER' || entry?.primitiveKind === 'VALVE_BODY'; }
function withErrors(plan, errors) { return { ...plan, errors: [...errors] }; }
function hasFallback(entry) { return entry?.evidence?.fallbackUsed === true || entry?.fallbackUsed === true || entry?.geometryStatus === 'fallback'; }
function point3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function point(value) { return value.map(Number); }
function pointOrNull(value) { return point3(value) ? point(value) : null; }
function unit(value) { return point3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= UNIT_EPSILON; }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function nonNegative(value) { return Number.isFinite(Number(value)) && Number(value) >= 0; }
function nonNegativeInteger(value) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
function scalar(value) { return Number(value); }
function optionalScalar(value) { return value === undefined ? undefined : Number(value); }
function half(value) { return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) / 2 : undefined; }
function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' ? value : {}; }
function copy(value) { return { ...value }; }
function copyDefined(value) { return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)); }
function uniqueBySource(entries) { const seen = new Set(); return entries.filter((entry) => { const key = String(entry.exportPrimitiveId || entry.sourcePrimitiveId || entry.sourceItemId || entry.itemId || JSON.stringify(entry)); if (seen.has(key)) return false; seen.add(key); return true; }); }
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function unitVector(vector) { const length = Math.hypot(...vector); return vector.map((entry) => entry / length); }
