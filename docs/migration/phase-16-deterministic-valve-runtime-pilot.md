# Phase 16 Deterministic Valve Runtime Pilot

Phase 16 adds a productive runtime-pilot package for the pipe+bend+flange subset plus deterministic inline valve bodies.

Valve bodies are generated only when source/export data provides deterministic center, normalized axis, body length, body radius, transform policy, and source identity. No guessed dimensions, placeholder valve boxes, handwheels, stems, actuators, or fallback geometry are emitted.

BM_CII current behavior:

- Pipes generated: 19
- Bends generated: 7
- Flange bodies generated: 8
- Deterministic valve bodies generated: 0
- Valves blocked: 6
- Supports deferred: 12
- ATT rows: 34

The six BM_CII valves remain blocked because current new-core outputs do not include deterministic valve body radius/length/catalogue evidence. Full RVM readiness remains false.

Production RVM and ATT writers are not modified. The old export path is unchanged and no default runtime switch is introduced.
