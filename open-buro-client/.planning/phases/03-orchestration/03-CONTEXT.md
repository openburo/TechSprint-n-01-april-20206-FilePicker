# Phase 3: Orchestration - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the `OpenBuroClient` public class — the facade that wires every Phase 2 layer into a working intent broker. This phase owns: session management (the `Map<string, ActiveSession>`), constructor validation, lazy capability fetch, `castIntent` orchestration, `destroy()` teardown via `AbortContext`, and WebSocket lifecycle wiring. Phase 3 must not reimplement any Phase 2 functionality — it composes what exists.

</domain>

<decisions>
## Implementation Decisions

### Post-destroy() Behavior (user-confirmed)

- `castIntent()` after `destroy()`: **throw `OBCError` synchronously** with code `DESTROYED` (new error code added in this phase)
- `getCapabilities()` after `destroy()`: **return empty array** (synchronous, stable — matches empty-registry semantics)
- `refreshCapabilities()` after `destroy()`: **return rejected Promise** with `OBCError { code: 'DESTROYED' }`
- `destroy()` called twice: **idempotent no-op** (AbortController.abort() is already idempotent; just early-return if already destroyed)

New error code `DESTROYED` added to `OBCErrorCode` union in `src/errors.ts` (minor Phase 1 extension).

### First-use Capability Fetch (user-confirmed)

- Constructor performs **no async side effects** (locked in Phase 1 architecture)
- First `castIntent()` triggers HTTP fetch if in-memory capability list is empty
- Concurrent `castIntent()` during first fetch: share the same in-flight Promise (single flight)
- If first fetch succeeds AND `options.liveUpdates` is enabled (default true) AND server header `X-OpenBuro-Server: true` was detected, start WebSocket listener
- If first fetch fails, the error is both:
  1. Propagated via the rejecting Promise returned from `castIntent()`
  2. Sent to `options.onError({ code: 'CAPABILITIES_FETCH_FAILED', cause })`
- A subsequent `castIntent()` after a failed fetch will retry fresh (no permanent failure mode)

### Architecture (locked by prior phases)

- `OpenBuroClient` is the **only** file permitted to import across layers
- `BridgeAdapter` injected via an optional `bridgeFactory` option for tests (defaults to `PenpalBridge`); `MockBridge` is used in Phase 3 integration tests
- Session state lives on the instance in a `Map<string, ActiveSession>` — keyed by UUID v4 from `generateSessionId()`
- `destroy()` uses `createAbortContext()` (from Phase 2 lifecycle layer) as the single teardown mechanism: capability loader fetches, WS listener, modal/iframe elements, Penpal connections are all registered on the abort context
- Constructor validation:
  - `options.capabilitiesUrl` must be `https://` or `http://localhost*` → otherwise throw `OBCError('CAPABILITIES_FETCH_FAILED', 'Mixed Content: capabilitiesUrl must be HTTPS in production')`
  - `options.wsUrl` if provided must be `wss://` or `ws://localhost*`
- Multiple instances isolated — no shared module-level state, no `window.OpenBuro` singleton

### castIntent Orchestration Flow (locked by spec + research)

1. Check destroyed flag → throw if destroyed
2. Ensure capabilities loaded (lazy fetch, single-flight)
3. Call `planCast(capabilities, intent)` → branch on discriminated union:
   - `no-match` → fire `onError('NO_MATCHING_CAPABILITY')`, invoke callback with `{ status: 'cancel', id, results: [] }`, return
   - `direct` (1 capability) → skip modal, proceed to iframe creation
   - `select` (N capabilities) → open chooser modal; on user cancel, invoke callback cancel and return; on user pick, proceed to iframe creation
4. Iframe creation (all in ONE synchronous block per research pitfall):
   - `generateSessionId()` → new UUID
   - `buildIframe(capability, { sessionId, intent })` → HTMLIFrameElement (throws `SAME_ORIGIN_CAPABILITY` if guard fails; propagate)
   - Append iframe to a shadow host (Phase 2 `createShadowHost()`)
   - `bridgeFactory.connect({ iframe, allowedOrigin, onResolve, abortSignal })` → ConnectionHandle
   - Start session watchdog timer (configurable, default 5 min → `IFRAME_TIMEOUT`)
   - Register session in `Map<string, ActiveSession>`
5. Resolve/cancel path:
   - Penpal child calls `resolve(result)` → look up session by `result.id`, clear watchdog, tear down iframe + shadow host, invoke callback with result
   - Timeout fires → close session with cancel + `IFRAME_TIMEOUT` error
   - `destroy()` called mid-session → close all active sessions with cancel

### Claude's Discretion

- Exact file names inside `src/` (e.g., `src/client.ts` vs `src/openburo-client.ts`)
- Whether to split the class into multiple private helper files
- Internal-only helpers (single-flight Promise cache, watchdog timer helper)
- The exact error message strings for `DESTROYED` / constructor validation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1 + Phase 2)

- `src/errors.ts` — `OBCError` + `OBCErrorCode` union (add `DESTROYED` this phase)
- `src/types.ts` — all shared interfaces
- `src/intent/id.ts` — `generateSessionId()`
- `src/intent/cast.ts` — `planCast()` discriminated union
- `src/intent/session.ts` — `ActiveSession` type + `SessionMap`
- `src/capabilities/resolver.ts` — `resolveCapabilities()`
- `src/capabilities/loader.ts` — `fetchCapabilities(url, { signal })`
- `src/capabilities/ws-listener.ts` — `WsListener` class with `start()/stop()`
- `src/lifecycle/abort-context.ts` — `createAbortContext()` with `addCleanup()`
- `src/ui/styles.ts` — `createShadowHost()`, `createSpinnerOverlay()`, `lockBodyScroll()`
- `src/ui/iframe.ts` — `buildIframe()`
- `src/ui/focus-trap.ts` — `trapFocus()` (used inside modal)
- `src/ui/modal.ts` — `buildModal()`
- `src/messaging/bridge-adapter.ts` — `BridgeAdapter`, `ConnectionHandle` interfaces
- `src/messaging/mock-bridge.ts` — `MockBridge` (for tests)
- `src/messaging/penpal-bridge.ts` — `PenpalBridge` (default production adapter)

### Established Patterns

- Biome strict (single quotes, `noUncheckedIndexedAccess`)
- `// @vitest-environment happy-dom` docblock for DOM-touching tests
- `MockBridge` injection for unit tests (no real Penpal handshake in happy-dom)
- Commits via `gsd-tools commit`

### Integration Points

- Phase 4 (Distribution) bundles `src/index.ts` → `OpenBuroClient` is the main export
- Capability-author integration guide (Phase 4) describes the `resolve()` contract from the iframe side

</code_context>

<specifics>
## Specific Ideas

- **Synchronicity pitfall** from research: `buildIframe() → shadowRoot.appendChild(iframe) → bridge.connect()` must be one synchronous block before any `await`. Document this inline in the orchestrator code.
- **Session timeout**: default 5 min, configurable via `options.sessionTimeoutMs`. Store as `timeoutHandle` on `ActiveSession`.
- **Single-flight fetch**: cache the in-flight `Promise<Capability[]>` on `this.inflightFetch`, clear on settle.
- **Session cleanup on `destroy()`**: iterate the session map, invoke each callback with `{ status: 'cancel', id, results: [] }`, then tear down all iframes via the AbortContext cleanups.

</specifics>

<deferred>
## Deferred Ideas

- `bridgeFactory` as a public option — Phase 3 uses it internally for tests but documents it as `@internal` (not published in the public API types for v1)
- Constructor option schema validation library (zod, etc.) — v2 concern; v1 uses simple `if` guards

</deferred>
