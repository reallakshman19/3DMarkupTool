import { collectExportModelForbiddenFieldHits, validateAttExportModelContract, validateGlbVisualModelContract, validateRvmExportModelContract } from '../contracts/index.js';
import { compileResolvedPrimitiveModelToAttExportModel } from './att-export-model-compiler.js';
import { compileResolvedPrimitiveModelToGlbVisualModel } from './glb-visual-model-compiler.js';
import { compileResolvedPrimitiveModelToRvmExportModel } from './rvm-export-model-compiler.js';

const EXPORT_AUDIT_SCHEMA = 'ExportModelCompilationAudit.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const AXIS_EPSILON = 1e-6;

export function compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit, options = {}) {
  return { rvmExportModel: compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit, options), attExportModel: compileResolvedPrimitiveModelToAttExportModel(primitiveModel, primitiveAudit, options), glbVisualModel: compileResolvedPrimitiveModelToGlbVisualModel(primitiveModel, primitiveAudit, options) };
}

export function buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit, options = {}) {
  const rvm = exportModels?.rvmExportModel;
  const att = exportModels?.attExportModel;
  const glb = exportModels?.glbVisualModel;
  const rvmValidation = validateRvmExportModelContract(rvm);
  const attValidation = validateAttExportModelContract(att);
  const glbValidation = validateGlbVisualModelContract(glb);
  const forbiddenHits = collectExportModelForbiddenFieldHits({ rvm, att, glb });
  const errors = [...rvmValidation.errors, ...attValidation.errors, ...glbValidation.errors];
  const warnings = Array.isArray(rvm?.transformWarnings) ? [...rvm.transformWarnings] : [];
  validateAuditInputs(primitiveAudit, rvm, errors);
  validateTransformedRvmPrimitives(primitiveModel, rvm, errors);
  return buildAudit(primitiveModel, rvm, att, glb, forbiddenHits, errors, warnings, rvmValidation, attValidation, glbValidation, primitiveAudit);
}

function validateAuditInputs(primitiveAudit, rvm, errors) {
  if (!primitiveAudit || primitiveAudit.schema !== 'PrimitiveCompilationAudit.v1') errors.push('PrimitiveCompilationAudit.v1 is required');
  if (primitiveAudit?.ok !== true) errors.push('PrimitiveCompilationAudit.ok must be true before export model compilation');
  if (!rvm?.transformPolicy) errors.push('RVM transform policy is required');
  if (rvm?.transformApplied === true && rvm?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('RVM transformApplied true requires final-review-transform.v1');
  if (rvm?.transformApplied !== true && rvm?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY) errors.push('final-review-transform.v1 requires transformApplied true');
}

function validateTransformedRvmPrimitives(primitiveModel, rvm, errors) {
  const primitiveById = new Map((Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : []).map((entry) => [entry.primitiveId, entry]));
  for (const [index, primitive] of rvmPrimitives(rvm).entries()) validateCylinderTransform(primitive, primitiveById, index, errors);
  for (const [index, primitive] of torusTestPrimitives(rvm).entries()) validateTorusTransform(primitive, index, errors);
  for (const [index, primitive] of flangeTestPrimitives(rvm).entries()) validateFlangeTransform(primitive, index, errors);
}

function validateCylinderTransform(primitive, primitiveById, index, errors) {
  if (!isPoint3(primitive.center)) errors.push(`RVM primitive ${index} transformed center is missing or non-finite`);
  if (!isPoint3(primitive.axis) || !isUnitVector(primitive.axis)) errors.push(`RVM primitive ${index} transformed axis is missing or not normalized`);
  const source = primitiveById.get(primitive.sourcePrimitiveId);
  if (!source) return;
  for (const key of ['lengthMm', 'radiusMm', 'diameterMm', 'wallMm']) if (source[key] !== undefined && Number(primitive[key]) !== Number(source[key])) errors.push(`RVM primitive ${index} ${key} changed during transform`);
}

function validateTorusTransform(primitive, index, errors) {
  if (!isPoint3(primitive.center)) errors.push(`RVM TORUS test primitive ${index} transformed center is missing or non-finite`);
  for (const key of ['normal', 'startTangent', 'endTangent']) if (!isPoint3(primitive[key]) || !isUnitVector(primitive[key])) errors.push(`RVM TORUS test primitive ${index} ${key} is not normalized finite`);
}

function validateFlangeTransform(primitive, index, errors) {
  if (!isPoint3(primitive.center)) errors.push(`RVM flange test primitive ${index} transformed center is missing or non-finite`);
  if (!isPoint3(primitive.axis) || !isUnitVector(primitive.axis)) errors.push(`RVM flange test primitive ${index} axis is not normalized finite`);
  if (Number(primitive.outerRadiusMm) <= Number(primitive.boreRadiusMm)) errors.push(`RVM flange test primitive ${index} outer radius must exceed bore radius`);
}

function buildAudit(primitiveModel, rvm, att, glb, forbiddenHits, errors, warnings, rvmValidation, attValidation, glbValidation, primitiveAudit) {
  const rvmRows = rvmPrimitives(rvm);
  const torusRows = torusTestPrimitives(rvm);
  const flangeRows = flangeTestPrimitives(rvm);
  const deferredRows = Array.isArray(rvm?.deferredExports) ? rvm.deferredExports : [];
  const blockedRows = Array.isArray(rvm?.blockedExports) ? rvm.blockedExports : [];
  const audit = auditRows(primitiveModel, rvm, att, glb, rvmRows, torusRows, flangeRows, deferredRows, blockedRows, forbiddenHits, errors, warnings);
  audit.ok = rvmValidation.ok && attValidation.ok && glbValidation.ok && primitiveAudit?.ok === true && audit.hardErrorCount === 0 && audit.rvmTorusWriterReadyCount === 0 && audit.productionReadyTorusCount === 0 && audit.flangeWriterReadyCount === 0 && audit.productionReadyFlangeCount === 0 && audit.writerCallCount === 0 && audit.binaryPayloadCount === 0 && audit.textPayloadCount === 0 && audit.glbPayloadCount === 0;
  return audit;
}

function auditRows(primitiveModel, rvm, att, glb, rvmRows, torusRows, flangeRows, deferredRows, blockedRows, forbiddenHits, errors, warnings) {
  const deferredFlanges = deferredRows.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER');
  return { schema: EXPORT_AUDIT_SCHEMA, graphId: primitiveModel?.graphId || '<unknown-graph>', transformPolicy: rvm?.transformPolicy || '<missing-transform-policy>', rvmTransformWarningCount: Array.isArray(rvm?.transformWarnings) ? rvm.transformWarnings.length : 0, rvmPrimitivePlanCount: rvmRows.length, rvmCylinderPlanCount: rvmRows.filter((entry) => entry.primitiveKind === 'CYLINDER').length, rvmTorusPlanCount: rvmRows.filter((entry) => entry.primitiveKind === 'TORUS').length, rvmTorusWriterReadyCount: rvmRows.filter((entry) => entry.primitiveKind === 'TORUS' && entry.writerReady === true).length, testByteEligibleTorusCount: torusRows.length, testByteEligibleBendTorusCount: torusRows.filter((entry) => entry.resolver === 'bendArcTorusPrimitive.v1').length, productionReadyTorusCount: torusRows.filter((entry) => entry.writerReady === true).length, deferredBendTorusExportCount: deferredRows.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, flangeDeferredExportCount: deferredFlanges.length, flangeWriterReadyCount: deferredFlanges.filter((entry) => entry.writerReady === true).length, flangeTestByteEligibleCount: flangeRows.length, productionReadyFlangeCount: flangeRows.filter((entry) => entry.writerReady === true).length, rvmBoxPlanCount: rvmRows.filter((entry) => entry.primitiveKind === 'BOX').length, rvmSpherePlanCount: rvmRows.filter((entry) => entry.primitiveKind === 'SPHERE').length, rvmPyramidPlanCount: rvmRows.filter((entry) => entry.primitiveKind === 'PYRAMID').length, attRecordPlanCount: Array.isArray(att?.records) ? att.records.length : 0, glbVisualPlanCount: Array.isArray(glb?.visualItems) ? glb.visualItems.length : 0, blockedExportCount: blockedRows.length, deferredExportCount: deferredRows.length, blockedAttRecordCount: Array.isArray(att?.blockedRecords) ? att.blockedRecords.length : 0, deferredAttRecordCount: Array.isArray(att?.deferredRecords) ? att.deferredRecords.length : 0, blockedVisualCount: Array.isArray(glb?.blockedVisuals) ? glb.blockedVisuals.length : 0, deferredVisualCount: Array.isArray(glb?.deferredVisuals) ? glb.deferredVisuals.length : 0, blockedUnresolvedExportCount: blockedRows.length, blockedFlangeExportCount: blockedRows.filter((entry) => entry.family === 'flange').length, blockedValveExportCount: blockedRows.filter((entry) => entry.family === 'valve').length, blockedBendExportCount: blockedRows.filter((entry) => entry.family === 'elbow').length, deferredSupportExportCount: deferredRows.filter((entry) => entry.family === 'support').length, writerCallCount: 0, binaryPayloadCount: forbiddenHits.filter((hit) => ['binary', 'bytes', 'buffer', 'arrayBuffer', 'chunk', 'cntb', 'primBody', 'fileBlob', 'writerPayload'].includes(hit.field)).length, textPayloadCount: forbiddenHits.filter((hit) => hit.field === 'attText').length, glbPayloadCount: forbiddenHits.filter((hit) => hit.field === 'glbBytes' || hit.field === 'gltfJson').length, navisTransformApplied: rvm?.transformApplied === true, hardErrorCount: errors.length, ok: false, errors, warnings };
}

export { compileResolvedPrimitiveModelToRvmExportModel, compileResolvedPrimitiveModelToAttExportModel, compileResolvedPrimitiveModelToGlbVisualModel };
function rvmPrimitives(rvm) { return Array.isArray(rvm?.primitives) ? rvm.primitives : []; }
function torusTestPrimitives(rvm) { return Array.isArray(rvm?.testByteEligiblePrimitives) ? rvm.testByteEligiblePrimitives : []; }
function flangeTestPrimitives(rvm) { return Array.isArray(rvm?.flangeTestByteEligiblePrimitives) ? rvm.flangeTestByteEligiblePrimitives : []; }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function isUnitVector(value) { const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2])); return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON; }
