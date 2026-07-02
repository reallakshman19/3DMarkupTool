import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { assertNewCoreCylinderRuntimePilotAudit } from '../../src/runtime-pilot/new-core-cylinder-code8-runtime-audit.js';

const execFileAsync = promisify(execFile);
const outdir = await mkdtemp(join(tmpdir(), 'ncc8-cli-'));
const script = 'scripts/generate-new-core-cylinder-runtime-pilot-artifact.mjs';
const { stdout } = await execFileAsync(process.execPath, [script, '--fixture=bm-cii', `--outdir=${outdir}`], { cwd: process.cwd() });
const artifactPath = join(outdir, 'BM_CII_cylinder_code8_runtime_pilot.rvm');
const auditPath = join(outdir, 'BM_CII_cylinder_code8_runtime_pilot.audit.json');
const audit = JSON.parse(await readFile(auditPath, 'utf8'));
const checksum = stdout.match(/checksum=([0-9a-f]{64})/)?.[1] || '';

assert.ok(stdout.includes('auditOk=true'), 'CLI reports audit ok');
assert.equal((await stat(artifactPath)).isFile(), true, '.rvm file exists');
assert.equal((await stat(auditPath)).isFile(), true, '.audit.json file exists');
assert.equal(assertNewCoreCylinderRuntimePilotAudit(audit, { ok: true, plannedCylinderCount: 19, decodedCylinderCount: 19, decodedPrimitiveCount: 19, fullModelReady: false, subsetReady: true }).ok, true);
assert.ok(audit.artifactByteLength > 0, 'byte length > 0');
assert.match(checksum, /^[0-9a-f]{64}$/);
assert.match(audit.artifactPath, /BM_CII_cylinder_code8_runtime_pilot\.rvm$/);
assert.equal(resolve(audit.artifactPath).startsWith(resolve(outdir)), true, 'artifact under temp outdir');
assert.equal(resolve(audit.auditPath).startsWith(resolve(outdir)), true, 'audit under temp outdir');
assert.equal(audit.artifactPath.includes('artifacts/new-core-cylinder-runtime-pilot'), false, 'test does not write repo artifact path');
await rm(outdir, { recursive: true, force: true });
console.log('new-core CYLINDER/code8 runtime pilot CLI test passed');
