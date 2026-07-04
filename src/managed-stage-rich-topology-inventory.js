import {
  assertRichTopologyManagedStageJson,
  validateRichTopologyManagedStageJson
} from './managed-stage-rich-topology-intake.js';

export const RICH_TOPOLOGY_INVENTORY_SCHEMA = 'ManagedStageRichTopologyInventory.v1';
export const RICH_TOPOLOGY_RECORD_SCHEMA = 'ManagedStageRichTopologyRecord.v1';
const NO_DROP_SCHEMA = 'ManagedStageRichTopologyNoDropValidation.v1';

export function buildRichTopologySourceInventory(sourceTextOrObject, sourceName = 'managed-stage.json') {
  const { root, intake } = coerceRichTopologyRoot(sourceTextOrObject, sourceName);
  const records = root ? collectRichTopologyRecords(root) : [];
  const actualCounts = countActualRecords(records);
  const noDrop = buildNoDrop(actualCounts, records, root?.stats || {});
  const inventory = buildInventory(root, sourceName, records, actualCounts, noDrop, intake.errors);
  const validation = validateRichTopologyNoDrop(inventory);
  return { ...inventory, ok: inventory.errors.length === 0 && validation.ok, warnings: validation.warnings };
}

export function collectRichTopologyRecords(root) {
  const records = [];
  walkRecords(root?.hierarchy || [], '', records);
  return records;
}

export function classifyRichTopologyRecord(record) {
  const attrs = attributesOf(record);
  if (isBranchRecord(record, attrs)) return 'branch';
  if (isSupportRecord(record, attrs)) return 'support';
  const text = familyText(record, attrs);
  if (/BEND|ELBO/.test(text)) return 'bend';
  if (/FLAN/.test(text)) return 'flange';
  if (/VALV/.test(text)) return 'valve';
  if (/REDU/.test(text)) return 'reducer';
  if (/PIPE/.test(text)) return 'pipe';
  return 'unknown';
}

export function validateRichTopologyNoDrop(inventory) {
  const errors = [];
  const warnings = [];
  const noDrop = inventory?.noDrop || {};
  if (noDrop.duplicateSourceElementIdCount) errors.push('duplicate source element IDs');
  if (noDrop.missingSourceElementIdCount) errors.push('missing source element IDs');
  if (noDrop.missingAposLposGeometryCount) errors.push('missing APOS/LPOS for geometry records');
  if (noDrop.zeroLengthGeometryCount) errors.push('zero-length geometry records');
  if (noDrop.statsChildrenMismatch) errors.push('stats.children mismatch actual source child count');
  if (noDrop.statsComponentsMismatch) errors.push('stats.components mismatch actual geometry record count');
  if (inventory?.actualCounts?.unknownRecords) warnings.push('unknown records present');
  if (inventory?.actualCounts?.supportRecords && !inventory?.sourceStats?.emittedSupports) warnings.push('stats support count unavailable');
  if (inventory?.sourceStats?.bends !== inventory?.actualCounts?.bendRecords) warnings.push('stats bend count mismatch actual bend count');
  return { schema: NO_DROP_SCHEMA, ok: errors.length === 0, errors, warnings };
}

export function assertRichTopologySourceInventory(sourceTextOrObject, sourceName = 'managed-stage.json') {
  if (typeof sourceTextOrObject === 'string') assertRichTopologyManagedStageJson(sourceTextOrObject, sourceName);
  const inventory = buildRichTopologySourceInventory(sourceTextOrObject, sourceName);
  if (!inventory.ok) throw new Error(`${sourceName} rich topology inventory rejected: ${inventory.errors.join(' | ')}`);
  return inventory;
}

function coerceRichTopologyRoot(sourceTextOrObject, sourceName) {
  if (typeof sourceTextOrObject === 'string') return coerceTextRoot(sourceTextOrObject, sourceName);
  const intake = validateRichTopologyManagedStageJson(sourceTextOrObject, sourceName);
  return { root: intake.ok ? sourceTextOrObject : null, intake };
}

function coerceTextRoot(sourceText, sourceName) {
  try {
    const root = JSON.parse(sourceText);
    const intake = validateRichTopologyManagedStageJson(root, sourceName);
    return { root: intake.ok ? root : null, intake };
  } catch (error) {
    return { root: null, intake: { errors: [`JSON parse failure in ${sourceName}: ${error?.message || error}`] } };
  }
}

function buildInventory(root, sourceName, records, actualCounts, noDrop, intakeErrors) {
  const stats = root?.stats || {};
  const validation = validateRichTopologyNoDrop({ actualCounts, sourceStats: sourceStats(stats), noDrop });
  return {
    schema: RICH_TOPOLOGY_INVENTORY_SCHEMA,
    ok: false,
    sourceName: String(sourceName || 'managed-stage.json'),
    source: stringValue(root?.source),
    converter: stringValue(root?.converter),
    converterSchema: stringValue(root?.converterSchema),
    branchCount: actualCounts.branchRecords,
    sourceStats: sourceStats(stats),
    actualCounts,
    noDrop,
    records,
    errors: [...intakeErrors, ...validation.errors],
    warnings: validation.warnings
  };
}

function walkRecords(nodes, owner, records) {
  for (const node of nodes || []) {
    const record = toInventoryRecord(node, owner);
    records.push(record);
    walkRecords(node?.children || [], record.family === 'branch' ? record.name : owner, records);
  }
}

function toInventoryRecord(node, owner) {
  const attrs = attributesOf(node);
  const family = classifyRichTopologyRecord(node);
  const hasApos = pointLike(attrs.APOS);
  const hasLpos = pointLike(attrs.LPOS);
  const lengthMm = lengthOf(attrs, hasApos, hasLpos);
  return {
    schema: RICH_TOPOLOGY_RECORD_SCHEMA,
    sourceElementId: sourceElementIdOf(node, attrs),
    name: stringValue(node?.name || attrs.NAME),
    type: stringValue(node?.type || attrs.TYPE),
    dtxr: stringValue(attrs.DTXR || attrs.CANONICAL_TYPE || attrs.COMPONENT_CLASS),
    family,
    owner: stringValue(owner),
    fromNode: stringValue(attrs.FROM_NODE),
    toNode: stringValue(attrs.TO_NODE),
    hasApos,
    hasLpos,
    lengthMm,
    validGeometrySpan: isGeometryFamily(family) && hasApos && hasLpos && lengthMm > 0,
    supportCandidate: family === 'support'
  };
}

function buildNoDrop(actualCounts, records, stats) {
  const geometry = records.filter((record) => isGeometryFamily(record.family));
  const missingId = geometry.filter((record) => !record.sourceElementId).length;
  const missingSpan = geometry.filter((record) => !record.hasApos || !record.hasLpos).length;
  const zeroLength = geometry.filter((record) => record.hasApos && record.hasLpos && !(record.lengthMm > 0)).length;
  const duplicateIds = duplicateSourceElementIds(geometry);
  return {
    checked: true,
    pass: missingId + missingSpan + zeroLength + duplicateIds === 0 && stats.children === actualCounts.sourceChildRecords && stats.components === actualCounts.geometryRecords,
    droppedSourceRecordCount: Math.max(0, numberValue(stats.children) - actualCounts.sourceChildRecords),
    duplicateSourceElementIdCount: duplicateIds,
    missingSourceElementIdCount: missingId,
    missingAposLposGeometryCount: missingSpan,
    zeroLengthGeometryCount: zeroLength,
    statsChildrenMismatch: stats.children !== actualCounts.sourceChildRecords,
    statsComponentsMismatch: stats.components !== actualCounts.geometryRecords
  };
}

function countActualRecords(records) {
  const counts = baseCounts();
  for (const record of records) incrementCounts(counts, record.family);
  return counts;
}

function incrementCounts(counts, family) {
  if (family !== 'branch') counts.sourceChildRecords += 1;
  if (family === 'branch') counts.branchRecords += 1;
  if (isGeometryFamily(family)) counts.geometryRecords += 1;
  if (family === 'support') counts.supportRecords += 1;
  if (family === 'pipe') counts.pipeRecords += 1;
  if (family === 'bend') counts.bendRecords += 1;
  if (family === 'flange') counts.flangeRecords += 1;
  if (family === 'valve') counts.valveRecords += 1;
  if (family === 'reducer') counts.reducerRecords += 1;
  if (family === 'unknown') counts.unknownRecords += 1;
}

function baseCounts() {
  return { sourceChildRecords: 0, branchRecords: 0, geometryRecords: 0, supportRecords: 0, pipeRecords: 0, bendRecords: 0, flangeRecords: 0, valveRecords: 0, reducerRecords: 0, unknownRecords: 0 };
}

function duplicateSourceElementIds(records) {
  const seen = new Set();
  const duplicates = new Set();
  for (const record of records) {
    if (!record.sourceElementId) continue;
    if (seen.has(record.sourceElementId)) duplicates.add(record.sourceElementId);
    seen.add(record.sourceElementId);
  }
  return duplicates.size;
}

function sourceStats(stats = {}) {
  return { components: numberValue(stats.components), children: numberValue(stats.children), emittedSupports: numberValue(stats.emittedSupports), bends: numberValue(stats.bends), validRestraints: numberValue(stats.validRestraints), restraintRows: numberValue(stats.restraintRows) };
}

function isBranchRecord(record, attrs) { return record?.type === 'BRANCH' || attrs.TYPE === 'BRAN'; }
function isSupportRecord(record, attrs) { return /^(ATTA|SUPP|SUPPORT|RESTRAINT)$/.test(record?.type || '') || /^(ATTA|SUPP|SUPPORT|RESTRAINT)$/.test(attrs.TYPE || '') || /support/i.test(`${attrs.COMPONENT_ROLE || ''} ${attrs.NODE_ROLE || ''}`) || Boolean(attrs.SUPPORT_TAG || attrs.SUPPORT_KIND || attrs.RESTRAINT_KIND); }
function familyText(record, attrs) { return `${attrs.DTXR || ''} ${attrs.TYPE || ''} ${attrs.CANONICAL_TYPE || ''} ${attrs.COMPONENT_CLASS || ''} ${record?.type || ''}`.toUpperCase(); }
function isGeometryFamily(family) { return ['pipe', 'bend', 'flange', 'valve', 'reducer'].includes(family); }
function attributesOf(record) { return record?.attributes && typeof record.attributes === 'object' ? record.attributes : {}; }
function sourceElementIdOf(_node, attrs) { return stringValue(attrs.SOURCE_ELEMENT_ID || attrs.REF || attrs.NAME || attrs.SOURCE_RESTRAINT_ID || attrs.SUPPORT_TAG); }
function pointLike(value) { return Number.isFinite(value?.x) && Number.isFinite(value?.y) && Number.isFinite(value?.z); }
function lengthOf(attrs, hasApos, hasLpos) { return firstPositive(attrs.LENGTH_MM, attrs.ROUTE_LENGTH_MM, attrs.ELEMENT_LENGTH_MM) || (hasApos && hasLpos ? distance(attrs.APOS, attrs.LPOS) : 0); }
function firstPositive(...values) { return values.find((value) => Number.isFinite(value) && value > 0) || 0; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
function numberValue(value) { return Number.isFinite(value) ? value : 0; }
function stringValue(value) { return typeof value === 'string' ? value : ''; }
