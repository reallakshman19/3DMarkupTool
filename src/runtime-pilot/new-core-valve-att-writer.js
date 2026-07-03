const ATT_SCHEMA = 'PipeBendFlangeValveRuntimePilotAtt.v1';
const HEADER = 'elementId|sourceItemId|sourcePrimitiveId|exportPrimitiveId|primitiveKind|primitiveCode|family|catalogueItemId|tag|name|runtimePilotStatus|runtimePilotScope|deterministicGeometry';

export function writeValvePilotAttText(plan) {
  const rows = Array.isArray(plan?.attRows) ? plan.attRows : [];
  const lines = [
    '# ATT Pilot Export',
    `# schema: ${ATT_SCHEMA}`,
    '# scope: pipe-bend-flange-valve-subset',
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
