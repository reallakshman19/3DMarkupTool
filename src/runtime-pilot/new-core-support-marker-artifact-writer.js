import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeValvePilotAttText } from './new-core-valve-att-writer.js';
import { validateNewCoreSupportMarkerRuntimePilotPlan } from './new-core-support-marker-runtime-pilot.js';
import { summarizeRvmPilotDecodedCounts, writeRvmPilotPackageBytes } from './rvm-pilot-byte-writer.js';

const ARTIFACT_SCHEMA = 'NewCoreSupportMarkerRuntimePilotArtifact.v1';

export async function writeNewCoreSupportMarkerRuntimePilotArtifact(plan, options) {
  const bag = object(options);
  const validation = validateNewCoreSupportMarkerRuntimePilotPlan(plan);
  if (!validation.ok || plan?.subsetReady !== true) return blockedArtifact(plan, validation, bag);
  const outdir = resolve(bag.outdir || 'artifacts/new-core-support-marker-runtime-pilot');
  const basename = bag.basename || 'BM_CII_pipe_bend_flange_valve_support_marker_runtime_pilot';
  const paths = artifactPaths(outdir, basename);
  const rvmBytes = writeRvmPilotPackageBytes(plan.basePlan, writerLabels());
  const attText = writeValvePilotAttText(plan.basePlan);
  await mkdir(outdir, { recursive: true });
  await writeFile(paths.rvmArtifactPath, Buffer.from(rvmBytes));
  await writeFile(paths.attArtifactPath, attText, 'utf8');
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm-att-package', artifactGenerated: true, mode: plan.mode, scope: plan.scope, ...paths, rvmByteLength: rvmBytes.byteLength, attByteLength: new TextEncoder().encode(attText).byteLength, checksumSha256: createHash('sha256').update(Buffer.from(rvmBytes)).digest('hex'), ...summarizeRvmPilotDecodedCounts(plan.basePlan), attRowCount: plan.basePlan.plannedAttRowCount, attRowsMatchRvmPrimitives: plan.basePlan.attRowsMatchRvmPrimitives, supportMarkerCount: plan.supportMarkerCount, blockedSupportMarkerCount: plan.blockedSupportMarkerCount, sourceTrace: plan.basePlan.sourceTrace };
}

function blockedArtifact(plan, validation, options) {
  const outdir = resolve(options.outdir || 'artifacts/new-core-support-marker-runtime-pilot');
  const paths = artifactPaths(outdir, options.basename || 'BM_CII_pipe_bend_flange_valve_support_marker_runtime_pilot');
  return { schema: ARTIFACT_SCHEMA, artifactKind: 'rvm-att-package', artifactGenerated: false, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-support-marker-subset', ...paths, rvmByteLength: 0, attByteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, supportMarkerCount: Number(plan?.supportMarkerCount || 0), blockedSupportMarkerCount: Number(plan?.blockedSupportMarkerCount || 0), sourceTrace: [], errors: validation.errors };
}

function artifactPaths(outdir, basename) {
  return { rvmArtifactPath: join(outdir, `${basename}.rvm`), attArtifactPath: join(outdir, `${basename}.att`), auditPath: join(outdir, `${basename}.audit.json`) };
}

function writerLabels() {
  return { headerLabel: 'phase-17-support-marker-pilot', phaseLabel: 'Phase17', modelName: 'PIPE_BEND_FLANGE_VALVE_SUPPORT_MARKER_RUNTIME_PILOT', groupName: 'PIPE_BEND_FLANGE_VALVE_SUPPORT_MARKER_RUNTIME_PILOT' };
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
