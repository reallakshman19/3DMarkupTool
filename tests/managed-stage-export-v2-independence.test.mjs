import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync('src/managed-stage-json-ui-controller.js', 'utf8');
const routeController = readFileSync('src/runtime-switch/new-core-pilot-route-controller.js', 'utf8');

assert.match(controller, /generateCompleteRvmPackage:\s*\(\)\s*=>\s*runBrowserExportV2FullPilotPackage\(true\)/);
assert.match(controller, /#generatePipeBendFlangeValvePilotPackageBtn',\s*runBrowserExportV2FullPilotPackage/);
assert.doesNotMatch(controller, /runManagedStageCompleteRvmExport/);

const functionMatch = controller.match(/async function runBrowserExportV2FullPilotPackage[\s\S]+?\n}\n\nasync function runBrowserSupportMarkerPilotExport/);
assert.ok(functionMatch, 'Export V2 full package function must be present');
const exportV2Function = functionMatch[0];

assert.match(exportV2Function, /executeNewCorePilotRoute/);
assert.match(exportV2Function, /generateBrowserManagedStageExportV2Package/);
assert.doesNotMatch(exportV2Function, /generateBrowserValvePilotExport/);
assert.doesNotMatch(exportV2Function, /managedStageUiState\.artifact/);
assert.doesNotMatch(exportV2Function, /artifact\.(rvm|att|audit)/);

assert.match(controller, /function activeExportV2State\(\)\s*\{\s*return\s*\{\s*sourceText:\s*managedStageUiState\.sourceText,\s*sourceName:\s*managedStageUiState\.sourceName,\s*basename:\s*managedStageUiState\.basename\s*\};\s*\}/);
assert.match(controller, /legacyManagedStageArtifactRead:\s*false/);
assert.match(controller, /oldProductionPathTouched:\s*routeAudit\.oldProductionPathTouched === true/);

assert.match(routeController, /basename:\s*routeOptions\.basename\s*\|\|\s*state\?\.basename/);

console.log('managed-stage Export V2 independence test passed');
