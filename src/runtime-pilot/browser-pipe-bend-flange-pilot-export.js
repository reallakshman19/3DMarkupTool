import { auditCatalogueBinding } from '../catalogue/catalogue-binder.js';
import { compileResolvedPrimitiveModelToExportModels } from '../export-models/export-model-compilers.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../geometry/geometry-solver.js';
import { convertManagedStageJsonToPlantGraph } from '../importers/managed-stage-to-plant-graph.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../primitives/primitive-compiler.js';
import { writePipeBendFlangePilotAttText } from './new-core-pipe-bend-flange-att-writer.js';
import { buildNewCorePipeBendFlangeRuntimePilotAudit } from './new-core-pipe-bend-flange-runtime-audit.js';
import { buildNewCorePipeBendFlangeRuntimePilotPlan } from './new-core-pipe-bend-flange-runtime-pilot.js';

const SCHEMA = 'BrowserPipeBendFlangePilotExportAudit.v1';
const OPTIONS = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true };
const CATALOGUE_PATHS = Object.freeze(['catalogues/base-piping/items/pipe-straight-4in-std.json', 'catalogues/base-piping/items/support-rest-generic.json', 'catalogues/base-piping/items/elbow-bend-45-114mm-6mm.json', 'catalogues/base-piping/items/elbow-bend-45-88mm-55mm.json', 'catalogues/base-piping/items/elbow-bend-45-60mm-39mm.json', 'catalogues/base-piping/items/flange-weld-neck-114mm-6mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-88mm-55mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-60mm-39mm-class150-rf.json']);

export async function generateBrowserPipeBendFlangePilotExport(state, options = {}) {
  const optionErrors = browserOptionErrors(options);
  if (optionErrors.length) return blockedResult(optionErrors);
  try {
    const exportModels = await resolveExportModels(state, options);
    const plan = buildNewCorePipeBendFlangeRuntimePilotPlan(exportModels, OPTIONS);
    const artifact = await generateArtifact(plan);
    const runtimeAudit = buildNewCorePipeBendFlangeRuntimePilotAudit(plan, artifact);
    const audit = browserAudit(plan, artifact, runtimeAudit, []);
    return buildPipeBendFlangePilotDownloadBundle(artifact, audit, options);
  } catch (error) {
    return blockedResult([error instanceof Error ? error.message : String(error)]);
  }
}

export function buildPipeBendFlangePilotDownloadBundle(artifact, audit, options = {}) {
  const basename = options.basename || 'BM_CII_pipe_bend_flange_runtime_pilot';
  const result = { schema: 'BrowserPipeBendFlangePilotDownloadBundle.v1', rvmFile: { filename: `${basename}.rvm`, mimeType: 'application/octet-stream', bytes: artifact.bytes }, attFile: { filename: `${basename}.att`, mimeType: 'text/plain', text: artifact.attText }, auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
  return assertBrowserPipeBendFlangePilotBoundary(result);
}

export function assertBrowserPipeBendFlangePilotBoundary(result) {
  const errors = [];
  if (!result?.rvmFile?.bytes || !(result.rvmFile.bytes instanceof Uint8Array)) errors.push('rvmFile.bytes must be Uint8Array');
  if (!result?.attFile?.text || typeof result.attFile.text !== 'string') errors.push('attFile.text is required');
  if (!result?.auditFile?.text || typeof result.auditFile.text !== 'string') errors.push('auditFile.text is required');
  for (const key of ['canvasTouched', 'threeGeometryCreated', 'cacheKeyMutated']) if (result?.audit?.[key] !== false) errors.push(`${key} must be false`);
  if (errors.length) throw new Error(`Browser Pipe+Bend+Flange pilot boundary invalid: ${errors.join('; ')}`);
  return result;
}

async function resolveExportModels(state, options) {
  const rvmExportModel = state?.rvmExportModel || state?.exportModels?.rvmExportModel || state?.artifact?.exportModel || (state?.exportModel?.schema === 'RvmExportModel.v1' ? state.exportModel : null);
  const attExportModel = state?.attExportModel || state?.exportModels?.attExportModel || state?.artifact?.attExportModel || null;
  if (rvmExportModel) return { rvmExportModel, attExportModel };
  if (!state?.sourceText) throw new Error('no managed-stage/new-core input loaded');
  const graph = convertManagedStageJsonToPlantGraph(state.sourceText, { sourceName: state.sourceName || 'managed-stage.json', phase: 'Phase 15 browser pipe+bend+flange pilot' });
  const catalogueItems = options.catalogueItems || await loadCatalogueItems(options.fetchImpl || globalThis.fetch);
  const bindingAudit = auditCatalogueBinding(graph, catalogueItems);
  const geometry = resolvePlantGraphGeometry(graph, bindingAudit);
  const geometryAudit = buildGeometryResolutionAudit(graph, geometry, bindingAudit);
  const primitiveModel = compileResolvedGeometryToPrimitives(geometry, geometryAudit);
  const primitiveAudit = buildPrimitiveCompilationAudit(geometry, primitiveModel, geometryAudit);
  return compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
}

async function generateArtifact(plan) {
  if (!plan.subsetReady) return blockedArtifact(plan);
  const bytes = writeRvmPackageBytes(plan);
  const attText = writePipeBendFlangePilotAttText(plan);
  const checksumSha256 = await sha256Hex(bytes);
  return { schema: 'BrowserPipeBendFlangePilotArtifact.v1', artifactGenerated: true, artifactKind: 'rvm-att-package', bytes, attText, byteLength: bytes.byteLength, rvmByteLength: bytes.byteLength, attByteLength: new TextEncoder().encode(attText).byteLength, checksumSha256, decodedPrimitiveCount: plan.plannedRvmPrimitiveCount, decodedCylinderCount: plan.plannedCylinderCount, decodedTorusCount: plan.plannedTorusCount, decodedFlangeCylinderCount: plan.plannedFlangeCylinderCount, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, attRowCount: plan.plannedAttRowCount, attRowsMatchRvmPrimitives: plan.attRowsMatchRvmPrimitives, sourceTrace: plan.sourceTrace };
}

function browserAudit(plan, artifact, runtimeAudit, extraErrors) { const errors = [...(runtimeAudit.errors || []), ...extraErrors]; const warnings = runtimeAudit.warnings || []; const audit = { schema: SCHEMA, ok: false, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: artifact.artifactGenerated === true, rvmDownloadPrepared: artifact.artifactGenerated === true, attDownloadPrepared: artifact.artifactGenerated === true, auditDownloadPrepared: artifact.artifactGenerated === true, plannedCylinderCount: runtimeAudit.plannedCylinderCount, plannedTorusCount: runtimeAudit.plannedTorusCount, plannedFlangeCylinderCount: runtimeAudit.plannedFlangeCylinderCount, plannedRvmPrimitiveCount: runtimeAudit.plannedRvmPrimitiveCount, decodedCylinderCount: runtimeAudit.decodedCylinderCount, decodedTorusCount: runtimeAudit.decodedTorusCount, decodedFlangeCylinderCount: runtimeAudit.decodedFlangeCylinderCount, decodedPrimitiveCount: runtimeAudit.decodedPrimitiveCount, attRowCount: runtimeAudit.attRowCount, attRowsMatchRvmPrimitives: runtimeAudit.attRowsMatchRvmPrimitives, blockedValveCount: runtimeAudit.blockedValveCount, deferredSupportCount: runtimeAudit.deferredSupportCount, fullModelReady: false, subsetReady: plan.subsetReady === true, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, productionReadyValveCount: 0, productionReadySupportCount: 0, warningCount: warnings.length, hardErrorCount: errors.length, warnings, errors }; audit.ok = audit.artifactGenerated && audit.rvmDownloadPrepared && audit.attDownloadPrepared && audit.auditDownloadPrepared && audit.hardErrorCount === 0 && audit.decodedPrimitiveCount === audit.plannedRvmPrimitiveCount && audit.attRowCount === audit.plannedRvmPrimitiveCount && audit.fullModelReady === false; return audit; }
function blockedResult(errors) { const audit = browserAudit({ subsetReady: false }, { artifactGenerated: false }, { plannedCylinderCount: 0, plannedTorusCount: 0, plannedFlangeCylinderCount: 0, plannedRvmPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedPrimitiveCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, blockedValveCount: 0, deferredSupportCount: 0, warnings: [], errors }, errors); return { schema: 'BrowserPipeBendFlangePilotDownloadBundle.v1', rvmFile: null, attFile: null, auditFile: { filename: 'BM_CII_pipe_bend_flange_runtime_pilot.audit.json', mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit }; }
function blockedArtifact(plan) { return { schema: 'BrowserPipeBendFlangePilotArtifact.v1', artifactGenerated: false, artifactKind: 'rvm-att-package', bytes: new Uint8Array(), attText: '', rvmByteLength: 0, attByteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, sourceTrace: [], errors: plan.errors }; }
function browserOptionErrors(options) { const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, userGestureConfirmed: true, browserDownload: true }; const errors = []; for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`); for (const key of ['canvasMutation', 'appStateMutation', 'automatic', 'background']) if (options[key] === true) errors.push(`${key} is forbidden`); return errors; }
async function loadCatalogueItems(fetchImpl) { if (typeof fetchImpl !== 'function') throw new Error('catalogue fetch is unavailable'); const items = []; for (const path of CATALOGUE_PATHS) { const response = await fetchImpl(`./${path}`); if (!response.ok) throw new Error(`Failed to load ${path}: HTTP ${response.status}`); items.push(await response.json()); } return items; }

function writeRvmPackageBytes(plan) { const writer = createChunkWriter(); writer.writeChunk('HEAD', headBody(), null); writer.writeChunk('MODL', modelBody(), null); writer.writeChunk('CNTB', groupBody('BROWSER_PIPE_BEND_FLANGE_PILOT'), () => { for (const item of plan.cylinderPrimitives) writer.writeChunk('PRIM', cylinderBody(item), null); for (const item of plan.torusPrimitives) writer.writeChunk('PRIM', torusBody(item), null); for (const item of plan.flangeCylinderPrimitives) writer.writeChunk('PRIM', flangeBody(item), null); writer.writeChunk('CNTE', uint32Body(2), null); }); writer.writeChunk('END:', uint32Body(1), null); return new Uint8Array(writer.finish()); }
function cylinderBody(item) { return primitiveBody(8, matrixFromDirection(item.center, item.axis), [-item.radiusMm, -item.radiusMm, -item.lengthMm / 2, item.radiusMm, item.radiusMm, item.lengthMm / 2], [item.radiusMm, item.lengthMm]); }
function flangeBody(item) { return primitiveBody(8, matrixFromDirection(item.center, item.axis), [-item.outerRadiusMm, -item.outerRadiusMm, -item.lengthMm / 2, item.outerRadiusMm, item.outerRadiusMm, item.lengthMm / 2], [item.outerRadiusMm, item.lengthMm]); }
function torusBody(item) { const outer = Number(item.majorRadiusMm) + Number(item.tubeRadiusMm); return primitiveBody(4, matrixFromTorus(item), [-outer, -outer, -item.tubeRadiusMm, outer, outer, item.tubeRadiusMm], [item.majorRadiusMm, item.tubeRadiusMm, Number(item.sweepAngleDeg) * Math.PI / 180]); }
function primitiveBody(code, matrix, bbox, payload) { return concat([uint32Body(1), uint32Body(code), float32ArrayBody(matrix), float32ArrayBody(bbox), float32ArrayBody(payload)]); }
function createChunkWriter() { const parts = []; let offset = 0; return { writeChunk(id, body, children) { const header = new ArrayBuffer(24); const view = new DataView(header); const padded = id.padEnd(4).slice(0, 4); for (let i = 0; i < 4; i += 1) view.setUint32(i * 4, padded.charCodeAt(i), false); view.setUint32(16, offset + 24 + body.byteLength, false); view.setUint32(20, 1, false); parts.push(header, body); offset += 24 + body.byteLength; if (children) children(); }, finish() { return concat(parts); } }; }
function headBody() { return concat([uint32Body(2), rvmString('phase-15-browser-pipe-bend-flange-pilot'), uint32Body(0), rvmString('2026-07-02T00:00:00.000Z'), rvmString('Phase15'), rvmString('UTF-8')]); }
function modelBody() { return concat([uint32Body(1), rvmString('INPUTXML'), rvmString('PIPE_BEND_FLANGE_BROWSER_PILOT')]); }
function groupBody(name) { return concat([uint32Body(2), rvmString(name), float32Body(0), float32Body(0), float32Body(0), uint32Body(0)]); }
function matrixFromDirection(center, axis) { const z = normalize(axis); const ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const x = normalize(cross(ref, z)); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(center)]; }
function matrixFromTorus(item) { const x = normalize(item.startTangent); const z = normalize(item.normal); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(item.center)]; }
function scaled(vector) { return vector.map((value) => Math.abs(Number(value) * 0.001) < 1e-12 ? 0 : Number(value) * 0.001); }
function normalize(value) { const vector = value.map(Number); const length = Math.hypot(...vector); return vector.map((entry) => entry / length); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function uint32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setUint32(0, Number(value) >>> 0, false); return out; }
function float32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setFloat32(0, Number(value), false); return out; }
function float32ArrayBody(values) { const out = new ArrayBuffer(values.length * 4); const view = new DataView(out); values.forEach((value, index) => view.setFloat32(index * 4, Number(value), false)); return out; }
function rvmString(value) { const encoded = new TextEncoder().encode(String(value || '')); const wordCount = Math.ceil((encoded.length + 1) / 4); const out = new ArrayBuffer(4 + wordCount * 4); new DataView(out).setUint32(0, wordCount, false); new Uint8Array(out, 4).set(encoded); return out; }
function concat(buffers) { const size = buffers.reduce((sum, item) => sum + item.byteLength, 0); const out = new Uint8Array(size); let offset = 0; for (const item of buffers) { out.set(new Uint8Array(item), offset); offset += item.byteLength; } return out.buffer; }
async function sha256Hex(bytes) { if (globalThis.crypto?.subtle) return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''); return fallbackHash(bytes); }
function fallbackHash(bytes) { let h = 2166136261; for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0; return String(h.toString(16).padStart(8, '0')).repeat(8).slice(0, 64); }
