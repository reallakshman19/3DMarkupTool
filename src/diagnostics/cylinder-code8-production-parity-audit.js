const AUDIT_SCHEMA = 'CylinderCode8ProductionParityAudit.v1';
const SOURCE_OF_TRUTH = 'PlantModelGraph.v1';
const RVM_EXPORT_MODEL_SCHEMA = 'RvmExportModel.v1';
const UNITS = 'mm';
const PROTECTED_RUNTIME_FILES = new Set([
  'src/app.js',
  'src/main.js',
  'index.html',
  'src/rvm-converter.js',
  'src/rvm-preview.js',
  'src/managed-stage-rvm-converter.js',
  'src/managed-stage-json-ui-controller.js',
  'src/safe-ui-loader.js',
  'src/app-loader.js'
]);
const PROTECTED_WRITER_FILES = new Set([
  'src/rvm-writer.js',
  'src/att-writer.js'
]);
const CYLINDER_KIND = 'CYLINDER';
const TORUS_KIND = 'TORUS';
const FLANGE_KIND = 'FLANGE_CYLINDER';
const CANDIDATE_STATUSES = new Set(['candidate', 'candidateReady', 'ready', 'productionCandidate']);
const BLOCKED_STATUSES = new Set(['blocked', 'notReady', 'unsupported']);
const DEFERRED_STATUSES = new Set(['deferred', 'notApplicable', 'pending']);

export function buildCylinderCode8ProductionParityAudit(input = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const model = input.rvmExportModel || input.exportModel || input.model || input;
  const graphId = stringOr(model?.graphId, input.graphId, options.graphId, '<unknown-graph>');
  const sourceOfTruth = stringOr(input.sourceOfTruth, model?.sourceOfTruth, options.sourceOfTruth, SOURCE_OF_TRUTH);
  const changedFiles = normalizeChangedFiles(input.changedFiles || options.changedFiles || []);
  const primitives = collectPrimitives(input, model);
  const productionRuntimeChanged = changedFiles.some((file) => PROTECTED_RUNTIME_FILES.has(file));
  const productionWriterChanged = changedFiles.some((file) => PROTECTED_WRITER_FILES.has(file));
  const runtimeSwitchImplemented = Boolean(input.runtimeSwitchImplemented || options.runtimeSwitchImplemented || model?.runtimeSwitchImplemented || model?.runtimeSwitch?.implemented || model?.featureFlagDefault === 'on');
  const rvmExportModelPromotedToSource = isRvmExportModelPromotedToSource(input, model, options, sourceOfTruth);
  const axisBasisOk = hasMeaningfulValue(input.axisBasis) || hasMeaningfulValue(options.axisBasis) || hasMeaningfulValue(model?.axisBasis) || hasMeaningfulValue(model?.metadata?.axisBasis) || hasMeaningfulValue(model?.reviewTransform?.axisBasis) || hasMeaningfulValue(model?.transformPolicy?.axisBasis);
  const transformPolicyOk = hasMeaningfulValue(input.transformPolicy) || hasMeaningfulValue(options.transformPolicy) || hasMeaningfulValue(model?.transformPolicy) || hasMeaningfulValue(model?.reviewTransform) || hasMeaningfulValue(model?.metadata?.transformPolicy);
  const units = stringOr(input.units, options.units, model?.units, model?.metadata?.units, null);
  const unitsOk = units === UNITS;

  let cylinderCount = 0;
  let nonCylinderCount = 0;
  let torusCount = 0;
  let flangeCount = 0;
  let valveCount = 0;
  let supportCount = 0;
  let blockedCount = 0;
  let deferredCount = 0;
  let unsupportedPrimitiveCount = 0;
  let fallbackSubstitutionCount = 0;
  let incompleteSourceTraceCount = 0;
  let cylinderCandidateCount = 0;
  let nonCylinderCandidateCount = 0;
  let torusCandidateCount = 0;
  let flangeCandidateCount = 0;
  let valveReadyCount = 0;
  let supportReadyCount = 0;

  for (const primitive of primitives) {
    const kind = normalizeKind(primitive);
    const code = normalizeCode(primitive);
    const status = normalizeStatus(primitive);
    const isCandidate = isCandidatePrimitive(primitive, status);
    const isCylinderCode8 = kind === CYLINDER_KIND && code === 8;
    const isTorusCode4 = kind === TORUS_KIND && code === 4;
    const isFlangeCode8 = kind === FLANGE_KIND && code === 8;
    const isValve = isValvePrimitive(primitive);
    const isSupport = isSupportPrimitive(primitive);

    if (isCylinderCode8) cylinderCount += 1;
    else nonCylinderCount += 1;
    if (isTorusCode4) torusCount += 1;
    if (isFlangeCode8) flangeCount += 1;
    if (isValve) valveCount += 1;
    if (isSupport) supportCount += 1;
    if (BLOCKED_STATUSES.has(status)) blockedCount += 1;
    if (DEFERRED_STATUSES.has(status)) deferredCount += 1;
    if (isFallbackSubstitution(primitive, kind)) fallbackSubstitutionCount += 1;
    if (isCylinderCode8 && isCandidate) cylinderCandidateCount += 1;
    if (!isCylinderCode8 && isCandidate) nonCylinderCandidateCount += 1;
    if (isTorusCode4 && isCandidate) torusCandidateCount += 1;
    if (isFlangeCode8 && isCandidate) flangeCandidateCount += 1;
    if (isValve && isCandidate) valveReadyCount += 1;
    if (isSupport && isCandidate) supportReadyCount += 1;
    if (isCandidate && !isCylinderCode8) unsupportedPrimitiveCount += 1;
    if (isCylinderCode8 && isCandidate && !hasCompleteSourceTrace(primitive, graphId)) incompleteSourceTraceCount += 1;
  }

  if (productionRuntimeChanged) errors.push('production runtime files changed; CYLINDER/code8 parity proof must fail closed');
  if (productionWriterChanged) errors.push('production writer files changed; CYLINDER/code8 parity proof must fail closed');
  if (runtimeSwitchImplemented) errors.push('runtime switch implementation detected; proof package must not implement the switch');
  if (rvmExportModelPromotedToSource) errors.push('RvmExportModel.v1 must remain downstream evidence and cannot be promoted to source-of-truth');
  if (sourceOfTruth !== SOURCE_OF_TRUTH) errors.push(`sourceOfTruth must be ${SOURCE_OF_TRUTH}`);
  if (!axisBasisOk) errors.push('axis basis is missing');
  if (!transformPolicyOk) errors.push('transform policy is missing');
  if (!unitsOk) errors.push('units must be mm');
  if (cylinderCandidateCount === 0) errors.push('at least one straight-pipe CYLINDER/code8 candidate is required for candidateReady evidence');
  if (nonCylinderCandidateCount > 0) errors.push('non-CYLINDER/code8 primitive was treated as candidate-ready');
  if (torusCandidateCount > 0) errors.push('TORUS/code4 is included in the candidate subset');
  if (flangeCandidateCount > 0) errors.push('FLANGE_CYLINDER/code8 is included in the candidate subset');
  if (valveReadyCount > 0) errors.push('valves are silently treated as ready');
  if (supportReadyCount > 0) errors.push('supports are silently treated as ready');
  if (fallbackSubstitutionCount > 0) errors.push('fallback primitive substitution detected');
  if (incompleteSourceTraceCount > 0) errors.push('source trace is incomplete for one or more CYLINDER/code8 candidates');
  if (primitives.length === 0) warnings.push('no primitives were provided to the CYLINDER/code8 parity audit');
  if (nonCylinderCount > 0 && nonCylinderCandidateCount === 0) warnings.push('non-CYLINDER primitives are present but isolated from the candidate subset');

  const hardErrorCount = errors.length;
  const warningCount = warnings.length;
  const ok = hardErrorCount === 0;
  const candidateReady = ok && cylinderCandidateCount === cylinderCount && cylinderCount > 0;

  return {
    schema: AUDIT_SCHEMA,
    graphId,
    scope: 'straight-pipe CYLINDER/code8 only',
    sourceOfTruth,
    candidateReady,
    productionRuntimeChanged,
    productionWriterChanged,
    runtimeSwitchImplemented,
    rvmExportModelPromotedToSource,
    cylinderCount,
    nonCylinderCount,
    torusCount,
    flangeCount,
    valveCount,
    supportCount,
    blockedCount,
    deferredCount,
    unsupportedPrimitiveCount,
    axisBasisOk,
    transformPolicyOk,
    unitsOk,
    sourceTraceOk: incompleteSourceTraceCount === 0,
    fallbackSubstitutionCount,
    hardErrorCount,
    warningCount,
    errors,
    warnings,
    ok
  };
}

export function assertCylinderCode8ProductionParityAudit(audit) {
  if (!audit || typeof audit !== 'object') throw new Error('CylinderCode8ProductionParityAudit must be an object');
  if (audit.schema !== AUDIT_SCHEMA) throw new Error(`schema must be ${AUDIT_SCHEMA}`);
  if (audit.ok !== true) throw new Error(`CylinderCode8ProductionParityAudit failed: ${(audit.errors || []).join('; ')}`);
  return { schema: 'CylinderCode8ProductionParityAuditAssertion.v1', ok: true };
}

function collectPrimitives(input, model) {
  const candidates = [
    input.primitives,
    input.resolvedPrimitiveModel?.primitives,
    input.primitiveModel?.primitives,
    model?.primitives,
    model?.items,
    model?.elements,
    model?.entries,
    model?.rvmPrimitives
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}
function normalizeChangedFiles(files) {
  return Array.isArray(files) ? files.map((file) => String(file).replace(/^\.\//, '')) : [];
}
function normalizeKind(primitive) {
  return String(primitive?.primitiveKind || primitive?.kind || primitive?.type || primitive?.shape || '').toUpperCase();
}
function normalizeCode(primitive) {
  const value = primitive?.primitiveCode ?? primitive?.code ?? primitive?.rvmCode ?? primitive?.reviewCode;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
function normalizeStatus(primitive) {
  return String(primitive?.candidateStatus || primitive?.rvmElementUnitStatus || primitive?.readinessStatus || primitive?.status || '').trim();
}
function isCandidatePrimitive(primitive, status) {
  return primitive?.candidateReady === true || primitive?.productionCandidate === true || CANDIDATE_STATUSES.has(status);
}
function isValvePrimitive(primitive) {
  const family = String(primitive?.family || primitive?.normalizedFamily || primitive?.sourceElementType || primitive?.type || '').toUpperCase();
  return family === 'VALV' || family === 'VALVE';
}
function isSupportPrimitive(primitive) {
  const family = String(primitive?.family || primitive?.normalizedFamily || primitive?.sourceElementType || primitive?.type || '').toUpperCase();
  return family === 'ATTA' || family === 'SUPPORT' || family === 'RESTRAINT';
}
function isFallbackSubstitution(primitive, kind) {
  return primitive?.fallback === true || primitive?.fallbackKind || primitive?.substitutionReason || ['BOX', 'SPHERE', 'PYRAMID'].includes(kind);
}
function hasCompleteSourceTrace(primitive, graphId) {
  const sourceId = primitive?.sourceItemId || primitive?.sourceRef || primitive?.sourceElementId;
  const trace = primitive?.sourceTrace || primitive?.trace || primitive?.evidence;
  if (!sourceId || !trace || typeof trace !== 'object' || Array.isArray(trace)) return false;
  const traceSourceOfTruth = trace.sourceOfTruth || trace.sourceModel;
  const traceGraphId = trace.graphId || trace.plantGraphId;
  return traceSourceOfTruth === SOURCE_OF_TRUTH && Boolean(traceGraphId || graphId);
}
function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
function isRvmExportModelPromotedToSource(input, model, options, sourceOfTruth) {
  if (input.rvmExportModelPromotedToSource || options.rvmExportModelPromotedToSource || model?.rvmExportModelPromotedToSource) return true;
  if (sourceOfTruth === RVM_EXPORT_MODEL_SCHEMA) return true;
  if (model?.schema === RVM_EXPORT_MODEL_SCHEMA && (model?.isSourceOfTruth === true || model?.sourceAuthority === 'source-of-truth')) return true;
  const description = String(input.description || options.description || model?.description || '');
  return /RvmExportModel\.v1\s+(is|as|becomes).*source[- ]of[- ]truth/i.test(description);
}
function stringOr(...values) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value;
  return values[values.length - 1];
}
