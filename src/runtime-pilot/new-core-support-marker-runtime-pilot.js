import { FINAL_REVIEW_TRANSFORM_POLICY, transformAuthoringPointToReview, transformAuthoringVectorToReview } from '../export-models/review-transform-policy.js';
import { buildNewCoreValveRuntimePilotPlan, validateNewCoreValveRuntimePilotPlan } from './new-core-valve-runtime-pilot.js';

const PLAN_SCHEMA = 'NewCoreSupportMarkerRuntimePilotPlan.v1';
const SCOPE = 'pipe-bend-flange-valve-support-marker-subset';
const VALVE_SCOPE = 'pipe-bend-flange-valve-subset';

export function buildNewCoreSupportMarkerRuntimePilotPlan(input, options) {
  const bag = object(options);
  const valveOptions = { ...bag, scope: VALVE_SCOPE };
  const valvePlan = buildNewCoreValveRuntimePilotPlan(input, valveOptions);
  const optionErrors = optionErrorsFor(bag);
  const markers = collectSupportMarkers(input);
  const errors = [...optionErrors, ...validateMarkers(markers.generated), ...array(valvePlan.errors)];
  const subsetReady = errors.length === 0 && valvePlan.subsetReady === true;
  return { schema: PLAN_SCHEMA, mode: 'explicit-runtime-pilot', scope: SCOPE, enabled: bag.enabled === true, baseRuntimePilotScope: VALVE_SCOPE, fullModelReady: false, subsetReady, supportMarkersOptional: true, supportMarkerCount: markers.generated.length, blockedSupportMarkerCount: markers.blocked.length, supportGeometryGenerated: false, supportFallbackCount: 0, supportMarkers: markers.generated, blockedSupportMarkers: markers.blocked, basePlan: valvePlan, plannedRvmPrimitiveCount: valvePlan.plannedRvmPrimitiveCount, plannedAttRowCount: valvePlan.plannedAttRowCount, warnings: markers.blocked.map((entry) => `${entry.sourceItemId || '<unknown-support>'} blocked: ${entry.reason}`), errors };
}

export function validateNewCoreSupportMarkerRuntimePilotPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== PLAN_SCHEMA) errors.push(`schema must be ${PLAN_SCHEMA}`);
  if (plan?.scope !== SCOPE) errors.push(`scope must be ${SCOPE}`);
  if (plan?.baseRuntimePilotScope !== VALVE_SCOPE) errors.push(`baseRuntimePilotScope must be ${VALVE_SCOPE}`);
  if (plan?.supportGeometryGenerated !== false) errors.push('supportGeometryGenerated must remain false');
  if (Number(plan?.supportFallbackCount || 0) !== 0) errors.push('supportFallbackCount must be 0');
  if (!Array.isArray(plan?.supportMarkers)) errors.push('supportMarkers must be array');
  if (!Array.isArray(plan?.blockedSupportMarkers)) errors.push('blockedSupportMarkers must be array');
  if (Number(plan?.supportMarkerCount || 0) !== array(plan?.supportMarkers).length) errors.push('supportMarkerCount mismatch');
  if (Number(plan?.blockedSupportMarkerCount || 0) !== array(plan?.blockedSupportMarkers).length) errors.push('blockedSupportMarkerCount mismatch');
  if (!validateNewCoreValveRuntimePilotPlan(plan?.basePlan).ok) errors.push('base Phase 16 valve plan must validate');
  return { schema: 'NewCoreSupportMarkerRuntimePilotPlanValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

function collectSupportMarkers(input) {
  const placements = array(input?.resolvedGeometry?.supportPlacements);
  const graphSupports = array(input?.graph?.items).filter((item) => item.kind === 'support');
  const rows = placements.length ? placements : graphSupports.map(graphSupport);
  const generated = [];
  const blocked = [];
  for (const row of rows) {
    const marker = markerFromPlacement(row);
    if (marker) generated.push(marker);
    else blocked.push({ sourceItemId: row.itemId || row.id || '', family: 'support', reason: 'missing deterministic support placement', sourceRef: row.sourceRef });
  }
  return { generated, blocked };
}

function markerFromPlacement(row) {
  const position = point3(row.position || row.placement?.position);
  if (!position || !(row.itemId || row.id)) return null;
  const axis = axisVector(row.axis);
  return { markerKind: 'SUPPORT_PLACEMENT_MARKER', family: 'support', sourceItemId: row.itemId || row.id, sourcePrimitiveId: `SUPPORT-MARKER-${row.itemId || row.id}`, center: transformAuthoringPointToReview(position, { fieldName: 'supportMarker.center' }), axis: transformAuthoringVectorToReview(axis, { fieldName: 'supportMarker.axis' }), basis: 'navis-review', transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY, transformApplied: true, supportFamily: row.supportFamily || row.type || '', deterministicPlacement: true, markerOnly: true, rvmGeometryGenerated: false, writerReady: false, runtimePilotReady: true, fallbackUsed: false, sourceRef: row.sourceRef };
}

function graphSupport(item) {
  return { itemId: item.id, position: item.placement?.position, axis: item.axis, supportFamily: item.supportFamily, sourceRef: item.sourceRef };
}

function validateMarkers(markers) {
  const errors = [];
  for (const [index, marker] of markers.entries()) {
    if (!point3(marker.center)) errors.push(`supportMarkers[${index}].center must be finite [x,y,z]`);
    if (!point3(marker.axis)) errors.push(`supportMarkers[${index}].axis must be finite [x,y,z]`);
    if (!marker.sourceItemId || !marker.sourcePrimitiveId) errors.push(`supportMarkers[${index}].source identity is required`);
    if (marker.deterministicPlacement !== true || marker.markerOnly !== true) errors.push(`supportMarkers[${index}] must be placement-only deterministic marker`);
    if (marker.rvmGeometryGenerated !== false || marker.fallbackUsed !== false) errors.push(`supportMarkers[${index}] must not generate support geometry or fallback`);
  }
  return errors;
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

function point3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))) ? value.map(Number) : null;
}

function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' ? value : {}; }
