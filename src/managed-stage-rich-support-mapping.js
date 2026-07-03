import { assertRichTopologyManagedStageJson } from './managed-stage-rich-topology-intake.js';
import { assertRichTopologySourceInventory } from './managed-stage-rich-topology-inventory.js';
import { assertRichTopologyGeometryContract } from './managed-stage-rich-topology-contract.js';
import {
  parseStagedJsonSourceContract,
  assertStagedJsonSourceContract
} from './stagedjson-source-contract.js';

export const RICH_TOPOLOGY_SUPPORT_MAPPING_SCHEMA = 'ManagedStageRichTopologySupportMapping.v1';
export const RICH_TOPOLOGY_SUPPORT_RECORD_SCHEMA = 'ManagedStageRichTopologySupportRecord.v1';
export const RICH_TOPOLOGY_SUPPORT_MAPPING_VALIDATION_SCHEMA = 'ManagedStageRichTopologySupportMappingValidation.v1';

export function buildRichTopologySupportMapping(sourceTextOrObject, sourceName = 'managed-stage.json') {
  const sourceRoot = parseRoot(sourceTextOrObject);
  const sourceContract = parseStagedJsonSourceContract(sourceTextOrObject, { sourceFile: sourceName });
  assertStagedJsonSourceContract(sourceContract);
  const supports = buildRichTopologySupportRecords(sourceContract);
  const counts = countSupports(supports);
  const draft = buildMappingShell(sourceContract, sourceRoot, sourceName, supports, counts);
  const validation = validateRichTopologySupportMapping(draft);
  return { ...draft, ok: validation.ok, readiness: readinessFor(counts, validation), errors: validation.errors, warnings: validation.warnings };
}

export function buildRichTopologySupportRecords(sourceContract) {
  return (sourceContract?.supports || []).map((support) => toRichSupportRecord(support));
}

export function validateRichTopologySupportMapping(mapping) {
  const errors = [];
  const warnings = [];
  if (mapping?.counts?.fatalSupportRecords) errors.push('blocked support mappings exist');
  if (mapping?.counts?.sourceSupportRecords !== mapping?.counts?.mappedSupportRecords) errors.push('source support count mismatch mapped support count');
  addFieldErrors(mapping?.supports || [], errors);
  if (mapping?.counts?.unknownFamilyCount) warnings.push('unknown support families present');
  if ((mapping?.supports || []).some((support) => support.popupRequired)) warnings.push('popup-required support mappings present');
  if ((mapping?.supports || []).some((support) => !support.position.matchedPipeRef)) warnings.push('missing matched pipe reference');
  if (mapping?.counts?.sourceSupportRecords) warnings.push('support catalogue deferred', 'structural support model deferred');
  return { schema: RICH_TOPOLOGY_SUPPORT_MAPPING_VALIDATION_SCHEMA, ok: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
}

export function assertRichTopologySupportMapping(sourceTextOrObject, sourceName = 'managed-stage.json') {
  const sourceText = toSourceText(sourceTextOrObject);
  assertRichTopologyManagedStageJson(sourceText, sourceName);
  assertRichTopologySourceInventory(sourceTextOrObject, sourceName);
  assertRichTopologyGeometryContract(sourceTextOrObject, sourceName);
  const mapping = buildRichTopologySupportMapping(sourceTextOrObject, sourceName);
  if (!mapping.ok) throw new Error(`${sourceName} rich topology support mapping rejected: ${mapping.errors.join(' | ')}`);
  return mapping;
}

export function classifySupportMappingState(support) {
  if (fatalReasonsFor(support).length) return 'blocked';
  if (warningReasonsFor(support).length) return 'warning-ready';
  return 'marker-ready';
}

function toRichSupportRecord(support) {
  const mappingState = classifySupportMappingState(support);
  const blockReason = fatalReasonsFor(support).join(';');
  return {
    schema: RICH_TOPOLOGY_SUPPORT_RECORD_SCHEMA,
    supportId: stringValue(support.supportId),
    supportMarkerId: stringValue(support.supportMarkerId),
    supportName: stringValue(support.supportName || support.name),
    sourcePath: stringValue(support.sourcePath),
    nodeNumber: stringValue(support.nodeNumber),
    supportKindRaw: stringValue(support.supportKindRaw),
    supportKindNormalized: stringValue(support.supportKindNormalized),
    supportFamily: stringValue(support.supportFamily),
    mappingState,
    blockReason,
    warningCode: stringValue(support.warningCode),
    warningMessage: stringValue(support.warningMessage),
    popupRequired: Boolean(support.popupRequired),
    axis: axisFor(support),
    gap: gapFor(support),
    position: positionFor(support),
    sourceTrace: sourceTraceFor(support),
    visualPolicy: { supportMarkerOnly: true, catalogueSupport: false, structuralSteel: false }
  };
}

function buildMappingShell(sourceContract, sourceRoot, sourceName, supports, counts) {
  return {
    schema: RICH_TOPOLOGY_SUPPORT_MAPPING_SCHEMA,
    ok: false,
    sourceName: String(sourceName || 'managed-stage.json'),
    source: sourceRoot?.source || sourceContract?.managedStageProfile?.source || sourceContract?.sourceFile || '',
    converter: sourceRoot?.converter || sourceContract?.managedStageProfile?.converter || '',
    converterSchema: sourceRoot?.converterSchema || '',
    counts,
    readiness: readinessFor(counts, { errors: [], warnings: [] }),
    supports,
    errors: [],
    warnings: []
  };
}

function countSupports(supports) {
  const counts = baseCounts(supports.length);
  for (const support of supports) incrementCounts(counts, support);
  return counts;
}

function incrementCounts(counts, support) {
  if (support.mappingState === 'marker-ready' || support.mappingState === 'warning-ready') counts.readySupportMarkers += 1;
  if (support.mappingState === 'warning-ready') counts.warningSupportRecords += 1;
  if (support.mappingState === 'blocked') counts.fatalSupportRecords += 1;
  const family = normalizeFamily(support.supportFamily || support.supportKindNormalized);
  if (family === 'REST') counts.restCount += 1;
  else if (family === 'GUIDE') counts.guideCount += 1;
  else if (family === 'LINE_STOP') counts.lineStopCount += 1;
  else if (family === 'HOLDDOWN') counts.holdDownCount += 1;
  else if (family === 'SPRING_CAN') counts.springCanCount += 1;
  else counts.unknownFamilyCount += 1;
}

function baseCounts(count) {
  return { sourceSupportRecords: count, mappedSupportRecords: count, readySupportMarkers: 0, warningSupportRecords: 0, fatalSupportRecords: 0, restCount: 0, guideCount: 0, lineStopCount: 0, holdDownCount: 0, springCanCount: 0, unknownFamilyCount: 0 };
}

function readinessFor(counts, validation) {
  return { supportMarkerReady: counts.sourceSupportRecords === 0 || validation.errors.length === 0, supportCatalogueDeferred: true, structuralSupportDeferred: true, fatalIssueCount: validation.errors.length, warningCount: validation.warnings.length };
}

function addFieldErrors(supports, errors) {
  if (supports.some((support) => !support.supportMarkerId)) errors.push('support marker ID missing');
  if (supports.some((support) => !support.position.hasPosition)) errors.push('support position missing');
  if (supports.some((support) => support.gap.carryForward)) errors.push('gap carry-forward violation');
}

function fatalReasonsFor(support) {
  const reasons = [];
  if (!stringValue(support.supportId)) reasons.push('missing supportId');
  if (!stringValue(support.supportMarkerId)) reasons.push('missing supportMarkerId');
  if (!pointLike(support.positionMm)) reasons.push('missing support marker position');
  if (hasErrorDiagnostic(support)) reasons.push('support mapper preflight error');
  if (hasGapCarryForwardViolation(support)) reasons.push('gap carry-forward violation');
  return reasons;
}

function warningReasonsFor(support) {
  const reasons = [];
  if (normalizeFamily(support.supportFamily || support.supportKindNormalized) === 'UNKNOWN') reasons.push('unknown support family');
  if (support.popupRequired) reasons.push('popup required');
  if (support.warningCode) reasons.push('warning code present');
  if (!pointLike(support.axisVector)) reasons.push('missing axis vector');
  if (!stringValue(support.matchedPipeRef)) reasons.push('missing matched pipe reference');
  return reasons;
}

function axisFor(support) {
  return { raw: stringValue(support.axisRaw), canvas: stringValue(support.axisCanvas), vector: pointLike(support.axisVector) ? support.axisVector : null, transformApplied: Boolean(support.axisTransformApplied) };
}

function gapFor(support) {
  const attrs = support.sourceAttributes || {};
  return { gapMm: numberValue(support.gapMm), recordScoped: textTrue(attrs.SUPPORT_GAP_RECORD_SCOPED), carryForward: hasGapCarryForwardViolation(support) };
}

function positionFor(support) {
  return { hasPosition: pointLike(support.positionMm), positionMm: pointLike(support.positionMm) ? support.positionMm : null, matchedPipeRef: stringValue(support.matchedPipeRef) };
}

function sourceTraceFor(support) {
  return { sourceKind: 'stagedJson', sourcePath: stringValue(support.sourcePath), rawType: stringValue(support.rawType), ref: stringValue(support.ref), name: stringValue(support.name || support.supportName) };
}

function hasErrorDiagnostic(support) {
  return (support.diagnostics || []).some((entry) => String(entry?.severity || '').toLowerCase() === 'error') || (support.preflight?.issues || []).some((entry) => String(entry?.severity || '').toLowerCase() === 'error');
}

function hasGapCarryForwardViolation(support) {
  const attrs = support.sourceAttributes || support.attrs || {};
  return textTrue(attrs.SUPPORT_GAP_CARRY_FORWARD) || support.gap?.carryForward === true || support.visual?.gapCarryForward === true;
}

function normalizeFamily(value) {
  const key = String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
  if (key === 'REST' || key === 'RESTRAINT') return 'REST';
  if (key === 'GUIDE') return 'GUIDE';
  if (['LINE_STOP', 'LINESTOP', 'LIMIT'].includes(key)) return 'LINE_STOP';
  if (key === 'HOLDDOWN' || key === 'HOLD_DOWN') return 'HOLDDOWN';
  if (key === 'SPRING_CAN' || key === 'CAN') return 'SPRING_CAN';
  return 'UNKNOWN';
}

function parseRoot(sourceTextOrObject) {
  if (typeof sourceTextOrObject !== 'string') return sourceTextOrObject;
  try { return JSON.parse(sourceTextOrObject); } catch (_) { return null; }
}

function toSourceText(sourceTextOrObject) {
  return typeof sourceTextOrObject === 'string' ? sourceTextOrObject : JSON.stringify(sourceTextOrObject);
}

function pointLike(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y) && Number.isFinite(value?.z);
}

function textTrue(value) { return String(value || '').trim().toUpperCase() === 'TRUE'; }
function numberValue(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function stringValue(value) { return typeof value === 'string' ? value : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
