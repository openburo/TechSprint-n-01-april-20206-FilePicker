# Phase 2: Core Implementation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Build every independent layer of `@openburo/client` so Phase 3's orchestrator can compose them:

1. **Capability layer** — HTTP loader, pure MIME resolver, `planCast()` discriminated union, WebSocket listener with full-jitter backoff
2. **Intent layer** — orchestration logic (no DOM knowledge), session map typing, timeout watchdog
3. **UI layer** — iframe factory (with same-origin guard + `title`), chooser modal inside Shadow DOM with full a11y baseline, loading indicator
4. **Messaging layer** — `BridgeAdapter` interface, `PenpalBridge` implementing it via Penpal v7 `connect` + `WindowMessenger`, `MockBridge` for tests

All layers produce unit-testable artifacts. The orchestrator (Phase 3) wires them together.

</domain>

<decisions>
## Implementation Decisions

### Chooser Modal Visual Defaults (user-confirmed)

- Modal card: `max-width: 480px`, `min-width: 320px`, responsive
- Backdrop: `rgba(0, 0, 0, 0.5)`
- Accent color (primary action, focus ring): `#2563eb` (Tailwind blue-600)
- Loading spinner: pure CSS `@keyframes` border-rotate (no SVG, no emoji, no external font)

### Chooser Keyboard Interaction (user-confirmed)

- Arrow keys (↑/↓) navigate capability items; `Home`/`End` jump to first/last
- `Enter` selects the focused item
- `Escape` dismisses → `cancel`
- Auto-focus the first capability item on open (focus trap pulls keyboard into modal)
- Single capability match → skip chooser entirely, open iframe directly (per IFR-/INT- requirements)
- Backdrop click dismisses → `cancel`
- Focus is restored to the element that held focus before `castIntent` on every close path

### Timing & Reconnect Knobs (user-confirmed)

- Penpal handshake timeout: **10 seconds** (slow capability servers during a hackathon demo)
- Intent session watchdog timeout: **5 minutes** default (configurable via options — per INT-08)
- WebSocket max reconnect attempts: **5** before emitting `WS_CONNECTION_FAILED`
- Iframe loading spinner delay: **150 ms** (spinner appears only if handshake takes longer)

### Architecture (locked by research SUMMARY.md)

- **Layer strictness**: orchestrator is the ONLY file that imports across layers. UI layer must not import Penpal. Messaging layer must not touch DOM. Capability layer must not touch DOM or Penpal.
- **Session state** lives exclusively on `OpenBuroClient` in a `Map<string, ActiveSession>` — no event bus. Phase 2 defines the `ActiveSession` type; Phase 3 holds the Map.
- **`planCast()`** is a pure function returning a discriminated union: `{ kind: 'no-match' } | { kind: 'direct'; capability } | { kind: 'select'; capabilities }`.
- **`BridgeAdapter` interface** + **`PenpalBridge`** implementation — Penpal is imported only from `src/messaging/penpal-bridge.ts`.
- **`MockBridge`** lives in `src/messaging/mock-bridge.ts` for unit tests.
- **Shadow DOM mode**: `attachShadow({ mode: 'open' })` (open, not closed).
- **Same-origin capability guard**: thrown before iframe creation, not lazily.
- **AbortController pattern**: every listener/fetch/WS registration uses `{ signal }` from a phase-2-provided helper so Phase 3 can call `controller.abort()` for leak-free `destroy()`.

### Test Environment (locked by Phase 1 choices)

- Vitest 4 with Node environment for pure-logic modules (resolver, planCast, id, errors)
- Vitest 4 with **happy-dom** environment for UI layer (modal, iframe factory, Shadow DOM) and messaging (MockBridge usage)
- happy-dom added as devDependency in Phase 2 Wave 0 (not present yet)
- WebSocket mocking via a tiny in-test fake (no external msw-ws dependency unless necessary)

### Claude's Discretion

- Exact file split inside each module (e.g., whether to put focus-trap logic in `ui/focus-trap.ts` or inline in `ui/modal.ts`)
- Test naming convention (`*.test.ts` co-located)
- Internal type names that don't appear in the public API
- Whether to export `planCast` publicly or keep it internal (recommend internal for v1)
- Exact WebSocket event payload schema beyond `REGISTRY_UPDATED` — follow project-level research SUMMARY.md

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1)

- `src/errors.ts` — `OBCError` class + `OBCErrorCode` union (all six codes including `SAME_ORIGIN_CAPABILITY`)
- `src/types.ts` — `Capability`, `IntentRequest`, `IntentResult`, `FileResult`, `IntentCallback`, `OBCOptions`, `CastPlan`
- `src/intent/id.ts` — `generateSessionId()` with `getRandomValues` fallback
- `src/index.ts` — barrel re-exports

### Established Patterns (from Phase 1)

- Biome strictness is live — all new code must pass `pnpm lint`
- TypeScript 6 with `noUncheckedIndexedAccess: true` — array index access returns `T | undefined`
- `ES2020` target — no top-level await, no `?.` chain assignment
- Dual CJS/ESM output via tsdown two-array config — UMD bundles Penpal
- Tests: Vitest 4, `vitest run` (never `vitest watch`), co-located `*.test.ts`
- Commits: `gsd-tools commit` (never raw `git commit`)
- Single-quote string literals rejected in some positions (Biome rule) — double quotes preferred

### Integration Points

- Phase 3 (Orchestration) imports EVERY new file in Phase 2 via the barrel `src/index.ts`
- Phase 4 (Distribution) bundles all Phase 2 files into ESM/CJS/UMD
- Capability-author integration guide (Phase 4) documents the Penpal v7 contract established here

</code_context>

<specifics>
## Specific Ideas

- **UUID fallback test technique** established in Phase 1 (`delete (globalThis.crypto as any).randomUUID`) can be reused for any other runtime capability-feature gates if needed
- **Research SUMMARY.md section "Pitfalls"** highlights exact WCAG-failing scenarios to avoid in the modal — use as a checklist
- **WebSocket reconnect**: the `destroyed` flag guard is REQUIRED in the initial implementation, not an afterthought (pitfall #6 in research)
- **iframe `title` attribute** must be set from `capability.appName` — one line, but WCAG 2.4.1 hard fail without it

</specifics>

<deferred>
## Deferred Ideas

- Parent-exposed methods beyond `resolve` (v2 — `MSG2-01`)
- `intent:resize` dynamic iframe sizing (v2 — `MSG2-02`)
- Capability icon lazy-loading (v2 — `UX2-02`)
- Recent/preferred capability ordering (v2 — `UX2-03`)
- CSS custom properties for theming (v2 — `UX2-01`)
- WebSocket auto-wiring into orchestrator options — that lives in Phase 2 scope, but the `liveUpdates: true` wire-up to the constructor happens in Phase 3 orchestrator; Phase 2 only ships the listener module

</deferred>
