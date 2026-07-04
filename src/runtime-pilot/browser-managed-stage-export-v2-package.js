import { convertManagedStageJsonToRvmAtt } from '../managed-stage-rvm-converter.js';

const SCHEMA = 'BrowserManagedStageExportV2PackageAudit.v1';
const BUNDLE_SCHEMA = 'BrowserManagedStageExportV2DownloadBundle.v1';
const SCOPE = 'managed-stage-rich-export-v2-full-package';
const LEGACY_OPTION_SCOPE = 'pipe-bend-flange-valve-subset';

/**
 * Builds the independent Export V2 full RVM package directly from managed-stage source text.
 * Parameters: managed-stage source state plus explicit browser export options.
 * Output: RVM, ATT, and audit download descriptors for the rich hierarchy/component RVM engine.
 * Fallback: none; missing source text or blocked rich geometry returns a blocked audit.
 */
export async function generateBrowserManagedStageExportV2Package(state, options) {
  const errors = optionErrors(object(options));
  if (!state?.sourceText) errors.push('no managed-stage/new-core input loaded');
  if (errors.length) return blockedResult(errors, object(options));
  try {
    const result = convertManagedStageJsonToRvmAtt(String(state.sourceText), exportV2Options(state, options));
    const audit = buildAudit(result, state, options);
    if (!audit.ok) return blockedResult(audit.errors, object(options), audit);
    return buildManagedStageExportV2DownloadBundle(result, audit, { basename: object(options).basename || state.basename });
  } catch (error) {
    return blockedResult([error?.message || String(error)], object(options));
  }
}

export function buildManagedStageExportV2DownloadBundle(result, audit, options) {
  const basename = safeBasename(object(options).basename || 'managed-stage.export-v2');
  return {
    schema: BUNDLE_SCHEMA,
    rvmFile: { filename: `${basename}.rvm`, mimeType: 'application/octet-stream', bytes: result.rvm },
    attFile: { filename: `${basename}.att`, mimeType: 'text/plain', text: result.att },
    auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` },
    audit,
  };
}

function exportV2Options(state, options) {
  return {
    filename: state?.sourceName || state?.filename || '',
    sourceName: state?.sourceName || state?.filename || '',
    rvmRootName: object(options).rvmRootName,
    excludeBendsWhileProcessingInputXmlBasedJson: false,
    allowManagedStageCode4Elbows: true,
    allowExperimentalCode4ElbowEmission: true,
    warningOnlyManagedStageGates: true,
    nonBlockingGeometryGates: true,
  };
}

function buildAudit(result, state, options) {
  const converterAudit = object(result?.audit);
  const chunkHierarchy = object(converterAudit.chunkHierarchy);
  const supportAudit = object(converterAudit.supportRvmExportAudit);
  const code4Audit = object(converterAudit.explicitCode4BendInvariantAudit);
  const symbolAudit = object(converterAudit.componentPrimitiveSymbolExportAudit);
  const histogram = object(converterAudit.primitiveHistogram);
  const errors = [];
  const hierarchyNodeCount = numberValue(chunkHierarchy.cntbCount ?? chunkHierarchy.counts?.CNTB ?? chunkHierarchy.cntb);
  const primitiveCount = numberValue(converterAudit.rvmPrimitivePayloadContract?.primitiveCount);
  const code4BendCount = numberValue(histogram[4] ?? histogram['4']);
  const supportPrimitiveCount = numberValue(supportAudit.supportPrimitiveCount);
  const supportRecordCount = numberValue(supportAudit.supportRecordCount);
  const flangeNodeCount = numberValue(symbolAudit.flangeNodeCount);
  const valveNodeCount = numberValue(symbolAudit.valveNodeCount);
  if (hierarchyNodeCount <= 2) errors.push(`Export V2 hierarchy too shallow: ${hierarchyNodeCount} CNTB nodes`);
  if (code4BendCount <= 0) errors.push('Export V2 emitted no code-4 bend primitives');
  if (numberValue(code4Audit.missingCode4PrimitiveCount) > 0) errors.push(`Export V2 missing ${code4Audit.missingCode4PrimitiveCount} code-4 bend primitive(s)`);
  if (supportRecordCount <= 0 || supportPrimitiveCount <= 0) errors.push('Export V2 emitted no transformed support geometry');
  if (flangeNodeCount <= 0) errors.push('Export V2 emitted no flange component nodes');
  if (valveNodeCount <= 0) errors.push('Export V2 emitted no valve component nodes');

  const ok = errors.length === 0;
  return {
    schema: SCHEMA,
    ok,
    mode: 'explicit-runtime-pilot',
    scope: SCOPE,
    requestedScope: object(options).scope || '',
    sourceName: state?.sourceName || '',
    artifactGenerated: true,
    rvmDownloadPrepared: true,
    attDownloadPrepared: true,
    auditDownloadPrepared: true,
    oldProductionExportPathTouched: false,
    legacyManagedStageArtifactRead: false,
    defaultRuntimeSwitchEnabled: false,
    appStartupBehaviorChanged: false,
    canvasTouched: false,
    threeGeometryCreated: false,
    cacheKeyMutated: false,
    fullModelReady: ok,
    hierarchyGenerated: hierarchyNodeCount > 2,
    hierarchyNodeCount,
    plannedRvmPrimitiveCount: primitiveCount,
    decodedPrimitiveCount: primitiveCount,
    primitiveHistogram: histogram,
    plannedTorusCount: code4BendCount,
    decodedTorusCount: code4BendCount,
    code4BendCount,
    explicitBendRecordCount: numberValue(code4Audit.explicitBendRecordCount),
    plannedCode4BendCount: numberValue(code4Audit.plannedCode4BendCount),
    missingCode4PrimitiveCount: numberValue(code4Audit.missingCode4PrimitiveCount),
    supportMarkerCount: supportRecordCount,
    supportPrimitiveCount,
    supportCylinderPrimitiveCount: numberValue(supportAudit.supportPrimitiveCodeHistogram?.[8] ?? supportAudit.supportPrimitiveCodeHistogram?.['8']),
    supportSpherePrimitiveCount: numberValue(supportAudit.supportPrimitiveCodeHistogram?.[9] ?? supportAudit.supportPrimitiveCodeHistogram?.['9']),
    supportMaxClusterOffsetMm: numberValue(supportAudit.supportMaxClusterOffsetMm),
    supportGeometryGenerated: supportPrimitiveCount > 0,
    plannedFlangeCylinderCount: numberValue(symbolAudit.weldNeckFlangePrimitiveCount),
    plannedValveBodyCount: numberValue(symbolAudit.ballValvePrimitiveCount),
    flangeNodeCount,
    valveNodeCount,
    warningCount: array(converterAudit.managedStageStrictGate?.nonBlockingAuditIssues).length,
    hardErrorCount: errors.length,
    warnings: array(converterAudit.managedStageStrictGate?.nonBlockingAuditIssues),
    errors,
    converterAudit,
  };
}

function blockedResult(errors, options, audit = null) {
  const blockedAudit = audit || {
    schema: SCHEMA,
    ok: false,
    mode: 'explicit-runtime-pilot',
    scope: SCOPE,
    requestedScope: options.scope || '',
    artifactGenerated: false,
    rvmDownloadPrepared: false,
    attDownloadPrepared: false,
    auditDownloadPrepared: true,
    oldProductionExportPathTouched: false,
    legacyManagedStageArtifactRead: false,
    fullModelReady: false,
    hierarchyGenerated: false,
    hierarchyNodeCount: 0,
    plannedRvmPrimitiveCount: 0,
    decodedPrimitiveCount: 0,
    code4BendCount: 0,
    supportMarkerCount: 0,
    supportPrimitiveCount: 0,
    hardErrorCount: errors.length,
    warningCount: 0,
    warnings: [],
    errors,
  };
  const basename = safeBasename(options.basename || 'managed-stage.export-v2');
  return {
    schema: BUNDLE_SCHEMA,
    rvmFile: null,
    attFile: null,
    auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(blockedAudit, null, 2)}\n` },
    audit: blockedAudit,
  };
}

function optionErrors(options) {
  const errors = [];
  if (options.enabled !== true) errors.push('enabled must be true');
  if (options.mode !== 'explicit-runtime-pilot') errors.push('mode must be explicit-runtime-pilot');
  if (![LEGACY_OPTION_SCOPE, SCOPE].includes(String(options.scope || ''))) errors.push(`scope must be ${LEGACY_OPTION_SCOPE} or ${SCOPE}`);
  if (options.userGestureConfirmed !== true) errors.push('userGestureConfirmed must be true');
  if (options.browserDownload !== true) errors.push('browserDownload must be true');
  return errors;
}

function safeBasename(value) {
  const trimmed = String(value || '').replace(/\.[^.\\/]+$/i, '').replace(/[^A-Za-z0-9_.() -]+/g, '_').trim();
  return trimmed || 'managed-stage.export-v2';
}

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
