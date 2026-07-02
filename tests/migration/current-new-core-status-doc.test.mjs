import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOC_PATH = 'docs/migration/current-new-core-status-2026-07.md';
const PROTECTED_FILES = Object.freeze([
  'src/app.js',
  'src/main.js',
  'src/managed-stage-rvm-converter.js',
  'src/rvm-writer.js',
  'src/att-writer.js',
  'src/managed-stage-json-ui-controller.js',
  'src/safe-ui-loader.js',
  'src/app-loader.js',
  'src/rvm-converter.js',
  'src/rvm-preview.js',
  'index.html'
]);

const REQUIRED_STATEMENTS = Object.freeze([
  'PlantModelGraph.v1 remains the engineering source-of-truth',
  'The runtime switch is not implemented and not authorized',
  'Canvas authoring is not started or authorized',
  'ElementRvmLedger.v1 is downstream trace/readiness ledger only',
  'Staged JSON children are source-import evidence only, not master model',
  'RvmExportModel.v1 is adapter/dry-run/test-byte boundary',
  'PR #481 must be resolved before PR #480',
  'PR #480 remains a test-only flange byte proof if accepted',
  'CYLINDER/code8 is candidate evidence only, not switch approval',
  'TORUS/code4 remains test-only until policy approval',
  'FLANGE_CYLINDER/code8 remains test-only/deferred until policy approval',
  'Valves are blocked/deferred unless separately proven',
  'Supports are blocked/deferred unless separately proven',
  'ATT remains a separate boundary',
  'GLB remains visual/preview only and not authority'
]);

const FORBIDDEN_WORK_STATEMENTS = Object.freeze([
  'no full runtime switch',
  'no runtime switch',
  'no default feature flag enablement',
  'no writer rewrite',
  'no converter reroute',
  'no UI/canvas authoring',
  'no fallback cubes',
  'no support placeholder downgrade',
  'no valve placeholder downgrade',
  'no support/valve placeholder downgrade',
  'no GLB-as-authority behavior',
  'no ATT collapse into RVM-only output'
]);

export function readStatusDocument(path = DOC_PATH) {
  return readFileSync(resolve(path), 'utf8');
}

export function assertContains(documentText, expected) {
  assert.ok(documentText.includes(expected), `missing required status text: ${expected}`);
}

export function assertAllPresent(documentText, expectedValues) {
  for (const expected of expectedValues) assertContains(documentText, expected);
}

export function assertProtectedFilesNamed(documentText) {
  assertAllPresent(documentText, PROTECTED_FILES);
}

export function assertForbiddenWorkNamed(documentText) {
  assertAllPresent(documentText, FORBIDDEN_WORK_STATEMENTS);
}

export function runCurrentStatusDocTest() {
  const documentText = readStatusDocument();
  assertAllPresent(documentText, REQUIRED_STATEMENTS);
  assertProtectedFilesNamed(documentText);
  assertForbiddenWorkNamed(documentText);
}

runCurrentStatusDocTest();
console.log('current new-core status document gate passed');
