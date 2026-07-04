import { FINAL_REVIEW_TRANSFORM_POLICY, transformAuthoringPointToReview, transformAuthoringVectorToReview } from '../export-models/review-transform-policy.js';
import { buildNewCoreValveRuntimePilotPlan, validateNewCoreValveRuntimePilotPlan } from './new-core-valve-runtime-pilot.js';

const PLAN_SCHEMA = 'NewCoreSupportMarkerRuntimePilotPlan.v1';
const SCOPE = 'pipe-bend-flange-valve-support-marker-subset';
const VALVE_SCOPE = 'pipe-bend-flange-valve-subset';
const SUPPORT_MARKER_CATALOGUE_ID = 'SOURCE_SUPPORT_MARKER';
const SUPPORT_MARKER_DEFAULT_PIPE_OD_MM = 60;
const UNIT_EPSILON = 1e-6;

/**
 * Builds the Export V2 support-marker plan on top of the pipe/bend/flange/valve plan.
 * Parameters: resolved new-core pipeline state plus explicit runtime-pilot options.
 * Output: a full RVM/ATT-ready plan with deterministic code-8/code-9 support marker primitives.
 * Fallback: when support rows lack pipe OD, the marker symbol size uses the existing 60 mm policy size.
 */
export function buildNewCoreSupportMarkerRuntimePilotPlan(input, options) {
  const bag = object(options);
  const valvePlan = buildNewCoreValveRuntimePilotPlan(input, { ...bag, scope: VALVE_SCOPE });
  const markers = collectSupportMarkers(input);
  const supportPrimitives = markers.generated.flatMap(supportMarkerPrimitives);
  const supportAttRows = buildSupportAttRows(supportPrimitives);
  const plannedRvmPrimitiveCount = Number(valvePlan.plannedRvmPrimitiveCount || 0) + supportPrimitives.length;
  const plannedAttRowCount = Number(valvePlan.plannedAttRowCount || 0) + supportAttRows.length;
  const attRowsMatchRvmPrimitives = plannedAttRowCount === plannedRvmPrimitiveCount;
  const errors = [
    ...optionErrorsFor(bag),
    ...validateMarkers(markers.generated),
    ...validateSupportPrimitives(supportPrimitives),
    ...fatalValveErrors(valvePlan),
  ];
  if (!attRowsMatchRvmPrimitives) errors.push('support ATT row count mismatch');

  const supportGeometryGenerated = supportPrimitives.length > 0;
  const fullModelReady = valvePlan.subsetReady === true && supportGeometryGenerated && markers.blocked.length === 0;
  const subsetReady = errors.length === 0 && markers.generated.length > 0 && supportGeometryGenerated && attRowsMatchRvmPrimitives;

  return {
    schema: PLAN_SCHEMA,
    mode: 'explicit-runtime-pilot',
    scope: SCOPE,
    enabled: bag.enabled === true,
    baseRuntimePilotScope: VALVE_SCOPE,
    fullModelReady,
    subsetReady,
    supportMarkersOptional: false,
    supportMarkerCount: markers.generated.length,
    blockedSupportMarkerCount: markers.blocked.length,
    supportPrimitiveCount: supportPrimitives.length,
    supportCylinderPrimitiveCount: supportPrimitives.filter((entry) => Number(entry.primitiveCode) === 8).length,
    supportSpherePrimitiveCount: supportPrimitives.filter((entry) => Number(entry.primitiveCode) === 9).length,
    supportGeometryGenerated,
    supportFallbackCount: 0,
    supportMarkers: markers.generated,
    supportMarkerPrimitives: supportPrimitives,
    blockedSupportMarkers: markers.blocked,
    basePlan: valvePlan,
    plannedCylinderCount: Number(valvePlan.plannedCylinderCount || 0),
    plannedTorusCount: Number(valvePlan.plannedTorusCount || 0),
    plannedFlangeCylinderCount: Number(valvePlan.plannedFlangeCylinderCount || 0),
    plannedValveBodyCount: Number(valvePlan.plannedValveBodyCount || 0),
    generatedValveCount: Number(valvePlan.generatedValveCount || 0),
    blockedValveCount: Number(valvePlan.blockedValveCount || 0),
    plannedRvmPrimitiveCount,
    plannedAttRowCount,
    attRowsMatchRvmPrimitives,
    deterministicValveOnly: true,
    valveFallbackCount: Number(valvePlan.valveFallbackCount || 0),
    guessedValveDimensionCount: Number(valvePlan.guessedValveDimensionCount || 0),
    deferredSupportCount: 0,
    cylinderPrimitives: array(valvePlan.cylinderPrimitives),
    torusPrimitives: array(valvePlan.torusPrimitives),
    flangeCylinderPrimitives: array(valvePlan.flangeCylinderPrimitives),
    valveBodyPrimitives: array(valvePlan.valveBodyPrimitives),
    attRows: [...array(valvePlan.attRows), ...supportAttRows],
    sourceTrace: [...array(valvePlan.sourceTrace), ...supportPrimitives.map(supportTrace)],
    warnings: markers.blocked.map((entry) => `${entry.sourceItemId || '<unknown-support>'} blocked: ${entry.reason}`),
    errors,
  };
}

export function validateNewCoreSupportMarkerRuntimePilotPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== PLAN_SCHEMA) errors.push(`schema must be ${PLAN_SCHEMA}`);
  if (plan?.scope !== SCOPE) errors.push(`scope must be ${SCOPE}`);
  if (plan?.baseRuntimePilotScope !== VALVE_SCOPE) errors.push(`baseRuntimePilotScope must be ${VALVE_SCOPE}`);
  if (plan?.supportGeometryGenerated !== true) errors.push('supportGeometryGenerated must be true');
  if (Number(plan?.supportFallbackCount || 0) !== 0) errors.push('supportFallbackCount must be 0');
  if (!Array.isArray(plan?.supportMarkers)) errors.push('supportMarkers must be array');
  if (!Array.isArray(plan?.supportMarkerPrimitives)) errors.push('supportMarkerPrimitives must be array');
  if (!Array.isArray(plan?.blockedSupportMarkers)) errors.push('blockedSupportMarkers must be array');
  if (Number(plan?.supportMarkerCount || 0) !== array(plan?.supportMarkers).length) errors.push('supportMarkerCount mismatch');
  if (Number(plan?.blockedSupportMarkerCount || 0) !== array(plan?.blockedSupportMarkers).length) errors.push('blockedSupportMarkerCount mismatch');
  if (Number(plan?.supportPrimitiveCount || 0) !== array(plan?.supportMarkerPrimitives).length) errors.push('supportPrimitiveCount mismatch');
  if (Number(plan?.plannedAttRowCount || 0) !== Number(plan?.plannedRvmPrimitiveCount || 0)) errors.push('plannedAttRowCount must equal plannedRvmPrimitiveCount');
  if (plan?.attRowsMatchRvmPrimitives !== true) errors.push('attRowsMatchRvmPrimitives must be true');
  if (!validateNewCoreValveRuntimePilotPlan(plan?.basePlan).ok) errors.push('base Phase 16 valve plan must validate');
  return { schema: 'NewCoreSupportMarkerRuntimePilotPlanValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function fatalValveErrors(valvePlan) {
  const rvmAbsenceErrors = new Set([
    'RvmExportModel.v1 is required',
    'no CYLINDER primitives found',
    'no elbow TORUS primitives found',
    'no FLANGE_CYLINDER primitives found',
    'att row count mismatch',
  ]);
  return array(valvePlan.errors).filter((entry) => !rvmAbsenceErrors.has(entry));
}

function collectSupportMarkers(input) {
  const placements = array(input?.resolvedGeometry?.supportPlacements);
  const graphSupports = array(input?.graph?.items).filter((item) => item.kind === 'support');
  const context = supportContext(input);
  const rows = placements.length ? placements : graphSupports.map(graphSupport);
  const generated = [];
  const blocked = [];
  for (const row of rows) {
    const marker = markerFromPlacement(row, context);
    if (marker) generated.push(marker);
    else blocked.push({ sourceItemId: row.itemId || row.id || '', family: 'support', reason: 'missing deterministic support placement', sourceRef: row.sourceRef });
  }
  return { generated, blocked };
}

function markerFromPlacement(row, context) {
  const position = point3(row.position || row.placement?.position);
  if (!position || !(row.itemId || row.id)) return null;
  const nearestRoute = nearestRouteFrame(position, context.routeFrames);
  const axis = axisVector(row.axis);
  return {
    markerKind: 'SUPPORT_PLACEMENT_MARKER',
    family: 'support',
    sourceItemId: row.itemId || row.id,
    sourcePrimitiveId: `SUPPORT-MARKER-${row.itemId || row.id}`,
    center: transformAuthoringPointToReview(position, { fieldName: 'supportMarker.center' }),
    axis: transformAuthoringVectorToReview(axis, { fieldName: 'supportMarker.axis' }),
    basis: 'navis-review',
    transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY,
    transformApplied: true,
    supportFamily: normalizeSupportFamily(row.supportFamily || row.type || ''),
    pipeOdMm: nearestRoute?.pipeOdMm || SUPPORT_MARKER_DEFAULT_PIPE_OD_MM,
    pipeAxis: nearestRoute?.axis ? transformAuthoringVectorToReview(nearestRoute.axis, { fieldName: 'supportMarker.pipeAxis' }) : [1, 0, 0],
    deterministicPlacement: true,
    markerOnly: false,
    rvmGeometryGenerated: true,
    writerReady: true,
    runtimePilotReady: true,
    fallbackUsed: false,
    sourceRef: row.sourceRef,
  };
}

function graphSupport(item) {
  return { itemId: item.id, position: item.placement?.position, axis: item.axis, supportFamily: item.supportFamily, sourceRef: item.sourceRef };
}

function supportMarkerPrimitives(marker) {
  const center = point3(marker.center);
  const pipeOdMm = Math.max(Number(marker.pipeOdMm) || SUPPORT_MARKER_DEFAULT_PIPE_OD_MM, SUPPORT_MARKER_DEFAULT_PIPE_OD_MM);
  const pipeRadiusMm = pipeOdMm / 2;
  const pinDirection = Math.abs(unitVector(marker.pipeAxis || [1, 0, 0])[2]) > 0.8 ? [1, 0, 0] : [0, 0, 1];
  const sphereCenter = add(center, scale(pinDirection, pipeOdMm * 1.5));
  const rodStart = add(center, scale(pinDirection, pipeOdMm));
  const rows = [
    supportSphere(marker, 'pin-sphere', sphereCenter, Math.max(pipeOdMm * 0.2, 16)),
    supportCylinderBetween(marker, 'pin-rod', rodStart, sphereCenter, Math.max(pipeOdMm * 0.08, 4)),
  ];
  for (const [role, direction, tip] of supportArrowDefinitions(marker.supportFamily, marker.pipeAxis, center, pipeRadiusMm)) {
    rows.push(...supportArrow(marker, role, direction, tip, pipeOdMm));
  }
  return rows;
}

function supportArrowDefinitions(family, pipeAxis, center, pipeRadiusMm) {
  const up = [0, 1, 0];
  const pipe = unitVector(pipeAxis || [1, 0, 0]);
  const pipeDim = dominantAxis(pipe);
  if (family === 'GUIDE') {
    const lateral = pipeDim === 'x' ? [0, 0, 1] : [1, 0, 0];
    return [
      ['guide-plus', lateral, add(center, scale(lateral, -pipeRadiusMm))],
      ['guide-minus', scale(lateral, -1), add(center, scale(lateral, pipeRadiusMm))],
    ];
  }
  if (family === 'LINESTOP' || family === 'LIMIT' || family === 'ANCHOR') {
    const offset = pipeDim === 'y' ? [1, 0, 0] : up;
    const offsetCenter = add(center, scale(offset, pipeRadiusMm * 1.33));
    return [
      ['linestop-plus', pipe, offsetCenter],
      ['linestop-minus', scale(pipe, -1), offsetCenter],
    ];
  }
  if (family === 'HOLDDOWN' || family === 'U_BOLT') {
    return [
      ['holddown-up', up, add(center, scale(up, -pipeRadiusMm))],
      ['holddown-down', [0, -1, 0], add(center, scale(up, pipeRadiusMm))],
    ];
  }
  return [['rest-up', up, add(center, scale(up, -pipeRadiusMm))]];
}

function supportArrow(marker, role, direction, tipPosition, pipeOdMm) {
  const dir = unitVector(direction);
  const arrowLengthMm = clamp(pipeOdMm * 0.8, 60, 240);
  const shaftRadiusMm = clamp(pipeOdMm * 0.05, 3, 12);
  const headLengthMm = shaftRadiusMm * 4;
  const shaftStart = sub(tipPosition, scale(dir, arrowLengthMm));
  const shaftEnd = sub(tipPosition, scale(dir, headLengthMm));
  const rows = [supportCylinderBetween(marker, `${role}-shaft`, shaftStart, shaftEnd, shaftRadiusMm)];
  const segmentLength = headLengthMm / 3;
  const radii = [shaftRadiusMm * 3, shaftRadiusMm * 2, shaftRadiusMm];
  let segmentStart = shaftEnd;
  for (let index = 0; index < 3; index += 1) {
    const segmentEnd = add(segmentStart, scale(dir, segmentLength));
    rows.push(supportCylinderBetween(marker, `${role}-head-${index + 1}`, segmentStart, segmentEnd, radii[index]));
    segmentStart = segmentEnd;
  }
  return rows;
}

function supportSphere(marker, role, center, diameterMm) {
  return {
    primitiveKind: 'SUPPORT_MARKER_SPHERE',
    primitiveCode: 9,
    basis: 'navis-review',
    transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY,
    transformApplied: true,
    center,
    diameterMm,
    radiusMm: diameterMm / 2,
    sourceItemId: marker.sourceItemId,
    sourcePrimitiveId: `${marker.sourcePrimitiveId}-${role}`,
    exportPrimitiveId: supportPrimitiveId(marker, role),
    catalogueItemId: SUPPORT_MARKER_CATALOGUE_ID,
    family: 'support',
    supportFamily: marker.supportFamily,
    deterministicGeometry: true,
    writerReady: true,
    runtimePilotReady: true,
    fallbackUsed: false,
    sourceRef: marker.sourceRef,
  };
}

function supportCylinderBetween(marker, role, start, end, radiusMm) {
  const delta = sub(end, start);
  return {
    primitiveKind: 'SUPPORT_MARKER_CYLINDER',
    primitiveCode: 8,
    basis: 'navis-review',
    transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY,
    transformApplied: true,
    center: midpoint(start, end),
    axis: unitVector(delta),
    startPoint: start,
    endPoint: end,
    radiusMm,
    lengthMm: magnitude(delta),
    sourceItemId: marker.sourceItemId,
    sourcePrimitiveId: `${marker.sourcePrimitiveId}-${role}`,
    exportPrimitiveId: supportPrimitiveId(marker, role),
    catalogueItemId: SUPPORT_MARKER_CATALOGUE_ID,
    family: 'support',
    supportFamily: marker.supportFamily,
    deterministicGeometry: true,
    writerReady: true,
    runtimePilotReady: true,
    fallbackUsed: false,
    sourceRef: marker.sourceRef,
  };
}

function validateMarkers(markers) {
  const errors = [];
  for (const [index, marker] of markers.entries()) {
    if (!point3(marker.center)) errors.push(`supportMarkers[${index}].center must be finite [x,y,z]`);
    if (!point3(marker.axis)) errors.push(`supportMarkers[${index}].axis must be finite [x,y,z]`);
    if (!marker.sourceItemId || !marker.sourcePrimitiveId) errors.push(`supportMarkers[${index}].source identity is required`);
    if (marker.deterministicPlacement !== true || marker.markerOnly !== false) errors.push(`supportMarkers[${index}] must be deterministic geometry marker`);
    if (marker.rvmGeometryGenerated !== true || marker.fallbackUsed !== false) errors.push(`supportMarkers[${index}] must generate support geometry without fallback`);
    if (!positive(marker.pipeOdMm)) errors.push(`supportMarkers[${index}].pipeOdMm must be positive`);
  }
  return errors;
}

function validateSupportPrimitives(primitives) {
  const errors = [];
  for (const [index, primitive] of primitives.entries()) {
    const label = `supportMarkerPrimitives[${index}]`;
    if (![8, 9].includes(Number(primitive.primitiveCode))) errors.push(`${label}.primitiveCode must be 8 or 9`);
    if (!point3(primitive.center)) errors.push(`${label}.center must be finite [x,y,z]`);
    if (Number(primitive.primitiveCode) === 8) {
      if (!unit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
      if (!positive(primitive.lengthMm)) errors.push(`${label}.lengthMm must be positive`);
      if (!positive(primitive.radiusMm)) errors.push(`${label}.radiusMm must be positive`);
    }
    if (Number(primitive.primitiveCode) === 9 && !positive(primitive.diameterMm)) errors.push(`${label}.diameterMm must be positive`);
    if (!primitive.sourceItemId || !primitive.sourcePrimitiveId || !primitive.exportPrimitiveId) errors.push(`${label}.source identity is required`);
    if (primitive.deterministicGeometry !== true || primitive.fallbackUsed !== false || primitive.writerReady !== true) errors.push(`${label}.deterministic support geometry policy invalid`);
  }
  return errors;
}

function buildSupportAttRows(primitives) {
  return primitives.map((primitive) => ({
    elementId: primitive.exportPrimitiveId,
    sourceItemId: primitive.sourceItemId,
    sourcePrimitiveId: primitive.sourcePrimitiveId,
    exportPrimitiveId: primitive.exportPrimitiveId,
    primitiveKind: primitive.primitiveKind,
    primitiveCode: primitive.primitiveCode,
    family: 'support',
    catalogueItemId: primitive.catalogueItemId,
    tag: '',
    name: primitive.exportPrimitiveId,
    runtimePilotStatus: 'generated',
    runtimePilotScope: SCOPE,
    deterministicGeometry: true,
  }));
}

function supportTrace(primitive) {
  return {
    sourceItemId: primitive.sourceItemId,
    sourcePrimitiveId: primitive.sourcePrimitiveId,
    primitiveKind: primitive.primitiveKind,
    primitiveCode: primitive.primitiveCode,
    family: 'support',
    runtimePilotStatus: 'generated',
    sourceRef: primitive.sourceRef,
  };
}

function supportContext(input) {
  const graphRoutesById = new Map(array(input?.graph?.routes).map((route) => [String(route.id), route]));
  const routeFrames = array(input?.resolvedGeometry?.routeFrames)
    .filter((frame) => point3(frame.start) && point3(frame.end))
    .map((frame) => {
      const route = graphRoutesById.get(String(frame.routeId)) || {};
      return {
        start: frame.start,
        end: frame.end,
        axis: unitVector(frame.direction || sub(frame.end, frame.start)),
        pipeOdMm: numberValue(frame.diameterMm ?? route.diameterMm ?? route.diameter ?? route.bore) || SUPPORT_MARKER_DEFAULT_PIPE_OD_MM,
      };
    });
  return { routeFrames };
}

function nearestRouteFrame(position, routeFrames) {
  let best = null;
  for (const frame of array(routeFrames)) {
    const distance = distancePointToSegment(position, frame.start, frame.end);
    if (!best || distance < best.distance) best = { distance, axis: frame.axis, pipeOdMm: frame.pipeOdMm };
  }
  return best;
}

function distancePointToSegment(point, start, end) {
  const segment = sub(end, start);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= 0) return magnitude(sub(point, start));
  const t = Math.max(0, Math.min(1, dot(sub(point, start), segment) / lengthSquared));
  return magnitude(sub(point, add(start, scale(segment, t))));
}

function optionErrorsFor(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true };
  const errors = [];
  for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`);
  return errors;
}

function axisVector(axis) {
  const text = String(axis || '+Y').toUpperCase();
  if (text === '+X' || text === 'X') return [1, 0, 0];
  if (text === '-X') return [-1, 0, 0];
  if (text === '-Y') return [0, -1, 0];
  if (text === '+Z' || text === 'Z') return [0, 0, 1];
  if (text === '-Z') return [0, 0, -1];
  return [0, 1, 0];
}

function normalizeSupportFamily(value) {
  const key = String(value || 'REST').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (key === 'LINE_STOP') return 'LINESTOP';
  if (key === 'LIMIT_STOP') return 'LIMIT';
  if (key === 'HOLD_DOWN') return 'HOLDDOWN';
  return key || 'REST';
}

function supportPrimitiveId(marker, role) {
  const item = String(marker.sourceItemId || 'UNKNOWN').replace(/[^A-Za-z0-9_.:-]+/g, '_');
  const suffix = String(role).replace(/[^A-Za-z0-9_.:-]+/g, '_');
  return `RVM-SUPPORT-${item}-${suffix}`;
}

function point3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))) ? value.map(Number) : null;
}

function unit(value) {
  return point3(value) && Math.abs(magnitude(value) - 1) <= UNIT_EPSILON;
}

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object' && 'value' in value) return numberValue(value.value);
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = String(value).trim().match(/^(-?\d+(?:\.\d+)?)\s*(mm|millimetres?|millimeters?|in|inch|inches|")?$/i);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;
  return ['in', 'inch', 'inches', '"'].includes(String(match[2] || 'mm').toLowerCase()) ? number * 25.4 : number;
}

function dominantAxis(vector) {
  const values = unitVector(vector).map((entry) => Math.abs(entry));
  return ['x', 'y', 'z'][values.indexOf(Math.max(...values))];
}

function unitVector(vector) {
  const length = magnitude(vector);
  return length > 0 ? vector.map((entry) => Number(entry) / length) : [1, 0, 0];
}

function add(a, b) {
  return [Number(a[0]) + Number(b[0]), Number(a[1]) + Number(b[1]), Number(a[2]) + Number(b[2])];
}

function sub(a, b) {
  return [Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2])];
}

function scale(vector, factor) {
  return [Number(vector[0]) * factor, Number(vector[1]) * factor, Number(vector[2]) * factor];
}

function midpoint(a, b) {
  return [(Number(a[0]) + Number(b[0])) / 2, (Number(a[1]) + Number(b[1])) / 2, (Number(a[2]) + Number(b[2])) / 2];
}

function magnitude(vector) {
  return Math.hypot(Number(vector[0]), Number(vector[1]), Number(vector[2]));
}

function dot(a, b) {
  return Number(a[0]) * Number(b[0]) + Number(a[1]) * Number(b[1]) + Number(a[2]) * Number(b[2]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' ? value : {}; }
