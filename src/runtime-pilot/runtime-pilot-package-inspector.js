import { createHash } from 'node:crypto';

const REPORT_SCHEMA = 'RuntimePilotPackageInspectionReport.v1';

export function inspectRuntimePilotPackage(input) {
  const audit = object(input?.audit);
  const attText = String(input?.attText || '');
  const rvmBytes = input?.rvmBytes instanceof Uint8Array ? input.rvmBytes : new Uint8Array(input?.rvmBytes || []);
  const errors = [];
  const attRowCount = countAttRows(attText);
  const computedChecksumSha256 = createHash('sha256').update(Buffer.from(rvmBytes)).digest('hex');
  validateCounts(audit, attRowCount, rvmBytes, errors);
  validateNoFallbacks(audit, errors);
  validateScope(audit, errors);
  return { schema: REPORT_SCHEMA, ok: errors.length === 0, packageBase: input?.base || '', scope: audit.scope || '', rvmByteLength: rvmBytes.byteLength, computedChecksumSha256, checksumLooksValid: /^[0-9a-f]{64}$/.test(computedChecksumSha256), plannedRvmPrimitiveCount: Number(audit.plannedRvmPrimitiveCount || 0), attRowCount, auditAttRowCount: Number(audit.attRowCount || 0), familyCounts: familyCounts(audit), fullModelReady: audit.fullModelReady === true, errors };
}

export function assertRuntimePilotPackageInspection(report) {
  if (!report?.ok) throw new Error(`Runtime pilot package inspection failed: ${array(report?.errors).join('; ')}`);
  return { schema: 'RuntimePilotPackageInspectionAssertion.v1', ok: true };
}

function validateCounts(audit, attRowCount, rvmBytes, errors) {
  if (rvmBytes.byteLength <= 0) errors.push('RVM byte length must be > 0');
  if (Number(audit.rvmArtifactByteLength || 0) !== rvmBytes.byteLength) errors.push('audit RVM byte length mismatch');
  if (Number(audit.attRowCount || 0) !== attRowCount) errors.push('ATT row count mismatch');
  if (Number(audit.plannedRvmPrimitiveCount || 0) !== Number(audit.decodedPrimitiveCount || 0)) errors.push('planned/decoded primitive count mismatch');
  if (Number(audit.attRowCount || 0) !== Number(audit.plannedRvmPrimitiveCount || 0)) errors.push('ATT rows must match RVM primitive count');
  if (audit.attRowsMatchRvmPrimitives !== true) errors.push('audit attRowsMatchRvmPrimitives must be true');
  if (Number(audit.sourceTraceCount || audit.attRowCount || 0) !== Number(audit.attRowCount || 0)) errors.push('source trace count must match ATT row count');
}

function validateNoFallbacks(audit, errors) {
  for (const key of ['fallbackPrimitiveCount', 'valveFallbackCount', 'supportFallbackCount', 'guessedValveDimensionCount', 'decodedBoxCount', 'decodedSphereCount', 'decodedPyramidCount']) {
    if (Number(audit[key] || 0) !== 0) errors.push(`${key} must be 0`);
  }
  if (audit.fullModelReady === true) errors.push('fullModelReady must remain false unless explicitly approved');
}

function validateScope(audit, errors) {
  const allowed = new Set(['pipe-bend-flange-valve-subset', 'pipe-bend-flange-valve-support-marker-subset']);
  if (!allowed.has(audit.scope)) errors.push(`unsupported generated package scope ${audit.scope || '<missing>'}`);
  if (audit.artifactGenerated !== true) errors.push('audit artifactGenerated must be true');
  if (audit.checksumPresent !== undefined && audit.checksumPresent !== true) errors.push('audit checksumPresent must be true');
}

function familyCounts(audit) {
  return { pipe: Number(audit.plannedCylinderCount || 0), bend: Number(audit.plannedTorusCount || 0), flange: Number(audit.plannedFlangeCylinderCount || 0), valve: Number(audit.plannedValveBodyCount || 0), supportMarker: Number(audit.supportMarkerCount || 0) };
}

function countAttRows(attText) {
  return attText.split(/\r?\n/).filter((line) => line && !line.startsWith('#') && !line.startsWith('elementId|')).length;
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
