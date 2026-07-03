# Phase 18 Pilot Package Inspection Report

Phase 18 adds `npm run inspect:new-core-runtime-pilot-package` for generated runtime-pilot packages.

The inspector validates:

- RVM byte length and audited primitive counts
- Primitive family counts
- ATT row count
- ATT-to-audit source trace consistency
- No fallback or placeholder geometry
- No unsupported box, sphere, or pyramid leakage
- Checksum shape
- Generated package scope
- Full readiness remains false unless explicitly approved

The command exits non-zero on mismatches. It does not modify production writers and does not add UI behavior.
