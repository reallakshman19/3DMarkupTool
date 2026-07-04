import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { assertRichTopologyManagedStageJson } from './managed-stage-rich-topology-intake.js';
import { assertRichTopologySourceInventory } from './managed-stage-rich-topology-inventory.js';
import { assertRichTopologyGeometryContract } from './managed-stage-rich-topology-contract.js';
import { assertRichTopologySupportMapping } from './managed-stage-rich-support-mapping.js';
import { buildManagedStagePreviewExportParityAudit } from './managed-stage-preview-export-parity-audit.js';
import { buildManagedStageRichArtifactPackage } from './managed-stage-rich-artifact-package.js';
import { convertManagedStageJsonToRvmAtt } from './managed-stage-rvm-converter.js';

export const MANAGED_STAGE_RICH_REGRESSION_GATE_SCHEMA = 'ManagedStageRichRegressionGate.v1';
export const MANAGED_STAGE_RICH_REGRESSION_EXPECTED_SCHEMA = 'ManagedStageRichGoldenExpected.v1';

const DEFAULT_FIXTURE = 'fixtures/managed-stage-rich/golden-rich-topology-managed-stage.json';
const DEFAULT_EXPECTED = 'fixtures/managed-stage-rich/golden-rich-topology-expected.json';
const RESULT_KEYS = ['schema', 'ok', 'fixture', 'gates', 'counts', 'artifacts', 'errors', 'warnings'];

export async function runManagedStageRichRegressionGate(options = {}) {
  const fixture = options.fixtureName || filenameOf(options.fixturePath || DEFAULT_FIXTURE);
  try {
    const sourceText = await readSourceText(options.fixtureObject, options.fixturePath || DEFAULT_FIXTURE);
    const expected = await readExpected(options.expectedManifest, options.expectedPath || DEFAULT_EXPECTED);
    const parts = runRichChain(sourceText, fixture);
    const result = buildManagedStageRichRegressionResult({ ...parts, fixture });
    const comparison = expected ? compareManagedStageRichRegressionResult(result, expected) : { ok: true, errors: [], warnings: [] };
    return { ...result, ok: result.ok && comparison.ok, errors: [...result.errors, ...comparison.errors], warnings: [...result.warnings, ...comparison.warnings] };
  } catch (error) {
    return failureResult(fixture, error);
  }
}

export function buildManagedStageRichRegressionResult(parts) {
  const gates = gatesFor(parts);
  const counts = countsFor(parts);
  const artifacts = artifactsFor(parts);
  const errors = [...(parts.errors || [])];
  const warnings = collectWarnings(parts);
  return compactResult({ schema: MANAGED_STAGE_RICH_REGRESSION_GATE_SCHEMA, ok: Object.values(gates).every(Boolean) && errors.length === 0, fixture: parts.fixture || '', gates, counts, artifacts, errors, warnings });
}

export function compareManagedStageRichRegressionResult(result, expectedManifest) {
  const expected = expectedManifest?.expected || expectedManifest || {};
  const errors = [];
  const warnings = [];
  compareBooleans(result.gates, expected, errors);
  compareCounts(result.counts, expected, errors);
  if (result.artifacts.rvmBytes < Number(expected.rvmBytesMin || 0)) errors.push('artifacts.rvmBytes below expected minimum');
  if (result.artifacts.attBytes < Number(expected.attBytesMin || 0)) errors.push('artifacts.attBytes below expected minimum');
  return { ok: errors.length === 0, errors, warnings };
}

export function createPreviewSceneEvidenceFromExportModel(exportModel, options = {}) {
  const root = { name: options.name || 'golden-rich-preview-scene', userData: {}, children: [] };
  copyExportNode(exportModel?.root || exportModel, root);
  root.traverse = function traverse(callback) { walkPreview(root, callback); };
  return root;
}

export function assertManagedStageRichRegressionResult(result, expectedManifest) {
  const comparison = compareManagedStageRichRegressionResult(result, expectedManifest);
  if (!result.ok || !comparison.ok) throw new Error(`managed-stage rich regression failed: ${[...result.errors, ...comparison.errors].join(' | ')}`);
  return true;
}

function runRichChain(sourceText, fixture) {
  assertRichTopologyManagedStageJson(sourceText, fixture);
  const richTopologyInventory = assertRichTopologySourceInventory(sourceText, fixture);
  const richTopologyGeometryContract = assertRichTopologyGeometryContract(sourceText, fixture);
  const richTopologySupportMapping = assertRichTopologySupportMapping(sourceText, fixture);
  const conversion = convertManagedStageJsonToRvmAtt(sourceText);
  const previewScene = createPreviewSceneEvidenceFromExportModel(conversion.exportModel);
  const richTopologyPreviewExportParity = buildManagedStagePreviewExportParityAudit(conversion.exportModel, previewScene, { sourceName: fixture });
  const audit = { ...conversion.audit, richTopologyInventory, richTopologyGeometryContract, richTopologySupportMapping, richTopologyPreviewExportParity };
  const richTopologyArtifactPackage = buildManagedStageRichArtifactPackage({ sourceText, sourceName: fixture, basename: fixture.replace(/\.[^.]+$/, ''), rvm: conversion.rvm, att: conversion.att, audit, exportModel: conversion.exportModel, sourceContract: conversion.sourceContract, richTopologyInventory, richTopologyGeometryContract, richTopologySupportMapping, richTopologyPreviewExportParity }, { generatedAt: '' });
  return { richTopologyInventory, richTopologyGeometryContract, richTopologySupportMapping, conversion, richTopologyPreviewExportParity, richTopologyArtifactPackage };
}

function copyExportNode(exportNode, previewParent) {
  if (!exportNode || typeof exportNode !== 'object') return;
  const group = previewGroup(exportNode);
  previewParent.children.push(group);
  for (const primitive of exportNode.primitives || []) group.children.push(previewPrimitive(primitive, exportNode));
  for (const child of exportNode.children || []) copyExportNode(child, group);
}

function previewGroup(exportNode) {
  const attrs = exportNode.attributes || {};
  return { name: exportNode.name || attrs.NAME || 'GROUP', userData: { TYPE: attrs.TYPE || '', family: attrs.COMPONENT_CLASS || attrs.FAMILY || '' }, children: [] };
}

function previewPrimitive(primitive, exportNode) {
  const attrs = exportNode.attributes || {};
  const sourceElementId = primitive.sourceElementId || primitive.source?.sourceElementId || attrs.SOURCE_ELEMENT_ID || attrs.SUPPORT_MARKER_ID || '';
  return { name: primitive.name || sourceElementId || 'PRIMITIVE', userData: { TYPE: 'RVM_PRIMITIVE', primitiveKind: primitive.kind || primitive.type || '', primitiveCode: codeOf(primitive), sourceName: primitive.name || sourceElementId || '', sourceElementId, family: primitive.family || primitive.componentFamily || attrs.COMPONENT_CLASS || attrs.FAMILY || '' }, children: [] };
}

function codeOf(primitive) {
  const parsed = Number(primitive.code ?? primitive.rvmCode ?? primitive.primitiveCode);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return { pyramid: 1, box: 2, elbow: 4, cylinder: 8, sphere: 9, snout: 7 }[primitive.kind] || 0;
}

function gatesFor(parts) {
  return { intakeOk: true, inventoryOk: parts.richTopologyInventory?.ok === true, geometryContractOk: parts.richTopologyGeometryContract?.ok === true, supportMappingOk: parts.richTopologySupportMapping?.ok === true, conversionOk: Boolean(parts.conversion?.rvm && parts.conversion?.att), previewExportParityOk: parts.richTopologyPreviewExportParity?.ok === true, artifactPackageOk: parts.richTopologyArtifactPackage?.ok === true };
}

function countsFor(parts) {
  const inventory = parts.richTopologyInventory?.actualCounts || {};
  const contractCounts = parts.richTopologyGeometryContract?.counts || {};
  return { sourceChildRecords: inventory.sourceChildRecords || 0, geometryRecords: inventory.geometryRecords || 0, supportRecords: inventory.supportRecords || 0, bendRecords: inventory.bendRecords || 0, geometryContracts: contractCounts.primitiveReadyCount || contractCounts.geometryContracts || 0, supportContracts: contractCounts.supportContracts || 0, supportMappedRecords: parts.richTopologySupportMapping?.counts?.mappedSupportRecords || 0, exportPrimitiveCount: parts.richTopologyPreviewExportParity?.counts?.exportPrimitiveCount || 0, previewPrimitiveCount: parts.richTopologyPreviewExportParity?.counts?.previewPrimitiveCount || 0, packageFileCount: parts.richTopologyArtifactPackage?.counts?.fileCount || 0, packagePresentFileCount: parts.richTopologyArtifactPackage?.counts?.presentFileCount || 0 };
}

function artifactsFor(parts) {
  return { rvmBytes: parts.conversion?.rvm?.byteLength || 0, attBytes: byteLength(parts.conversion?.att), auditBytes: parts.richTopologyArtifactPackage?.counts?.auditBytes || 0 };
}

function compareBooleans(gates, expected, errors) {
  for (const key of ['intakeOk', 'inventoryOk', 'geometryContractOk', 'supportMappingOk', 'conversionOk', 'previewExportParityOk', 'artifactPackageOk']) if (gates[key] !== expected[key]) errors.push(`gates.${key} expected ${expected[key]} got ${gates[key]}`);
}

function compareCounts(counts, expected, errors) {
  for (const key of ['sourceChildRecords', 'geometryRecords', 'supportRecords', 'bendRecords', 'geometryContracts', 'supportContracts', 'supportMappedRecords', 'packageFileCount', 'packagePresentFileCount']) if (counts[key] !== expected[key]) errors.push(`counts.${key} expected ${expected[key]} got ${counts[key]}`);
}

function failureResult(fixture, error) {
  const message = error?.message || String(error);
  const gate = gateFromMessage(message);
  return compactResult({ schema: MANAGED_STAGE_RICH_REGRESSION_GATE_SCHEMA, ok: false, fixture, gates: { intakeOk: false, inventoryOk: false, geometryContractOk: false, supportMappingOk: false, conversionOk: false, previewExportParityOk: false, artifactPackageOk: false }, counts: emptyCounts(), artifacts: { rvmBytes: 0, attBytes: 0, auditBytes: 0 }, errors: [`${gate}: ${message}`], warnings: [] });
}

function gateFromMessage(message) {
  if (/intake|schema|profile|converter|units/i.test(message)) return 'intake';
  if (/inventory|no.?drop|children|components/i.test(message)) return 'inventory';
  if (/geometry|diameter|bend evidence|APOS|LPOS/i.test(message)) return 'geometryContract';
  if (/support|position|marker/i.test(message)) return 'supportMapping';
  return 'conversion';
}

async function readSourceText(fixtureObject, fixturePath) {
  if (fixtureObject) return JSON.stringify(fixtureObject);
  return readFile(fixturePath, 'utf8');
}

async function readExpected(expectedManifest, expectedPath) {
  if (expectedManifest === null) return null;
  if (expectedManifest) return expectedManifest;
  return JSON.parse(await readFile(expectedPath, 'utf8'));
}

function collectWarnings(parts) { return [...(parts.richTopologyInventory?.warnings || []), ...(parts.richTopologyGeometryContract?.warnings || []), ...(parts.richTopologySupportMapping?.warnings || []), ...(parts.richTopologyPreviewExportParity?.warnings || []), ...(parts.richTopologyArtifactPackage?.warnings || [])]; }
function emptyCounts() { return { sourceChildRecords: 0, geometryRecords: 0, supportRecords: 0, bendRecords: 0, geometryContracts: 0, supportContracts: 0, supportMappedRecords: 0, exportPrimitiveCount: 0, previewPrimitiveCount: 0, packageFileCount: 0, packagePresentFileCount: 0 }; }
function compactResult(result) { return Object.fromEntries(RESULT_KEYS.map((key) => [key, result[key]])); }
function byteLength(text) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(String(text || '')).byteLength : String(text || '').length; }
function filenameOf(path) { return String(path || '').split(/[\\/]/).pop() || ''; }
function walkPreview(node, callback) { callback(node); for (const child of node.children || []) walkPreview(child, callback); }

async function main() {
  const result = await runManagedStageRichRegressionGate();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
