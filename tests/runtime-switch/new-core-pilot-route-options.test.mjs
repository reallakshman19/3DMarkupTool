import assert from 'node:assert/strict';
import { createNewCorePilotRouteOptions, validateNewCorePilotRouteOptions } from '../../src/runtime-switch/new-core-pilot-route-options.js';

const defaults = createNewCorePilotRouteOptions();
assert.equal(defaults.enabled, false);
assert.equal(defaults.defaultProductionPathUnchanged, true);
assert.equal(defaults.oldExportPathModified, false);
assert.equal(validateNewCorePilotRouteOptions(defaults).ok, true);

assert.equal(validateNewCorePilotRouteOptions({ ...defaults, routeName: 'old-export' }).ok, false);
assert.equal(validateNewCorePilotRouteOptions({ ...defaults, defaultProductionPathUnchanged: false }).ok, false);
assert.equal(validateNewCorePilotRouteOptions({ ...defaults, oldExportPathModified: true }).ok, false);

console.log('new-core pilot route options test passed');
