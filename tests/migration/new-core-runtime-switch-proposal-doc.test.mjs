import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const proposal = await readFile('docs/migration/new-core-runtime-switch-proposal.md', 'utf8');

const requiredTerms = [
  'PlantModelGraph.v1',
  'RvmExportModel.v1',
  'adapter/dry-run',
  'production runtime path remains unchanged',
  'CYLINDER/code8',
  'TORUS/code4',
  'FLANGE_CYLINDER/code8',
  'valves',
  'supports',
  'ATT',
  'GLB',
  'rollback',
  'Agent 00 approval'
];

for (const term of requiredTerms) {
  assert.ok(proposal.includes(term), `proposal document must contain: ${term}`);
}

const requiredPolicyStatements = [
  'The runtime switch is not implemented and not authorized.',
  '`PlantModelGraph.v1` remains the engineering-intent source of truth.',
  '`RvmExportModel.v1` is currently an adapter/dry-run/test-byte boundary only.',
  'The switch is not approved by this document.'
];

for (const statement of requiredPolicyStatements) {
  assert.ok(proposal.includes(statement), `proposal document must contain policy statement: ${statement}`);
}

const forbiddenImplications = [
  'runtime switch is approved',
  'source element is now the master unit',
  'staged JSON child is the master',
  'roadmap resets'
];

for (const phrase of forbiddenImplications) {
  assert.equal(proposal.includes(phrase), false, `proposal document must not imply: ${phrase}`);
}

console.log('new-core runtime switch proposal document policy test passed');
