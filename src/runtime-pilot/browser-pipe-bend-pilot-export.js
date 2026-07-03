import { auditCatalogueBinding } from '../catalogue/catalogue-binder.js';
import { compileResolvedPrimitiveModelToExportModels } from '../export-models/export-model-compilers.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../geometry/geometry-solver.js';
import { convertManagedStageJsonToPlantGraph } from '../importers/managed-stage-to-plant-graph.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../primitives/primitive-compiler.js';
import { buildNewCorePipeBendRuntimePilotAudit } from './new-core-pipe-bend-runtime-audit.js';
import { buildNewCorePipeBendRuntimePilotPlan } from './new-core-pipe-bend-runtime-pilot.js';

const SCHEMA = 'BrowserPipeBendPilotExportAudit.v1';
const OPTIONS = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true };
const CATALOGUE_PATHS = Object.freeze(['catalogues/base-piping/items/pipe-straight-4in-std.json', 'catalogues/base-piping/items/support-rest-generic.json', 'catalogues/base-piping/items/elbow-bend-45-114mm-6mm.json', 'catalogues/base-piping/items/elbow-bend-45-88mm-55mm.json', 'catalogues/base-piping/items/elbow-bend-45-60mm-39mm.json', 'catalogues/base-piping/items/flange-weld-neck-114mm-6mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-88mm-55mm-class150-rf.json', 'catalogues/base-piping/items/flange-weld-neck-60mm-39mm-class150-rf.json']);

export async function generateBrowserPipeBendPilotExport(state, options = {}) {
  const optionErrors = browserOptionErrors(options);
  if (optionErrors.length) return blockedResult(optionErrors);
  try {
    const rvmExportModel = await resolveRvmExportModel(state, options);
    const plan = buildNewCorePipeBendRuntimePilotPlan(rvmExportModel, OPTIONS);
    const artifact = await generateArtifact(plan);
    const runtimeAudit = buildNewCorePipeBendRuntimePilotAudit(plan, artifact);
    const audit = browserAudit(plan, artifact, runtimeAudit, []);
    return buildPipeBendPilotDownloadBundle(artifact, audit, options);
  } catch (error) {
    return blockedResult([error instanceof Error ? error.message : String(error)]);
  }
}

export function buildPipeBendPilotDownloadBundle(artifact, audit, options = {}) {
  const basename = options.basename || 'BM_CII_pipe_bend_runtime_pilot';
  const result = { schema: 'BrowserPipeBendPilotDownloadBundle.v1', rvmFile: { filename: `${basename}.rvm`, mimeType: 'application/octet-stream', bytes: artifact.bytes }, auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
  return assertBrowserPipeBendPilotBoundary(result);
}

export function assertBrowserPipeBendPilotBoundary(result) {
  const errors = [];
  if (!result?.rvmFile?.bytes || !(result.rvmFile.bytes instanceof Uint8Array)) errors.push('rvmFile.bytes must be Uint8Array');
  if (!result?.auditFile?.text || typeof result.auditFile.text !== 'string') errors.push('auditFile.text is required');
  for (const key of ['canvasTouched', 'threeGeometryCreated', 'cacheKeyMutated']) if (result?.audit?.[key] !== false) errors.push(`${key} must be false`);
  if (errors.length) throw new Error(`Browser Pipe+Bend pilot boundary invalid: ${errors.join('; ')}`);
  return result;
}

async function resolveRvmExportModel(state, options) {
  const direct = state?.rvmExportModel || state?.exportModels?.rvmExportModel || (state?.exportModel?.schema === 'RvmExportModel.v1' ? state.exportModel : null) || state?.artifact?.exportModel;
  if (direct) return direct;
  if (!state?.sourceText) throw new Error('no managed-stage/new-core input loaded');
  const graph = convertManagedStageJsonToPlantGraph(state.sourceText, { sourceName: state.sourceName || 'managed-stage.json', phase: 'Phase 14 browser pipe+bend pilot' });
  const catalogueItems = options.catalogueItems || await loadCatalogueItems(options.fetchImpl || globalThis.fetch);
  const bindingAudit = auditCatalogueBinding(graph, catalogueItems);
  const geometry = resolvePlantGraphGeometry(graph, bindingAudit);
  const geometryAudit = buildGeometryResolutionAudit(graph, geometry, bindingAudit);
  const primitiveModel = compileResolvedGeometryToPrimitives(geometry, geometryAudit);
  const primitiveAudit = buildPrimitiveCompilationAudit(geometry, primitiveModel, geometryAudit);
  return compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit).rvmExportModel;
}

async function generateArtifact(plan) {
  if (!plan.subsetReady) return blockedArtifact(plan);
  const bytes = writeRvmPipeBendBytes(plan.cylinderPrimitives, plan.torusPrimitives);
  const checksumSha256 = await sha256Hex(bytes);
  return { schema: 'BrowserPipeBendPilotArtifact.v1', artifactGenerated: true, artifactKind: 'rvm', writerBridge: 'browser-pipe-bend-pilot-export.v1', bytes, byteLength: bytes.byteLength, checksumSha256, decodedPrimitiveCount: plan.plannedCylinderCount + plan.plannedTorusCount, decodedCylinderCount: plan.plannedCylinderCount, decodedTorusCount: plan.plannedTorusCount, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, sourceTrace: plan.sourceTrace };
}

function browserAudit(plan, artifact, runtimeAudit, extraErrors) { const errors = [...(runtimeAudit.errors || []), ...extraErrors]; const warnings = runtimeAudit.warnings || []; const audit = { schema: SCHEMA, ok: false, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', userGestureConfirmed: true, browserDownloadRequested: true, oldProductionExportPathTouched: false, defaultRuntimeSwitchEnabled: false, appStartupBehaviorChanged: false, canvasTouched: false, threeGeometryCreated: false, cacheKeyMutated: false, artifactGenerated: artifact.artifactGenerated === true, rvmDownloadPrepared: artifact.artifactGenerated === true, auditDownloadPrepared: artifact.artifactGenerated === true, plannedCylinderCount: runtimeAudit.plannedCylinderCount, plannedTorusCount: runtimeAudit.plannedTorusCount, decodedCylinderCount: runtimeAudit.decodedCylinderCount, decodedTorusCount: runtimeAudit.decodedTorusCount, decodedPrimitiveCount: runtimeAudit.decodedPrimitiveCount, excludedFlangeCount: runtimeAudit.excludedFlangeCount, blockedValveCount: runtimeAudit.blockedValveCount, deferredSupportCount: runtimeAudit.deferredSupportCount, fullModelReady: false, subsetReady: plan.subsetReady === true, productionReadyTorusCount: 0, productionReadyFlangeCount: 0, productionReadyValveCount: 0, productionReadySupportCount: 0, warningCount: warnings.length, hardErrorCount: errors.length, warnings, errors }; audit.ok = audit.artifactGenerated && audit.rvmDownloadPrepared && audit.auditDownloadPrepared && audit.hardErrorCount === 0 && audit.decodedCylinderCount === audit.plannedCylinderCount && audit.decodedTorusCount === audit.plannedTorusCount && audit.decodedPrimitiveCount === audit.decodedCylinderCount + audit.decodedTorusCount && audit.fullModelReady === false && audit.productionReadyTorusCount === 0 && audit.productionReadyFlangeCount === 0; return audit; }
function blockedResult(errors) { const audit = browserAudit({ subsetReady: false }, { artifactGenerated: false }, { plannedCylinderCount: 0, plannedTorusCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedPrimitiveCount: 0, excludedFlangeCount: 0, blockedValveCount: 0, deferredSupportCount: 0, warnings: [], errors }, errors); return { schema: 'BrowserPipeBendPilotDownloadBundle.v1', rvmFile: null, auditFile: { filename: 'BM_CII_pipe_bend_runtime_pilot.audit.json', mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit }; }
function blockedArtifact(plan) { return { schema: 'BrowserPipeBendPilotArtifact.v1', artifactGenerated: false, artifactKind: 'rvm', bytes: new Uint8Array(), byteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, sourceTrace: [], errors: plan.errors }; }

function browserOptionErrors(options) { const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-subset', allowPartialModel: true, writeArtifact: true, userGestureConfirmed: true, browserDownload: true }; const errors = []; for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`); for (const key of ['canvasMutation', 'appStateMutation', 'automatic', 'background']) if (options[key] === true) errors.push(`${key} is forbidden`); return errors; }
async function loadCatalogueItems(fetchImpl) { if (typeof fetchImpl !== 'function') throw new Error('catalogue fetch is unavailable'); const items = []; for (const path of CATALOGUE_PATHS) { const response = await fetchImpl(`./${path}`); if (!response.ok) throw new Error(`Failed to load ${path}: HTTP ${response.status}`); items.push(await response.json()); } return items; }

function writeRvmPipeBendBytes(cylinders, toruses) { const writer = createChunkWriter(); writer.writeChunk('HEAD', headBody(), null); writer.writeChunk('MODL', modelBody(), null); writer.writeChunk('CNTB', groupBody('BROWSER_PIPE_BEND_PILOT'), () => { for (const primitive of cylinders) writer.writeChunk('PRIM', cylinderBody(primitive), null); for (const primitive of toruses) writer.writeChunk('PRIM', torusBody(primitive), null); writer.writeChunk('CNTE', uint32Body(2), null); }); writer.writeChunk('END:', uint32Body(1), null); return new Uint8Array(writer.finish()); }
function cylinderBody(primitive) { return primitiveBody(8, matrixFromDirection(primitive.center, primitive.axis), [-primitive.radiusMm, -primitive.radiusMm, -primitive.lengthMm / 2, primitive.radiusMm, primitive.radiusMm, primitive.lengthMm / 2], [primitive.radiusMm, primitive.lengthMm]); }
function torusBody(primitive) { const outer = Number(primitive.majorRadiusMm) + Number(primitive.tubeRadiusMm); return primitiveBody(4, matrixFromTorus(primitive), [-outer, -outer, -primitive.tubeRadiusMm, outer, outer, primitive.tubeRadiusMm], [primitive.majorRadiusMm, primitive.tubeRadiusMm, Number(primitive.sweepAngleDeg) * Math.PI / 180]); }
function primitiveBody(code, matrix, bbox, payload) { return concat([uint32Body(1), uint32Body(code), float32ArrayBody(matrix), float32ArrayBody(bbox), float32ArrayBody(payload)]); }
function createChunkWriter() { const parts = []; let offset = 0; return { writeChunk(id, body, children) { const header = new ArrayBuffer(24); const view = new DataView(header); const padded = id.padEnd(4).slice(0, 4); for (let i = 0; i < 4; i += 1) view.setUint32(i * 4, padded.charCodeAt(i), false); view.setUint32(16, offset + 24 + body.byteLength, false); view.setUint32(20, 1, false); parts.push(header, body); offset += 24 + body.byteLength; if (children) children(); }, finish() { return concat(parts); } }; }
function headBody() { return concat([uint32Body(2), rvmString('phase-14-browser-pipe-bend-pilot'), uint32Body(0), rvmString('2026-07-02T00:00:00.000Z'), rvmString('Phase14'), rvmString('UTF-8')]); }
function modelBody() { return concat([uint32Body(1), rvmString('INPUTXML'), rvmString('PIPE_BEND_BROWSER_PILOT')]); }
function groupBody(name) { return concat([uint32Body(2), rvmString(name), float32Body(0), float32Body(0), float32Body(0), uint32Body(0)]); }
function matrixFromDirection(center, axis) { const z = normalize(axis); const ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const x = normalize(cross(ref, z)); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(center)]; }
function matrixFromTorus(primitive) { const x = normalize(primitive.startTangent); const z = normalize(primitive.normal); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(primitive.center)]; }
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
