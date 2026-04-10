# Phase 1: Foundations - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the TypeScript library scaffold and all shared contracts that every other phase depends on: build tooling (tsdown + Vitest 4 + Biome + TS 6), `OBCError` + error codes, shared interfaces (`Capability`, `IntentRequest`, `IntentResult`, `OBCOptions`, `CastPlan`, `FileResult`, `IntentCallback`), and the `generateSessionId()` utility with a `getRandomValues` fallback. After this phase, any other phase can `import` shared types and errors without scaffolding concerns.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Research (`.planning/research/STACK.md`, `SUMMARY.md`) and the critical cross-cutting findings in REQUIREMENTS.md already lock:
- **Bundler**: tsdown (not tsup — deprecated)
- **Test runner**: Vitest 4
- **Lint/format**: Biome
- **TypeScript**: 6.x, target `ES2020`, `moduleResolution: bundler`, `noEmit: true`
- **Penpal**: v7, pinned to exact version (no `^` range)
- **UUID**: `crypto.randomUUID()` with inline `getRandomValues` fallback (covers Chrome 90 / FF 88 / Safari 14 floor)
- **Exports map**: nested `types` field per `import`/`require` condition
- **CI gate**: `@arethetypeswrong/cli --pack`
- **Package name**: `@openburo/client`

Claude chooses all remaining details: file naming conventions, test file layout, Biome config strictness, tsconfig fine print, repo layout within `open-buro-client/`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

None — the `open-buro-client/` directory is empty (greenfield).

### Established Patterns

None yet. Phase 1 establishes them.

### Integration Points

- Sibling Go server at `../open-buro-server/` exposes `/api/v1/capabilities` (HTTP) and `/capabilities/ws` (WebSocket) — referenced but not imported; OBC is the browser-side consumer.
- The parent repo (`openburo-spec`) is already a git repository; OBC lives as a subdirectory of it. No nested `git init`.

</code_context>

<specifics>
## Specific Ideas

- Package name fixed: `@openburo/client`
- The exact Penpal v7 version to pin should be the latest stable at implementation time (v7.0.6 verified in research; re-verify via `npm view penpal version` before pinning)
- TypeScript 6.x strict defaults are accepted; no override
- All source under `src/`, all tests co-located as `*.test.ts` or under `src/__tests__/` (Claude's call)

</specifics>

<deferred>
## Deferred Ideas

- Vendoring Penpal source (decided: pin exact version first, vendor only if supply-chain posture tightens — documented in PROJECT.md Key Decisions and REQUIREMENTS.md Out of Scope)
- CI workflow definition (GitHub Actions, etc.) — delivered alongside the `attw` gate in Phase 4 Distribution, not Phase 1 scaffold

</deferred>
