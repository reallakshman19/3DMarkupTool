import { writeValvePilotAttText } from './new-core-valve-att-writer.js';
import { buildNewCoreSupportMarkerRuntimePilotAudit } from './new-core-support-marker-runtime-audit.js';
import { buildNewCoreSupportMarkerRuntimePilotPlan } from './new-core-support-marker-runtime-pilot.js';
import { summarizeRvmPilotDecodedCounts, writeRvmPilotPackageBytes } from './rvm-pilot-byte-writer.js';

const SCOPE = 'pipe-bend-flange-valve-support-marker-subset';
const OPTIONS = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, allowPartialModel: true, writeArtifact: true, writeAtt: true, deterministicValveOnly: true, includeSupportMarkers: true };

export async function generateBrowserSupportMarkerPilotExport(state, options) {
  const errors = optionErrors(object(options));
  if (errors.length) return blockedResult(errors);
  const plan = buildNewCoreSupportMarkerRuntimePilotPlan(state, OPTIONS);
  const artifact = await generateArtifact(plan);
  const audit = buildNewCoreSupportMarkerRuntimePilotAudit(plan, artifact, {});
  return buildSupportMarkerPilotDownloadBundle(artifact, audit, object(options));
}

export function buildSupportMarkerPilotDownloadBundle(artifact, audit, options) {
  const basename = object(options).basename || 'BM_CII_pipe_bend_flange_valve_support_marker_runtime_pilot';
  return { schema: 'BrowserSupportMarkerPilotDownloadBundle.v1', rvmFile: { filename: `${basename}.rvm`, mimeType: 'application/octet-stream', bytes: artifact.bytes }, attFile: { filename: `${basename}.att`, mimeType: 'text/plain', text: artifact.attText }, auditFile: { filename: `${basename}.audit.json`, mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
}

async function generateArtifact(plan) {
  if (!plan.subsetReady) return blockedArtifact(plan);
  const bytes = writeRvmPilotPackageBytes(plan.basePlan, { headerLabel: 'phase-17-browser-support-marker-pilot', phaseLabel: 'Phase17', modelName: 'SUPPORT_MARKER_BROWSER_PILOT', groupName: 'BROWSER_SUPPORT_MARKER_PILOT' });
  const attText = writeValvePilotAttText(plan.basePlan);
  return { schema: 'BrowserSupportMarkerPilotArtifact.v1', artifactGenerated: true, artifactKind: 'rvm-att-package', bytes, attText, rvmByteLength: bytes.byteLength, attByteLength: new TextEncoder().encode(attText).byteLength, checksumSha256: await sha256Hex(bytes), ...summarizeRvmPilotDecodedCounts(plan.basePlan), attRowCount: plan.basePlan.plannedAttRowCount, attRowsMatchRvmPrimitives: plan.basePlan.attRowsMatchRvmPrimitives, supportMarkerCount: plan.supportMarkerCount, blockedSupportMarkerCount: plan.blockedSupportMarkerCount, sourceTrace: plan.basePlan.sourceTrace };
}

function blockedResult(errors) {
  const audit = { schema: 'NewCoreSupportMarkerRuntimePilotAudit.v1', ok: false, scope: SCOPE, artifactGenerated: false, supportMarkerCount: 0, blockedSupportMarkerCount: 0, errors, warnings: [] };
  return { schema: 'BrowserSupportMarkerPilotDownloadBundle.v1', rvmFile: null, attFile: null, auditFile: { filename: 'BM_CII_pipe_bend_flange_valve_support_marker_runtime_pilot.audit.json', mimeType: 'application/json', text: `${JSON.stringify(audit, null, 2)}\n` }, audit };
}

function blockedArtifact(plan) {
  return { schema: 'BrowserSupportMarkerPilotArtifact.v1', artifactGenerated: false, artifactKind: 'rvm-att-package', bytes: new Uint8Array(), attText: '', rvmByteLength: 0, attByteLength: 0, checksumSha256: '', decodedPrimitiveCount: 0, attRowCount: 0, attRowsMatchRvmPrimitives: false, supportMarkerCount: Number(plan?.supportMarkerCount || 0), blockedSupportMarkerCount: Number(plan?.blockedSupportMarkerCount || 0), sourceTrace: [], errors: plan.errors };
}

function optionErrors(options) {
  const required = { enabled: true, mode: 'explicit-runtime-pilot', scope: SCOPE, includeSupportMarkers: true, userGestureConfirmed: true, browserDownload: true };
  const errors = [];
  for (const [key, expected] of Object.entries(required)) if (options[key] !== expected) errors.push(`${key} must be ${expected}`);
  return errors;
}

async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return '0'.repeat(64);
}

function object(value) {
  return value && typeof value === 'object' ? value : {};
}
