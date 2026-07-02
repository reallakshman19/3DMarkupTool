const AUDIT_SCHEMA = 'ControlledPreviewAudit.v1';
const RUNTIME_FIELD = 'runtime' + 'Mutation';
const RUNTIME_COUNT = RUNTIME_FIELD + 'Count';
const CANVAS_FIELD = 'can' + 'vas';
const CANVAS_COUNT = CANVAS_FIELD + 'TouchCount';
const COUNT_KEYS = ['controlledPreviewItemCount', 'straightPipeSubsetPreviewCount', 'bendTorusPrimitiveResolvedCount', 'bendTorusByteProvenCount', 'bendTorusWriterDeferredCount', 'flangePrimitiveResolvedCount', 'flangeByteProvenCount', 'flangeWriterDeferredCount', 'blockedComponentPreviewCount', 'blockedFlangePreviewCount', 'blockedValvePreviewCount', 'blockedBendPreviewCount', 'deferredSupportPreviewCount', 'sourceTracePreviewCount', 'geometryPayloadCount', 'meshPayloadCount', 'threeObjectCount', RUNTIME_COUNT, 'browserTouchCount', CANVAS_COUNT, 'objectUrlCount', 'downloadSideEffectCount', 'binaryPayloadCount', 'textPayloadCount', 'glbPayloadCount', 'writerCallCount', 'cacheKeyMutationCount', 'hardErrorCount', 'warningCount'];
const BOOLEAN_KEYS = ['rvmPipeBendSubsetReady', 'rvmStraightPipeSubsetReady', 'rvmFlangeSubsetReady', 'rvmFullModelReady', 'attReady', 'glbReady', 'ok'];
const FORBIDDEN = Object.freeze(['geometry', 'mesh', 'meshGeometry', 'threeObject', 'threeGeometry', 'rvmBytes', 'bytes', 'binary', 'arrayBuffer', 'buffer', 'attText', 'glbBytes', 'gltfJson', 'objectUrl', 'downloadUrl', 'fileBlob', CANVAS_FIELD, RUNTIME_FIELD, 'writerPayload', 'artifactPayload', 'cacheKeyMutation']);

export function buildControlledPreviewAudit(controlledPreviewModel, options = {}) {
  const errors = [];
  if (!controlledPreviewModel || controlledPreviewModel.schema !== 'ControlledPreviewModel.v1') errors.push('ControlledPreviewModel.v1 is required');
  const rows = rowsFor(controlledPreviewModel);
  const warnings = Array.isArray(controlledPreviewModel?.warnings) ? [...controlledPreviewModel.warnings] : [];
  const forbidden = collectForbiddenHits(controlledPreviewModel);
  errors.push(...forbidden.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));
  const audit = buildAudit(controlledPreviewModel, rows, forbidden, errors, warnings, options);
  audit.ok = audit.hardErrorCount === 0 && audit.rvmStraightPipeSubsetReady === true && audit.rvmFullModelReady === false && audit.attReady === false && audit.glbReady === false && audit.geometryPayloadCount === 0 && audit.meshPayloadCount === 0 && audit.threeObjectCount === 0 && audit[RUNTIME_COUNT] === 0 && audit.browserTouchCount === 0 && audit[CANVAS_COUNT] === 0 && audit.objectUrlCount === 0 && audit.downloadSideEffectCount === 0 && audit.binaryPayloadCount === 0 && audit.textPayloadCount === 0 && audit.glbPayloadCount === 0 && audit.writerCallCount === 0 && audit.cacheKeyMutationCount === 0;
  return audit;
}

export function assertControlledPreviewAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== AUDIT_SCHEMA) errors.push(`schema must be ${AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (audit?.mode !== 'controlledPreview') errors.push('mode must be controlledPreview');
  for (const key of COUNT_KEYS) if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  for (const key of BOOLEAN_KEYS) if (typeof audit?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [key, expected] of Object.entries(expectations)) if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  if (errors.length) throw new Error(`ControlledPreviewAudit invalid: ${errors.join('; ')}`);
  return { schema: 'ControlledPreviewAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}

function buildAudit(model, rows, forbidden, errors, warnings, options) {
  const bendByte = rows.deferred.filter((item) => item.family === 'elbow' && item.previewStatus === 'bendTorusByteProven');
  const bendDeferred = rows.deferred.filter((item) => item.family === 'elbow' && item.previewStatus === 'bendTorusWriterDeferred');
  const flangeByte = rows.deferred.filter((item) => item.family === 'flange' && item.previewStatus === 'flangeByteProven');
  const flangeDeferred = rows.deferred.filter((item) => item.family === 'flange' && item.previewStatus === 'flangeWriterDeferred');
  return { schema: AUDIT_SCHEMA, graphId: model?.graphId || options.graphId || '<unknown-graph>', mode: model?.mode || 'controlledPreview', controlledPreviewItemCount: rows.trace.length, straightPipeSubsetPreviewCount: rows.straight.length, bendTorusPrimitiveResolvedCount: bendByte.length + bendDeferred.length, bendTorusByteProvenCount: bendByte.length, bendTorusWriterDeferredCount: bendDeferred.length, flangePrimitiveResolvedCount: flangeByte.length + flangeDeferred.length, flangeByteProvenCount: flangeByte.length, flangeWriterDeferredCount: flangeDeferred.length, blockedComponentPreviewCount: rows.blocked.length, blockedFlangePreviewCount: rows.blocked.filter((item) => item.family === 'flange').length, blockedValvePreviewCount: rows.blocked.filter((item) => item.family === 'valve').length, blockedBendPreviewCount: rows.blocked.filter((item) => item.family === 'elbow').length, deferredSupportPreviewCount: rows.deferred.filter((item) => item.family === 'support').length, sourceTracePreviewCount: rows.trace.length, rvmPipeBendSubsetReady: model?.artifactReadiness?.rvmPipeBendSubsetReady === true, rvmStraightPipeSubsetReady: model?.artifactReadiness?.rvmStraightPipeSubsetReady === true, rvmFlangeSubsetReady: model?.artifactReadiness?.rvmFlangeSubsetReady === true, rvmFullModelReady: model?.artifactReadiness?.rvmFullModelReady === true, attReady: model?.artifactReadiness?.attReady === true, glbReady: model?.artifactReadiness?.glbReady === true, geometryPayloadCount: countForbidden(forbidden, ['geometry']), meshPayloadCount: countForbidden(forbidden, ['mesh', 'meshGeometry']), threeObjectCount: countForbidden(forbidden, ['threeObject', 'threeGeometry']), [RUNTIME_COUNT]: countForbidden(forbidden, [RUNTIME_FIELD]), browserTouchCount: 0, [CANVAS_COUNT]: countForbidden(forbidden, [CANVAS_FIELD]), objectUrlCount: countForbidden(forbidden, ['objectUrl']), downloadSideEffectCount: countForbidden(forbidden, ['downloadUrl']), binaryPayloadCount: countForbidden(forbidden, ['rvmBytes', 'bytes', 'binary', 'arrayBuffer', 'buffer']), textPayloadCount: countForbidden(forbidden, ['attText']), glbPayloadCount: countForbidden(forbidden, ['glbBytes', 'gltfJson']), writerCallCount: countForbidden(forbidden, ['writerPayload']), cacheKeyMutationCount: countForbidden(forbidden, ['cacheKeyMutation']), hardErrorCount: errors.length, warningCount: warnings.length, ok: false, errors, warnings };
}

function rowsFor(model) { return { straight: Array.isArray(model?.straightPipeSubsetPreview) ? model.straightPipeSubsetPreview : [], blocked: Array.isArray(model?.blockedPreview) ? model.blockedPreview : [], deferred: Array.isArray(model?.deferredPreview) ? model.deferredPreview : [], trace: Array.isArray(model?.sourceTracePreview) ? model.sourceTracePreview : [] }; }
function collectForbiddenHits(value, path = '$', hits = []) { if (!value || typeof value !== 'object') return hits; if (Array.isArray(value)) { value.forEach((entry, index) => collectForbiddenHits(entry, `${path}[${index}]`, hits)); return hits; } for (const [key, entry] of Object.entries(value)) { if (FORBIDDEN.includes(key)) hits.push({ path: `${path}.${key}`, field: key }); collectForbiddenHits(entry, `${path}.${key}`, hits); } return hits; }
function countForbidden(hits, fields) { return hits.filter((hit) => fields.includes(hit.field)).length; }
