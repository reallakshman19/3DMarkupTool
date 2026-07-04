const CONTROLLER_SCHEMA = 'ManagedStageJsonUiController.v5';
const MANAGED_STAGE_SCHEMA = 'inputxml-managed-stage/v1';
const MANAGED_STAGE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
const NON_BLOCKING_MANAGED_STAGE_AUDIT_PATTERNS = Object.freeze([
  '^expected skipped support records:',
  '^expected support records emitted to RVM:',
  '^expected support RVM primitive count:',
  '^expected topology component count:',
  '^expected topology geometry component count:',
  '^expected topology support count:',
  '^expected explicit BEND record count:',
  '^expected explicit BEND detail count:',
  '^expected missing explicit BEND detail count:',
  '^expected synthetic 1.5D trim blocked count:',
  '^expected support association-only count:',
  '^expected support topology blocked count:',
  '^expected support continuity edge count:',
  '^expected support inline face count:',
  '^expected code 1 pyramid primitives:',
  '^expected code 4 torus primitives:',
  '^expected code 8 cylinder primitives:',
  '^expected CNTB count:',
  '^expected PRIM count:'
]);
const BM_CII_STAGED_JSON_EXPECTATIONS = Object.freeze({
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  supportRecordsEmittedToRvm: 12,
  supportRvmPrimitiveCount: 34,
  topologyComponentCount: 52,
  topologyGeometryComponentCount: 40,
  topologySupportCount: 12,
  explicitBendRecordCount: 7,
  explicitBendDetailCount: 7,
  missingExplicitBendDetailCount: 0,
  synthetic1p5DTrimBlockedCount: 7,
  supportAssociationOnlyCount: 12,
  supportTopologyBlockedCount: 0,
  supportContinuityEdgeCount: 0,
  supportInlineFaceCount: 0,
  primitiveCodeCounts: { 1: 0, 4: 0, 8: 149 },
  code1: 0,
  cntbCount: 56,
  primCount: 149,
  supportMaxGlyphExtentMm: 100,
  supportMaxClusterOffsetMm: 30,
  supportMaxPrimitiveSpanMm: 60,
  supportMaxBarRadiusMm: 3,
  forbiddenPrimitiveCodesPresent: [],
  nonBlockingAuditIssuePatterns: NON_BLOCKING_MANAGED_STAGE_AUDIT_PATTERNS
});

const managedStageUiState = {
  sourceText: '',
  sourceName: '',
  basename: 'managed-stage',
  artifact: null,
  modelRoot: null
};

let managedStageRuntimeModulesPromise = null;

installManagedStageJsonUi();

export function installManagedStageJsonUi() {
  if (window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.schema === CONTROLLER_SCHEMA) {
    return window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  }

  const modelFileInput = ensureUnifiedModelFileInput();
  ensureUnifiedDropZone(modelFileInput);
  const button = ensureUnifiedModelButton(document.querySelector('.input-primary-actions'), modelFileInput);
  if (button && button.dataset.managedStageJsonUiBound !== '1') {
    button.dataset.managedStageJsonUiBound = '1';
    button.addEventListener('click', () => modelFileInput.click());
  }
  modelFileInput.addEventListener('change', onUnifiedModelFileChange, true);

  installManagedStageButtonInterceptors(modelFileInput);
  installBrowserCylinderCode8PilotPanel();
  const api = {
    schema: CONTROLLER_SCHEMA,
    loadText: loadManagedStageText,
    loadFile: loadManagedStageFile,
    getActiveArtifact: () => managedStageUiState.artifact,
    getActiveSourceText: () => managedStageUiState.sourceText,
    getActiveSourceName: () => managedStageUiState.sourceName,
    getPilotActionModel: getBrowserCylinderCode8PilotActionModel,
    getPipeBendPilotActionModel: getBrowserPipeBendPilotActionModel,
    getPipeBendFlangePilotActionModel: getBrowserPipeBendFlangePilotActionModel,
    getValvePilotActionModel: getBrowserValvePilotActionModel,
    generateCylinderCode8PilotExport: () => runBrowserCylinderCode8PilotExport(true),
    generatePipeBendPilotExport: () => runBrowserPipeBendPilotExport(true),
    generatePipeBendFlangePilotPackage: () => runBrowserPipeBendFlangePilotExport(true),
    generateCompleteRvmPackage: () => runBrowserExportV2FullPilotPackage(true),
    generatePipeBendFlangeValvePilotPackage: () => runBrowserValvePilotExport(true),
    generateSupportMarkerPilotPackage: () => runBrowserSupportMarkerPilotExport(true),
    clear: clearManagedStagePreview
  };
  window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__ = api;
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-ui-ready', { detail: { schema: CONTROLLER_SCHEMA } }));
  return api;
}

function ensureUnifiedModelFileInput() { const input = document.getElementById('xmlFile'); if (!input) throw new Error('Managed-stage JSON UI cannot find #xmlFile'); input.accept = '.json,.jscon,application/json'; input.setAttribute('aria-label', 'Load stagedJson'); input.dataset.acceptsManagedStageJson = 'true'; return input; }
function ensureUnifiedDropZone(input) { const drop = input.closest('.file-drop'); if (!drop) return; drop.title = 'Choose stagedJson or BM_CII_INPUT_managed_stage.json'; drop.setAttribute('aria-label', 'Choose stagedJson'); const span = drop.querySelector('span'); if (span) span.textContent = 'Choose stagedJson'; }
function ensureUnifiedModelButton(host, modelFileInput) { const existing = document.getElementById('loadUnifiedModelFileBtn'); if (existing) existing.remove(); return null; }

function onUnifiedModelFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!isJsonFileName(file.name)) { resetManagedStageStateOnly(); return; }
  event.preventDefault();
  event.stopImmediatePropagation();
  loadManagedStageFile(file).catch((error) => { log(`ERROR managed-stage JSON load failed: ${error.message}`); setStatus('Managed-stage JSON load failed'); });
}

async function loadManagedStageFile(file) { resetSupportBasisToInputXml('managed-stage-file-load'); const sourceText = await file.text(); if (!looksLikeManagedStageJson(sourceText, file.name)) throw new Error(`${file.name} is JSON, but not ${MANAGED_STAGE_SCHEMA} / ${MANAGED_STAGE_PROFILE}`); return loadManagedStageText(sourceText, file.name); }

async function loadManagedStageText(sourceText, sourceName = 'BM_CII_INPUT_managed_stage.json') {
  managedStageUiState.sourceText = sourceText;
  managedStageUiState.sourceName = sourceName;
  managedStageUiState.basename = basenameWithoutExtension(sourceName);
  setStatus('Managed-stage JSON converting');
  updateInputStatus(`${sourceName} — managed-stage JSON`);
  log(`Loaded managed-stage JSON ${sourceName} (${sourceText.length.toLocaleString()} chars)`);
  const { convertManagedStageJsonToRvmAtt, createManagedStagePreviewScene, buildSupportMarkerGlbObject, createRvmPreviewScene } = await getManagedStageRuntimeModules();
  const options = managedStageRvmOptions(sourceName);
  const result = convertManagedStageJsonToRvmAtt(sourceText, options);
  let coordinateAuditScene = null;
  let previewAudit = null;
  try { coordinateAuditScene = createManagedStagePreviewScene(sourceText, { sourceName, exportModel: result.exportModel }); replaceManagedStagePreviewSupportMarkers(coordinateAuditScene, result.sourceContract?.supports || [], buildSupportMarkerGlbObject); previewAudit = coordinateAuditScene.userData?.managedStageCoordinateAudit || null; } catch (err) { log(`[managed-stage] Coordinate-preservation self-test skipped (non-blocking): ${err?.message || err}`); }
  const visibleDiagnostics = buildManagedStageVisibleDiagnostics(result.audit, previewAudit);
  const previewScene = createRvmPreviewScene(result.exportModel, { recenter: false, sceneName: `${managedStageUiState.basename}_EXPORTED_RVM_PREVIEW` });
  previewScene.userData = { ...(previewScene.userData || {}), TYPE: 'MANAGED_STAGE_EXPORTED_RVM_PREVIEW', SOURCE_FORMAT: MANAGED_STAGE_SCHEMA, sourceName, geometryComponents: result.audit?.inputCounts?.geometryComponents, primitiveCount: result.audit?.rvmPrimitivePayloadContract?.primitiveCount, previewPipeline: 'exported-rvm-export-model-geometry', coordinatePreservationPipeline: 'raw-managed-stage-json-coordinate-preserving-explicit-bend-topology-gated', managedStageCoordinateAudit: previewAudit, managedStageVisibleDiagnostics: visibleDiagnostics };
  managedStageUiState.artifact = { sourceText, sourceName, basename: managedStageUiState.basename, rvm: result.rvm, att: result.att, audit: result.audit, exportModel: result.exportModel, profile: result.profile, sourceContract: result.sourceContract, previewScene, coordinateAuditScene, previewPipeline: 'exported-rvm-export-model-geometry', coordinatePreservationPipeline: 'raw-managed-stage-json-coordinate-preserving-explicit-bend-topology-gated', previewCoordinateAudit: previewAudit, visibleDiagnostics };
  showManagedStagePreview(previewScene);
  enableManagedStageDownloads();
  setStatus('Managed-stage RVM ready');
  updateDrawerSummary(result.audit, previewAudit);
  updateManagedStageDiagnosticsPanel(result.audit, previewAudit);
  logManagedStageSummary(result.audit);
  logManagedStagePreviewCoordinateAudit(previewAudit);
  logManagedStageVisibleDiagnostics(visibleDiagnostics);
  showManagedStageAuditWarnings(result.audit?.managedStageStrictGate);
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-loaded', { detail: { sourceName, sourceText, audit: result.audit, sourceContract: result.sourceContract, supportSourceBasis: result.sourceContract?.supportSourceBasis || result.audit?.supportSourceBasis || null, previewCoordinateAudit: previewAudit, visibleDiagnostics, modelRoot: previewScene } }));
  return managedStageUiState.artifact;
}

function getManagedStageRuntimeModules() { if (!managedStageRuntimeModulesPromise) { managedStageRuntimeModulesPromise = Promise.all([import('./managed-stage-rvm-converter.js?v=bust-cache-6-source-root'), import('./managed-stage-preview-scene-explicit-bend.js?v=bust-cache-4'), import('./support-marker-primitive-policy.js?v=bust-cache-4'), import('./rvm-preview.js?v=bust-cache-4')]).then(([converter, preview, markerPolicy, rvmPreview]) => ({ convertManagedStageJsonToRvmAtt: converter.convertManagedStageJsonToRvmAtt, createManagedStagePreviewScene: preview.createManagedStagePreviewScene, buildSupportMarkerGlbObject: markerPolicy.buildSupportMarkerGlbObject, createRvmPreviewScene: rvmPreview.createRvmPreviewScene })); } return managedStageRuntimeModulesPromise; }

function replaceManagedStagePreviewSupportMarkers(scene, supports, buildSupportMarkerGlbObject) {
  const removals = [];
  scene?.traverse?.((object) => { if (object?.userData?.TYPE === 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW') removals.push(object); });
  for (const object of removals) object.parent?.remove(object);
  if (!Array.isArray(supports) || !supports.length) return;
  for (const support of supports) scene.add(buildSupportMarkerGlbObject(support, { sceneScale: 1 }));
  scene.userData = { ...(scene.userData || {}), supportMarkerSource: 'contract.supports', supportMarkerCount: supports.length, supportMarkerPolicy: 'SupportMarkerPrimitivePolicy.v1' };
  const audit = scene.userData?.managedStageCoordinateAudit;
  if (audit) { audit.supportMarkerSource = 'contract.supports'; audit.supportMarkerCount = supports.length; audit.supportPreviewSelectable = true; audit.supportVisualPolicy = { ...(audit.supportVisualPolicy || {}), selectableContract: 'SUPPORT_MARKER', supportPreviewRaycastDisabled: false }; }
}

function showManagedStagePreview(previewScene) { managedStageUiState.modelRoot = previewScene; const api = window.__viewerApi; if (api?.setModelRoot) api.setModelRoot(previewScene, { source: CONTROLLER_SCHEMA, mode: 'managed-stage-rvm' }); else if (window.__3D_MARKUP_VIEWER_RUNTIME__?.scene) { const scene = window.__3D_MARKUP_VIEWER_RUNTIME__.scene; if (managedStageUiState.modelRoot?.parent === scene) scene.remove(managedStageUiState.modelRoot); scene.add(previewScene); } }
function clearManagedStagePreview() { if (managedStageUiState.modelRoot?.parent) managedStageUiState.modelRoot.parent.remove(managedStageUiState.modelRoot); managedStageUiState.sourceText = ''; managedStageUiState.sourceName = ''; managedStageUiState.artifact = null; managedStageUiState.modelRoot = null; }
function enableManagedStageDownloads() { setButton('downloadRvmBtn', false, () => downloadBlob(managedStageUiState.artifact.rvm, `${managedStageUiState.basename}.rvm`, 'application/octet-stream')); setButton('downloadAttBtn', false, () => downloadBlob(managedStageUiState.artifact.att, `${managedStageUiState.basename}.att`, 'text/plain')); setButton('downloadAuditBtn', false, () => downloadBlob(JSON.stringify(managedStageUiState.artifact.audit, null, 2), `${managedStageUiState.basename}.audit.json`, 'application/json')); setButton('previewRvmBtn', false, () => showManagedStagePreview(managedStageUiState.artifact.previewScene)); }
function setButton(id, disabled, onClick) { const button = document.getElementById(id); if (!button) return; button.disabled = disabled; if (onClick) button.onclick = onClick; }

function installManagedStageButtonInterceptors(modelFileInput) { document.getElementById('loadSampleBtn')?.addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); loadBundledManagedStageSample().catch((error) => { log(`ERROR loading BM_CII stagedJson sample: ${error.message}`); setStatus('BM_CII stagedJson load failed'); }); }, true); }

function installBrowserCylinderCode8PilotPanel() {
  if (document.getElementById('newCorePilotExportPanel')) return;
  const host = document.querySelector('[data-section="export"]') || document.querySelector('.input-primary-actions') || document.body;
  const grid = host.querySelector?.('.download-grid') || null;
  const panel = document.createElement('details');
  panel.id = 'newCorePilotExportPanel';
  panel.className = 'export-v2-menu advanced-pilot-export-panel';
  // Phase 7: button label reflects fullModelReady feature flag state
  const valveLabel = window.__3D_MARKUP_EXPORT_V2_FULL_MODEL_ENABLED__ === true
    ? 'Export Full Production Package'
    : 'Export Full Pilot Package';
  panel.innerHTML = `<summary class="export-v2-trigger"><i data-lucide="package-plus"></i><span>Export V2</span></summary><div class="export-v2-menu-list" role="menu" aria-label="Export V2 pilot actions"><button id="generateCylinderCode8PilotRvmBtn" type="button" role="menuitem">Export Cylinders (RVM)</button><button id="generatePipeBendPilotRvmBtn" type="button" role="menuitem">Export Pipes + Bends (RVM)</button><button id="generatePipeBendFlangePilotPackageBtn" type="button" role="menuitem">Export Pipes + Bends + Flanges (Package)</button><button id="generatePipeBendFlangeValvePilotPackageBtn" type="button" role="menuitem">${valveLabel}</button><button id="generateSupportMarkerPilotPackageBtn" type="button" role="menuitem">Export Support Markers Only (Package)</button><div id="newCorePilotExportStatus" aria-live="polite">Pilot export idle.</div></div>`;
  (grid || host).appendChild(panel);
  bindExportV2Action(panel, '#generateCylinderCode8PilotRvmBtn', runBrowserCylinderCode8PilotExport);
  bindExportV2Action(panel, '#generatePipeBendPilotRvmBtn', runBrowserPipeBendPilotExport);
  bindExportV2Action(panel, '#generatePipeBendFlangePilotPackageBtn', runBrowserPipeBendFlangePilotExport);
  bindExportV2Action(panel, '#generatePipeBendFlangeValvePilotPackageBtn', runBrowserExportV2FullPilotPackage);
  bindExportV2Action(panel, '#generateSupportMarkerPilotPackageBtn', runBrowserSupportMarkerPilotExport);
  window.lucide?.createIcons?.();
}

function bindExportV2Action(panel, selector, action) {
  panel.querySelector(selector)?.addEventListener('click', () => {
    panel.removeAttribute('open');
    action(true);
  });
}

async function runBrowserCylinderCode8PilotExport(userGestureConfirmed = false) { const status = document.getElementById('newCorePilotExportStatus'); if (!userGestureConfirmed) return setPilotStatus(status, 'New-Core Pilot Export blocked: user gesture missing'); if (!managedStageUiState.artifact && !managedStageUiState.sourceText) return setPilotStatus(status, 'New-Core Pilot Export blocked: no managed-stage/new-core input loaded'); try { const [{ generateBrowserCylinderCode8PilotExport }, ui] = await Promise.all([import('./runtime-pilot/browser-cylinder-code8-pilot-export.js?v=bust-cache-4'), import('./runtime-pilot/browser-cylinder-code8-pilot-ui.js?v=bust-cache-4')]); const result = await ui.executeBrowserCylinderCode8PilotAction(activePilotState(), { generateBrowserCylinderCode8PilotExport, downloadHost: window }); setPilotStatus(status, result.statusMessage); log(result.statusMessage); return result; } catch (error) { return setPilotStatus(status, `New-Core Pilot Export blocked: ${error?.message || error}`); } }
async function runBrowserPipeBendPilotExport(userGestureConfirmed = false) { const status = document.getElementById('newCorePilotExportStatus'); if (!userGestureConfirmed) return setPilotStatus(status, 'New-Core Pipe+Bend Pilot Export blocked: user gesture missing'); if (!managedStageUiState.artifact && !managedStageUiState.sourceText) return setPilotStatus(status, 'New-Core Pipe+Bend Pilot Export blocked: no managed-stage/new-core input loaded'); try { const [{ generateBrowserPipeBendPilotExport }, ui] = await Promise.all([import('./runtime-pilot/browser-pipe-bend-pilot-export.js?v=bust-cache-4'), import('./runtime-pilot/browser-pipe-bend-pilot-ui.js?v=bust-cache-4')]); const result = await ui.executeBrowserPipeBendPilotAction(activePilotState(), { generateBrowserPipeBendPilotExport, downloadHost: window }); setPilotStatus(status, result.statusMessage); log(result.statusMessage); return result; } catch (error) { return setPilotStatus(status, `New-Core Pipe+Bend Pilot Export blocked: ${error?.message || error}`); } }
async function runBrowserPipeBendFlangePilotExport(userGestureConfirmed = false) { const status = document.getElementById('newCorePilotExportStatus'); if (!userGestureConfirmed) return setPilotStatus(status, 'New-Core Pipe+Bend+Flange Pilot Package blocked: user gesture missing'); if (!managedStageUiState.artifact && !managedStageUiState.sourceText) return setPilotStatus(status, 'New-Core Pipe+Bend+Flange Pilot Package blocked: no managed-stage/new-core input loaded'); try { const [{ generateBrowserPipeBendFlangePilotExport }, ui] = await Promise.all([import('./runtime-pilot/browser-pipe-bend-flange-pilot-export.js?v=bust-cache-4'), import('./runtime-pilot/browser-pipe-bend-flange-pilot-ui.js?v=bust-cache-4')]); const result = await ui.executeBrowserPipeBendFlangePilotAction(activePilotState(), { generateBrowserPipeBendFlangePilotExport, downloadHost: window }); setPilotStatus(status, result.statusMessage); log(result.statusMessage); return result; } catch (error) { return setPilotStatus(status, `New-Core Pipe+Bend+Flange Pilot Package blocked: ${error?.message || error}`); } }
async function runBrowserValvePilotExport(userGestureConfirmed = false) { const status = document.getElementById('newCorePilotExportStatus'); if (!userGestureConfirmed) return setPilotStatus(status, 'New-Core Pipe+Bend+Flange+Valve Pilot Package blocked: user gesture missing'); if (!managedStageUiState.artifact && !managedStageUiState.sourceText) return setPilotStatus(status, 'New-Core Pipe+Bend+Flange+Valve Pilot Package blocked: no managed-stage/new-core input loaded'); try { const [{ generateBrowserValvePilotExport }, ui] = await Promise.all([import('./runtime-pilot/browser-valve-pilot-export.js?v=bust-cache-4'), import('./runtime-pilot/browser-valve-pilot-ui.js?v=bust-cache-4')]); const result = await ui.executeBrowserValvePilotAction(activePilotState(), { generateBrowserValvePilotExport, downloadHost: window }); setPilotStatus(status, result.statusMessage); log(result.statusMessage); return result; } catch (error) { return setPilotStatus(status, `New-Core Pipe+Bend+Flange+Valve Pilot Package blocked: ${error?.message || error}`); } }

async function runBrowserExportV2FullPilotPackage(userGestureConfirmed = false) {
  const status = document.getElementById('newCorePilotExportStatus');
  if (!userGestureConfirmed) return setPilotStatus(status, 'Export V2 full package blocked: user gesture missing');
  if (!managedStageUiState.sourceText) return setPilotStatus(status, 'Export V2 full package blocked: no managed-stage/new-core input loaded');
  try {
    const [{ executeNewCorePilotRoute }, { generateBrowserManagedStageExportV2Package }] = await Promise.all([
      import('./runtime-switch/new-core-pilot-route-controller.js?v=bust-cache-2-export-v2-rich'),
      import('./runtime-pilot/browser-managed-stage-export-v2-package.js?v=bust-cache-1-rich')
    ]);
    const route = await executeNewCorePilotRoute(activeExportV2State(), { generatePilotPackage: generateBrowserManagedStageExportV2Package }, { enabled: true, userGestureConfirmed: true, basename: `${managedStageUiState.basename || 'managed-stage'}.export-v2` });
    if (!route?.ok) return setPilotStatus(status, `Export V2 full package blocked: ${(route?.audit?.errors || ['new-core route blocked']).join('; ')}`);
    const bundle = route.packageResult;
    const audit = buildExportV2IndependentAudit(route);
    const downloads = downloadExportV2Package(bundle, audit, managedStageUiState.basename || 'managed-stage');
    const packageAudit = bundle?.audit || {};
    const statusMessage = `Export V2 full package generated independently: ${packageAudit.plannedRvmPrimitiveCount || 0} rich RVM primitives, ${packageAudit.hierarchyNodeCount || 0} hierarchy nodes, ${packageAudit.code4BendCount || 0} code-4 bends. Legacy RVM export untouched. Full RVM ready: ${packageAudit.fullModelReady === true}.`;
    if (status) status.textContent = statusMessage;
    log(statusMessage);
    return { schema: 'BrowserExportV2FullPilotPackageUiResult.v1', ok: true, downloadCount: downloads.length, downloads, statusMessage, audit };
  } catch (error) {
    return setPilotStatus(status, `Export V2 full package blocked: ${error?.message || error}`);
  }
}

async function runBrowserSupportMarkerPilotExport(userGestureConfirmed = false) { 
  const status = document.getElementById('newCorePilotExportStatus'); 
  if (!userGestureConfirmed) return setPilotStatus(status, 'New-Core Support Marker Pilot Package blocked: user gesture missing'); 
  if (!managedStageUiState.artifact && !managedStageUiState.sourceText) return setPilotStatus(status, 'New-Core Support Marker Pilot Package blocked: no managed-stage/new-core input loaded'); 
  try { 
    const [{ generateBrowserSupportMarkerPilotExport }, ui] = await Promise.all([import('./runtime-pilot/browser-support-marker-pilot-export.js?v=bust-cache-4'), import('./runtime-pilot/browser-support-marker-pilot-ui.js?v=bust-cache-4')]); 
    const result = await ui.executeBrowserSupportMarkerPilotAction(activePilotState(), { generateBrowserSupportMarkerPilotExport, downloadHost: window }); 
    setPilotStatus(status, result.statusMessage); 
    log(result.statusMessage); 
    return result; 
  } catch (error) { 
    return setPilotStatus(status, `New-Core Support Marker Pilot Package blocked: ${error?.message || error}`); 
  } 
}
async function getBrowserCylinderCode8PilotActionModel() { const ui = await import('./runtime-pilot/browser-cylinder-code8-pilot-ui.js?v=bust-cache-4'); return ui.createCylinderCode8PilotActionModel(); }
async function getBrowserPipeBendPilotActionModel() { const ui = await import('./runtime-pilot/browser-pipe-bend-pilot-ui.js?v=bust-cache-4'); return ui.createPipeBendPilotActionModel(); }
async function getBrowserPipeBendFlangePilotActionModel() { const ui = await import('./runtime-pilot/browser-pipe-bend-flange-pilot-ui.js?v=bust-cache-4'); return ui.createPipeBendFlangePilotActionModel(); }
async function getBrowserValvePilotActionModel() { const ui = await import('./runtime-pilot/browser-valve-pilot-ui.js?v=bust-cache-4'); return ui.createValvePilotActionModel(); }
function activePilotState() { return { sourceText: managedStageUiState.sourceText, sourceName: managedStageUiState.sourceName, basename: managedStageUiState.basename, artifact: managedStageUiState.artifact }; }
function activeExportV2State() { return { sourceText: managedStageUiState.sourceText, sourceName: managedStageUiState.sourceName, basename: managedStageUiState.basename }; }
function setPilotStatus(element, message) { if (element) element.textContent = message; return { schema: 'BrowserPilotUiResult.v1', ok: false, statusMessage: message, downloadCount: 0, downloads: [] }; }

async function loadBundledManagedStageSample() { resetSupportBasisToInputXml('bm-cii-bundled-sample'); const dataModule = await import('./managed-stage-bm-cii-json-sample-data.js?v=bust-cache-4').catch(() => null); if (typeof dataModule?.createBmCiiManagedStageSampleJson === 'function') { const text = dataModule.createBmCiiManagedStageSampleJson(); const name = dataModule.BM_CII_MANAGED_STAGE_SAMPLE_NAME || 'BM_CII_INPUT_managed_stage.json'; log(`Loaded bundled ${name} (${text.length.toLocaleString()} chars) via in-memory sample data`); return loadManagedStageText(text, name); } const text = await fetchManagedStageSampleText(); return loadManagedStageText(text, 'BM_CII_INPUT_managed_stage.json'); }
async function fetchManagedStageSampleText() { const candidates = ['./src/BM_CII_INPUT_managed_stage.json', './BM_CII_INPUT_managed_stage.json', './samples/BM_CII_INPUT_managed_stage.json']; const failures = []; for (const url of candidates) { try { const response = await fetch(url); if (response.ok) { log(`Loaded BM_CII stagedJson sample from ${url}`); return response.text(); } failures.push(`${url}: HTTP ${response.status}`); } catch (error) { failures.push(`${url}: ${error?.message || error}`); } } throw new Error(`Unable to load BM_CII_INPUT_managed_stage.json from bundled data or fallback URLs. ${failures.join(' | ')}`); }
function resetSupportBasisToInputXml(reason = 'managed-stage-load') { const select = document.getElementById('supportMode'); if (select) { ensureSupportModeOption(select, 'stagedJson', 'InputXML Basis — use staged InputXML supports'); if (select.value !== 'stagedJson') { select.value = 'stagedJson'; select.dispatchEvent(new Event('change', { bubbles: true })); } } const supportUi = window.__3D_MARKUP_SUPPORT_SOURCE_UI__; if (supportUi && typeof supportUi === 'object') { supportUi.sourceMode = 'stagedJson'; supportUi.activeBasis = 'InputXML Basis'; supportUi.lastBasisResetReason = reason; } window.dispatchEvent(new CustomEvent('viewer:support-basis-reset', { detail: { reason, sourceMode: 'stagedJson', activeBasis: 'InputXML Basis' } })); }
function ensureSupportModeOption(select, value, label) { if (Array.from(select.options || []).some((option) => option.value === value)) return; const option = document.createElement('option'); option.value = value; option.textContent = label || value; select.appendChild(option); }
function looksLikeManagedStageJson(sourceText, sourceName = '') { if (!isJsonFileName(sourceName)) return false; try { const parsed = JSON.parse(sourceText); return parsed?.schema === MANAGED_STAGE_SCHEMA && parsed?.profile === MANAGED_STAGE_PROFILE; } catch (_) { return false; } }
function isJsonFileName(name = '') { return /\.json$|\.jscon$/i.test(String(name)); }
function basenameWithoutExtension(name = '') { return String(name || 'managed-stage').replace(/\.[^.]+$/, '') || 'managed-stage'; }
function bmCiiLikeSourceName(name = '') { return /BM_CII/i.test(String(name)); }
function managedStageRvmOptions(sourceName = '') {
  return {
    ...(bmCiiLikeSourceName(sourceName) ? { strictAuditExpectations: BM_CII_STAGED_JSON_EXPECTATIONS } : {}),
    excludeBendsWhileProcessingInputXmlBasedJson: true,
    allowManagedStageCode4Elbows: false
  };
}
function resetManagedStageStateOnly() { managedStageUiState.sourceText = ''; managedStageUiState.sourceName = ''; managedStageUiState.artifact = null; managedStageUiState.modelRoot = null; }
function log(message) { const el = document.getElementById('log'); if (el) el.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`; else console.log(message); }
function setStatus(message) { const el = document.getElementById('runtimeStatus'); if (el) el.textContent = message; }
function updateInputStatus(message) { const el = document.getElementById('inputStatus'); if (el) el.textContent = message; }
function downloadBlob(content, filename, mime) { if (!content) return; const blob = content instanceof Blob ? content : new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2500); }
function downloadExportV2Package(bundle, audit, basename) {
  const base = `${basename || 'managed-stage'}.export-v2`;
  const files = [
    { filename: `${base}.rvm`, mimeType: bundle?.rvmFile?.mimeType || 'application/octet-stream', content: bundle?.rvmFile?.bytes },
    { filename: `${base}.att`, mimeType: bundle?.attFile?.mimeType || 'text/plain', content: bundle?.attFile?.text },
    { filename: `${base}.audit.json`, mimeType: 'application/json', content: `${JSON.stringify(audit, null, 2)}\n` }
  ].filter((file) => file.content);
  for (const file of files) downloadBlob(file.content, file.filename, file.mimeType);
  return files.map(({ filename, mimeType }) => ({ filename, mimeType }));
}
function buildExportV2IndependentAudit(route) {
  const routeAudit = route?.audit || {};
  const packageAudit = route?.packageResult?.audit || {};
  return {
    schema: 'BrowserExportV2IndependentPackageAudit.v1',
    ok: route?.ok === true && routeAudit.oldProductionPathTouched === false && routeAudit.defaultProductionPathChanged === false,
    newCoreRouteUsed: true,
    legacyManagedStageArtifactRead: false,
    oldProductionPathTouched: routeAudit.oldProductionPathTouched === true,
    defaultProductionPathChanged: routeAudit.defaultProductionPathChanged === true,
    fullModelReady: packageAudit.fullModelReady === true,
    routeAudit,
    packageAudit
  };
}
function buildManagedStageVisibleDiagnostics(audit = {}, previewAudit = null) { return { schema: 'ManagedStageVisibleDiagnostics.v1', source: audit.source || '', primitiveHistogram: audit.primitiveHistogram || {}, supportRvmExportAudit: audit.supportRvmExportAudit || null, previewAudit, warnings: audit.managedStageStrictGate?.nonBlockingAuditIssues || [] }; }
function updateDrawerSummary(audit = {}, previewAudit = null) { const el = document.getElementById('drawerSummaryHint'); if (!el) return; const counts = audit.inputCounts || {}; el.textContent = `Managed-stage: ${counts.geometryComponents || 0} geometry components, ${counts.supportRecordsEmittedToRvm || 0} support markers, ${audit.rvmBytes || 0} RVM bytes.`; }
function updateManagedStageDiagnosticsPanel(audit = {}, previewAudit = null) { const el = document.getElementById('conversionStatus'); if (el) el.textContent = `Managed-stage RVM ready — code8=${audit.primitiveHistogram?.[8] || 0}, supports=${audit.inputCounts?.supportRecordsEmittedToRvm || 0}.`; }
function logManagedStageSummary(audit = {}) { log(`Managed-stage RVM: components=${audit.inputCounts?.geometryComponents || 0}, supports=${audit.inputCounts?.supportRecordsEmittedToRvm || 0}, PRIM=${audit.rvmPrimitivePayloadContract?.primitiveCount || 0}`); }
function logManagedStagePreviewCoordinateAudit(previewAudit = null) { if (!previewAudit) return; log(`Coordinate audit: components=${previewAudit.componentCount || 0}, supportMarkers=${previewAudit.supportMarkerCount || 0}`); }
function logManagedStageVisibleDiagnostics(visibleDiagnostics = {}) { log(`Visible diagnostics: supportPrimitiveCount=${visibleDiagnostics.supportRvmExportAudit?.supportPrimitiveCount || 0}`); }
function showManagedStageAuditWarnings(gate = null) { for (const issue of gate?.nonBlockingAuditIssues || []) log(`AUDIT warning: ${issue}`); }
