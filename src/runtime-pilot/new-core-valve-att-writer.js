const ATT_SCHEMA = 'PipeBendFlangeValveRuntimePilotAtt.v1';
const HEADER = 'elementId|sourceItemId|sourcePrimitiveId|exportPrimitiveId|primitiveKind|primitiveCode|family|catalogueItemId|tag|name|runtimePilotStatus|runtimePilotScope|deterministicGeometry';

/**
 * Writes the runtime-pilot ATT table for Export V2 RVM packages.
 * Parameters: a pipe/bend/flange/valve plan, or the full support-marker plan with the same attRows contract.
 * Output: pipe-delimited ATT text with a schema stamp, scope stamp, header row, and one row per RVM primitive.
 * Fallback: when the plan has no explicit scope, the legacy valve subset scope is stamped for compatibility.
 */
export function writeValvePilotAttText(plan) {
  const rows = Array.isArray(plan?.attRows) ? plan.attRows : [];
  const scope = typeof plan?.scope === 'string' && plan.scope.trim() ? plan.scope.trim() : 'pipe-bend-flange-valve-subset';
  const lines = [
    '# ATT Pilot Export',
    `# schema: ${ATT_SCHEMA}`,
    `# scope: ${scope}`,
    HEADER,
    ...rows.map(formatRow)
  ];
  return `${lines.join('\n')}\n`;
}

export function countValvePilotAttRows(attText) {
  return String(attText || '').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && !line.startsWith('elementId|')).length;
}

export function assertValvePilotAttText(attText, expectedRows) {
  const rowCount = countValvePilotAttRows(attText);
  const errors = [];
  if (!String(attText || '').startsWith('# ATT Pilot Export')) errors.push('ATT pilot header is required');
  if (!String(attText || '').includes(`# schema: ${ATT_SCHEMA}`)) errors.push('ATT pilot schema stamp is required');
  if (!String(attText || '').includes(HEADER)) errors.push('ATT pilot column header is required');
  if (rowCount !== expectedRows) errors.push(`ATT row count ${rowCount} does not match ${expectedRows}`);
  if (errors.length) throw new Error(`PipeBendFlangeValveRuntimePilotAtt invalid: ${errors.join('; ')}`);
  return { schema: 'PipeBendFlangeValveRuntimePilotAttAssertion.v1', ok: true, rowCount };
}

function formatRow(row) {
  return [
    row.elementId,
    row.sourceItemId,
    row.sourcePrimitiveId,
    row.exportPrimitiveId,
    row.primitiveKind,
    row.primitiveCode,
    row.family,
    row.catalogueItemId,
    row.tag,
    row.name,
    row.runtimePilotStatus,
    row.runtimePilotScope,
    row.deterministicGeometry
  ].map(escapeField).join('|');
}

function escapeField(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', ' ');
}
