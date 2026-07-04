import {
  assertRichTopologySourceInventory,
  buildRichTopologySourceInventory
} from './managed-stage-rich-topology-inventory.js';

export const RICH_TOPOLOGY_GEOMETRY_CONTRACT_SCHEMA = 'ManagedStageRichTopologyGeometryContract.v1';
export const RICH_TOPOLOGY_COMPONENT_CONTRACT_SCHEMA = 'ManagedStageRichTopologyComponentContract.v1';
export const RICH_TOPOLOGY_CONTRACT_VALIDATION_SCHEMA = 'ManagedStageRichTopologyContractValidation.v1';

const GEOMETRY_FAMILIES = ['pipe', 'bend', 'flange', 'valve', 'reducer'];
const DIAMETER_KEYS = ['DIAMETER_MM', 'OUTSIDE_DIAMETER_MM', 'DIAMETER', 'BORE', 'ABORE', 'LBORE'];
const BEND_KEYS = ['BEND_RADIUS_MM', 'BEND_RADIUS', 'BEND_ANGLE_DEG', 'BEND_ANGLE', 'BEND_ELEMENT_LENGTH_MM', 'ELBOW_ARC_LENGTH_MM'];

export function buildRichTopologyGeometryContract(sourceTextOrObject, sourceName = 'managed-stage.json') {
  const root = parseRoot(sourceTextOrObject);
  const inventory = buildRichTopologySourceInventory(root || sourceTextOrObject, sourceName);
  const rawEvidence = root ? collectRawEvidence(root) : new Map();
  const contracts = buildRichTopologyComponentContracts({ ...inventory, rawEvidence });
  const draft = buildContractShell(inventory, contracts, sourceName);
  const validation = validateRichTopologyGeometryContract(draft);
  const errors = [...inventory.errors, ...validation.errors];
  return { ...draft, ok: errors.length === 0, readiness: readinessFor(draft.counts, errors, validation.warnings), errors, warnings: validation.warnings };
}

export function buildRichTopologyComponentContracts(inventory) {
  return (inventory?.records || []).map((record) => {
    const attrs = rawAttributesFor(inventory.rawEvidence, record);
    return buildComponentContract(record, attrs);
  });
}

export function validateRichTopologyGeometryContract(contract) {
  const errors = [];
  const warnings = [];
  const blocked = contract?.contracts?.filter((item) => item.contractState === 'blocked') || [];
  if (blocked.length) errors.push(`blocked primitive-intent records exist: ${blocked.map(blockLabel).join(', ')}`);
  addMissingErrors(contract?.contracts || [], errors);
  if (contract?.counts?.unknownContracts) errors.push('unknown records present');
  if (contract?.counts?.supportContracts) warnings.push('support records deferred');
  if ((contract?.contracts || []).some((item) => item.warnings.includes('valve geometry is visual-derived, not catalogue-authoritative'))) warnings.push('valve geometry visual-derived');
  return { schema: RICH_TOPOLOGY_CONTRACT_VALIDATION_SCHEMA, ok: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
}

export function assertRichTopologyGeometryContract(sourceTextOrObject, sourceName = 'managed-stage.json') {
  assertRichTopologySourceInventory(sourceTextOrObject, sourceName);
  const contract = buildRichTopologyGeometryContract(sourceTextOrObject, sourceName);
  if (!contract.ok) throw new Error(`${sourceName} rich topology geometry contract rejected: ${contract.errors.join(' | ')}`);
  return contract;
}

export function classifyGeometryContractState(record) {
  if (record?.family === 'branch') return 'branch-context';
  if (record?.family === 'support') return 'support-deferred';
  if (record?.family === 'unknown') return 'blocked';
  return record?.validGeometrySpan ? 'primitive-ready' : 'blocked';
}

function buildComponentContract(record, attrs) {
  const family = record.family;
  const geometry = geometryEvidence(record, attrs);
  const blockReason = blockReasonFor(record, geometry, attrs);
  const contractState = stateFor(record, blockReason);
  const warnings = family === 'valve' && contractState === 'primitive-ready' ? ['valve geometry is visual-derived, not catalogue-authoritative'] : [];
  return {
    schema: RICH_TOPOLOGY_COMPONENT_CONTRACT_SCHEMA,
    sourceElementId: record.sourceElementId,
    name: record.name,
    family,
    contractState,
    blockReason,
    warnings,
    owner: record.owner,
    fromNode: record.fromNode,
    toNode: record.toNode,
    geometry,
    sourceTrace: sourceTraceFor(record),
    primitiveIntent: primitiveIntentFor(family, contractState)
  };
}

function buildContractShell(inventory, contracts, sourceName) {
  const counts = countsFor(contracts);
  return {
    schema: RICH_TOPOLOGY_GEOMETRY_CONTRACT_SCHEMA,
    ok: false,
    sourceName: String(sourceName || inventory.sourceName || 'managed-stage.json'),
    source: inventory.source,
    converter: inventory.converter,
    converterSchema: inventory.converterSchema,
    counts,
    readiness: readinessFor(counts, [], []),
    contracts,
    errors: [],
    warnings: []
  };
}

function geometryEvidence(record, attrs) {
  return {
    hasApos: Boolean(record.hasApos),
    hasLpos: Boolean(record.hasLpos),
    lengthMm: record.lengthMm || 0,
    hasPositiveLength: record.lengthMm > 0,
    hasDiameterEvidence: hasEvidence(attrs, DIAMETER_KEYS),
    hasAxisEvidence: Boolean(record.fromNode && record.toNode)
  };
}

function blockReasonFor(record, geometry, attrs) {
  if (record.family === 'unknown') return 'unknown-rich-topology-record';
  if (!GEOMETRY_FAMILIES.includes(record.family)) return '';
  const reasons = [];
  if (!record.sourceElementId) reasons.push('missing-sourceElementId');
  if (!geometry.hasApos || !geometry.hasLpos) reasons.push('missing-APOS-LPOS');
  if (!geometry.hasPositiveLength) reasons.push('non-positive-length');
  if (!geometry.hasDiameterEvidence) reasons.push('missing-diameter-evidence');
  if (!geometry.hasAxisEvidence) reasons.push('missing-fromNode-toNode');
  if (record.family === 'bend' && !hasEvidence(attrs, BEND_KEYS)) reasons.push('missing-bend-evidence');
  return reasons.join(';');
}

function stateFor(record, blockReason) {
  if (record.family === 'branch') return 'branch-context';
  if (record.family === 'support') return 'support-deferred';
  return blockReason ? 'blocked' : 'primitive-ready';
}

function primitiveIntentFor(family, state) {
  const primitiveFamily = expectedPrimitiveFamily(family);
  return { expectedPrimitiveFamily: primitiveFamily, exportEligible: state === 'primitive-ready' };
}

function expectedPrimitiveFamily(family) {
  if (family === 'pipe') return 'cylinder';
  if (family === 'bend') return 'torus-or-cylinder-fallback';
  if (family === 'flange' || family === 'reducer') return 'snout-or-cylinder';
  if (family === 'valve') return 'visual-valve-recipe';
  if (family === 'support') return 'support-marker-deferred';
  return 'none';
}

function addMissingErrors(contracts, errors) {
  for (const item of contracts.filter((entry) => entry.contractState === 'blocked')) {
    if (item.blockReason.includes('missing-sourceElementId')) errors.push(`primitive-ready geometry record missing sourceElementId: ${item.name}`);
    if (item.blockReason.includes('missing-APOS-LPOS')) errors.push(`primitive-ready geometry record missing APOS/LPOS: ${item.sourceElementId || item.name}`);
    if (item.blockReason.includes('non-positive-length')) errors.push(`primitive-ready geometry record has non-positive length: ${item.sourceElementId || item.name}`);
    if (item.blockReason.includes('missing-diameter-evidence')) errors.push(`primitive-ready geometry record missing diameter evidence: ${item.sourceElementId || item.name}`);
    if (item.blockReason.includes('missing-fromNode-toNode')) errors.push(`pipe/flange/valve/reducer record missing fromNode/toNode: ${item.sourceElementId || item.name}`);
    if (item.blockReason.includes('missing-bend-evidence')) errors.push(`bend record missing bend evidence: ${item.sourceElementId || item.name}`);
  }
}

function countsFor(contracts) {
  const counts = { totalRecords: contracts.length, geometryContracts: 0, supportContracts: 0, blockedContracts: 0, deferredContracts: 0, pipeContracts: 0, bendContracts: 0, flangeContracts: 0, valveContracts: 0, reducerContracts: 0, unknownContracts: 0 };
  for (const item of contracts) incrementCounts(counts, item);
  return counts;
}

function incrementCounts(counts, item) {
  if (GEOMETRY_FAMILIES.includes(item.family)) counts.geometryContracts += 1;
  if (item.contractState === 'blocked') counts.blockedContracts += 1;
  if (item.contractState === 'support-deferred') counts.deferredContracts += 1;
  const key = `${item.family}Contracts`;
  if (key in counts) counts[key] += 1;
}

function readinessFor(counts, errors, warnings) {
  return { primitivePlanningReady: errors.length === 0, supportMappingDeferred: counts.supportContracts > 0, unknownRecordsBlocked: counts.unknownContracts > 0, fatalGeometryIssueCount: errors.length, warningCount: warnings.length };
}

function sourceTraceFor(record) {
  return { hasSourceElementId: Boolean(record.sourceElementId), sourceElementId: record.sourceElementId, name: record.name, owner: record.owner };
}

function parseRoot(sourceTextOrObject) {
  if (typeof sourceTextOrObject !== 'string') return sourceTextOrObject;
  try { return JSON.parse(sourceTextOrObject); } catch (_) { return null; }
}

function collectRawEvidence(root) {
  const evidence = new Map();
  walkRaw(root?.hierarchy || [], evidence);
  return evidence;
}

function walkRaw(nodes, evidence) {
  for (const node of nodes || []) {
    const attrs = attributesOf(node);
    for (const key of rawKeys(node, attrs)) evidence.set(key, attrs);
    walkRaw(node?.children || [], evidence);
  }
}

function rawKeys(node, attrs) {
  return [attrs.SOURCE_ELEMENT_ID, attrs.REF, attrs.NAME, attrs.SOURCE_RESTRAINT_ID, attrs.SUPPORT_TAG, node?.name].filter((value) => typeof value === 'string' && value);
}

function rawAttributesFor(rawEvidence, record) {
  return rawEvidence?.get(record.sourceElementId) || rawEvidence?.get(record.name) || {};
}

function hasEvidence(attrs, keys) {
  return keys.some((key) => attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim() !== '');
}

function attributesOf(node) {
  return node?.attributes && typeof node.attributes === 'object' ? node.attributes : {};
}

function blockLabel(item) {
  return `${item.sourceElementId || item.name || '<unknown>'} ${item.blockReason}`.trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
