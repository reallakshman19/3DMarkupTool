# Phase 19 Guarded Runtime Pilot Route

Phase 19 adds a controlled route controller for explicit new-core pilot package export.

The route is default-off and blocked unless explicitly enabled with a user gesture. It calls only the supplied pilot package adapter and does not call, replace, or mutate the old production export path.

Policy:

- Old production export remains the default route.
- The new route is advanced/developer-only.
- No production writer rewrite is implied.
- No automatic background generation is allowed.
- Full RVM readiness remains false.

This is not a full runtime switch.
