export const RICH_TOPOLOGY_INTAKE_SCHEMA = 'ManagedStageRichTopologyIntake.v1';
export const MANAGED_STAGE_SCHEMA = 'inputxml-managed-stage/v1';
export const MANAGED_STAGE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
export const RICH_TOPOLOGY_CONVERTER = 'INPUTXML->STAGEDJSON';
export const RICH_TOPOLOGY_CONVERTER_SCHEMA = 'inputxml-direct-managed-stage/v2-rich-topology';

const GLB_BASIC_REJECTION = `INPUTXML->GLB basic staged JSON is not supported by WP1 rich topology intake; expected converter ${RICH_TOPOLOGY_CONVERTER} with converterSchema ${RICH_TOPOLOGY_CONVERTER_SCHEMA}.`;

export function parseJsonForRichTopologyIntake(sourceText, sourceName = 'managed-stage.json') {
  try {
    return JSON.parse(sourceText);
  } catch (error) {
    return buildIntake(null, sourceName, [`JSON parse failure in ${sourceName}: ${error?.message || error}`]);
  }
}

export function validateRichTopologyManagedStageJson(parsed, sourceName = 'managed-stage.json') {
  if (isIntakeResult(parsed)) return parsed;
  const root = isPlainObject(parsed) ? parsed : null;
  const errors = [];
  if (!root) errors.push('missing object root');
  if (root) validateIdentity(root, errors);
  if (root) validateTopology(root, errors);
  return buildIntake(root, sourceName, errors);
}

export function looksLikeRichTopologyManagedStageJson(sourceText, sourceName = 'managed-stage.json') {
  const parsed = parseJsonForRichTopologyIntake(sourceText, sourceName);
  return validateRichTopologyManagedStageJson(parsed, sourceName).ok;
}

export function assertRichTopologyManagedStageJson(sourceText, sourceName = 'managed-stage.json') {
  const parsed = parseJsonForRichTopologyIntake(sourceText, sourceName);
  const intake = validateRichTopologyManagedStageJson(parsed, sourceName);
  if (!intake.ok) throw new Error(`${sourceName} rejected by ${RICH_TOPOLOGY_INTAKE_SCHEMA}: ${intake.errors.join(' | ')}`);
  return intake;
}

function validateIdentity(root, errors) {
  if (root.schema !== MANAGED_STAGE_SCHEMA) errors.push(`schema is not ${MANAGED_STAGE_SCHEMA}`);
  if (root.profile !== MANAGED_STAGE_PROFILE) errors.push(`profile is not ${MANAGED_STAGE_PROFILE}`);
  if (root.converter === 'INPUTXML->GLB') errors.push(GLB_BASIC_REJECTION);
  else if (root.converter !== RICH_TOPOLOGY_CONVERTER) errors.push(`converter is not ${RICH_TOPOLOGY_CONVERTER}`);
  if (root.converterSchema !== RICH_TOPOLOGY_CONVERTER_SCHEMA) errors.push(`converterSchema is not ${RICH_TOPOLOGY_CONVERTER_SCHEMA}`);
  if (root.units?.length !== 'mm') errors.push('units.length is not mm');
}

function validateTopology(root, errors) {
  if (!Array.isArray(root.hierarchy) || root.hierarchy.length === 0) errors.push('hierarchy is not a non-empty array');
  if (!isPlainObject(root.stats)) {
    errors.push('stats is missing or not object');
    return;
  }
  if (!positiveNumber(root.stats.components)) errors.push('stats.components is missing/non-positive');
  if (!positiveNumber(root.stats.children)) errors.push('stats.children is missing/non-positive');
  if (positiveNumber(root.stats.components) && positiveNumber(root.stats.children) && root.stats.children < root.stats.components) errors.push('stats.children < stats.components');
}

function buildIntake(root, sourceName, errors) {
  const stats = root?.stats && isPlainObject(root.stats) ? root.stats : {};
  const hierarchy = Array.isArray(root?.hierarchy) ? root.hierarchy : [];
  return {
    schema: RICH_TOPOLOGY_INTAKE_SCHEMA,
    ok: errors.length === 0,
    sourceName: String(sourceName || 'managed-stage.json'),
    source: stringValue(root?.source),
    inputSchema: stringValue(root?.schema),
    profile: stringValue(root?.profile),
    converter: stringValue(root?.converter),
    converterSchema: stringValue(root?.converterSchema),
    unitsLength: stringValue(root?.units?.length),
    branchCount: countBranchNodes(hierarchy) || hierarchy.length,
    stats: {
      components: numberValue(stats.components),
      children: numberValue(stats.children),
      emittedSupports: numberValue(stats.emittedSupports),
      bends: numberValue(stats.bends)
    },
    errors: [...errors],
    warnings: []
  };
}

function countBranchNodes(nodes) {
  let count = 0;
  for (const node of nodes || []) {
    if (node?.type === 'BRANCH' || node?.attributes?.TYPE === 'BRAN') count += 1;
    count += countBranchNodes(node?.children);
  }
  return count;
}

function positiveNumber(value) { return Number.isFinite(value) && value > 0; }
function numberValue(value) { return Number.isFinite(value) ? value : 0; }
function stringValue(value) { return typeof value === 'string' ? value : ''; }
function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isIntakeResult(value) { return value?.schema === RICH_TOPOLOGY_INTAKE_SCHEMA && Array.isArray(value.errors); }
