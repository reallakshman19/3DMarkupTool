export const MANAGED_STAGE_RICH_ARTIFACT_PACKAGE_SCHEMA = 'ManagedStageRichArtifactPackage.v1';
export const MANAGED_STAGE_RICH_ARTIFACT_FILE_SCHEMA = 'ManagedStageRichArtifactFile.v1';
export const MANAGED_STAGE_RICH_ARTIFACT_VALIDATION_SCHEMA = 'ManagedStageRichArtifactPackageValidation.v1';

export function buildManagedStageRichArtifactPackage(parts, options = {}) {
  const files = buildManagedStageArtifactFiles(parts, options);
  const evidenceChain = buildEvidenceChain(parts);
  const evidenceState = buildEvidenceState(parts);
  const counts = buildCounts(files, evidenceChain);
  const integrity = buildIntegrity(files);
  const draft = {
    schema: MANAGED_STAGE_RICH_ARTIFACT_PACKAGE_SCHEMA,
    ok: false,
    packageName: packageNameFor(parts, options),
    sourceName: stringValue(parts?.sourceName),
    basename: basenameFor(parts),
    generatedAt: stringValue(options.generatedAt),
    files,
    counts,
    evidenceChain,
    readiness: readinessFor(files, evidenceChain, evidenceState, [], []),
    integrity,
    errors: [],
    warnings: []
  };
  const validation = validateManagedStageRichArtifactPackage(draft);
  return { ...draft, ok: validation.ok, readiness: readinessFor(files, evidenceChain, evidenceState, validation.errors, validation.warnings), errors: validation.errors, warnings: validation.warnings };
}

export function buildManagedStageArtifactFiles(parts, options = {}) {
  const basename = basenameFor(parts);
  const auditText = stableAuditJson(parts?.audit || {});
  return [
    fileDescriptor('rvm', `${basename}.rvm`, 'application/octet-stream', parts?.rvm),
    fileDescriptor('att', `${basename}.att`, 'text/plain', parts?.att),
    fileDescriptor('audit', `${basename}.audit.json`, 'application/json', auditText)
  ];
}

export function validateManagedStageRichArtifactPackage(packageAudit) {
  const errors = [];
  const warnings = [];
  const files = packageAudit?.files || [];
  const byRole = Object.fromEntries(files.map((file) => [file.role, file]));
  if (files.length !== 3) errors.push('package file count is not 3');
  addArtifactErrors(byRole, errors);
  if (!evidenceComplete(packageAudit?.evidenceChain)) errors.push('required rich evidence block missing');
  if (packageAudit?.readiness?.previewExportParityOk === false) warnings.push('preview/export parity failed');
  if (packageAudit?.readiness?.supportMappingWarningCount > 0) warnings.push('support mapping warnings present');
  if (files.length === 3 && files.every((file) => file.present)) warnings.push('artifact hash is non-cryptographic');
  return { schema: MANAGED_STAGE_RICH_ARTIFACT_VALIDATION_SCHEMA, ok: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
}

export function assertManagedStageRichArtifactPackage(parts, options = {}) {
  const packageAudit = buildManagedStageRichArtifactPackage(parts, options);
  if (!packageAudit.ok) throw new Error(`managed-stage rich artifact package rejected: ${packageAudit.errors.join(' | ')}`);
  return packageAudit;
}

export function hashArtifactContent(content) {
  let hash = 0x811c9dc5;
  for (const byte of bytesFor(content)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(-8);
}

export function byteLengthOfArtifact(content) {
  if (content == null) return 0;
  if (typeof content === 'string') return utf8Bytes(content).length;
  if (content instanceof Uint8Array) return content.byteLength;
  if (content instanceof ArrayBuffer) return content.byteLength;
  if (typeof content?.byteLength === 'number') return content.byteLength;
  if (typeof content?.size === 'number') return content.size;
  return 0;
}

function fileDescriptor(role, filename, mime, content) {
  const byteLength = byteLengthOfArtifact(content);
  return {
    schema: MANAGED_STAGE_RICH_ARTIFACT_FILE_SCHEMA,
    role,
    filename,
    mime,
    byteLength,
    hash: hashArtifactContent(content),
    present: byteLength > 0
  };
}

function buildCounts(files, evidenceChain) {
  return {
    fileCount: files.length,
    presentFileCount: files.filter((file) => file.present).length,
    missingFileCount: files.filter((file) => !file.present).length,
    rvmBytes: bytesForRole(files, 'rvm'),
    attBytes: bytesForRole(files, 'att'),
    auditBytes: bytesForRole(files, 'audit'),
    evidenceBlockCount: Object.values(evidenceChain).filter(Boolean).length
  };
}

function buildEvidenceChain(parts) {
  return {
    intake: Boolean(parts?.sourceText && parts?.sourceName),
    inventory: Boolean(parts?.richTopologyInventory),
    geometryContract: Boolean(parts?.richTopologyGeometryContract),
    supportMapping: Boolean(parts?.richTopologySupportMapping),
    previewExportParity: Boolean(parts?.richTopologyPreviewExportParity),
    sourceContract: Boolean(parts?.sourceContract),
    exportModel: Boolean(parts?.exportModel)
  };
}

function buildEvidenceState(parts) {
  return {
    previewExportParityOk: parts?.richTopologyPreviewExportParity?.ok !== false,
    supportMappingWarningCount: Array.isArray(parts?.richTopologySupportMapping?.warnings) ? parts.richTopologySupportMapping.warnings.length : 0
  };
}

function buildIntegrity(files) {
  return { algorithm: 'fnv1a-32', rvmHash: hashForRole(files, 'rvm'), attHash: hashForRole(files, 'att'), auditHash: hashForRole(files, 'audit') };
}

function readinessFor(files, evidenceChain, evidenceState, errors, warnings) {
  const byRole = Object.fromEntries(files.map((file) => [file.role, file]));
  return {
    packageReady: errors.length === 0,
    rvmReady: Boolean(byRole.rvm?.present),
    attReady: Boolean(byRole.att?.present),
    auditReady: Boolean(byRole.audit?.present),
    evidenceComplete: evidenceComplete(evidenceChain),
    previewExportParityOk: evidenceState.previewExportParityOk,
    supportMappingWarningCount: evidenceState.supportMappingWarningCount,
    fatalIssueCount: errors.length,
    warningCount: warnings.length
  };
}

function addArtifactErrors(byRole, errors) {
  if (!byRole.rvm?.present) errors.push('RVM artifact missing');
  if (!byRole.att?.present) errors.push('ATT artifact missing');
  if (!byRole.audit?.present) errors.push('audit artifact missing');
  if (!byRole.rvm?.byteLength) errors.push('RVM byte length is zero');
  if (!byRole.att?.byteLength) errors.push('ATT byte length is zero');
  if (!byRole.audit?.byteLength) errors.push('audit byte length is zero');
}

function evidenceComplete(evidenceChain = {}) {
  return ['intake', 'inventory', 'geometryContract', 'supportMapping', 'previewExportParity', 'sourceContract', 'exportModel'].every((key) => evidenceChain[key] === true);
}

function packageNameFor(parts, options) {
  return stringValue(options.packageName) || `${basenameFor(parts)}.managed-stage-artifacts`;
}

function basenameFor(parts) {
  return stringValue(parts?.basename) || stringValue(parts?.sourceName).replace(/\.[^.]+$/, '') || 'managed-stage';
}

function bytesForRole(files, role) { return files.find((file) => file.role === role)?.byteLength || 0; }
function hashForRole(files, role) { return files.find((file) => file.role === role)?.hash || '00000000'; }
function stableAuditJson(audit) { return JSON.stringify(audit || {}, null, 2); }

function bytesFor(content) {
  if (content == null) return [];
  if (typeof content === 'string') return utf8Bytes(content);
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (typeof content?.size === 'number') return utf8Bytes(`blob:${content.size}`);
  return utf8Bytes(String(content));
}

function utf8Bytes(value) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(value));
  return Array.from(String(value), (char) => char.charCodeAt(0) & 0xff);
}

function stringValue(value) { return typeof value === 'string' ? value : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
