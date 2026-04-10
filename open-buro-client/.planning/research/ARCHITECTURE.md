# Architecture Research

**Domain:** Framework-agnostic vanilla TypeScript browser library — iframe-based intent brokering
**Researched:** 2026-04-10
**Confidence:** HIGH (derived from spec + first-principles; validated against Penpal API, Auth0 SPA SDK, Supabase-js patterns)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PUBLIC SURFACE (src/index.ts)                   │
│          OpenBuroClient class + exported types + OBCError            │
├─────────────────────────────────────────────────────────────────────┤
│                     ORCHESTRATION LAYER                              │
│              OpenBuroClient.ts  ←  session Map<id, Session>         │
│  castIntent() / getCapabilities() / refreshCapabilities() /destroy() │
├──────────────┬────────────────────────┬────────────────────────────┤
│  CAPABILITY  │    INTENT LAYER        │   UI LAYER                  │
│  LAYER       │                        │                             │
│              │  src/intent/           │  src/ui/                    │
│  src/        │  ├── cast.ts           │  ├── modal.ts               │
│  capabilities│  ├── id.ts             │  ├── iframe.ts              │
│  /           │  └── types.ts          │  └── styles.ts              │
│  ├─loader.ts │                        │                             │
│  ├─resolver.ts                        │  (UI layer knows NOTHING    │
│  └─ws-       │  (pure functions:      │   about Penpal or messaging;│
│    listener.ts│  no DOM, no WS)       │   returns HTMLElements only)│
├──────────────┴────────────────────────┴────────────────────────────┤
│                     MESSAGING LAYER                                  │
│                   src/messaging/penpal-bridge.ts                     │
│                                                                      │
│  BridgeAdapter interface  ←  PenpalBridge implements BridgeAdapter  │
│  connect(iframe, origin, methods) → ConnectionHandle                 │
│  destroy(handle)                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     SHARED / CROSS-CUTTING                           │
│  src/errors.ts (OBCError codes)  │  src/types.ts (all shared types) │
└─────────────────────────────────────────────────────────────────────┘
```

The key design principle: **each layer below the orchestrator has no upward dependency**. The capability layer knows nothing about the UI. The UI layer knows nothing about Penpal. The messaging layer knows nothing about capabilities or sessions. The orchestrator (OpenBuroClient) is the only component allowed to hold and cross-reference all pieces.

---

## Component Boundaries

| Component | Owns | Public Surface | Does NOT touch |
|-----------|------|----------------|----------------|
| `OpenBuroClient` | Session `Map<id, Session>`, lifecycle orchestration | `castIntent`, `getCapabilities`, `refreshCapabilities`, `destroy` | Penpal API directly, DOM directly |
| `capabilities/loader.ts` | HTTP fetch + header detection | `fetchCapabilities(url): Promise<Capability[]>` | WebSocket, DOM, sessions |
| `capabilities/resolver.ts` | Mime matching logic | `resolve(capabilities, intent): Capability[]` | Network, DOM |
| `capabilities/ws-listener.ts` | WebSocket + exponential backoff | `WsListener` class with `start()`, `stop()`, `onUpdate` callback | HTTP, DOM, sessions |
| `intent/id.ts` | UUID v4 generation | `generateSessionId(): string` | Everything except crypto |
| `intent/types.ts` | Shared intent types | Type exports only | Nothing |
| `intent/cast.ts` | Intent orchestration pure logic (match count → decision) | `planCast(capabilities, intent): CastPlan` | DOM, WS, Penpal |
| `ui/modal.ts` | Selection modal DOM construction | `buildModal(capabilities, onSelect, onCancel): HTMLElement` | Penpal, capabilities resolver |
| `ui/iframe.ts` | Iframe DOM construction + URL assembly | `buildIframe(capability, params): HTMLIFrameElement` | Penpal, resolver |
| `ui/styles.ts` | Shadow DOM host construction + style injection | `createShadowHost(): ShadowRoot` | Everything |
| `messaging/penpal-bridge.ts` | Penpal `connect()` call, `ConnectionHandle` wrapping | `PenpalBridge implements BridgeAdapter` | UI, capabilities, sessions |
| `errors.ts` | `OBCError` class + error codes enum | `OBCError`, `OBCErrorCode` | Everything |
| `types.ts` | All shared TS interfaces | Type exports | Everything |

### The BridgeAdapter Interface

The messaging layer MUST be hidden behind an interface:

```typescript
// src/messaging/bridge-adapter.ts
export interface ConnectionHandle {
  destroy(): void;
}

export interface BridgeAdapter {
  connect(
    iframe: HTMLIFrameElement,
    allowedOrigin: string,
    exposedMethods: Record<string, (...args: unknown[]) => unknown>
  ): Promise<ConnectionHandle>;
}
```

`PenpalBridge` in `src/messaging/penpal-bridge.ts` is the sole implementation. The `OpenBuroClient` constructor accepts an optional `BridgeAdapter` for testing (injected mock — no real iframes needed in unit tests). Production code defaults to `new PenpalBridge()`.

This mirrors how Auth0's SDK separates its OAuth transport from the main client: the client holds strategy objects, not concrete library calls.

---

## Recommended Project Structure

```
src/
├── index.ts                      # Public barrel: re-exports class + types + OBCError
├── OpenBuroClient.ts             # Orchestrator (only file that imports across all layers)
├── types.ts                      # All shared interfaces (Capability, IntentRequest, etc.)
├── errors.ts                     # OBCError class + OBCErrorCode enum
│
├── capabilities/
│   ├── loader.ts                 # fetchCapabilities(url) → Promise<Capability[]>
│   ├── resolver.ts               # resolve(caps, intent) → Capability[]
│   └── ws-listener.ts           # WsListener class (WebSocket + backoff)
│
├── intent/
│   ├── id.ts                     # generateSessionId() → string (UUID v4)
│   ├── cast.ts                   # planCast() → CastPlan (pure, no side effects)
│   └── types.ts                  # Intent-specific types (IntentRequest, IntentResult, CastPlan)
│
├── ui/
│   ├── modal.ts                  # buildModal(caps, onSelect, onCancel) → HTMLElement
│   ├── iframe.ts                 # buildIframe(cap, params) → HTMLIFrameElement
│   └── styles.ts                 # createShadowHost(container) → ShadowRoot
│
└── messaging/
    ├── bridge-adapter.ts         # BridgeAdapter interface + ConnectionHandle interface
    └── penpal-bridge.ts         # PenpalBridge implements BridgeAdapter
```

### Structure Rationale

- **`capabilities/`**: All server-interaction logic. The only layer that uses `fetch` and `WebSocket`. Isolated so the resolver can be unit tested without any network mock.
- **`intent/`**: Pure domain logic — no I/O, no DOM. `cast.ts` makes decisions (0 / 1 / N match) based on resolved capabilities; it returns a `CastPlan` discriminated union that the orchestrator acts on.
- **`ui/`**: DOM factories that return elements. No event wiring to business logic — callers pass callbacks in. Shadow DOM host lives here. No knowledge of Penpal or sessions.
- **`messaging/`**: The only file that imports Penpal. Hidden behind `BridgeAdapter` so the rest of the codebase never takes a direct Penpal dependency.
- **`OpenBuroClient.ts`**: The one file allowed to import from all layers. Holds the session Map and wires everything together.

---

## Architectural Patterns

### Pattern 1: Facade + Internal Module Composition (Supabase-js style)

**What:** The public class (`OpenBuroClient`) is a thin facade that instantiates and delegates to independent internal modules. It does not implement logic — it composes.

**When to use:** Any SDK where the public API must be stable but internals evolve. Supabase-js uses this for Auth, Realtime, Storage — each is a separate package behind `.auth`, `.realtime`, `.storage` accessors. Same principle applies here at the file level.

**Trade-offs:** Adds indirection; all worth it — each module is independently testable, replaceable, and has a documented surface.

```typescript
export class OpenBuroClient {
  private capabilities: Capability[] = [];
  private sessions = new Map<string, ActiveSession>();
  private wsListener?: WsListener;
  private bridge: BridgeAdapter;

  constructor(private opts: OBCOptions) {
    this.bridge = opts._bridge ?? new PenpalBridge(); // test injection point
  }

  async castIntent(intent: IntentRequest): Promise<IntentResult> {
    const matches = resolve(this.capabilities, intent);
    const plan = planCast(matches, intent);
    const id = generateSessionId();
    // ... orchestrate via plan
  }
}
```

### Pattern 2: Discriminated Union CastPlan (pure decision, impure execution)

**What:** `planCast()` returns a typed decision object. The orchestrator interprets it and performs side effects. This keeps the decision logic pure and testable.

**When to use:** Any time a function must make a branching decision whose branches involve DOM/network side effects. Separating the decision from the execution makes the decision unit-testable.

**Trade-offs:** Slightly more ceremony; eliminates the need to stub DOM in decision tests.

```typescript
// src/intent/cast.ts
export type CastPlan =
  | { kind: 'no-match' }
  | { kind: 'direct'; capability: Capability }
  | { kind: 'select'; candidates: Capability[] };

export function planCast(matches: Capability[], intent: IntentRequest): CastPlan {
  if (matches.length === 0) return { kind: 'no-match' };
  if (matches.length === 1) return { kind: 'direct', capability: matches[0] };
  return { kind: 'select', candidates: matches };
}
```

### Pattern 3: Session Object per `castIntent` call

**What:** Each `castIntent` call creates a `Session` object (id, iframe ref, Penpal connection handle, timeout handle). The orchestrator stores these in a `Map<string, Session>`. `destroy()` iterates and tears down all active sessions.

**When to use:** Any library that supports concurrent operations that must be independently cancellable. Required here because the spec mandates multiple concurrent `castIntent` sessions.

**Trade-offs:** Requires diligent cleanup discipline; pays off with leak-free `destroy()`.

```typescript
interface ActiveSession {
  id: string;
  iframe: HTMLIFrameElement;
  shadowHost: Element;
  connectionHandle: ConnectionHandle;
  timeoutHandle: ReturnType<typeof setTimeout>;
  resolve: (result: IntentResult) => void;
  reject: (err: OBCError) => void;
}
```

### Pattern 4: BridgeAdapter Dependency Injection for Testability

**What:** Penpal is injected via the `BridgeAdapter` interface. Tests provide a `MockBridge` that resolves immediately without touching `postMessage`. Production code uses `PenpalBridge`.

**When to use:** Any time a third-party library does I/O that is hard to stub (postMessage, WebSocket). Wrap it, inject it.

**Trade-offs:** One extra interface file. Eliminates all real-iframe setup from unit tests.

---

## Data Flow: Full `castIntent` Happy Path

```
Host App calls: obc.castIntent({ action: 'PICK', mimeType: 'image/png' })
    │
    ▼
OpenBuroClient.castIntent()
    │
    ├─→ resolve(this.capabilities, intent)          [capabilities/resolver.ts — pure]
    │       └─ returns [Capability]
    │
    ├─→ planCast(matches, intent)                   [intent/cast.ts — pure]
    │       └─ returns { kind: 'direct', capability }
    │                  OR { kind: 'select', candidates }
    │                  OR { kind: 'no-match' }
    │
    ├─→ generateSessionId()                         [intent/id.ts — pure]
    │       └─ returns UUID string
    │
    ├─[if 'select']─→ buildModal(candidates, onSelect, onCancel)  [ui/modal.ts]
    │                       └─ injected into Shadow DOM
    │                       └─ user picks → onSelect(capability)
    │
    ├─→ buildIframe(capability, { id, clientUrl, type, ... })  [ui/iframe.ts]
    │       └─ HTMLIFrameElement, not yet in DOM
    │
    ├─→ createShadowHost(opts.container)            [ui/styles.ts]
    │       └─ appends backdrop + shadow root
    │       └─ appends iframe to shadow root
    │
    ├─→ bridge.connect(iframe, capability.origin, { resolve: ... })  [messaging/penpal-bridge.ts]
    │       └─ PenpalBridge: new WindowMessenger + connect()
    │       └─ returns Promise<ConnectionHandle>
    │
    ├─→ sessions.set(id, { iframe, shadowHost, connectionHandle, timeout, resolve, reject })
    │
    │   [iframe loads, user interacts, iframe calls parent.resolve(result)]
    │
    ├─→ onChildResolve(id, result)
    │       └─ clearTimeout(session.timeout)
    │       └─ session.connectionHandle.destroy()
    │       └─ shadowHost.remove()
    │       └─ sessions.delete(id)
    │       └─ session.resolve(result)             ← Promise resolves to host app
    │
    ▼
Host App receives: IntentResult
```

### Session State Ownership

Session state lives **exclusively in `OpenBuroClient.sessions: Map<string, ActiveSession>`**. There is no event bus between components — the orchestrator holds direct object references. This is intentional:

- Simpler to reason about (no pub/sub routing to trace)
- Easier to unit test (inject sessions map in tests)
- Correct for this scale (single-client library, not a framework)

An event bus would add indirection without benefit here. The Penpal `resolve` callback is a direct closure over the session Promise's `resolve/reject` pair.

### WS Live Updates Flow

```
WsListener(wsUrl)
    │
    └─ onmessage: REGISTRY_UPDATED
            └─ callback → OpenBuroClient._onRegistryUpdated()
                    └─ loader.fetchCapabilities(url)
                            └─ this.capabilities = [...new]
                            └─ opts.onCapabilitiesUpdated?.([...new])
```

WsListener is started in the `OpenBuroClient` constructor when `liveUpdates: true` (or `X-OpenBuro-Server: true` header detected on initial fetch). It is torn down in `destroy()`.

---

## Build Order and Phase Dependencies

This directly maps to the suggested roadmap phase structure:

```
Phase 1: Foundations (no dependencies)
├── src/errors.ts          — OBCError, OBCErrorCode
├── src/types.ts           — Capability, IntentRequest, IntentResult
├── src/intent/types.ts    — CastPlan discriminated union
├── src/intent/id.ts       — UUID generation
└── Build tooling (tsup, tsconfig, vitest)

Phase 2: Core Logic (depends on Phase 1 types only — fully unit-testable)
├── src/capabilities/resolver.ts   — mime matching (rich unit tests here)
├── src/intent/cast.ts             — planCast() pure function (unit tests)
└── src/capabilities/loader.ts     — fetchCapabilities (mock fetch in tests)

Phase 3: Capability Infrastructure (depends on Phase 1–2)
└── src/capabilities/ws-listener.ts  — WebSocket + backoff (mock WS in tests)

Phase 4: UI Layer (depends on Phase 1 types, no Phase 2–3 deps)
├── src/ui/styles.ts    — Shadow DOM host
├── src/ui/iframe.ts    — iframe factory
└── src/ui/modal.ts     — selection modal

Phase 5: Messaging Layer (depends on Phase 1 types only)
├── src/messaging/bridge-adapter.ts   — interface
└── src/messaging/penpal-bridge.ts    — Penpal implementation

Phase 6: Orchestration (depends on all above)
└── src/OpenBuroClient.ts   — wires Phase 2–5 together

Phase 7: Integration Tests + Polish
├── Integration: full castIntent with MockBridge
├── Integration: destroy() leak test
└── Build: ESM + CJS + UMD + types
```

Phases 2, 3, 4, and 5 have **no dependency on each other** and can be developed in parallel once Phase 1 types are locked.

---

## Testability Strategy per Component

| Component | Test Type | Strategy |
|-----------|-----------|----------|
| `capabilities/resolver.ts` | Unit | Pure function — no mocks needed. Rich matrix of mime types, wildcards, exact matches, absent filters. |
| `intent/cast.ts` | Unit | Pure function — assert CastPlan shape for 0/1/N capabilities. |
| `intent/id.ts` | Unit | Assert UUID v4 format, uniqueness over N calls. |
| `capabilities/loader.ts` | Unit | Mock `fetch` (vitest `vi.stubGlobal`). Test error → OBCError mapping, header detection. |
| `capabilities/ws-listener.ts` | Unit | Mock `WebSocket` class. Test reconnect backoff timing with fake timers. |
| `ui/modal.ts` | Unit (jsdom) | Assert returned element structure, callback wiring. No Penpal needed. |
| `ui/iframe.ts` | Unit (jsdom) | Assert iframe attributes, sandbox, URL params. |
| `ui/styles.ts` | Unit (jsdom) | Assert shadow root created on container, no host page style bleed. |
| `messaging/penpal-bridge.ts` | Integration | Real iframe in jsdom or Playwright. Only component requiring cross-origin frame. |
| `OpenBuroClient` (happy path) | Integration | Use `MockBridge` implementing `BridgeAdapter`. Assert session lifecycle, Promise resolution. |
| `OpenBuroClient` (destroy) | Integration | Assert no lingering listeners (spy on `removeEventListener`, `WS.close`). |
| Multiple concurrent sessions | Integration | Two `castIntent` calls simultaneously, assert isolation by id. |

**Key insight:** Because `PenpalBridge` is hidden behind `BridgeAdapter`, `OpenBuroClient` integration tests never need a real iframe or real `postMessage` round-trip. The `MockBridge` can synchronously resolve. Real Penpal is only exercised in a small set of end-to-end Playwright tests.

---

## Anti-Patterns

### Anti-Pattern 1: Coupling UI Layer to Penpal

**What people do:** Import Penpal inside `ui/iframe.ts` or `ui/modal.ts` and set up the connection there.

**Why it's wrong:** The UI layer becomes impossible to test without mocking Penpal. The iframe DOM factory and the Penpal handshake have different lifetimes — conflating them causes teardown races.

**Do this instead:** `ui/iframe.ts` returns a plain `HTMLIFrameElement`. `OpenBuroClient` appends it to the DOM and separately calls `bridge.connect(iframe, ...)` in the next step. UI and messaging are independent operations.

### Anti-Pattern 2: Global State / Singleton

**What people do:** Export a module-level singleton `const obc = new OpenBuroClient(...)` or use a module-level `capabilities` array.

**Why it's wrong:** The spec requires multiple concurrent `OpenBuroClient` instances to work side-by-side (e.g., two widgets on the same page). Singletons make this impossible.

**Do this instead:** All state lives on the class instance. No module-level mutable variables outside the class.

### Anti-Pattern 3: Calling `castIntent` Logic Synchronously Inside Constructor

**What people do:** Start the HTTP fetch for capabilities inside the constructor, kicking off async work before the caller can attach callbacks.

**Why it's wrong:** Error events emitted before `onError` is attached are silently dropped. Constructor side effects cause memory leaks if `destroy()` is called before the first await resolves.

**Do this instead:** Constructor sets up synchronous state only. Provide an explicit `init(): Promise<void>` or lazy-load capabilities on the first `castIntent` call. The spec's `refreshCapabilities()` implies eager loading is opt-in.

### Anti-Pattern 4: DOM Bleed via Global `<style>` Injection

**What people do:** `document.head.appendChild(style)` with `.obc-modal { ... }` class-prefixed rules.

**Why it's wrong:** The host application may have CSS reset rules, specificity conflicts, or `all: unset` that breaks modal styling. The opposite is also true — library styles leak into host app elements if selectors aren't perfectly scoped.

**Do this instead:** Inject into a Shadow DOM root. Styles inside a shadow root do not cross the shadow boundary in either direction. The spec already mandates this.

### Anti-Pattern 5: Ignoring Session ID on Incoming Penpal Messages

**What people do:** Accept the first `resolve()` call from any child frame.

**Why it's wrong:** If a stale session's iframe (from a previous `castIntent` that timed out) somehow sends a delayed `resolve`, it corrupts the active session's result.

**Do this instead:** Each Penpal connection is established with the session `id` in scope. The `resolve` method exposed to the child closes over that specific session id and only resolves/rejects the matching Promise in `sessions.get(id)`. Stale iframes can't reach another session's Promise.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenBuro Server (`GET /api/v1/capabilities`) | Plain `fetch` in `loader.ts` | Check `X-OpenBuro-Server: true` header to auto-enable WS. `CAPABILITIES_FETCH_FAILED` on non-2xx. |
| OpenBuro Server (`/capabilities/ws`) | Native `WebSocket` in `ws-listener.ts` | Auto-derive URL from `capabilitiesUrl` (http→ws scheme swap). Exponential backoff with 5-attempt cap. |
| Capability iframe (third-party) | Penpal `WindowMessenger` in `penpal-bridge.ts` | `allowedOrigins` restricted to `capability.path` origin. Iframe sandbox: `allow-scripts allow-same-origin allow-forms allow-popups`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `OpenBuroClient` ↔ `capabilities/loader` | Direct function call, `await` | Loader is stateless; client holds the returned array |
| `OpenBuroClient` ↔ `ws-listener` | Constructor injection of callback | `WsListener(wsUrl, onUpdate)` — listener calls `onUpdate(caps)` on `REGISTRY_UPDATED` |
| `OpenBuroClient` ↔ `ui/*` | Direct function call, returns DOM elements | Client appends returned elements; passes callbacks for user actions |
| `OpenBuroClient` ↔ `messaging/bridge-adapter` | `BridgeAdapter` interface | Injected in constructor; client calls `bridge.connect()`, stores `ConnectionHandle` |
| `ui/modal` ↔ `ui/styles` | None — styles owns the shadow root | Modal receives the shadow root as a mount target from the orchestrator |
| `intent/cast` ↔ `capabilities/resolver` | None — orchestrator calls both | Resolver result feeds into planCast; no direct import between the two |

---

## Scaling Considerations

This is a browser library — "scaling" means "more instances on more host pages", not infrastructure scaling. The relevant concerns:

| Concern | At 1 instance | At 3+ concurrent instances |
|---------|--------------|---------------------------|
| Global style pollution | Shadow DOM prevents it | Shadow DOM prevents it — each instance creates its own host |
| WS connections | 1 per client | Each client opens its own WS; host app should share one client instance |
| Session Map growth | Bounded by active castIntent calls | Bounded — sessions are deleted on resolve/reject/destroy |
| DOM footprint | 1 backdrop + 1 iframe per active session | Cleaned up on resolve; `destroy()` removes all |

The one non-obvious concern: if a host app creates many `OpenBuroClient` instances with the same `wsUrl`, each opens an independent WebSocket. The spec says "multiple concurrent instances work side-by-side" — but the recommended pattern is one shared instance per page. This should be noted in the README.

---

## Sources

- Penpal API (v6+, WindowMessenger pattern): [GitHub — Aaronius/penpal](https://github.com/Aaronius/penpal)
- Auth0 SPA SDK (facade pattern reference): [GitHub — auth0/auth0-spa-js](https://github.com/auth0/auth0-spa-js)
- Supabase-js architecture (facade + sub-client composition): [DeepWiki — supabase/supabase-js](https://deepwiki.com/supabase/supabase-js)
- Shadow DOM isolation: [MDN — Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- TypeScript library structure: [TypeScript docs — Library Structures](https://www.typescriptlang.org/docs/handbook/declaration-files/library-structures.html)
- Shadow DOM for third-party injection: [Courier — Shadow DOM to Isolate Styles](https://www.courier.com/blog/how-to-use-the-shadow-dom-to-isolate-styles-on-a-dom-that-isnt-yours)

---

*Architecture research for: OpenBuroClient — vanilla TS iframe intent brokering library*
*Researched: 2026-04-10*
