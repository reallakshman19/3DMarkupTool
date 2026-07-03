import assert from 'node:assert/strict';
import { executeNewCorePilotRoute, defaultProductionRouteDescriptor } from '../../src/runtime-switch/new-core-pilot-route-controller.js';
import { assertNewCorePilotRouteAudit } from '../../src/runtime-switch/new-core-pilot-route-audit.js';

let pilotCalls = 0;
let oldProductionCalls = 0;
const services = {
  generatePilotPackage: async () => {
    pilotCalls += 1;
    return { rvmFile: {}, attFile: {}, auditFile: {}, audit: { ok: true } };
  },
  oldProductionExport: async () => {
    oldProductionCalls += 1;
  }
};

const defaultRoute = defaultProductionRouteDescriptor();
assert.equal(defaultRoute.defaultRoute, true);
assert.equal(defaultRoute.modifiedByNewCorePilotRoute, false);

const blockedDefault = await executeNewCorePilotRoute({}, services, {});
assert.equal(blockedDefault.ok, false);
assert.equal(pilotCalls, 0);
assert.equal(oldProductionCalls, 0);

const blockedGesture = await executeNewCorePilotRoute({}, services, { enabled: true });
assert.equal(blockedGesture.ok, false);
assert.equal(pilotCalls, 0);

const result = await executeNewCorePilotRoute({}, services, { enabled: true, userGestureConfirmed: true });
assert.equal(result.ok, true);
assert.equal(result.oldProductionPathCalled, false);
assert.equal(pilotCalls, 1);
assert.equal(oldProductionCalls, 0);
assert.equal(assertNewCorePilotRouteAudit(result.audit, { ok: true, pilotAdapterCalled: true, oldProductionPathTouched: false, defaultProductionPathChanged: false, defaultRuntimeSwitchEnabled: false, fullModelReady: false }).ok, true);

console.log('new-core pilot route controller test passed');
