import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeValvePilotAttText } from './new-core-valve-att-writer.js';
import { validateNewCoreValveRuntimePilotPlan } from './new-core-valve-runtime-pilot.js';
import { summarizeRvmPilotDecodedCounts, writeRvmPilotPackageBytes } from './rvm-pilot-byte-writer.js';

const ARTIFACT_SCHEMA = 'NewCorePipeBendFlangeValveRuntimePilotArtifact.v1';
const SCOPE = 'pipe-bend-flange-valve-subset';
const FORBIDDEN_OPTIONS = Object.freeze(['browser', 'canvas', 'download', 'objectUrl', 'createObjectUrl', 'downloadUrl', 'dom', 'ui', 'appMutation']);

export async function writeNewCoreValveRuntimePilotArtifact(plan, options) {
  const bag = object(options);
  const optionErrors = writerOptionErrors(bag);
  const validation = validateNewCoreValveRuntimePilotPlan(plan);
  if (optionErrors.length || !validation.ok || plan?.subsetReady !== true) return blockedArtifact(plan, optionErrors, validation, bag);
  const outdir = resolve(bag.outdir || 'artifacts/new-core-valve-runtime-pilot');
  const basename = bag.basename || 'BM_CII_pipe_bend_flange_valve_runtime_pilot';
  const paths = artifactPaths(outdir, basename);
  const rvmBytes = writeRvmPilotPackageBytes(plan, writerLabels());
  const attText = writeValvePilotAttText(plan);
  await mkdir(outdir, { recursive: true });
  await writeFile(paths.rvmArtifactPath, Buffer.from(rvmBytes));
  await writeFile(paths.attArtifactPath, attText, 'utf8');
  return result(plan, paths, rvmBytes, attText);
}

function result(plan, paths, rvmBytes, attText) {
  return {
    schema: ARTIFACT_SCHEMA,
    artifactKind: 'rvm-att-package',
    mode: plan.mode,
    scope: plan.scope,
    artifactGenerated: true,
    ...paths,
    rvmByteLength: rvmBytes.byteLength,
    attByteLength: new TextEncoder().encode(attText).byteLength,
    checksumSha256: createHash('sha256').update(Buffer.from(rvmBytes)).digest('hex'),
    ...summarizeRvmPilotDecodedCounts(plan),
    attRowCount: plan.plannedAttRowCount,
    attRowsMatchRvmPrimitives: plan.attRowsMatchRvmPrimitives,
    sourceTrace: plan.sourceTrace.map((entry) => ({ ...entry, runtimePilotStatus: 'artifactWritten' }))
  };
}

function blockedArtifact(plan, optionErrors, validation, options) {
  const outdir = resolve(options.outdir || 'artifacts/new-core-valve-runtime-pilot');
  const paths = artifactPaths(outdir, options.basename || 'BM_CII_pipe_bend_flange_valve_runtime_pilot');
  const errors = [...optionErrors, ...(validation.errors || []), ...(plan?.errors || [])];
  return {
    schema: ARTIFACT_SCHEMA,
    artifactKind: 'rvm-att-package',
    mode: 'explicit-runtime-pilot',
    scope: SCOPE,
    artifactGenerated: false,
    ...paths,
    rvmByteLength: 0,
    attByteLength: 0,
    checksumSha256: '',
    decodedPrimitiveCount: 0,
    decodedCylinderCount: 0,
    decodedTorusCount: 0,
    decodedFlangeCylinderCount: 0,
    decodedValveBodyCount: 0,
    decodedBoxCount: 0,
    decodedSphereCount: 0,
    decodedPyramidCount: 0,
    attRowCount: 0,
    attRowsMatchRvmPrimitives: false,
    sourceTrace: [],
    errors
  };
}

function artifactPaths(outdir, basename) {
  return { rvmArtifactPath: join(outdir, `${basename}.rvm`), attArtifactPath: join(outdir, `${basename}.att`), auditPath: join(outdir, `${basename}.audit.json`) };
}

function writerOptionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true };
  const errors = [];
  for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`);
  for (const key of FORBIDDEN_OPTIONS) if (options[key] === true) errors.push(`${key} option is forbidden for Node package writer`);
  return errors;
}

function writerLabels() {
  return { headerLabel: 'phase-16-pipe-bend-flange-valve-pilot', phaseLabel: 'Phase16', modelName: 'PIPE_BEND_FLANGE_VALVE_RUNTIME_PILOT', groupName: 'PIPE_BEND_FLANGE_VALVE_RUNTIME_PILOT' };
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
