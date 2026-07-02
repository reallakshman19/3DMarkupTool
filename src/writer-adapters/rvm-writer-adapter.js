const RVM_WRITER_ADAPTER_SCHEMA = 'RvmWriterAdapterPlan.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const TRANSFORM_BLOCK_WARNING = 'RVM writer artifact readiness blocked until final review transform policy is implemented.';
const SUBSET_READY_WARNING = 'RVM writer dry-run ready for pipe+bend and flange test-byte subsets; production flange writer remains disabled';
const AXIS_EPSILON = 1e-6;

export function adaptRvmExportModelForWriter(rvmExportModel, exportAudit, options = {}) {
  const mode = options.mode || 'dryRun';
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1' && exportAudit.ok === true;
  const plannedChunks = [];
  const testByteEligibleItems = [];
  const blockedItems = [];
  const deferredItems = [];
  const warnings = [];
  if (canPlan) collectWriterRows(rvmExportModel, plannedChunks, testByteEligibleItems, blockedItems, deferredItems);
  const finalTransformReady = rvmExportModel?.transformApplied === true && rvmExportModel?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY;
  if (!finalTransformReady) warnings.push(TRANSFORM_BLOCK_WARNING);
  const counts = countRows(plannedChunks, testByteEligibleItems, deferredItems);
  const writerReady = canPlan && plannedChunks.length > 0 && finalTransformReady;
  const pipeBendSubsetTestByteReady = writerReady && counts.testByteEligibleTorusCount > 0;
  const flangeSubsetTestByteReady = writerReady && counts.flangeTestByteEligibleCount > 0;
  if (writerReady) warnings.push(SUBSET_READY_WARNING);
  return buildAdapter(rvmExportModel, options, mode, writerReady, pipeBendSubsetTestByteReady, flangeSubsetTestByteReady, plannedChunks, testByteEligibleItems, blockedItems, deferredItems, counts, warnings);
}

function collectWriterRows(rvmExportModel, plannedChunks, testByteEligibleItems, blockedItems, deferredItems) {
  for (const primitive of Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives : []) if (isCylinderCode8Plan(primitive)) plannedChunks.push({ chunkKind: 'PRIM', sourcePrimitiveId: primitive.sourcePrimitiveId, sourceItemId: primitive.sourceItemId, primitiveKind: 'CYLINDER', primitiveCode: 8, writerStatus: 'planned', reason: 'writer-neutral cylinder primitive plan accepted', sourceRef: primitive.sourceRef });
  for (const primitive of Array.isArray(rvmExportModel?.testByteEligiblePrimitives) ? rvmExportModel.testByteEligiblePrimitives : []) if (isTorusCode4TestPlan(primitive)) testByteEligibleItems.push(testItem(primitive, 'elbow', 'bend', 'TORUS', 4, 'TORUS/code4 eligible for isolated Phase 11B test-byte bridge'));
  for (const primitive of Array.isArray(rvmExportModel?.flangeTestByteEligiblePrimitives) ? rvmExportModel.flangeTestByteEligiblePrimitives : []) if (isFlangeCode8TestPlan(primitive)) testByteEligibleItems.push(testItem(primitive, 'flange', 'flange', 'FLANGE_CYLINDER', 8, 'FLANGE_CYLINDER/code8 eligible for isolated Phase 11C-B test-byte bridge'));
  for (const blocked of Array.isArray(rvmExportModel?.blockedExports) ? rvmExportModel.blockedExports : []) blockedItems.push(statusItem(blocked, 'blocked'));
  for (const deferred of Array.isArray(rvmExportModel?.deferredExports) ? rvmExportModel.deferredExports : []) if (!isTestByteDeferred(deferred)) deferredItems.push(statusItem(deferred, 'deferred'));
}

function buildAdapter(rvmExportModel, options, mode, writerReady, pipeBendReady, flangeReady, plannedChunks, testItems, blockedItems, deferredItems, counts, warnings) {
  return { schema: RVM_WRITER_ADAPTER_SCHEMA, graphId: rvmExportModel?.graphId || options.graphId || '<unknown-graph>', writerKind: 'rvm', mode, writerReady, testByteReady: pipeBendReady || flangeReady, pipeBendSubsetTestByteReady: pipeBendReady, flangeSubsetTestByteReady: flangeReady, writerReadinessScope: readinessScope(writerReady, pipeBendReady, flangeReady), sourceSchema: 'RvmExportModel.v1', transformPolicy: rvmExportModel?.transformPolicy || '<missing-transform-policy>', transformApplied: rvmExportModel?.transformApplied === true, plannedPrimitiveCount: plannedChunks.length, plannedCylinderCount: counts.plannedCylinderCount, plannedTorusCount: 0, plannedBoxCount: 0, plannedSphereCount: 0, plannedPyramidCount: 0, testByteEligibleTorusCount: counts.testByteEligibleTorusCount, testByteEligibleBendTorusCount: counts.testByteEligibleBendTorusCount, productionReadyTorusCount: 0, deferredFlangeWriterCount: counts.deferredFlangeWriterCount, flangeWriterReadyCount: 0, flangeTestByteEligibleCount: counts.flangeTestByteEligibleCount, productionReadyFlangeCount: 0, plannedChunks, testByteEligibleItems: testItems, blockedItems, deferredItems, warnings };
}

function countRows(plannedChunks, testItems, deferredItems) {
  return { plannedCylinderCount: plannedChunks.filter((entry) => entry.primitiveKind === 'CYLINDER').length, testByteEligibleTorusCount: testItems.filter((entry) => entry.primitiveKind === 'TORUS').length, testByteEligibleBendTorusCount: testItems.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, flangeTestByteEligibleCount: testItems.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER').length, deferredFlangeWriterCount: deferredItems.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER').length };
}

function readinessScope(writerReady, pipeBendReady, flangeReady) {
  if (pipeBendReady && flangeReady) return 'pipeBendAndFlangeSubsetsTestByteReady';
  if (pipeBendReady) return 'pipeBendSubsetTestByteReady';
  if (flangeReady) return 'flangeSubsetTestByteReady';
  return writerReady ? 'straightPipeSubsetDryRunReady' : 'blocked';
}

function testItem(primitive, family, defaultType, primitiveKind, primitiveCode, reason) {
  return { sourcePrimitiveId: primitive.sourcePrimitiveId, sourceItemId: primitive.sourceItemId, family, type: primitive.type || defaultType, primitiveKind, primitiveCode, resolver: primitive.resolver, writerStatus: 'testByteEligible', reason, sourceRef: primitive.sourceRef };
}

function statusItem(entry, writerStatus) { return { sourceItemId: entry.sourceItemId, sourcePrimitiveId: entry.sourcePrimitiveId, family: entry.family, type: entry.type, primitiveKind: entry.primitiveKind, primitiveCode: entry.primitiveCode, resolver: entry.resolver, writerStatus, reason: entry.reason, sourceRef: entry.sourceRef }; }
function isTestByteDeferred(entry) { return entry.testByteEligible === true && ((entry.family === 'elbow' && entry.primitiveKind === 'TORUS') || (entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER')); }
function isCylinderCode8Plan(primitive) { return primitive?.primitiveKind === 'CYLINDER' && Number(primitive?.primitiveCode) === 8 && isPoint3(primitive?.center) && isPoint3(primitive?.axis) && isUnitVector(primitive.axis) && finitePositive(primitive?.lengthMm) && finitePositive(primitive?.radiusMm) && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY && primitive?.basis === 'navis-review'; }
function isTorusCode4TestPlan(primitive) { return primitive?.primitiveKind === 'TORUS' && Number(primitive?.primitiveCode) === 4 && primitive?.testByteEligible === true && primitive?.writerReady === false && primitive?.basis === 'navis-review' && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY && isPoint3(primitive?.center) && ['normal', 'startTangent', 'endTangent'].every((key) => isPoint3(primitive?.[key]) && isUnitVector(primitive[key])) && ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg'].every((key) => finitePositive(primitive?.[key])); }
function isFlangeCode8TestPlan(primitive) { return primitive?.primitiveKind === 'FLANGE_CYLINDER' && Number(primitive?.primitiveCode) === 8 && primitive?.family === 'flange' && primitive?.testByteEligible === true && primitive?.writerReady === false && primitive?.basis === 'navis-review' && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY && primitive?.transformApplied === true && isPoint3(primitive?.center) && isPoint3(primitive?.axis) && isUnitVector(primitive.axis) && ['lengthMm', 'outerRadiusMm', 'boreRadiusMm'].every((key) => finitePositive(primitive?.[key])) && Number(primitive.outerRadiusMm) > Number(primitive.boreRadiusMm) && Boolean(primitive.catalogueItemId) && Boolean(primitive.catalogueRef) && primitive?.evidence?.fallbackUsed !== true; }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function isUnitVector(value) { const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2])); return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON; }
function finitePositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
