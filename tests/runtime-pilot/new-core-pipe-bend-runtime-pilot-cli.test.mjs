import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { assertNewCorePipeBendRuntimePilotAudit } from '../../src/runtime-pilot/new-core-pipe-bend-runtime-audit.js';

const execFileAsync = promisify(execFile);
const outdir = await mkdtemp(join(tmpdir(), 'pipe-bend-cli-'));
const script = 'scripts/generate-new-core-pipe-bend-runtime-pilot-artifact.mjs';
const { stdout } = await execFileAsync(process.execPath, [script, '--fixture=bm-cii', `--outdir=${outdir}`], { cwd: process.cwd() });
const artifactPath = join(outdir, 'BM_CII_pipe_bend_runtime_pilot.rvm');
const auditPath = join(outdir, 'BM_CII_pipe_bend_runtime_pilot.audit.json');
const audit = JSON.parse(await readFile(auditPath, 'utf8'));
const checksum = stdout.match(/checksum=([0-9a-f]{64})/)?.[1] || '';

assert.ok(stdout.includes('auditOk=true'), 'CLI reports audit ok');
assert.equal((await stat(artifactPath)).isFile(), true, '.rvm file exists');
assert.equal((await stat(auditPath)).isFile(), true, '.audit.json file exists');
assert.equal(assertNewCorePipeBendRuntimePilotAudit(audit, { ok: true, plannedCylinderCount: 19, plannedTorusCount: 7, decodedCylinderCount: 19, decodedTorusCount: 7, decodedPrimitiveCount: 26, fullModelReady: false, subsetReady: true }).ok, true);
assert.ok(audit.artifactByteLength > 0, 'byte length > 0');
assert.match(checksum, /^[0-9a-f]{64}$/);
assert.equal(resolve(audit.artifactPath).startsWith(resolve(outdir)), true, 'artifact under temp outdir');
assert.equal(resolve(audit.auditPath).startsWith(resolve(outdir)), true, 'audit under temp outdir');
assert.equal(audit.artifactPath.includes('artifacts/new-core-pipe-bend-runtime-pilot'), false, 'test does not write repo artifact path');
await rm(outdir, { recursive: true, force: true });
console.log('new-core pipe+bend runtime pilot CLI test passed');
