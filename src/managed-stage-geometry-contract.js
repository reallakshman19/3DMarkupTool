import { distance, point3 } from './managed-stage-topology-audit.js?v=bust-cache-4';

const EPS_MM = 0.001;
const SUPPORTED_DTXR = new Set(['PIPE', 'UNSPECIFIED', 'BEND', 'FLANGE', 'FLANGE_PAIR', 'REDUCER', 'VALVE', 'FLANGED_VALVE']);
const DTXR_ALIASES = new Map([
  ['FLAN', 'FLANGE'], ['FLG', 'FLANGE'], ['FLNG', 'FLANGE'], ['WN', 'FLANGE'], ['WNF', 'FLANGE'],
  ['WELDNECK', 'FLANGE'], ['WELD_NECK', 'FLANGE'], ['WELDNECK_FLANGE', 'FLANGE'], ['WELD_NECK_FLANGE', 'FLANGE'],
  ['RED', 'REDUCER'], ['REDUC', 'REDUCER'], ['REDUCER', 'REDUCER'], ['CONCENTRIC_REDUCER', 'REDUCER'],
  ['ECCENTRIC_REDUCER', 'REDUCER'], ['CONC_REDUCER', 'REDUCER'], ['ECC_REDUCER', 'REDUCER'],
  ['VALV', 'VALVE'], ['BV', 'VALVE'], ['BALL', 'VALVE'], ['BALLVALVE', 'VALVE'], ['BALL_VALVE', 'VALVE'],
  ['FLANGEDVALVE', 'FLANGED_VALVE'], ['FLANGED_VALVE', 'FLANGED_VALVE'], ['FLANGEDBALLVALVE', 'FLANGED_VALVE'], ['FLANGED_BALL_VALVE', 'FLANGED_VALVE']
]);
const DIAMETER_FIELDS = ['DIAMETER_MM', 'OUTSIDE_DIAMETER_MM', 'OUTSIDE_DIAMETER', 'OD_MM', 'OD', 'PIPE_OD_MM', 'PIPE_OUTSIDE_DIAMETER_MM', 'BORE_MM', 'DIAMETER', 'BORE', 'ABORE', 'ABORE_MM', 'LBORE', 'LBORE_MM', 'START_DIAMETER', 'START_DIAMETER_MM', 'START_OUTSIDE_DIAMETER_MM', 'END_DIAMETER', 'END_DIAMETER_MM', 'END_OUTSIDE_DIAMETER_MM'];
const START_DIAMETER_FIELDS = ['START_DIAMETER', 'START_DIAMETER_MM', 'START_OUTSIDE_DIAMETER_MM', 'ABORE', 'ABORE_MM'];
const END_DIAMETER_FIELDS = ['END_DIAMETER', 'END_DIAMETER_MM', 'END_OUTSIDE_DIAMETER_MM', 'LBORE', 'LBORE_MM'];
const BEND_RADIUS_FIELDS = ['BEND_RADIUS_MM', 'BEND_RADIUS', 'RADIUS_MM', 'ELBOW_RADIUS_MM'];
const BEND_ANGLE_FIELDS = ['BEND_ANGLE_DEG', 'BEND_ANGLE', 'ANGLE_DEG', 'ELBOW_ANGLE_DEG'];
const BEND_ELEMENT_LENGTH_FIELDS = ['BEND_ELEMENT_LENGTH_MM', 'ELEMENT_LENGTH_MM'];
const FLANGE_OUTSIDE_DIAMETER_FIELDS = ['FLANGE_OD_MM', 'FLANGE_OUTSIDE_DIAMETER_MM', 'FLANGE_DIAMETER_MM'];
const FLANGE_FACE_DIAMETER_FIELDS = ['FLANGE_FACE_OD_MM', 'FACE_OD_MM', 'RAISED_FACE_OD_MM', 'RF_OD_MM'];
const FLANGE_HUB_DIAMETER_FIELDS = ['HUB_OD_MM', 'HUB_DIAMETER_MM', 'NECK_OD_MM', 'WELDNECK_HUB_OD_MM', 'WELD_NECK_HUB_OD_MM'];
const VALVE_BODY_DIAMETER_FIELDS = ['VALVE_BODY_OD_MM', 'VALVE_BODY_DIAMETER_MM', 'BODY_OD_MM', 'BODY_DIAMETER_MM', 'VALVE_BALL_OD_MM', 'BALL_OD_MM'];
const VALVE_SEAT_DIAMETER_FIELDS = ['VALVE_SEAT_OD_MM', 'SEAT_OD_MM'];
const VALVE_END_FLANGE_DIAMETER_FIELDS = ['VALVE_END_FLANGE_OD_MM', 'VALVE_FLANGE_OD_MM', 'END_FLANGE_OD_MM'];
const REDUCER_OFFSET_X_FIELDS = ['REDUCER_OFFSET_X', 'ECC_OFFSET_X', 'OFFSET_X', 'XOFFSET'];
const REDUCER_OFFSET_Y_FIELDS = ['REDUCER_OFFSET_Y', 'ECC_OFFSET_Y', 'OFFSET_Y', 'YOFFSET'];

export function buildManagedStageGeometryContractSet(profileOrRecords, options = {}) {
  const geometryRecords = Array.isArray(profileOrRecords) ? profileOrRecords : profileOrRecords.geometryRecords || [];
  const supportRecords = Array.isArray(profileOrRecords) ? [] : profileOrRecords.supportRecords || [];
  const contracts = [];
  const warnings = [];
  const skippedContracts = [];
  for (const [index, record] of geometryRecords.entries()) {
    try {
      const contract = createManagedStageGeometryContract(record, index, options);
      contracts.push(contract);
      warnings.push(...(contract.nonBlockingGeometryWarnings || []));
    } catch (error) {
      if (!warningOnly(options)) throw error;
      const name = record?.attributes?.NAME || record?.name || `ELEMENT_${index + 1}`;
      const warning = geometryWarning('contract-skipped', name, error.message);
      warnings.push(warning);
      skippedContracts.push(warning);
    }
  }
  return {
    schema: 'ManagedStageGeometryContractSet.v1',
    units: 'mm',
    contractCount: contracts.length,
    sourceGeometryRecordCount: geometryRecords.length,
    supportRecordsSkippedFromGeometry: supportRecords.length,
    contracts,
    audit: auditManagedStageGeometryContracts(contracts, {
      sourceGeometryRecordCount: geometryRecords.length,
      supportRecordsSkippedFromGeometry: supportRecords.length,
      nonBlockingWarnings: warnings,
      skippedContracts
    })
  };
}

export function createManagedStageGeometryContract(record, elementIndex = 0, options = {}) {
  const a = record.attributes || {};
  if (record.type === 'ATTA' || a.TYPE === 'ATTA') throw new Error(`Support/restraint record is not a geometry contract: ${record.name || a.NAME || 'UNNAMED'}`);
  const sourceDtxr = a.DTXR || a.RAW_TYPE || record.type || 'UNKNOWN';
  let dtxr = normalizeManagedStageGeometryDtxr(sourceDtxr);
  const warnings = [];
  if (!SUPPORTED_DTXR.has(dtxr)) {
    if (!warningOnly(options)) throw new Error(`Unsupported managed-stage geometry DTXR: ${sourceDtxr}`);
    warnings.push(geometryWarning('unsupported-dtxr-degraded', a.NAME || record.name || 'UNNAMED', `Unsupported managed-stage geometry DTXR ${sourceDtxr}; emitted as UNSPECIFIED`));
    dtxr = 'UNSPECIFIED';
  }

  const start = point3(a.APOS, `${record.name}.APOS`);
  const end = point3(a.LPOS, `${record.name}.LPOS`);
  const lengthMm = distance(start, end);
  if (!(lengthMm > 0)) throw new Error(`Zero-length managed-stage geometry contract: ${record.name || a.NAME || 'UNNAMED'}`);

  const diameter = resolveDiameterEvidence(a);
  if (!(diameter.diameterMm > 0)) throw new Error(`Missing/invalid diameter for ${record.name || a.NAME || 'UNNAMED'}`);
  const offsets = resolveReducerOffsetEvidence(a);

  const axis = normalize(vsub(end, start));
  const contract = {
    schema: 'ManagedStageGeometryContract.v1',
    elementIndex,
    elementId: a.SOURCE_ELEMENT_ID || a.REF || a.NAME || record.name || `ELEMENT_${elementIndex + 1}`,
    name: a.NAME || record.name || `ELEMENT_${elementIndex + 1}`,
    type: record.type || a.TYPE || 'UNKNOWN',
    rawType: a.RAW_TYPE || sourceDtxr,
    dtxr,
    sourceDtxr,
    dtxrNormalizedFromAlias: dtxr !== normalizeDtxrToken(sourceDtxr),
    componentClass: componentClassForDtxr(dtxr),
    fromNode: String(a.FROM_NODE || ''),
    toNode: String(a.TO_NODE || ''),
    emitGeometry: true,
    centerlineKind: dtxr === 'BEND' ? 'arc' : 'line',
    endpointLocked: true,
    startMm: start,
    endMm: end,
    centerMm: midpoint(start, end),
    axis,
    lengthMm,
    diameterMm: diameter.diameterMm,
    radiusMm: diameter.diameterMm / 2,
    startDiameterMm: diameter.startDiameterMm,
    endDiameterMm: diameter.endDiameterMm,
    startRadiusMm: diameter.startDiameterMm / 2,
    endRadiusMm: diameter.endDiameterMm / 2,
    reducerOffsetXMm: offsets.x.value ?? 0,
    reducerOffsetYMm: offsets.y.value ?? 0,
    material: a.MATERIAL || '',
    wallThickMm: parseOptionalMm(a.WALL_THICK),
    sourceFormat: a.SOURCE_FORMAT || '',
    sourceElementId: a.SOURCE_ELEMENT_ID || '',
    richGeometryEvidence: richGeometryEvidence(diameter),
    richComponentEvidence: richComponentEvidence(a, offsets),
    nonBlockingGeometryWarnings: warnings
  };

  if (contract.centerlineKind === 'arc') applyBendArcEvidence(contract, a, options, warnings);
  return contract;
}

export function auditManagedStageGeometryContracts(contracts = [], options = {}) {
  const dtxrHistogram = {};
  const classHistogram = {};
  const centerlineKindHistogram = {};
  const zeroLength = [];
  const invalidAxis = [];
  const unsupportedDtxr = [];
  const missingNodes = [];
  const degradedBends = [];
  let maxAxisLengthError = 0;
  for (const contract of contracts) {
    dtxrHistogram[contract.dtxr] = (dtxrHistogram[contract.dtxr] || 0) + 1;
    classHistogram[contract.componentClass] = (classHistogram[contract.componentClass] || 0) + 1;
    centerlineKindHistogram[contract.centerlineKind] = (centerlineKindHistogram[contract.centerlineKind] || 0) + 1;
    if (!SUPPORTED_DTXR.has(contract.dtxr)) unsupportedDtxr.push(contract.name);
    if (contract.degradedBendToSourceRouteCylinder) degradedBends.push(contract.name);
    if (!(contract.lengthMm > 0)) zeroLength.push(contract.name);
    if (!contract.fromNode || !contract.toNode) missingNodes.push(contract.name);
    const axisLen = Math.hypot(contract.axis?.[0] || 0, contract.axis?.[1] || 0, contract.axis?.[2] || 0);
    const axisError = Math.abs(axisLen - 1);
    maxAxisLengthError = Math.max(maxAxisLengthError, axisError);
    if (axisError > EPS_MM) invalidAxis.push(contract.name);
  }
  return {
    schema: 'ManagedStageGeometryContractAudit.v1',
    toleranceMm: EPS_MM,
    sourceGeometryRecordCount: options.sourceGeometryRecordCount ?? contracts.length,
    contractCount: contracts.length,
    skippedContractCount: options.skippedContracts?.length || 0,
    supportRecordsSkippedFromGeometry: options.supportRecordsSkippedFromGeometry || 0,
    dtxrHistogram,
    classHistogram,
    centerlineKindHistogram,
    zeroLength,
    invalidAxis,
    unsupportedDtxr,
    missingNodes,
    degradedBends,
    nonBlockingWarnings: options.nonBlockingWarnings || [],
    nonBlockingWarningCount: (options.nonBlockingWarnings || []).length,
    skippedContracts: options.skippedContracts || [],
    maxAxisLengthError: round(maxAxisLengthError),
    allEndpointLocked: contracts.every((contract) => contract.endpointLocked === true),
    allEmitGeometry: contracts.every((contract) => contract.emitGeometry === true)
  };
}

export function assertManagedStageGeometryContractAudit(audit, expectations = {}) {
  if (audit.schema !== 'ManagedStageGeometryContractAudit.v1') throw new Error('Invalid managed-stage geometry contract audit schema');
  if (audit.zeroLength?.length) throw new Error(`Geometry contract zero-length components: ${audit.zeroLength.join(', ')}`);
  if (audit.invalidAxis?.length) throw new Error(`Geometry contract invalid axes: ${audit.invalidAxis.join(', ')}`);
  if (audit.unsupportedDtxr?.length) throw new Error(`Geometry contract unsupported DTXR records: ${audit.unsupportedDtxr.join(', ')}`);
  if (audit.missingNodes?.length) throw new Error(`Geometry contract missing nodes: ${audit.missingNodes.join(', ')}`);
  if (audit.allEndpointLocked !== true) throw new Error('Geometry contracts must be endpoint locked');
  if (audit.allEmitGeometry !== true) throw new Error('Geometry contracts must all emit geometry');
  if (expectations.contractCount !== undefined && audit.contractCount !== expectations.contractCount) throw new Error(`Geometry contract count mismatch: expected ${expectations.contractCount}, got ${audit.contractCount}`);
  if (expectations.supportRecordsSkippedFromGeometry !== undefined && audit.supportRecordsSkippedFromGeometry !== expectations.supportRecordsSkippedFromGeometry) throw new Error(`Support skip count mismatch: expected ${expectations.supportRecordsSkippedFromGeometry}, got ${audit.supportRecordsSkippedFromGeometry}`);
  return { ok: true, contractCount: audit.contractCount, dtxrHistogram: audit.dtxrHistogram };
}

export function normalizeManagedStageGeometryDtxr(value) { return DTXR_ALIASES.get(normalizeDtxrToken(value)) || normalizeDtxrToken(value); }

export function componentClassForDtxr(dtxr) {
  const normalized = normalizeManagedStageGeometryDtxr(dtxr);
  if (normalized === 'PIPE') return 'PIPE';
  if (normalized === 'UNSPECIFIED') return 'UNKNOWN_PIPELIKE';
  if (normalized === 'BEND') return 'BEND';
  if (normalized === 'FLANGE') return 'FLANGE';
  if (normalized === 'FLANGE_PAIR') return 'FLANGE_PAIR';
  if (normalized === 'REDUCER') return 'REDUCER';
  if (normalized === 'VALVE') return 'VALVE';
  if (normalized === 'FLANGED_VALVE') return 'FLANGED_VALVE';
  return 'UNKNOWN';
}

function richGeometryEvidence(diameter) {
  return { diameterField: diameter.diameterField, startDiameterField: diameter.startDiameterField, endDiameterField: diameter.endDiameterField, bendRadiusField: '', bendAngleField: '', bendAngleDerivedFromElementLength: false };
}

function richComponentEvidence(attrs, offsets) {
  const flangeOutside = firstMm(attrs, FLANGE_OUTSIDE_DIAMETER_FIELDS);
  const flangeHub = firstMm(attrs, FLANGE_HUB_DIAMETER_FIELDS);
  const flangeFace = firstMm(attrs, FLANGE_FACE_DIAMETER_FIELDS);
  const valveBody = firstMm(attrs, VALVE_BODY_DIAMETER_FIELDS);
  const valveSeat = firstMm(attrs, VALVE_SEAT_DIAMETER_FIELDS);
  const valveEndFlange = firstMm(attrs, VALVE_END_FLANGE_DIAMETER_FIELDS);
  return {
    flangeOutsideDiameterField: flangeOutside.field,
    flangeOutsideDiameterMm: flangeOutside.value,
    flangeHubDiameterField: flangeHub.field,
    flangeHubDiameterMm: flangeHub.value,
    flangeFaceDiameterField: flangeFace.field,
    flangeFaceDiameterMm: flangeFace.value,
    valveBodyDiameterField: valveBody.field,
    valveBodyDiameterMm: valveBody.value,
    valveSeatDiameterField: valveSeat.field,
    valveSeatDiameterMm: valveSeat.value,
    valveEndFlangeDiameterField: valveEndFlange.field,
    valveEndFlangeDiameterMm: valveEndFlange.value,
    reducerOffsetXField: offsets.x.field,
    reducerOffsetYField: offsets.y.field
  };
}

function resolveDiameterEvidence(attrs) {
  const diameter = firstMm(attrs, DIAMETER_FIELDS);
  const start = firstMm(attrs, START_DIAMETER_FIELDS);
  const end = firstMm(attrs, END_DIAMETER_FIELDS);
  const fallback = diameter.value ?? start.value ?? end.value;
  return {
    diameterMm: fallback,
    startDiameterMm: start.value ?? fallback,
    endDiameterMm: end.value ?? fallback,
    diameterField: diameter.field || start.field || end.field || '',
    startDiameterField: start.field || diameter.field || end.field || '',
    endDiameterField: end.field || diameter.field || start.field || ''
  };
}

function resolveReducerOffsetEvidence(attrs) {
  return { x: firstNumber(attrs, REDUCER_OFFSET_X_FIELDS), y: firstNumber(attrs, REDUCER_OFFSET_Y_FIELDS) };
}

function applyBendArcEvidence(contract, attrs, options, warnings) {
  const radius = firstMm(attrs, BEND_RADIUS_FIELDS);
  const directAngle = firstNumber(attrs, BEND_ANGLE_FIELDS);
  const elementLength = firstMm(attrs, BEND_ELEMENT_LENGTH_FIELDS);
  const derivedAngle = deriveBendAngleDeg(elementLength.value, radius.value, elementLength.field);
  const bendAngleDeg = directAngle.value ?? derivedAngle.value;
  contract.richGeometryEvidence.bendRadiusField = radius.field;
  contract.richGeometryEvidence.bendAngleField = directAngle.field || derivedAngle.field;
  contract.richGeometryEvidence.bendAngleDerivedFromElementLength = derivedAngle.derived;
  const bendIssues = [];
  if (!(radius.value > 0)) bendIssues.push(`Missing/invalid bend radius for ${contract.name}`);
  if (!(bendAngleDeg > 0)) bendIssues.push(`Missing/invalid bend angle for ${contract.name}`);
  if (bendIssues.length) return degradeBend(contract, bendIssues, options, warnings);
  contract.arc = { bendRadiusMm: radius.value, tubeRadiusMm: contract.radiusMm, bendAngleDeg, sweepAngleRad: (bendAngleDeg * Math.PI) / 180, solverState: 'endpoint-contract-only' };
}

function deriveBendAngleDeg(elementLengthMm, bendRadiusMm, field) {
  if (!(elementLengthMm > 0) || !(bendRadiusMm > 0)) return { value: null, field: '', derived: false };
  return { value: (elementLengthMm / bendRadiusMm) * 180 / Math.PI, field: field || 'BEND_ELEMENT_LENGTH_MM', derived: true };
}

function degradeBend(contract, bendIssues, options, warnings) {
  if (!warningOnly(options)) throw new Error(bendIssues[0]);
  for (const issue of bendIssues) warnings.push(geometryWarning('bend-arc-degraded-to-source-route', contract.name, issue));
  contract.centerlineKind = 'line';
  contract.excludeCode4Bend = true;
  contract.degradedBendToSourceRouteCylinder = true;
  contract.bendArcDegradationReason = bendIssues.join('; ');
}

function firstMm(attrs, keys) {
  for (const field of keys) {
    const value = parseOptionalMm(attrs[field]);
    if (value != null) return { field, value };
  }
  return { field: '', value: null };
}

function firstNumber(attrs, keys) {
  for (const field of keys) {
    const value = parseOptionalNumber(attrs[field]);
    if (value != null) return { field, value };
  }
  return { field: '', value: null };
}

function normalizeDtxrToken(value) { return String(value || 'UNKNOWN').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'UNKNOWN'; }
function warningOnly(options = {}) { return options.nonBlockingGeometryGates === true || options.warningOnlyManagedStageGates === true; }
function geometryWarning(code, elementName, message) { return { code, severity: 'warning', elementName, message }; }
function parseOptionalMm(value) { if (value === undefined || value === null || value === '') return null; const match = String(value).match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : null; }
function parseOptionalNumber(value) { if (value === undefined || value === null || value === '') return null; const number = Number(String(value).replace(/[^0-9.+-]/g, '')); return Number.isFinite(number) ? number : null; }
function normalize(vector) { const length = Math.hypot(vector[0], vector[1], vector[2]); if (!(length > 0)) throw new Error('Cannot normalize zero-length vector'); return vector.map((entry) => entry / length); }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function round(value) { return Math.round(Number(value || 0) * 1000) / 1000; }
