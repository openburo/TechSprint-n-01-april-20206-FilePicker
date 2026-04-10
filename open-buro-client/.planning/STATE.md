# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** A host app can call `obc.castIntent(intent, cb)` once and get a fully orchestrated file-picker / file-save flow — capability discovery, user selection, sandboxed iframe lifecycle, and PostMessage round-trip — with zero framework lock-in.
**Current focus:** Phase 1 — Foundations

## Current Position

Phase: 1 of 4 (Foundations)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-10 — Roadmap created; all 88 v1 requirements mapped to 4 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Coarse granularity → 4 phases; Phases 2 layers are built in parallel (parallelization: true)
- Roadmap: WS live updates (WS-01..07) included in Phase 2 alongside core layers (not deferred), as all requirements are v1
- Roadmap: Same-origin capability guard (IFR-08) lives in Phase 2 iframe layer; ORCH-01 constructor validation is Phase 3
- Research: Penpal v7 API is `connect({ messenger: new WindowMessenger(...), methods })` — v6 `connectToChild` must not be used anywhere
- Research: tsdown (not tsup) for all build output; tsup is deprecated

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 1] tsdown 0.21.x is pre-1.0; monitor GitHub issues before starting Phase 1 — fallback is Rollup 4 for UMD
- [Pre-Phase 2] Shadow DOM + iframe focus delegation has browser-specific quirks; spike needed before implementing UI layer focus trap
- [Pre-Phase 2] Penpal v7 MessagePort behavior under specific CSP configs is under-documented; validate handshake timing in test fixtures early

## Session Continuity

Last session: 2026-04-10
Stopped at: Roadmap created; STATE.md and REQUIREMENTS.md traceability updated. Ready to plan Phase 1.
Resume file: None
