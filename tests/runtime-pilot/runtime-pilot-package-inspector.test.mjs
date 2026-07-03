import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';
import { writeNewCoreValveRuntimePilotArtifact } from '../../src/runtime-pilot/new-core-valve-artifact-writer.js';
import { buildNewCoreValveRuntimePilotAudit } from '../../src/runtime-pilot/new-core-valve-runtime-audit.js';
import { buildNewCoreValveRuntimePilotPlan } from '../../src/runtime-pilot/new-core-valve-runtime-pilot.js';
import { assertRuntimePilotPackageInspection, inspectRuntimePilotPackage } from '../../src/runtime-pilot/runtime-pilot-package-inspector.js';

const execFileAsync = promisify(execFile);
const outdir = await mkdtemp(join(tmpdir(), 'inspect-pilot-'));
const state = await buildBmCiiPhase11aState();
const options = { enabled: true, mode: 'explicit-runtime-pilot', scope: 'pipe-bend-flange-valve-subset', allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, outdir };
const plan = buildNewCoreValveRuntimePilotPlan(state, options);
const artifact = await writeNewCoreValveRuntimePilotArtifact(plan, options);
const audit = buildNewCoreValveRuntimePilotAudit(plan, artifact, {});
await writeFile(artifact.auditPath, `${JSON.stringify(audit, null, 2)}\n`);

const report = inspectRuntimePilotPackage({ base: 'BM_CII_pipe_bend_flange_valve_runtime_pilot', rvmBytes: new Uint8Array(await readFile(artifact.rvmArtifactPath)), attText: await readFile(artifact.attArtifactPath, 'utf8'), audit });
assert.equal(assertRuntimePilotPackageInspection(report).ok, true);
assert.equal(report.familyCounts.pipe, 19);
assert.equal(report.familyCounts.bend, 7);
assert.equal(report.familyCounts.flange, 8);
assert.equal(report.fullModelReady, false);

const mismatch = inspectRuntimePilotPackage({ base: 'bad', rvmBytes: new Uint8Array(await readFile(artifact.rvmArtifactPath)), attText: await readFile(artifact.attArtifactPath, 'utf8'), audit: { ...audit, attRowCount: audit.attRowCount + 1 } });
assert.equal(mismatch.ok, false);
assert.ok(mismatch.errors.includes('ATT row count mismatch'));

await writeFile(artifact.auditPath, `${JSON.stringify({ ...audit, attRowCount: audit.attRowCount + 1 }, null, 2)}\n`);
await assert.rejects(() => execFileAsync(process.execPath, ['scripts/inspect-new-core-runtime-pilot-package.mjs', `--dir=${outdir}`, '--base=BM_CII_pipe_bend_flange_valve_runtime_pilot'], { cwd: process.cwd() }), /Runtime pilot package inspection failed/);

await rm(outdir, { recursive: true, force: true });
console.log('runtime pilot package inspector test passed');
