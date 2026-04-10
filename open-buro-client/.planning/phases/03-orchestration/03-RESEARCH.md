# Phase 3 Research — Orchestration

**Status:** Composition phase — no external research required.

All Phase 3 building blocks already exist in Phase 2 (`src/capabilities/*`, `src/intent/*`, `src/ui/*`, `src/messaging/*`, `src/lifecycle/abort-context.ts`). This phase is pure orchestration: wire them together behind the `OpenBuroClient` facade with session state, AbortContext teardown, and public API semantics locked in 03-CONTEXT.md.

## Known Patterns (already proven in Phase 2)

- **Single-flight promise cache**: stash `Promise<T> | null`, clear on settle
- **Session Map**: `Map<string, ActiveSession>` keyed by UUID v4 from `generateSessionId()`
- **AbortContext composition**: register every cleanup via `abortContext.addCleanup(fn)`; `destroy()` calls `abortContext.abort()`
- **Synchronicity rule** (research pitfall from Phase 2): `buildIframe() → shadowRoot.appendChild → bridgeFactory.connect()` must be one synchronous block before any `await`

## Penpal v7 API Reminder

```typescript
// Already used in PenpalBridge — orchestrator just calls the adapter:
const handle: ConnectionHandle = await bridgeFactory.connect({
  iframe,
  allowedOrigin,
  onResolve: (result) => { ... },
  sessionId,
});
// handle.destroy() is called via abortContext cleanup
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Env | `// @vitest-environment happy-dom` for integration tests |
| Quick run | `pnpm vitest run src/client.test.ts` |
| Full suite | `pnpm run ci` |

### Phase 3 → Test Map

| Req | Behavior | Test Type | Command |
|-----|----------|-----------|---------|
| ORCH-01 | Constructor validates HTTPS | unit (happy-dom) | `pnpm vitest run src/client.test.ts -t "https"` |
| ORCH-02 | No async side-effects in constructor | unit | `pnpm vitest run src/client.test.ts -t "constructor"` |
| ORCH-03 | Multiple instances isolated | integration | `pnpm vitest run src/client.test.ts -t "concurrent"` |
| ORCH-04 | `destroy()` leaves zero artifacts | integration | `pnpm vitest run src/client.test.ts -t "destroy"` |
| ORCH-05 | AbortController teardown | integration | included in destroy test |
| ORCH-06 | Post-destroy() predictable behavior | unit | `pnpm vitest run src/client.test.ts -t "destroyed"` |

### Key test scenarios (using MockBridge injection)

1. Happy-path `castIntent` round-trip → MockBridge resolves → callback invoked with result
2. No-match path → `NO_MATCHING_CAPABILITY` error + cancel callback
3. Select path → modal shown, cancel button → cancel callback
4. Two concurrent instances → separate session maps, separate capabilities
5. Two concurrent sessions in one instance → results route to correct callbacks by id
6. `destroy()` during active session → all sessions cancelled, zero DOM artifacts, WS closed, bridge.destroy called
7. Post-destroy `castIntent` → sync throw with code `DESTROYED`
8. Single-flight fetch — two concurrent `castIntent` during cold start share the same fetch
9. Failed fetch → error surfaced, next `castIntent` retries
10. Same-origin capability → `SAME_ORIGIN_CAPABILITY` propagated to callback as error
