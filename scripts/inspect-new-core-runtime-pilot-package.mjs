#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertRuntimePilotPackageInspection, inspectRuntimePilotPackage } from '../src/runtime-pilot/runtime-pilot-package-inspector.js';

const args = parseArgs(process.argv.slice(2));

try {
  const dir = String(args.dir || '');
  const base = String(args.base || '');
  if (!dir) throw new Error('--dir is required');
  if (!base) throw new Error('--base is required');
  const rvmBytes = new Uint8Array(await readFile(join(dir, `${base}.rvm`)));
  const attText = await readFile(join(dir, `${base}.att`), 'utf8');
  const audit = JSON.parse(await readFile(join(dir, `${base}.audit.json`), 'utf8'));
  const report = inspectRuntimePilotPackage({ base, rvmBytes, attText, audit });
  console.log(JSON.stringify(report, null, 2));
  assertRuntimePilotPackageInspection(report);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseArgs(values) {
  return Object.fromEntries(values.filter((entry) => entry.startsWith('--')).map((entry) => {
    const [key, ...rest] = entry.slice(2).split('=');
    return [key, rest.join('=') || true];
  }));
}
