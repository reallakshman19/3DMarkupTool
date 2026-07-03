#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { buildBmCiiPhase11aState } from '../tests/fixtures/bend-torus-phase11a-pipeline.mjs';
import { writeNewCoreValveRuntimePilotArtifact } from '../src/runtime-pilot/new-core-valve-artifact-writer.js';
import { buildNewCoreValveRuntimePilotAudit } from '../src/runtime-pilot/new-core-valve-runtime-audit.js';
import { buildNewCoreValveRuntimePilotPlan } from '../src/runtime-pilot/new-core-valve-runtime-pilot.js';

const args = parseArgs(process.argv.slice(2));
const fixture = args.fixture || 'bm-cii';
const outdir = args.outdir || 'artifacts/new-core-valve-runtime-pilot';

try {
  if (fixture !== 'bm-cii') throw new Error('Only --fixture=bm-cii is supported');
  const state = await buildBmCiiPhase11aState();
  const options = explicitOptions({ outdir });
  const plan = buildNewCoreValveRuntimePilotPlan(state, options);
  const artifact = await writeNewCoreValveRuntimePilotArtifact(plan, options);
  const audit = buildNewCoreValveRuntimePilotAudit(plan, artifact, {});
  await writeFile(artifact.auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  printResult(artifact, audit);
  if (!audit.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function explicitOptions(extra) {
  return { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, ...extra };
}

function parseArgs(values) {
  return Object.fromEntries(values.filter((entry) => entry.startsWith('--')).map((entry) => {
    const [key, ...rest] = entry.slice(2).split('=');
    return [key, rest.join('=') || true];
  }));
}

function printResult(artifact, audit) {
  console.log(`rvmArtifactPath=${artifact.rvmArtifactPath}`);
  console.log(`attArtifactPath=${artifact.attArtifactPath}`);
  console.log(`auditPath=${artifact.auditPath}`);
  console.log(`rvmByteLength=${artifact.rvmByteLength}`);
  console.log(`attByteLength=${artifact.attByteLength}`);
  console.log(`checksum=${artifact.checksumSha256}`);
  console.log(`plannedCylinderCount=${audit.plannedCylinderCount}`);
  console.log(`plannedTorusCount=${audit.plannedTorusCount}`);
  console.log(`plannedFlangeCylinderCount=${audit.plannedFlangeCylinderCount}`);
  console.log(`plannedValveBodyCount=${audit.plannedValveBodyCount}`);
  console.log(`generatedValveCount=${audit.generatedValveCount}`);
  console.log(`blockedValveCount=${audit.blockedValveCount}`);
  console.log(`attRowCount=${audit.attRowCount}`);
  console.log(`deferredSupportCount=${audit.deferredSupportCount}`);
  console.log(`auditOk=${audit.ok}`);
}
