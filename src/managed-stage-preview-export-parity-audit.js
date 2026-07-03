export const MANAGED_STAGE_PREVIEW_EXPORT_PARITY_SCHEMA = 'ManagedStagePreviewExportParityAudit.v1';
export const MANAGED_STAGE_PREVIEW_EXPORT_PRIMITIVE_SCHEMA = 'ManagedStagePreviewExportPrimitiveParity.v1';
export const MANAGED_STAGE_PREVIEW_EXPORT_VALIDATION_SCHEMA = 'ManagedStagePreviewExportParityValidation.v1';

export function buildManagedStagePreviewExportParityAudit(exportModel, previewScene, options = {}) {
  const exportEvidence = collectExportModelPrimitiveEvidence(exportModel);
  const previewEvidence = collectPreviewScenePrimitiveEvidence(previewScene);
  const comparison = compareEvidence(exportEvidence, previewEvidence);
  const counts = buildCounts(exportEvidence, previewEvidence, comparison);
  const draft = {
    schema: MANAGED_STAGE_PREVIEW_EXPORT_PARITY_SCHEMA,
    ok: false,
    sourceName: stringValue(options.sourceName),
    sceneName: stringValue(previewScene?.name),
    counts,
    readiness: readinessFor(counts, [], []),
    exportEvidence,
    previewEvidence,
    missingPreviewPrimitiveIds: comparison.missing,
    extraPreviewPrimitiveIds: comparison.extra,
    errors: [],
    warnings: []
  };
  const validation = validateManagedStagePreviewExportParity(draft);
  return { ...draft, ok: validation.ok, readiness: readinessFor(counts, validation.errors, validation.warnings), errors: validation.errors, warnings: validation.warnings };
}

export function collectExportModelPrimitiveEvidence(exportModel) {
  const primitives = [];
  collectExportNode(exportModel?.root || exportModel, primitives);
  for (const primitive of exportModel?.primitives || []) addExportPrimitive(primitives, primitive, null);
  return primitives;
}

export function collectPreviewScenePrimitiveEvidence(previewScene) {
  const evidence = [];
  walkPreview(previewScene, null, evidence);
  return evidence;
}

export function validateManagedStagePreviewExportParity(parityAudit) {
  const errors = [];
  const warnings = [];
  const counts = parityAudit?.counts || {};
  if (!counts.exportPrimitiveCount) errors.push('export primitive count is zero');
  if (!counts.previewPrimitiveCount) errors.push('preview primitive count is zero');
  if (counts.missingPreviewPrimitiveCount) errors.push('missing preview primitives exist');
  if (counts.extraPreviewPrimitiveCount) errors.push('extra preview primitives exist');
  if (counts.familyMismatchCount) errors.push('family/code mismatch exists');
  if (counts.exportSupportMarkerCount !== counts.previewSupportMarkerCount) errors.push('support marker count mismatch');
  if ((parityAudit?.exportEvidence || []).some((item) => !item.sourceElementId)) warnings.push('some export primitives missing sourceElementId');
  if ((parityAudit?.previewEvidence || []).some((item) => !item.sourceElementId)) warnings.push('some preview primitives missing sourceElementId');
  if (previewObjectCount(parityAudit?.previewEvidence) > counts.previewPrimitiveCount) warnings.push('preview object count exceeds primitive evidence count');
  return { schema: MANAGED_STAGE_PREVIEW_EXPORT_VALIDATION_SCHEMA, ok: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
}

export function assertManagedStagePreviewExportParity(exportModel, previewScene, options = {}) {
  const audit = buildManagedStagePreviewExportParityAudit(exportModel, previewScene, options);
  if (!audit.ok) throw new Error(`managed-stage preview/export parity rejected: ${audit.errors.join(' | ')}`);
  return audit;
}

function collectExportNode(node, out) {
  if (!node || typeof node !== 'object') return;
  for (const primitive of node.primitives || []) addExportPrimitive(out, primitive, node);
  for (const child of node.children || []) collectExportNode(child, out);
}

function addExportPrimitive(out, primitive, node) {
  const index = out.length;
  const context = nodeContext(node);
  const id = primitiveId(primitive, index);
  const sourceElementId = sourceElementIdOf(primitive) || context.sourceElementId;
  const family = familyOf(primitive) || context.family;
  const kind = kindOf(primitive);
  const code = codeOf(primitive, kind);
  out.push(record(id, sourceElementId, family, kind, code, context.supportMarker || supportMarkerLike(primitive, family, kind)));
}

function walkPreview(node, inherited, out) {
  if (!node || typeof node !== 'object') return;
  const userData = node.userData || {};
  const context = previewContext(userData, inherited);
  const isPrimitive = looksLikePreviewPrimitive(node, userData);
  if (isPrimitive && !hasPreviewPrimitiveDescendant(node)) out.push(previewRecord(node, userData, out.length, context));
  for (const child of node.children || []) walkPreview(child, context, out);
}

function hasPreviewPrimitiveDescendant(node) {
  for (const child of node?.children || []) {
    if (looksLikePreviewPrimitive(child, child?.userData || {})) return true;
    if (hasPreviewPrimitiveDescendant(child)) return true;
  }
  return false;
}

function previewRecord(node, userData, index, context) {
  const id = stringValue(userData.primitiveId || userData.sourceName || node.name) || `PREVIEW_PRIM_${index + 1}`;
  const sourceElementId = stringValue(userData.SOURCE_ELEMENT_ID || userData.sourceElementId) || context.sourceElementId;
  const family = stringValue(userData.family || userData.componentFamily) || context.family;
  const kind = kindOf(userData) || stringValue(userData.primitiveKind || node.type);
  const code = codeOf(userData, kind);
  return record(id, sourceElementId, family, kind, code, context.supportMarker || supportMarkerLike(userData, family, kind));
}

function compareEvidence(exportEvidence, previewEvidence) {
  const previewMap = keyCount(previewEvidence);
  const exportMap = keyCount(exportEvidence);
  return { missing: diffKeys(exportMap, previewMap), extra: diffKeys(previewMap, exportMap) };
}

function buildCounts(exportEvidence, previewEvidence, comparison) {
  const exportGeometry = exportEvidence.filter((item) => !item.supportMarker);
  const previewGeometry = previewEvidence.filter((item) => !item.supportMarker);
  return {
    exportPrimitiveCount: exportEvidence.length,
    previewPrimitiveCount: previewEvidence.length,
    exportSupportMarkerCount: exportEvidence.filter((item) => item.supportMarker).length,
    previewSupportMarkerCount: previewEvidence.filter((item) => item.supportMarker).length,
    exportCode4Count: exportGeometry.filter((item) => item.code === 4).length,
    exportCode8Count: exportGeometry.filter((item) => item.code === 8).length,
    previewCode4Count: previewGeometry.filter((item) => item.code === 4).length,
    previewCode8Count: previewGeometry.filter((item) => item.code === 8).length,
    missingPreviewPrimitiveCount: comparison.missing.length,
    extraPreviewPrimitiveCount: comparison.extra.length,
    familyMismatchCount: codeFamilyMismatchCount(exportEvidence, previewEvidence)
  };
}

function nodeContext(node) {
  const attrs = node?.attributes || {};
  return {
    sourceElementId: stringValue(attrs.SOURCE_ELEMENT_ID || attrs.SUPPORT_MARKER_ID || attrs.ID),
    family: stringValue(attrs.COMPONENT_CLASS || attrs.FAMILY || attrs.TYPE),
    supportMarker: supportMarkerLike(attrs, attrs.FAMILY, attrs.TYPE)
  };
}

function previewContext(userData, inherited) {
  return {
    sourceElementId: stringValue(userData.SOURCE_ELEMENT_ID || userData.sourceElementId) || inherited?.sourceElementId || '',
    family: stringValue(userData.family || userData.COMPONENT_CLASS || userData.TYPE) || inherited?.family || '',
    supportMarker: Boolean(inherited?.supportMarker || supportMarkerLike(userData, userData.family, userData.TYPE))
  };
}

function record(id, sourceElementId, family, kind, code, supportMarker) {
  return { schema: MANAGED_STAGE_PREVIEW_EXPORT_PRIMITIVE_SCHEMA, id, sourceElementId, family, kind, code, supportMarker };
}

function primitiveId(primitive, index) {
  return stringValue(primitive?.id || primitive?.primitiveId || primitive?.name) || (sourceElementIdOf(primitive) ? `${sourceElementIdOf(primitive)}:${index + 1}` : `EXPORT_PRIM_${index + 1}`);
}

function sourceElementIdOf(value) {
  return stringValue(value?.sourceElementId || value?.source?.sourceElementId || value?.userData?.SOURCE_ELEMENT_ID || value?.metadata?.sourceElementId);
}

function familyOf(value) {
  return stringValue(value?.family || value?.componentFamily || value?.metadata?.family || value?.userData?.family);
}

function kindOf(value) {
  return stringValue(value?.kind || value?.type || value?.primitiveKind || value?.userData?.primitiveKind);
}

function codeOf(value, kind = '') {
  const direct = value?.code ?? value?.rvmCode ?? value?.primitiveCode ?? value?.metadata?.code ?? value?.metadata?.rvmCode ?? value?.userData?.RVM_CODE ?? value?.userData?.PRIMITIVE_CODE;
  const parsed = Number(direct);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return codeForKind(kind);
}

function codeForKind(kind) {
  const key = String(kind || '').toLowerCase();
  if (key === 'elbow' || key === 'torus') return 4;
  if (key === 'cylinder') return 8;
  if (key === 'snout') return 7;
  if (key === 'sphere') return 9;
  if (key === 'box') return 2;
  if (key === 'pyramid') return 1;
  return 0;
}

function looksLikePreviewPrimitive(node, userData) {
  const text = `${userData.TYPE || ''} ${userData.primitiveKind || ''} ${node.name || ''}`.toUpperCase();
  if (/RVM_PRIMITIVE|PRIMITIVE/.test(text)) return true;
  return Boolean(userData.SOURCE_ELEMENT_ID || userData.sourceElementId || userData.primitiveId || userData.RVM_CODE || userData.PRIMITIVE_CODE);
}

function supportMarkerLike(value, family, kind) {
  const text = `${value?.TYPE || ''} ${value?.type || ''} ${value?.primitiveKind || ''} ${family || ''} ${kind || ''}`.toUpperCase();
  return text.includes('SUPPORT_MARKER') || text.includes('SUPPORT MARKER');
}

function evidenceKey(item) {
  const identity = item.sourceElementId || item.id;
  return `${identity}:${item.code}:${normalize(item.family || item.kind)}`;
}

function keyCount(items) {
  const map = new Map();
  for (const item of items) map.set(evidenceKey(item), (map.get(evidenceKey(item)) || 0) + 1);
  return map;
}

function diffKeys(left, right) {
  const out = [];
  for (const [key, count] of left) for (let i = 0; i < Math.max(0, count - (right.get(key) || 0)); i += 1) out.push(key);
  return out;
}

function codeFamilyMismatchCount(exportEvidence, previewEvidence) {
  return Math.max(0, diffKeys(keyCount(exportEvidence), keyCount(previewEvidence)).length);
}

function readinessFor(counts, errors, warnings) {
  return { previewRepresentsExportModel: errors.length === 0, supportPreviewRepresentsExportSupportMarkers: counts.exportSupportMarkerCount === counts.previewSupportMarkerCount, fatalIssueCount: errors.length, warningCount: warnings.length };
}

function previewObjectCount(previewEvidence) { return (previewEvidence || []).length; }
function normalize(value) { return String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_'); }
function stringValue(value) { return typeof value === 'string' ? value : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
