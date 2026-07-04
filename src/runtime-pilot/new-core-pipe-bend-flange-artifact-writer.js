import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writePipeBendFlangePilotAttText } from './new-core-pipe-bend-flange-att-writer.js';
import { validateNewCorePipeBendFlangeRuntimePilotPlan } from './new-core-pipe-bend-flange-runtime-pilot.js';

const ARTIFACT_SCHEMA = 'NewCorePipeBendFlangeRuntimePilotArtifact.v1';
const FORBIDDEN_OPTIONS = Object.freeze(['browser', 'canvas', 'download', 'objectUrl', 'createObjectUrl', 'downloadUrl', 'dom', 'ui', 'appMutation']);

export async function writeNewCorePipeBendFlangeRuntimePilotArtifact(plan, options = {}) {
  const optionErrors = writerOptionErrors(options);
  const validation = validateNewCorePipeBendFlangeRuntimePilotPlan(plan);
  if (optionErrors.length || !validation.ok || plan?.subsetReady !== true) return blockedArtifact(plan, optionErrors, validation, options);
  const outdir = resolve(options.outdir || 'artifacts/new-core-pipe-bend-flange-runtime-pilot');
  const basename = options.basename || 'BM_CII_pipe_bend_flange_runtime_pilot';
  const paths = artifactPaths(outdir, basename);
  const rvmBytes = writeRvmPackageBytes(plan);
  const attText = writePipeBendFlangePilotAttText(plan);
  await mkdir(outdir, { recursive: true });
  await writeFile(paths.rvmArtifactPath, Buffer.from(rvmBytes));
  await writeFile(paths.attArtifactPath, attText, 'utf8');
  return result(plan, paths, rvmBytes, attText);
}

function result(plan, paths, rvmBytes, attText) {
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm-att-package', mode: plan.mode, scope: plan.scope, artifactGenerated: true, ...paths, rvmByteLength: rvmBytes.byteLength, attByteLength: new TextEncoder().encode(attText).byteLength, checksumSha256: createHash('sha256').update(Buffer.from(rvmBytes)).digest('hex'), decodedPrimitiveCount: plan.plannedRvmPrimitiveCount, decodedCylinderCount: plan.plannedCylinderCount, decodedTorusCount: plan.plannedTorusCount, decodedFlangeCylinderCount: plan.plannedFlangeCylinderCount, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, attRowCount: plan.plannedAttRowCount, attRowsMatchRvmPrimitives: plan.attRowsMatchRvmPrimitives, sourceTrace: plan.sourceTrace.map((entry) => ({ ...entry, runtimePilotStatus: 'artifactWritten' })) };
}

function blockedArtifact(plan, optionErrors, validation, options) {
  const outdir = resolve(options.outdir || 'artifacts/new-core-pipe-bend-flange-runtime-pilot');
  const paths = artifactPaths(outdir, options.basename || 'BM_CII_pipe_bend_flange_runtime_pilot');
  const errors = [...optionErrors, ...(validation.errors || []), ...(plan?.errors || [])];
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm-att-package', mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', artifactGenerated: false, ...paths, rvmByteLength: 0, attByteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedTorusCount: 0, decodedFlangeCylinderCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, sourceTrace: [], errors };
}

function artifactPaths(outdir, basename) { return { rvmArtifactPath: join(outdir, `${basename}.rvm`), attArtifactPath: join(outdir, `${basename}.att`), auditPath: join(outdir, `${basename}.audit.json`) }; }
function writerOptionErrors(options) { const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true }; const errors = []; for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`); for (const key of FORBIDDEN_OPTIONS) if (options[key] === true) errors.push(`${key} option is forbidden for Node package writer`); return errors; }

function writeRvmPackageBytes(plan) { const writer = createChunkWriter(); writer.writeChunk('HEAD', headBody(), null); writer.writeChunk('MODL', modelBody(), null); writer.writeChunk('CNTB', groupBody('PIPE_BEND_FLANGE_RUNTIME_PILOT'), () => { for (const item of plan.cylinderPrimitives) writer.writeChunk('PRIM', cylinderBody(item), null); for (const item of plan.torusPrimitives) writer.writeChunk('PRIM', torusBody(item), null); for (const item of plan.flangeCylinderPrimitives) writer.writeChunk('PRIM', flangeBody(item), null); writer.writeChunk('CNTE', uint32Body(2), null); }); writer.writeChunk('END:', uint32Body(1), null); return new Uint8Array(writer.finish()); }
function cylinderBody(item) { return primitiveBody(8, matrixFromDirection(item.center, item.axis), [-item.radiusMm, -item.radiusMm, -item.lengthMm / 2, item.radiusMm, item.radiusMm, item.lengthMm / 2], [item.radiusMm, item.lengthMm]); }
function flangeBody(item) { return primitiveBody(8, matrixFromDirection(item.center, item.axis), [-item.outerRadiusMm, -item.outerRadiusMm, -item.lengthMm / 2, item.outerRadiusMm, item.outerRadiusMm, item.lengthMm / 2], [item.outerRadiusMm, item.lengthMm]); }
function torusBody(item) { const outer = Number(item.majorRadiusMm) + Number(item.tubeRadiusMm); return primitiveBody(4, matrixFromTorus(item), [-outer, -outer, -item.tubeRadiusMm, outer, outer, item.tubeRadiusMm], [item.majorRadiusMm, item.tubeRadiusMm, Number(item.sweepAngleDeg) * Math.PI / 180]); }
function primitiveBody(code, matrix, bbox, payload) { return concat([uint32Body(1), uint32Body(code), float32ArrayBody(matrix), float32ArrayBody(bbox), float32ArrayBody(payload)]); }
function createChunkWriter() { const parts = []; let offset = 0; return { writeChunk(id, body, children) { const header = new ArrayBuffer(24); const view = new DataView(header); const padded = id.padEnd(4).slice(0, 4); for (let i = 0; i < 4; i += 1) view.setUint32(i * 4, padded.charCodeAt(i), false); view.setUint32(16, offset + 24 + body.byteLength, false); view.setUint32(20, 1, false); parts.push(header, body); offset += 24 + body.byteLength; if (children) children(); }, finish() { return concat(parts); } }; }
function headBody() { return concat([uint32Body(2), rvmString('phase-15-pipe-bend-flange-pilot'), uint32Body(0), rvmString('2026-07-02T00:00:00.000Z'), rvmString('Phase15'), rvmString('UTF-8')]); }
function modelBody() { return concat([uint32Body(1), rvmString('INPUTXML'), rvmString('PIPE_BEND_FLANGE_RUNTIME_PILOT')]); }
function groupBody(name) { return concat([uint32Body(2), rvmString(name), float32Body(0), float32Body(0), float32Body(0), uint32Body(0)]); }
function matrixFromDirection(center, axis) { const z = normalize(axis); const ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const x = normalize(cross(ref, z)); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(center)]; }
function matrixFromTorus(item) { const y = normalize(item.startTangent); const z = normalize(item.normal); const x = normalize(cross(y, z)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(item.center)]; }
function scaled(vector) { return vector.map((value) => Math.abs(Number(value) * 0.001) < 1e-12 ? 0 : Number(value) * 0.001); }
function normalize(value) { const vector = value.map(Number); const length = Math.hypot(...vector); return vector.map((entry) => entry / length); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function uint32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setUint32(0, Number(value) >>> 0, false); return out; }
function float32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setFloat32(0, Number(value), false); return out; }
function float32ArrayBody(values) { const out = new ArrayBuffer(values.length * 4); const view = new DataView(out); values.forEach((value, index) => view.setFloat32(index * 4, Number(value), false)); return out; }
function rvmString(value) { const encoded = new TextEncoder().encode(String(value || '')); const wordCount = Math.ceil((encoded.length + 1) / 4); const out = new ArrayBuffer(4 + wordCount * 4); new DataView(out).setUint32(0, wordCount, false); new Uint8Array(out, 4).set(encoded); return out; }
function concat(buffers) { const size = buffers.reduce((sum, item) => sum + item.byteLength, 0); const out = new Uint8Array(size); let offset = 0; for (const item of buffers) { out.set(new Uint8Array(item), offset); offset += item.byteLength; } return out.buffer; }
