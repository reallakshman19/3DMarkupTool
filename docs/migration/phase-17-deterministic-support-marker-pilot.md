# Phase 17 Deterministic Support Marker Pilot

Phase 17 adds optional support placement markers to the runtime-pilot package.

Support markers are placement evidence only. They are stamped as `SUPPORT_PLACEMENT_MARKER`, use deterministic source identity and placement, and do not generate production support geometry.

BM_CII current behavior:

- Support markers generated: 12
- Support markers blocked: 0
- Support geometry generated: false
- Support fallback count: 0

No fallback box, guessed support dimensions, shoe, clamp, or structural steel geometry is emitted. Full RVM readiness remains false unless the owner explicitly changes the policy.

The Phase 16 pipe+bend+flange+valve package remains available.
