import { auditCatalogueBinding } from '../catalogue/catalogue-binder.js';
import { compileResolvedPrimitiveModelToExportModels } from '../export-models/export-model-compilers.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../geometry/geometry-solver.js';
import { convertManagedStageJsonToPlantGraph } from '../importers/managed-stage-to-plant-graph.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../primitives/primitive-compiler.js';
import { writeValvePilotAttText } from './new-core-valve-att-writer.js';
import { buildNewCoreValveRuntimePilotAudit } from './new-core-valve-runtime-audit.js';
import { buildNewCoreValveRuntimePilotPlan } from './new-core-valve-runtime-pilot.js';
import { summarizeRvmPilotDecodedCounts, writeRvmPilotPackageBytes } from './rvm-pilot-byte-writer.js';

const SCHEMA = 'BrowserPipeBendFlangeValvePilotExportAudit.v1';
const SCOPE = 'pipe-bend-flange-valve-subset';
const OPTIONS = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true };
const CATALOGUE_PATHS = Object.freeze(['catalogues/base-piping/items/pipe-straight-4in-std.json', 'catalogues/base-piping/items/support-rest-generic.json', 'catalogues/base-piping/items/elbow-bend-45-114mm-6mm.json', 'catalogues/base-piping/items/elbow-bend-45-88mm-55mm.json', 'catalogues/base-piping/items/elbow-bend-45-60mm-39mm.json', 'catalogues/base-piping/items/flange-weld-neck-114mm-6mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-88mm-55mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-60mm-39mm-class150-rf.json']);

export async function generateBrowserValvePilotExport(state, options) {
  const optionErrors = browserOptionErrors(object(options));
  if (optionErrors.length) return blockedResult(optionErrors);
  try {
    const pipeline = await resolvePipelineState(state, object(options));
    const plan = buildNewCoreValveRuntimePilotPlan(pipeline, OPTIONS);
    const artifact = await generateArtifact(plan);
    const runtimeAudit = buildNewCoreValveRuntimePilotAudit(plan, artifact, {});
    const audit = browserAudit(plan, artifact, runtimeAudit, []);
    return buildValvePilotDownloadBundle(artifact, audit, object(options));
  } catch (error) {
    return blockedResult([error instanceof Error ? error.message : String(error)]);
  }
}

export function buildValvePilotDownloadBundle(artifact, audit, options) {
  const basename = object(options).basename || 'BM_CII_pipe_bend_flange_valve_runtime_pilot';
  const result = { schema: 'BrowserPipeBendFlangeValvePilotDownloadBundle.v1', rvmFile: { filename: `${basename}.rvm`, mimeType: 'application/octet-stream', bytes: artifact.bytes }, attFile: { filename: `${basename}.att`, mimeType: 'text/plain', text: artifact.attText }, auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
  return assertBrowserValvePilotBoundary(result);
}

export function assertBrowserValvePilotBoundary(result) {
  const errors = [];
  if (!result?.rvmFile?.bytes || !(result.rvmFile.bytes instanceof Uint8Array)) errors.push('rvmFile.bytes must be Uint8Array');
  if (!result?.attFile?.text || typeof result.attFile.text !== 'string') errors.push('attFile.text is required');
  if (!result?.auditFile?.text || typeof result.auditFile.text !== 'string') errors.push('auditFile.text is required');
  for (const key of ['canvasTouched', 'threeGeometryCreated', 'cacheKeyMutated']) if (result?.audit?.[key] !== false) errors.push(`${key} must be false`);
  if (errors.length) throw new Error(`Browser Pipe+Bend+Flange+Valve pilot boundary invalid: ${errors.join('; ')}`);
  return result;
}

async function resolvePipelineState(state, options) {
  const existing = state?.rvmExportModel || state?.exportModels?.rvmExportModel || state?.artifact?.exportModel || (state?.exportModel?.schema === 'RvmExportModel.v1' ? state.exportModel : null);
  const attExportModel = state?.attExportModel || state?.exportModels?.attExportModel || state?.artifact?.attExportModel || null;
  if (existing) return { rvmExportModel: existing, attExportModel, graph: state?.graph || graphFromState(state) };
  if (!state?.sourceText) throw new Error('no managed-stage/new-core input loaded');
  return buildPipelineFromSourceText(state, options);
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
  return convertManagedStageJsonToPlantGraph(state.sourceText, { sourceName: state.sourceName || 'managed-stage.json', phase: 'Phase 16 browser pipe+bend+flange+valve pilot' });
}

async function generateArtifact(plan) {
  if (!plan.subsetReady) return blockedArtifact(plan);
  const bytes = writeRvmPilotPackageBytes(plan, { headerLabel: 'phase-16-browser-pipe-bend-flange-valve-pilot', phaseLabel: 'Phase16', modelName: 'PIPE_BEND_FLANGE_VALVE_BROWSER_PILOT', groupName: 'BROWSER_PIPE_BEND_FLANGE_VALVE_PILOT' });
  const attText = writeValvePilotAttText(plan);
  const checksumSha256 = await sha256Hex(bytes);
  return { schema: 'BrowserPipeBendFlangeValvePilotArtifact.v1', artifactGenerated: true, artifactKind: 'rvm-att-package', bytes, attText, byteLength: bytes.byteLength, rvmByteLength: bytes.byteLength, attByteLength: new TextEncoder().encode(attText).byteLength, checksumSha256, ...summarizeRvmPilotDecodedCounts(plan), attRowCount: plan.plannedAttRowCount, attRowsMatchRvmPrimitives: plan.attRowsMatchRvmPrimitives, sourceTrace: plan.sourceTrace };
}

function browserAudit(plan, artifact, runtimeAudit, extraErrors) {
  const errors = [...(runtimeAudit.errors || []), ...extraErrors];
  const warnings = runtimeAudit.warnings || [];
  const audit = { schema: SCHEMA, ok: false, mode: 'explicit-runtime-pilot', scope: SCOPE, userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: artifact.artifactGenerated === true, rvmDownloadPrepared: artifact.artifactGenerated === true, attDownloadPrepared: artifact.artifactGenerated === true, auditDownloadPrepared: artifact.artifactGenerated === true, plannedCylinderCount: runtimeAudit.plannedCylinderCount, plannedTorusCount: runtimeAudit.plannedTorusCount, plannedFlangeCylinderCount: runtimeAudit.plannedFlangeCylinderCount, plannedValveBodyCount: runtimeAudit.plannedValveBodyCount, generatedValveCount: runtimeAudit.generatedValveCount, blockedValveCount: runtimeAudit.blockedValveCount, plannedRvmPrimitiveCount: runtimeAudit.plannedRvmPrimitiveCount, decodedCylinderCount: runtimeAudit.decodedCylinderCount, decodedTorusCount: runtimeAudit.decodedTorusCount, decodedFlangeCylinderCount: runtimeAudit.decodedFlangeCylinderCount, decodedValveBodyCount: runtimeAudit.decodedValveBodyCount, decodedPrimitiveCount: runtimeAudit.decodedPrimitiveCount, attRowCount: runtimeAudit.attRowCount, attRowsMatchRvmPrimitives: runtimeAudit.attRowsMatchRvmPrimitives, deferredSupportCount: runtimeAudit.deferredSupportCount, fullModelReady: false, subsetReady: plan.subsetReady === true, valveFallbackCount: runtimeAudit.valveFallbackCount, guessedValveDimensionCount: runtimeAudit.guessedValveDimensionCount, warningCount: warnings.length, hardErrorCount: errors.length, warnings, errors };
  audit.ok = audit.artifactGenerated && audit.rvmDownloadPrepared && audit.attDownloadPrepared && audit.auditDownloadPrepared && audit.hardErrorCount === 0 && audit.decodedPrimitiveCount === audit.plannedRvmPrimitiveCount && audit.attRowCount === audit.plannedRvmPrimitiveCount && audit.fullModelReady === false && audit.valveFallbackCount === 0 && audit.guessedValveDimensionCount === 0;
  return audit;
}

function blockedResult(errors) {
  const audit = browserAudit({ subsetReady: false }, blockedArtifact({ errors }), emptyRuntimeAudit(errors), errors);
  return { schema: 'BrowserPipeBendFlangeValvePilotDownloadBundle.v1', rvmFile: null, attFile: null, auditFile: { filename: 'BM_CII_pipe_bend_flange_valve_runtime_pilot.audit.json', mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
}

function blockedArtifact(plan) {
  return { schema: 'BrowserPipeBendFlangeValvePilotArtifact.v1', artifactGenerated: false, artifactKind: 'rvm-att-package', bytes: new Uint8Array(), attText: '', rvmByteLength: 0, attByteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedValveBodyCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, sourceTrace: [], errors: plan.errors };
}

function emptyRuntimeAudit(errors) {
  return { plannedCylinderCount: 0, plannedTorusCount: 0, plannedFlangeCylinderCount: 0, plannedValveBodyCount: 0, generatedValveCount: 0, blockedValveCount: 0, plannedRvmPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedValveBodyCount: 0, decodedPrimitiveCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, deferredSupportCount: 0, valveFallbackCount: 0, guessedValveDimensionCount: 0, warnings: [], errors };
}

function browserOptionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, userGestureConfirmed: true, browserDownload: true };
  const errors = [];
  for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`);
  for (const key of ['canvasMutation', 'appStateMutation', 'automatic', 'background']) if (options[key] === true) errors.push(`${key} is forbidden`);
  return errors;
}

async function loadCatalogueItems(fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new Error('catalogue fetch is unavailable');
  const items = [];
  for (const path of CATALOGUE_PATHS) {
    const response = await fetchImpl(`./${path}`);
    if (!response.ok) throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
    items.push(await response.json());
  }
  return items;
}

async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return fallbackHash(bytes);
}

function fallbackHash(bytes) {
  let h = 2166136261;
  for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0;
  return String(h.toString(16).padStart(8, '0')).repeat(8).slice(0, 64);
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
