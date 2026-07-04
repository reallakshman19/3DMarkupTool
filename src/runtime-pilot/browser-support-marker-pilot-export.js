import { auditCatalogueBinding } from '../catalogue/catalogue-binder.js';
import { compileResolvedPrimitiveModelToExportModels } from '../export-models/export-model-compilers.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../geometry/geometry-solver.js';
import { convertManagedStageJsonToPlantGraph } from '../importers/managed-stage-to-plant-graph.js?v=bust-cache-5-object-points';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../primitives/primitive-compiler.js';
import { writeValvePilotAttText } from './new-core-valve-att-writer.js';
import { buildNewCoreSupportMarkerRuntimePilotAudit } from './new-core-support-marker-runtime-audit.js';
import { buildNewCoreSupportMarkerRuntimePilotPlan } from './new-core-support-marker-runtime-pilot.js';
import { summarizeRvmPilotDecodedCounts, writeRvmPilotPackageBytes } from './rvm-pilot-byte-writer.js';

const SCOPE = 'pipe-bend-flange-valve-support-marker-subset';
const OPTIONS = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true };

export async function generateBrowserSupportMarkerPilotExport(state, options) {
  const errors = optionErrors(object(options));
  if (errors.length) return blockedResult(errors);
  try {
    const pipeline = await resolvePipelineState(state, object(options));
    const plan = buildNewCoreSupportMarkerRuntimePilotPlan(pipeline, OPTIONS);
    const artifact = await generateArtifact(plan);
    const audit = buildNewCoreSupportMarkerRuntimePilotAudit(plan, artifact, {});
    return buildSupportMarkerPilotDownloadBundle(artifact, audit, object(options));
  } catch (error) {
    return blockedResult([error?.message || String(error)]);
  }
}

export function buildSupportMarkerPilotDownloadBundle(artifact, audit, options) {
  const basename = object(options).basename || 'BM_CII_pipe_bend_flange_valve_support_marker_runtime_pilot';
  return { schema: 'BrowserSupportMarkerPilotDownloadBundle.v1', rvmFile: { filename: `${basename}.rvm`, mimeType: 'application/octet-stream', bytes: artifact.bytes }, attFile: { filename: `${basename}.att`, mimeType: 'text/plain', text: artifact.attText }, auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
}

async function generateArtifact(plan) {
  if (!plan.subsetReady) return blockedArtifact(plan);
  const bytes = writeRvmPilotPackageBytes(plan, { headerLabel: 'phase-17-browser-support-marker-pilot', phaseLabel: 'Phase17', modelName: 'SUPPORT_MARKER_BROWSER_PILOT', groupName: 'BROWSER_SUPPORT_MARKER_PILOT' });
  const attText = writeValvePilotAttText(plan);
  return { schema: 'BrowserSupportMarkerPilotArtifact.v1', artifactGenerated: true, artifactKind: 'rvm-att-package', bytes, attText, rvmByteLength: bytes.byteLength, attByteLength: new TextEncoder().encode(attText).byteLength, checksumSha256: await sha256Hex(bytes), ...summarizeRvmPilotDecodedCounts(plan), attRowCount: plan.plannedAttRowCount, attRowsMatchRvmPrimitives: plan.attRowsMatchRvmPrimitives, supportMarkerCount: plan.supportMarkerCount, blockedSupportMarkerCount: plan.blockedSupportMarkerCount, supportPrimitiveCount: plan.supportPrimitiveCount, supportCylinderPrimitiveCount: plan.supportCylinderPrimitiveCount, supportSpherePrimitiveCount: plan.supportSpherePrimitiveCount, sourceTrace: plan.sourceTrace };
}

function blockedResult(errors) {
  const audit = { schema: 'NewCoreSupportMarkerRuntimePilotAudit.v1', ok: false, scope: SCOPE, artifactGenerated: false, supportMarkerCount: 0, blockedSupportMarkerCount: 0, errors, warnings: [] };
  return { schema: 'BrowserSupportMarkerPilotDownloadBundle.v1', rvmFile: null, attFile: null, auditFile: { filename: 'BM_CII_pipe_bend_flange_valve_support_marker_runtime_pilot.audit.json', mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
}

function blockedArtifact(plan) {
  return { schema: 'BrowserSupportMarkerPilotArtifact.v1', artifactGenerated: false, artifactKind: 'rvm-att-package', bytes: new Uint8Array(), attText: '', rvmByteLength: 0, attByteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, supportMarkerCount: Number(plan?.supportMarkerCount || 0), blockedSupportMarkerCount: Number(plan?.blockedSupportMarkerCount || 0), sourceTrace: [], errors: plan.errors };
}

function optionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, includeSupportMarkers: true, userGestureConfirmed: true, browserDownload: true };
  const errors = [];
  for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`);
  return errors;
}

async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return '0'.repeat(64);
}

function object(value) { return value && typeof value === 'object' ? value : {}; }

const CATALOGUE_PATHS = Object.freeze(['catalogues/base-piping/items/pipe-straight-4in-std.json', 'catalogues/base-piping/items/support-rest-generic.json', 'catalogues/base-piping/items/elbow-bend-45-114mm-6mm.json', 'catalogues/base-piping/items/elbow-bend-45-88mm-55mm.json', 'catalogues/base-piping/items/elbow-bend-45-60mm-39mm.json', 'catalogues/base-piping/items/flange-weld-neck-114mm-6mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-88mm-55mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-60mm-39mm-class150-rf.json']);

async function resolvePipelineState(state, options) {
  // If the state already has a compiled RvmExportModel, use it directly (fast path)
  const candidates = [state?.rvmExportModel, state?.exportModels?.rvmExportModel, state?.artifact?.exportModel, state?.exportModel];
  const existing = candidates.find((c) => c?.schema === 'RvmExportModel.v1') || null;
  if (existing) {
    const attExportModel = state?.attExportModel || state?.exportModels?.attExportModel || state?.artifact?.attExportModel || null;
    return { rvmExportModel: existing, attExportModel, graph: state?.graph || graphFromState(state) };
  }
  // For support-only exports, just parse the plant graph from sourceText.
  // The support marker plan reads supports from graph.items — no RVM needed.
  if (state?.sourceText) {
    const graph = graphFromState(state);
    return { rvmExportModel: null, attExportModel: null, graph, resolvedGeometry: null, primitiveModel: null };
  }
  throw new Error('no managed-stage/new-core input loaded');
}

async function buildPipelineFromSourceText(state, options) {
  const graph = graphFromState(state);
  const catalogueItems = options.catalogueItems || await loadCatalogueItems(options.fetchImpl || globalThis.fetch);
  const bindingAudit = auditCatalogueBinding(graph, catalogueItems);
  const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
  const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
  const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
  const primitiveAudit = buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit);
  return { ...compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit), graph, resolvedGeometry, primitiveModel };
}

function graphFromState(state) {
  if (!state?.sourceText) return null;
  return convertManagedStageJsonToPlantGraph(state.sourceText, { sourceName: state.sourceName || 'managed-stage.json', phase: 'Phase 17 browser support marker pilot' });
}

async function loadCatalogueItems(fetchImpl) {
  const items = [];
  for (const path of CATALOGUE_PATHS) {
    const response = await fetchImpl(path);
    if (response.ok) items.push(await response.json());
  }
  return items;
}
