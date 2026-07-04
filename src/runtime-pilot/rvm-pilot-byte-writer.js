const EPSILON = 1e-12;

export function writeRvmPilotPackageBytes(plan, options) {
  const writer = createChunkWriter();
  writer.writeChunk('HEAD', headBody(options.headerLabel, options.phaseLabel), null);
  writer.writeChunk('MODL', modelBody(options.modelName), null);
  writer.writeChunk('CNTB', groupBody(options.groupName), () => {
    for (const item of array(plan.cylinderPrimitives)) writer.writeChunk('PRIM', cylinderBody(item), null);
    for (const item of array(plan.torusPrimitives)) writer.writeChunk('PRIM', torusBody(item), null);
    for (const item of array(plan.flangeCylinderPrimitives)) writer.writeChunk('PRIM', flangeBody(item), null);
    for (const item of array(plan.valveBodyPrimitives)) writer.writeChunk('PRIM', valveBody(item), null);
    for (const item of array(plan.supportMarkerPrimitives)) writer.writeChunk('PRIM', supportMarkerBody(item), null);
    writer.writeChunk('CNTE', uint32Body(2), null);
  });
  writer.writeChunk('END:', uint32Body(1), null);
  return new Uint8Array(writer.finish());
}

export function summarizeRvmPilotDecodedCounts(plan) {
  const supportCylinderCount = Number(plan.supportCylinderPrimitiveCount || 0);
  const supportSphereCount = Number(plan.supportSpherePrimitiveCount || 0);
  return {
    decodedPrimitiveCount: Number(plan.plannedRvmPrimitiveCount || 0),
    decodedCylinderCount: Number(plan.plannedCylinderCount || 0) + supportCylinderCount,
    decodedTorusCount: Number(plan.plannedTorusCount || 0),
    decodedFlangeCylinderCount: Number(plan.plannedFlangeCylinderCount || 0),
    decodedValveBodyCount: Number(plan.plannedValveBodyCount || 0),
    decodedBoxCount: 0,
    decodedSphereCount: supportSphereCount,
    decodedPyramidCount: 0
  };
}

function cylinderBody(item) {
  return code8CylinderBody(item.center, item.axis, item.radiusMm, item.lengthMm);
}

function flangeBody(item) {
  return code8CylinderBody(item.center, item.axis, item.outerRadiusMm, item.lengthMm);
}

function valveBody(item) {
  return code8CylinderBody(item.center, item.axis, item.bodyRadiusMm, item.lengthMm);
}

function supportMarkerBody(item) {
  if (Number(item.primitiveCode) === 9) return sphereBody(item);
  return code8CylinderBody(item.center, item.axis, item.radiusMm, item.lengthMm);
}

function code8CylinderBody(center, axis, radiusMm, lengthMm) {
  return primitiveBody(8, matrixFromDirection(center, axis), [-radiusMm, -radiusMm, -lengthMm / 2, radiusMm, radiusMm, lengthMm / 2], [radiusMm, lengthMm]);
}

function sphereBody(item) {
  const diameter = Number(item.diameterMm || item.radiusMm * 2);
  const radius = diameter / 2;
  return primitiveBody(9, matrixFromDirection(item.center, [0, 0, 1]), [-radius, -radius, -radius, radius, radius, radius], [diameter]);
}

function torusBody(item) {
  const outer = Number(item.majorRadiusMm) + Number(item.tubeRadiusMm);
  const sweep = Number(item.sweepAngleDeg) * Math.PI / 180;
  return primitiveBody(4, matrixFromTorus(item), [-outer, -outer, -item.tubeRadiusMm, outer, outer, item.tubeRadiusMm], [item.majorRadiusMm, item.tubeRadiusMm, sweep]);
}

function primitiveBody(code, matrix, bbox, payload) {
  return concat([uint32Body(1), uint32Body(code), float32ArrayBody(matrix), float32ArrayBody(bbox), float32ArrayBody(payload)]);
}

function createChunkWriter() {
  const parts = [];
  let offset = 0;
  return {
    writeChunk(id, body, children) {
      const header = new ArrayBuffer(24);
      const view = new DataView(header);
      const padded = id.padEnd(4).slice(0, 4);
      for (let index = 0; index < 4; index += 1) view.setUint32(index * 4, padded.charCodeAt(index), false);
      view.setUint32(16, offset + 24 + body.byteLength, false);
      view.setUint32(20, 1, false);
      parts.push(header, body);
      offset += 24 + body.byteLength;
      if (children) children();
    },
    finish() { return concat(parts); }
  };
}

function headBody(label, phase) {
  return concat([uint32Body(2), rvmString(label), uint32Body(0), rvmString('2026-07-03T00:00:00.000Z'), rvmString(phase), rvmString('UTF-8')]);
}

function modelBody(name) {
  return concat([uint32Body(1), rvmString('INPUTXML'), rvmString(name)]);
}

function groupBody(name) {
  return concat([uint32Body(2), rvmString(name), float32Body(0), float32Body(0), float32Body(0), uint32Body(0)]);
}

function matrixFromDirection(center, axis) {
  const z = normalize(axis);
  const ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = normalize(cross(ref, z));
  const y = normalize(cross(z, x));
  return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(center)];
}

function matrixFromTorus(item) {
  const y = normalize(item.startTangent);
  const z = normalize(item.normal);
  const x = normalize(cross(y, z));
  return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(item.center)];
}

function scaled(vector) {
  return vector.map((value) => Math.abs(Number(value) * 0.001) < EPSILON ? 0 : Number(value) * 0.001);
}

function normalize(value) {
  const vector = value.map(Number);
  const length = Math.hypot(...vector);
  return vector.map((entry) => entry / length);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function uint32Body(value) {
  const out = new ArrayBuffer(4);
  new DataView(out).setUint32(0, Number(value) >>> 0, false);
  return out;
}

function float32Body(value) {
  const out = new ArrayBuffer(4);
  new DataView(out).setFloat32(0, Number(value), false);
  return out;
}

function float32ArrayBody(values) {
  const out = new ArrayBuffer(values.length * 4);
  const view = new DataView(out);
  values.forEach((value, index) => view.setFloat32(index * 4, Number(value), false));
  return out;
}

function rvmString(value) {
  const encoded = new TextEncoder().encode(String(value || ''));
  const wordCount = Math.ceil((encoded.length + 1) / 4);
  const out = new ArrayBuffer(4 + wordCount * 4);
  new DataView(out).setUint32(0, wordCount, false);
  new Uint8Array(out, 4).set(encoded);
  return out;
}

function concat(buffers) {
  const size = buffers.reduce((sum, item) => sum + item.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const item of buffers) {
    out.set(new Uint8Array(item), offset);
    offset += item.byteLength;
  }
  return out.buffer;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
