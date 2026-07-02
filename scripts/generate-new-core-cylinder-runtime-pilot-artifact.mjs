#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { buildNewCoreCylinderRuntimePilotPlan } from '../src/runtime-pilot/new-core-cylinder-code8-runtime-pilot.js';
import { writeNewCoreCylinderRuntimePilotArtifact } from '../src/runtime-pilot/new-core-cylinder-code8-artifact-writer.js';
import { buildNewCoreCylinderRuntimePilotAudit } from '../src/runtime-pilot/new-core-cylinder-code8-runtime-audit.js';
import { buildBmCiiPhase11aState } from '../tests/fixtures/bend-torus-phase11a-pipeline.mjs';

const args = parseArgs(process.argv.slice(2));
const fixture = args.fixture || 'bm-cii';
const outdir = args.outdir || 'artifacts/new-core-cylinder-runtime-pilot';

try {
  if (fixture !== 'bm-cii') throw new Error('Only --fixture=bm-cii is supported');
  const state = await buildBmCiiPhase11aState();
  const pilotOptions = explicitOptions({ outdir });
  const plan = buildNewCoreCylinderRuntimePilotPlan(state.exportModels.rvmExportModel, pilotOptions);
  const artifact = await writeNewCoreCylinderRuntimePilotArtifact(plan, pilotOptions);
  const audit = buildNewCoreCylinderRuntimePilotAudit(plan, artifact);
  await writeFile(artifact.auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  printResult(artifact, audit);
  if (!audit.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function explicitOptions(extra = {}) {
  return { enabled: true, mode: 'explicit-runtime-pilot', scope: 'cylinder-code8-subset', allowPartialModel: true, writeArtifact: true, ...extra };
}

function parseArgs(values) {
  return Object.fromEntries(values.filter((entry) => entry.startsWith('--')).map((entry) => {
    const [key, ...rest] = entry.slice(2).split('=');
    return [key, rest.join('=') || true];
  }));
}

function printResult(artifact, audit) {
  console.log(`artifactPath=${artifact.artifactPath}`);
  console.log(`auditPath=${artifact.auditPath}`);
  console.log(`byteLength=${artifact.byteLength}`);
  console.log(`checksum=${artifact.checksumSha256}`);
  console.log(`plannedCylinderCount=${audit.plannedCylinderCount}`);
  console.log(`decodedCylinderCount=${audit.decodedCylinderCount}`);
  console.log(`excludedTorusCount=${audit.excludedTorusCount}`);
  console.log(`excludedFlangeCount=${audit.excludedFlangeCount}`);
  console.log(`blockedValveCount=${audit.blockedValveCount}`);
  console.log(`deferredSupportCount=${audit.deferredSupportCount}`);
  console.log(`auditOk=${audit.ok}`);
}
