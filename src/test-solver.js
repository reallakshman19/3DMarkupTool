import fs from 'fs';
import { convertManagedStageJsonToPlantGraph } from './importers/managed-stage-to-plant-graph.js';
import { bindPlantGraphToCatalogue, auditCatalogueBinding } from './catalogue/catalogue-binder.js';
import { resolvePlantGraphGeometry, buildGeometryResolutionAudit } from './geometry/geometry-solver.js';

const rawData = JSON.parse(fs.readFileSync('C:/Users/reall/Downloads/AML-78-SYS-005-28-FEB-23_LATEST_INPUT_managed_stage (1).json', 'utf8'));

const graph = convertManagedStageJsonToPlantGraph(rawData, { sourceName: 'AML-78', allowUnrecognizedCaesarTypes: true });
const catalogueItems = [];
const bindings = bindPlantGraphToCatalogue(graph, catalogueItems, { allowDerivedCatalogueItems: true });
const bindingAudit = auditCatalogueBinding(graph, bindings, { allowDerivedCatalogueItems: true });
const geometry = resolvePlantGraphGeometry(graph, bindingAudit, { allowDerivedCatalogueItems: true });

const blockedBends = [];
const blockedFlanges = [];

for (const blocked of geometry.unresolvedGeometry) {
    if (blocked.family === 'elbow') blockedBends.push(blocked);
    if (blocked.family === 'flange') blockedFlanges.push(blocked);
}

console.log(`--- BLOCKED BENDS (${blockedBends.length}) ---`);
for (const b of blockedBends.slice(0, 2)) {
    console.log('Blocked Bend Record:', b);
    const item = graph.items.find(i => i.id === b.itemId);
    console.log('Bend Evidence:', item.bendEvidence);
}

console.log(`\n--- BLOCKED FLANGES (${blockedFlanges.length}) ---`);
for (const f of blockedFlanges.slice(0, 2)) {
    console.log('Blocked Flange Record:', f);
    const item = graph.items.find(i => i.id === f.itemId);
    console.log('Flange Evidence:', item.flangeEvidence);
    console.log('Flange Dimensions:', item.dimensions);
}

const audit = buildGeometryResolutionAudit(graph, geometry, bindingAudit);
console.log('\n--- AUDIT ERRORS ---');
console.log(audit.errors);
