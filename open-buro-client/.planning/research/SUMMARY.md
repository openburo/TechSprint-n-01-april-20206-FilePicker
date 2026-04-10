# Project Research Summary

**Project:** @openburo/client (OpenBuroClient)
**Domain:** Framework-agnostic vanilla TypeScript browser library — sandboxed iframe intent brokering
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

OpenBuroClient is a browser-side SDK that implements an Android-Intent-style capability broker: the host app calls `castIntent`, OBC fetches a registry of capability providers, matches on MIME type, shows a chooser modal if needed, loads the selected capability in a sandboxed iframe, runs a PostMessage RPC handshake, and returns a typed result. The architectural ancestors (Android Intents, Cozy intents, Google Picker) all agree on the same layered structure: capability discovery is separate from selection UI, which is separate from the PostMessage channel. The recommended implementation follows a Facade-over-modules pattern (Supabase-js style): a thin `OpenBuroClient` orchestrator delegates to independent, separately testable modules with clean layer boundaries. The messaging layer is hidden behind a `BridgeAdapter` interface so Penpal never appears outside `src/messaging/`, enabling full unit test coverage without real iframes.

Three cross-cutting facts must not get lost before a single line of code is written. First, the project spec describes the Penpal v6 API (`connectToChild`, `connectToParent`, `allowedOrigins` on the connection call). Penpal v7 — the only current release — replaced this entirely with `connect({ messenger: new WindowMessenger(...), methods })`. All spec pseudocode is wrong and will not compile against the npm package. Second, the spec sandbox string `allow-scripts allow-same-origin` is a documented security anti-pattern when the capability origin can equal the host origin: the embedded page can remove its own `sandbox` attribute via JavaScript. The iframe factory must guard against same-origin capabilities at construction time. Third, the spec has zero accessibility requirements for the chooser modal and loaded iframe. ESC key, focus trap, focus restoration, `role="dialog"` + `aria-modal` + `aria-labelledby`, an iframe `title` attribute, body scroll lock, and a loading indicator are all absent from the spec but are WCAG table stakes and must be treated as P1 requirements alongside the core intent flow.

The build stack is fully settled: tsdown (not tsup — tsup is deprecated) for ESM/CJS/UMD output, TypeScript 6 with explicit `ES2020` target, Vitest 4 for tests, Biome for lint/format. The one remaining decision is whether to narrow the stated browser floor (Chrome 90 / Firefox 88 / Safari 14) to match the `crypto.randomUUID()` baseline (Chrome 92 / Firefox 95 / Safari 15.4) or add a three-line `getRandomValues` fallback. The fallback is recommended: zero dependencies, covers the full stated range. Penpal is a single-maintainer package; pin to an exact version and evaluate vendoring it before the first integration phase.

---

## Key Findings

### Recommended Stack

The stack is greenfield-clean with no framework constraints. tsdown 0.21.7 (Rolldown-based successor to the now-deprecated tsup) handles all three output formats including UMD natively — this is the only tool that does so without a plugin shim. TypeScript 6.0 introduced several breaking default changes (rootDir, target, outFile removal) that require explicit tsconfig values even for a "simple" project; the researched tsconfig is provided verbatim in STACK.md and must be used as-is. The exports map shape for dual-package ESM/CJS is non-trivial: `"types"` must appear nested inside each condition (`import` and `require` branches), not only at the top level; `@arethetypeswrong/cli` must be a CI gate on every publish to detect `CJSResolvesToESM` and `FallbackCondition` errors before consumers encounter them.

**Core technologies:**
- **TypeScript 6.0** — source language; use explicit `ES2020` target, `moduleResolution: bundler`, `noEmit: true` (tsdown drives emit)
- **tsdown 0.21.7** — library bundler producing ESM + CJS + UMD; only tool supporting UMD natively in 2026; tsup is deprecated and must not be used
- **Penpal 7.0.6** — parent-to-iframe PostMessage RPC; v7 API is `connect({ messenger: new WindowMessenger(...), methods })`; v6 `connectToChild`/`connectToParent` no longer exist
- **Vitest 4.1.4** — unit + integration tests; native ESM; Browser Mode stable; 10-20x faster than Jest
- **Biome 2.4** — lint + format in a single binary; replaces ESLint + Prettier; 450+ TypeScript-aware rules
- **`@arethetypeswrong/cli`** — CI gate validating published exports map; non-negotiable for a dual-format library
- **`crypto.randomUUID()` + `getRandomValues` fallback** — zero-dependency UUID; inline three-line fallback covers Chrome 90-91, Firefox 88-94, Safari 14-15.3 that lack `randomUUID`

### Expected Features

The core value proposition — `castIntent(intent)` to sandboxed iframe to typed result — has a deep dependency tree that must be satisfied before any of it works. MIME-type matching, capability discovery, session UUID isolation, and the Penpal bridge are all prerequisites to the single happy-path flow. The six accessibility gaps in the spec (ESC, focus trap, focus restoration, ARIA dialog, iframe title, scroll lock) and the loading indicator are table stakes by WCAG 2.1 and universal modal convention; they belong in v1 alongside the core flow, not in a polish pass.

**Must have (table stakes for v1):**
- `castIntent()` full orchestration: discovery, match, modal or direct, iframe, result
- HTTP capability fetch + MIME resolver with wildcard support (`*/*`, `image/*`, exact)
- Penpal v7 iframe messaging with per-session `allowedOrigins` restriction
- Same-origin capability guard: constructor throws if `capability.origin === location.origin`
- Session UUID isolation for concurrent intents (Map keyed by session id)
- Chooser modal with capability list (appName + icon)
- ESC key + backdrop click dismiss the chooser
- Focus trap inside chooser modal while open (WCAG 2.1 SC 2.1.2)
- Focus restoration to trigger element on modal close (WCAG 2.1 SC 2.4.3)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on chooser (WCAG 2.1 SC 4.1.2)
- `title` attribute on injected iframe using `capability.appName` (WCAG 2.4.1 / ACT cae760)
- Body scroll lock while modal/iframe is open; restore on all close paths
- Loading indicator in the host-side overlay until Penpal handshake completes
- Timeout watchdog with `IFRAME_TIMEOUT` error; clean teardown on expiry
- `destroy()` with zero leaks (AbortController as single teardown mechanism)
- Shadow DOM style isolation (`attachShadow({ mode: 'open' })`)
- `OBCError` structured errors with codes via `onError` + Promise rejection
- ESM + CJS + UMD builds with nested `types` in exports map

**Should have (differentiators, add after v1 validation):**
- WebSocket live registry updates with full jitter exponential backoff and `destroyed` flag guard
- `onCapabilitiesUpdated` callback (only meaningful with WS live updates)
- Multiple simultaneous `castIntent` sessions verified under load

**Defer (v2+):**
- Framework bindings (`@openburo/react`, `@openburo/vue`)
- CSS custom-properties theming within Shadow DOM
- Capability manifest schema versioning
- `intent:resize` dynamic iframe sizing

**Anti-features (explicitly do not build in v1):**
- Custom modal theming API or slots
- OAuth/SSO token exchange inside OBC
- Capability caching / offline mode
- Parent-to-iframe method calls beyond `resolve`
- Global `window.OpenBuro` singleton (UMD exposes `window.OpenBuroClient` as opt-in only)

### Architecture Approach

OBC follows a strict layered architecture with no upward dependencies: the orchestrator (`OpenBuroClient`) is the sole file permitted to import across all layers. The capability layer (HTTP + MIME + WS) knows nothing about the UI. The UI layer (modal, iframe factory, Shadow DOM host) knows nothing about Penpal. The messaging layer is the only file that imports Penpal, hidden behind a `BridgeAdapter` interface that enables `MockBridge` injection for unit tests. Each `castIntent` call produces an `ActiveSession` object stored in a `Map<string, ActiveSession>` — this is the single source of truth for in-flight state, enabling leak-free `destroy()` and correct concurrent session isolation. Intent decisions are handled by a pure `planCast()` function returning a discriminated union (`no-match | direct | select`) allowing the decision to be unit-tested without DOM stubs.

**Major components:**
1. **`OpenBuroClient`** — thin orchestrator; holds `sessions: Map<string, ActiveSession>`; the only file crossing layer boundaries
2. **`capabilities/loader.ts`** — `fetchCapabilities(url)` via plain `fetch`; detects `X-OpenBuro-Server` header; passes `AbortController.signal`
3. **`capabilities/resolver.ts`** — pure MIME-type matching function; no I/O; richly unit-testable
4. **`capabilities/ws-listener.ts`** — WebSocket + full-jitter exponential backoff; `destroyed` boolean guard; `start()`/`stop()` interface
5. **`intent/cast.ts`** — pure `planCast()` returning `CastPlan` discriminated union; no DOM, no network
6. **`ui/modal.ts`** — DOM factory returning `HTMLElement`; callbacks injected by orchestrator; no Penpal knowledge
7. **`ui/iframe.ts`** — iframe DOM factory with sandbox string, `title` attribute from `capability.appName`, URL params
8. **`ui/styles.ts`** — `attachShadow({ mode: 'open' })`; CSS reset on modal root; returns `ShadowRoot`
9. **`messaging/bridge-adapter.ts`** — `BridgeAdapter` interface + `ConnectionHandle` interface; pure types
10. **`messaging/penpal-bridge.ts`** — sole Penpal import; `PenpalBridge implements BridgeAdapter`; wraps `new WindowMessenger` + `connect()`
11. **`errors.ts`** — `OBCError` class + `OBCErrorCode` enum
12. **`types.ts`** — all shared interfaces (`Capability`, `IntentRequest`, `IntentResult`, `OBCOptions`)

### Critical Pitfalls

1. **Penpal v7 API mismatch with spec** — The spec uses `connectToChild`/`connectToParent` (v6). v7 uses `connect({ messenger: new WindowMessenger({ remoteWindow, allowedOrigins }), methods })`. After the v7 handshake, all RPC traffic uses MessagePorts, not `window.postMessage` — a raw `window.message` listener cannot observe Penpal RPC calls. Build to v7 from day one; never reference the spec pseudocode as implementation guidance.

2. **Sandbox security: `allow-scripts` + `allow-same-origin` nullifies sandboxing** — If a capability URL shares origin with the host page, the embedded script can remove the `sandbox` attribute from the iframe element, escaping all constraints. The iframe factory must throw `OBCError` before creating the iframe if `new URL(capability.path).origin === location.origin`.

3. **Missing a11y baseline** — Without ESC key handling, focus trap, focus restoration, `role="dialog"` + `aria-modal` + `aria-labelledby`, and iframe `title`, OBC fails WCAG 2.1 SC 2.1.2, 2.4.1, 2.4.3, and 4.1.2. These are P1. The chooser modal phase must include all of them before closing.

4. **`crypto.randomUUID()` browser gap** — The stated browser floor (Chrome 90 / Firefox 88 / Safari 14) predates `randomUUID` support by 2-7 versions. Use the inline `getRandomValues` fallback in `intent/id.ts`.

5. **`destroy()` leaks compound with every feature** — Use `AbortController` as the single teardown mechanism. Every feature PR must update `destroy()` and pass an integration test asserting zero listeners + closed WS + no OBC DOM remaining.

6. **WebSocket reconnect: jitter + `destroyed` guard required** — Pure exponential backoff causes synchronized reconnect storms. The `destroyed` flag guard prevents post-`destroy()` reconnect timers from opening new connections. Both must ship in the same PR as the initial WebSocket code.

7. **Penpal supply-chain risk** — Pin to exact version (`"penpal": "7.0.6"`, not `"^7.0.6"`). Evaluate vendoring Penpal source (~500 lines) before the first integration phase to eliminate the transitive dependency.

8. **Dual-package types gotcha** — Top-level `"types"` field in `package.json` is invisible to `moduleResolution: bundler` consumers. Nest `"types"` inside each `exports` condition; run `attw --pack` as a CI gate; never publish without it passing.

9. **Penpal version contract for capability authors** — OBC parent uses Penpal v7; capability iframes must also use a v7-compatible Penpal. A v5/v6 child causes a silent `IFRAME_TIMEOUT`. Document the version requirement in a capability author integration guide from day one.

10. **Concurrent session isolation** — The `resolve()` method exposed to each child iframe must close over the specific `sessionId` and call `sessions.get(sessionId)?.resolve(result)`. Design the session Map before any `castIntent` implementation is written.

---

## Implications for Roadmap

The architecture research provides a direct build order based on layer dependencies. Phases 2-5 have no dependency on each other and can be developed in parallel once Phase 1 types are locked. Security and accessibility gaps must be addressed in the phases that create the affected code, not deferred to a hardening phase.

### Phase 1: Foundations

**Rationale:** All other phases depend on shared types and error codes. Build tooling must be in place before any source can be written or tested. The Penpal supply-chain decision (vendor vs. pin) must be made here before Penpal appears in any code.
**Delivers:** Repo scaffold with tsdown/Vitest/Biome/TypeScript 6 configured; `OBCError` + `OBCErrorCode`; all shared interfaces (`Capability`, `IntentRequest`, `IntentResult`, `OBCOptions`, `CastPlan`); `generateSessionId()` with `getRandomValues` fallback; `@arethetypeswrong/cli` in CI; exact Penpal version pinned.
**Addresses:** UUID browser gap, dual-package types setup, supply-chain risk
**Avoids:** tsup (deprecated), `uuid` npm package, Penpal `^` range

### Phase 2: Core Logic (parallel with Phases 3-5)

**Rationale:** Pure functions with no I/O or DOM — fully unit-testable without mocks. Unblocks the orchestrator in Phase 6 as soon as Phase 1 types are available.
**Delivers:** `capabilities/resolver.ts` (MIME matching with wildcards + absent-filter handling); `intent/cast.ts` (`planCast()` discriminated union); `capabilities/loader.ts` (HTTP fetch, header detection, `AbortController.signal`, mixed-content guard, `OBCError` mapping)
**Avoids:** Re-fetching on every `castIntent`, silent mixed-content failures

### Phase 3: Capability Infrastructure (parallel with Phases 2, 4, 5)

**Rationale:** WebSocket with correct jitter backoff and `destroyed` guard must be built as a unit, not incrementally. Separating it into its own phase prevents the pattern of "add jitter later."
**Delivers:** `capabilities/ws-listener.ts` — WebSocket + full-jitter exponential backoff (1s to 30s cap, 5 attempts), `destroyed` boolean flag guard, `start()`/`stop()` interface, `WS_CONNECTION_FAILED` error after exhaustion, `wss://` protocol validation
**Avoids:** Reconnection storm, post-`destroy()` reconnect, silent WS failure

### Phase 4: UI Layer (parallel with Phases 2, 3, 5)

**Rationale:** UI components are pure DOM factories independently testable with happy-dom. Accessibility requirements belong here — retrofitting focus traps and ARIA after the modal is "done" is significantly harder than building them in.
**Delivers:** `ui/styles.ts` (Shadow DOM host with `attachShadow({ mode: 'open' })`, CSS reset); `ui/iframe.ts` (iframe factory: sandbox string, `title` attribute from `capability.appName`, URL params); `ui/modal.ts` (chooser modal: `role="dialog"` + `aria-modal` + `aria-labelledby`, focus trap, ESC key handler, backdrop click handler, body scroll lock, cancel button, loading spinner overlay)
**Avoids:** Shadow DOM `mode: 'closed'`, CSS bleed, missing a11y baseline, `innerHTML` for untrusted capability metadata

### Phase 5: Messaging Layer (parallel with Phases 2, 3, 4)

**Rationale:** Penpal is isolated to this layer by design. Building it in parallel forces the `BridgeAdapter` interface to be established early, enabling `MockBridge` in all orchestrator tests.
**Delivers:** `messaging/bridge-adapter.ts` (`BridgeAdapter` + `ConnectionHandle` interfaces); `messaging/penpal-bridge.ts` (`PenpalBridge implements BridgeAdapter`; uses `new WindowMessenger({ remoteWindow, allowedOrigins })` + `connect()`); `MockBridge` for tests
**Uses:** Penpal v7 `connect` + `WindowMessenger` API (not v6 `connectToChild`)
**Avoids:** Penpal API mismatch with spec, coupling UI to Penpal, raw `message` listener without origin guard

### Phase 6: Orchestration

**Rationale:** The orchestrator can only be written after all layer components are available. It wires them together but implements no logic itself.
**Delivers:** `OpenBuroClient.ts` — `castIntent()` full flow, `refreshCapabilities()`, `getCapabilities()`, `destroy()` via `AbortController.abort()`, session `Map<string, ActiveSession>`, constructor validation (mixed-content, same-origin capability guard), `BridgeAdapter` injection for tests
**Avoids:** Constructor async side effects, singleton pattern, session cross-contamination, anonymous listener functions, `destroy()` leak

### Phase 7: Integration Tests + Distribution

**Rationale:** Integration tests exercise the full session lifecycle with `MockBridge`. Distribution validation must pass before any publish.
**Delivers:** Integration test: happy-path `castIntent` with `MockBridge`; `destroy()` leak test (zero listeners + closed WS + no OBC DOM); two concurrent sessions delivering to correct callbacks; `attw --pack` CI gate; `publint` validation; ESM + CJS + UMD build output; capability author integration guide (Penpal v7 version contract)
**Avoids:** `CJSResolvesToESM` type errors, publish without type validation, undocumented Penpal version contract

### Phase 8: WebSocket Live Updates (post-validation)

**Rationale:** Deferred until the core v1 flow is validated. WS live updates require an active capability registry with multiple adopters to be meaningful. The WS infrastructure from Phase 3 is already built — this phase wires it into the orchestrator.
**Delivers:** `liveUpdates` option wiring in `OpenBuroClient` constructor; `onCapabilitiesUpdated` callback; WS auto-detection from `X-OpenBuro-Server` header; reconnect configuration exposed via `OBCOptions`

### Phase Ordering Rationale

- Phase 1 must be first: types and tooling are prerequisites for everything.
- Phases 2-5 are independent of each other once Phase 1 types are locked; they can run in parallel.
- Phase 6 requires all of Phases 2-5 to be complete; it is the integration point.
- Phase 7 validates the integrated system and gates distribution.
- Phase 8 is post-validation; it adds the WS differentiator once the core is proven.
- Security and accessibility requirements are embedded in the phases that create the affected code (Phase 4 for a11y, Phase 5 for messaging security, Phase 6 for constructor guards) — never deferred to a separate hardening phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Messaging Layer):** Penpal v7 MessagePort behavior in cross-origin iframes under specific CSP configurations is not fully documented. Validate handshake timing under fast-loading test fixtures before writing the connection lifecycle code.
- **Phase 4 (UI Layer):** Shadow DOM focus trap implementation has browser-specific quirks when the shadow root contains an iframe (focus delegation into cross-origin sandboxed content is limited by sandbox policy). Needs a spike before implementing.
- **Phase 7 (Distribution):** tsdown 0.21.x is pre-1.0. If UMD output has a regression, the fallback is Rollup 4. Verify tsdown UMD output against a CDN smoke test before publishing.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundations):** tooling config is well-documented and verified; tsconfig and tsdown config are provided verbatim in STACK.md.
- **Phase 2 (Core Logic):** pure functions, standard unit test patterns.
- **Phase 3 (WS Listener):** backoff + jitter patterns are well-documented; msw WS mocking is stable.
- **Phase 6 (Orchestration):** facade + session Map patterns are standard; all design decisions are made by this point.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core tools verified against official sources and npm. Penpal v7 API verified against release notes and GitHub README. Only uncertainty is tsdown pre-1.0 status. |
| Features | HIGH | Spec is detailed; analogous systems (Android Intents, Cozy, Google Picker) are well-documented and provide strong validation signal. Missing a11y features identified with specific WCAG citations. |
| Architecture | HIGH | Derived from spec + first principles; validated against Penpal API, Auth0 SPA SDK, Supabase-js. Layer boundaries and component responsibilities are unambiguous. |
| Pitfalls | HIGH | Most claims verified against official docs, Penpal release notes, MDN, and community sources. Sandbox security pitfall verified against browser vendor documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Same-origin capability URL UX:** The security guard is clear (throw), but the error code and message for same-origin capabilities needs a decision during Phase 6 planning — constructor-time or per-`castIntent` error?
- **Shadow DOM + iframe focus delegation:** Keyboard navigation from the chooser modal into the sandboxed capability iframe is constrained by sandbox policy. WCAG compliance for the iframe interaction phase needs a focused assessment during Phase 4 planning.
- **tsdown UMD pre-1.0 stability:** If a Rolldown regression surfaces during implementation, the fallback to Rollup 4 adds approximately one sprint of config work. Monitor tsdown GitHub issues before starting Phase 1.
- **Penpal version negotiation protocol:** The version-negotiation ping design (if chosen) needs a small spike during Phase 5 planning.
- **Browser floor decision:** The `getRandomValues` fallback is recommended over narrowing the floor, but the final browser compatibility matrix should be confirmed with the project owner before Phase 1 closes.

---

## Sources

### Primary (HIGH confidence)
- Penpal v7.0.0 release notes: https://github.com/Aaronius/penpal/releases/tag/v7.0.0 — v7 API shape, `WindowMessenger`, migration deltas
- Penpal GitHub README (current): https://github.com/Aaronius/penpal — usage examples, version compatibility
- TypeScript 6.0 announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ — default changes, removed options
- `crypto.randomUUID()` caniuse: https://caniuse.com/mdn-api_crypto_randomuuid — Chrome 92 / Firefox 95 / Safari 15.4 baseline confirmed
- Vitest 4.0 announcement: https://vitest.dev/blog/vitest-4 — Browser Mode stable status
- tsdown introduction: https://tsdown.dev/guide/ — UMD support confirmed, tsup deprecation
- Rocket Validator sandbox warning: https://rocketvalidator.com/html-validation/bad-value-x-for-attribute-sandbox-on-element-iframe-setting-both-allow-scripts-and-allow-same-origin-is-not-recommended — `allow-scripts` + `allow-same-origin` breakout
- WCAG 2.1 modal dialog requirements: https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html — SC 2.1.2 focus trap
- ACT rule cae760: https://act-rules.github.io/rules/cae760/ — iframe accessible name requirement
- MDN postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage — origin validation requirements
- Android Intents documentation: https://developer.android.com/reference/android/content/Intent
- Cozy intent spec: https://docs.cozy.io/en/cozy-stack/intents/

### Secondary (MEDIUM confidence)
- ESM/CJS exports map pattern: https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing — dual-package types structure
- `@arethetypeswrong/cli` CJSResolvesToESM docs: https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md
- TypeScript 5.x to 6.0 migration guide: community guide cross-checked against TS6 announcement
- Auth0 SPA SDK facade pattern: https://github.com/auth0/auth0-spa-js
- Supabase-js facade + sub-client composition: https://deepwiki.com/supabase/supabase-js
- WebSocket reconnection jitter: https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1
- npm Supply Chain Attack 2025: https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem

### Tertiary (LOW confidence — validate during implementation)
- Penpal v7-to-v6 child compatibility: documented as supported but not independently verified against a live cross-version test
- tsdown 0.21 UMD output fidelity: pre-1.0, reported working by TresJS and others but not verified against OBC build shape

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
