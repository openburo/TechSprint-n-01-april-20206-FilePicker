# Pitfalls Research

**Domain:** iframe-broker / PostMessage RPC / framework-agnostic TypeScript library
**Researched:** 2026-04-10
**Confidence:** HIGH (most claims verified against official docs, Penpal release notes, MDN, and multiple community sources)

---

## Critical Pitfalls

### Pitfall 1: Penpal `connectToChild` Called After Iframe Has Already Loaded

**What goes wrong:**
The iframe's `connectToParent` handshake fires when the child document is ready. If the parent calls `connectToChild` after that window has already sent its handshake, the connection is never established and the Promise never resolves — silently hanging the intent session.

**Why it happens:**
Developers assume Penpal will poll or retry on both sides. It does not. The handshake is a one-shot event per navigation. In Penpal v7 the handshake protocol is more resilient (either side can call `connect` first), but the race is still real when the iframe loads fast (e.g., same-origin or cached).

**How to avoid:**
Always append the iframe to the DOM and call `connectToChild` in the same JavaScript event loop tick. Penpal's documentation is explicit: setting `src` and calling `connectToChild` in the same sync block is safe; moving `connectToChild` into a `setTimeout` or `await` boundary is not. Never wait for a `load` event on the iframe before calling `connectToChild`.

**Warning signs:**
- `castIntent` promise never resolves and no error fires
- The Penpal `connection.promise` hangs indefinitely
- Adding a `console.log` in the child's `connectToParent` shows it fires, but no parent handler responds

**Phase to address:**
Phase — Iframe Lifecycle & PostMessage RPC (the phase that wires `castIntent` to Penpal). Write an integration test that verifies connection is established within 500 ms on a fast-loading mock child.

---

### Pitfall 2: Sandbox `allow-scripts` + `allow-same-origin` Together Nullifies Sandboxing

**What goes wrong:**
Combining `allow-scripts` and `allow-same-origin` in the sandbox attribute allows the embedded page (if it is same-origin) to use JavaScript to remove the `sandbox` attribute from its own iframe element, completely escaping the sandbox. Browsers (and validators like Rocket Validator) explicitly warn against this combination.

**Why it happens:**
Developers cargo-cult sandbox strings from Stack Overflow answers written before this interaction was widely understood, or copy an existing demo that worked because the child was cross-origin.

**How to avoid:**
In OBC's case, capability iframes are third-party (cross-origin), so `allow-same-origin` is included for `postMessage` handshake purposes. Verify that every capability URL is genuinely cross-origin at runtime. Add a guard in the iframe factory: if `new URL(capability.path).origin === location.origin`, throw a configuration error rather than opening the iframe. Document in the library README that same-origin capabilities are unsupported for security reasons. The approved sandbox string is: `allow-scripts allow-same-origin allow-forms allow-popups`.

**Warning signs:**
- A capability URL whose origin matches the host page's origin
- Browser devtools "sandbox violation" warnings disappearing unexpectedly
- CSP reports showing the iframe accessing parent-origin resources

**Phase to address:**
Phase — Security Hardening / Iframe Factory. Add origin-equality guard before iframe creation.

---

### Pitfall 3: PostMessage Origin Validated Only by Penpal — No Secondary Guard

**What goes wrong:**
Penpal's `allowedOrigins` option restricts which origins can complete the handshake, but any code path that uses a raw `window.addEventListener('message', ...)` handler (e.g., for session ID routing, capability pings, or debugging) outside of Penpal bypasses that restriction entirely. An attacker page can send crafted messages with valid-looking session IDs to trigger logic.

**Why it happens:**
Developers add auxiliary `message` listeners alongside Penpal, forget to validate `event.origin` in them, and assume Penpal's check covers all postMessage traffic.

**How to avoid:**
Every `window.addEventListener('message', handler)` in the codebase must begin with an `event.origin` check against an explicit `allowedOrigins` set, even if Penpal is the primary channel. Since OBC already knows `capability.path` per session, maintain a `Set<string>` of active session origins and validate against it. Use TypeScript to enforce this: create a `safeMessageHandler(allowedOrigins, handler)` wrapper that gates the callback. Also validate `event.data.id` against the active session registry so stale or cross-session messages are dropped before they reach any handler.

**Warning signs:**
- Raw `message` event listeners without an origin guard visible in grep/audit
- Console errors from Penpal about unexpected origins — these indicate attempted exploitation or misconfiguration
- Any place where `event.origin === '*'` is used

**Phase to address:**
Phase — PostMessage RPC Layer. Enforce via code review checklist item: "every `message` listener has explicit `event.origin` validation."

---

### Pitfall 4: `destroy()` Leaks — Listeners, WebSocket, Iframes, and Shadow DOM Left Behind

**What goes wrong:**
When `destroy()` is called (e.g., on SPA route change or component unmount), any of these can survive:
- The global `window.message` listener added for Penpal or session routing
- The WebSocket connection in `CONNECTING` or `OPEN` state
- The injected backdrop/iframe DOM inside `options.container`
- The `AbortController` / `AbortSignal` tied to capability fetch requests
- Penpal's internal `connection.destroy()` not called, leaving its `MessagePort` open

Each leaked listener holds a reference to the OBC instance (and its closures), preventing GC. Leaked WebSockets keep the TCP connection alive. Leaked iframes keep the capability URL loaded and Penpal's timers running.

**Why it happens:**
Teardown is built last, tested least, and broken by every new feature that adds a listener or resource without updating `destroy()`. Anonymous listener functions make `removeEventListener` impossible.

**How to avoid:**
- Use `AbortController` as the single teardown mechanism: pass its signal to `fetch`, to WebSocket event listeners, and to all `addEventListener` calls via `{ signal }` option. Calling `controller.abort()` in `destroy()` removes everything atomically.
- Store the Penpal `connection` reference per session and call `connection.destroy()` in the session cleanup path.
- Write a dedicated integration test that calls `destroy()` and then asserts: zero `message` listeners on `window`, WebSocket `readyState === CLOSED`, no child nodes added by OBC remain in `options.container`.
- Never use anonymous functions for listeners — always bind a named reference so `removeEventListener` can target it.

**Warning signs:**
- DevTools Memory heap snapshot before/after showing retained `OpenBuroClient` instances
- `WebSocket` connections that stay `OPEN` after `destroy()`
- `container.children` still contains OBC-injected nodes after `destroy()`
- Multiple successive `castIntent` calls grow memory monotonically instead of stabilizing

**Phase to address:**
Phase — Core Lifecycle / `destroy()`. Integration test is a hard gate: must pass before the phase is complete.

---

### Pitfall 5: WebSocket Reconnection Storm (Thundering Herd Without Jitter)

**What goes wrong:**
When the OBC server restarts or goes offline briefly, all browser clients using the library reconnect at the same exponential-backoff intervals (1 s, 2 s, 4 s, ...). Without jitter, hundreds of tabs reconnect simultaneously in synchronized waves, amplifying load spikes on the server.

Additionally, if `destroy()` is called while the WebSocket is in the middle of a backoff delay, the pending `setTimeout` fires after teardown and opens a new connection on an already-destroyed instance.

**Why it happens:**
Pure exponential backoff is the first thing developers implement. Jitter is an afterthought. The destroyed-instance reconnect happens because `clearTimeout` is not called in `destroy()`.

**How to avoid:**
- Implement full jitter: `delay = randomBetween(0, min(cap, baseDelay * 2^attempt))` where `cap = 30000 ms`.
- Store every reconnect `setTimeout` handle. In `destroy()`, cancel all pending timers before closing the WebSocket.
- Track a `destroyed` boolean flag. The reconnect callback must check `this.destroyed` before opening a new WebSocket.
- Limit total reconnect attempts (5 default, configurable via `OBCOptions`). After exhaustion, invoke `onError` with `WS_CONNECTION_FAILED` and stop.

**Warning signs:**
- Network tab showing many simultaneous WebSocket connection attempts at identical timestamps after a server restart
- After `destroy()` call, a new WebSocket connection appears in the Network tab
- `WS_CONNECTION_FAILED` never fires even after many failed attempts

**Phase to address:**
Phase — WebSocket Live Updates. Jitter and the `destroyed` guard must both be implemented in the same PR as the initial WebSocket code.

---

### Pitfall 6: Concurrent `castIntent` Sessions Not Isolated by Session ID

**What goes wrong:**
When two `castIntent` calls are in flight simultaneously (e.g., the host app calls `castIntent` again before the first resolves), both share the global `window.message` listener. If the first session's iframe resolves early and posts a `resolve(result)` message, the message handler might deliver the result to the wrong callback because session ID validation is missing or partial.

**Why it happens:**
Initial implementation wires `resolve()` as a single callback reference rather than a Map keyed by session ID. Adding the second session overwrites the first, or both sessions use the same callback slot.

**How to avoid:**
- Maintain a `Map<sessionId, SessionState>` where `SessionState` holds the Penpal connection, the callback/resolver, and the timeout handle.
- The Penpal `resolve` method exposed to the child must close over `sessionId` and call `sessions.get(sessionId)?.resolve(result)` — never a shared closure.
- Validate `event.data.id` against `sessions.has(id)` in every raw `message` handler before routing.
- Write a unit test that fires two concurrent `castIntent` calls with distinct mock capabilities and asserts each callback receives only its own result.

**Warning signs:**
- Swapped results when two file pickers open simultaneously
- One `castIntent` resolving immediately when a different session's iframe posts
- `sessions.size` never exceeds 1 even when two calls are in flight

**Phase to address:**
Phase — Session Manager / Intent Orchestration. Session map must be designed before any `castIntent` implementation is written.

---

### Pitfall 7: CSS Injected Into Host Page Instead of Shadow DOM, or Shadow DOM Root Closed

**What goes wrong:**
Two failure modes:
1. Fallback path injects a `<style>` tag directly into `document.head` with `.obc-*` selectors. Host CSS with higher specificity overrides the modal's layout or hides it. OBC's styles also bleed into host elements that coincidentally share class names.
2. Shadow DOM is used but created with `mode: 'closed'`. This prevents automated testing frameworks (and OBC's own `destroy()` cleanup code) from accessing the shadow root to remove injected nodes or run assertions.

**Why it happens:**
Shadow DOM is planned as preferred but the fallback is written first for speed and then becomes permanent. `mode: 'closed'` is chosen to prevent "tampering" without understanding its testing and teardown implications.

**How to avoid:**
- Always use `attachShadow({ mode: 'open' })`. Open mode is testable and still isolates styles. Security through shadow-root opacity is not a real protection.
- In the Shadow DOM host element, inject a `<style>` block that explicitly resets inherited CSS properties (`all: initial` on the modal root, then re-declare only OBC styles). This prevents `font-size`, `color`, `line-height`, and `rem` from leaking in.
- Keep a reference to the shadow host element in `destroy()` and call `shadowHost.remove()`.
- Store the `<style>` node reference if using the fallback path, and call `styleNode.remove()` in `destroy()`.

**Warning signs:**
- Modal text renders at unexpected sizes because host page uses a non-standard `font-size` on `html`
- Host page's CSS reset (e.g., `* { box-sizing: border-box; margin: 0 }`) applies inside the modal
- `destroy()` leaves a `<style>` tag in `document.head` visible in DevTools

**Phase to address:**
Phase — UI Isolation / Modal Injection. Shadow DOM must be the primary path and must be tested against a host page that has aggressive CSS resets.

---

### Pitfall 8: Mixed Content — HTTP Capability URL or WS (Not WSS) in HTTPS Host

**What goes wrong:**
Modern browsers block all "active" mixed content — iframes, scripts, and WebSocket connections — when the host page is served over HTTPS. If a capability URL uses `http://` or the WebSocket uses `ws://`, the browser silently blocks the connection without a clear user-visible error. The library's `onError` may not fire because the fetch/socket never reaches the network.

**Why it happens:**
During development the server runs on `http://localhost`, which browsers exempt from mixed-content rules. The issue only surfaces in staging or production with a real HTTPS host page. Developers miss it because local testing never triggers it.

**How to avoid:**
- In the HTTP capability loader, check `capabilitiesUrl` at construction time: if `location.protocol === 'https:'` and the URL is `http:`, emit an `OBCError` immediately with a clear message ("Capability URL must use HTTPS when the host page is served over HTTPS").
- Similarly validate `wsUrl`: reject `ws://` when the host is on HTTPS, require `wss://`.
- Do not attempt to auto-upgrade — the caller must configure HTTPS/WSS explicitly. Auto-upgrading hides misconfiguration.
- Document this constraint prominently in the README under "Requirements."

**Warning signs:**
- `castIntent` hangs with no error in production but works in local dev
- Browser console shows "Mixed Content: The page was loaded over HTTPS, but requested an insecure resource"
- `fetch()` to `capabilitiesUrl` rejects with a network error (not an HTTP error)

**Phase to address:**
Phase — Capability Loading / HTTP Loader. Add mixed-content guard to the `OpenBuroClient` constructor validation step.

---

### Pitfall 9: TypeScript `types` Field Outside `exports` Map — Silent Type Loss

**What goes wrong:**
Publishing a package with a top-level `"types": "types/index.d.ts"` in `package.json` works for consumers using `moduleResolution: "node"` (legacy), but consumers using `moduleResolution: "bundler"` or `"node16"` / `"nodenext"` look inside the `exports` map for type declarations. If `exports` has no `"types"` sub-field, TypeScript emits `TS7016: Could not find a declaration file for module '@openburo/client'`.

Additionally, publishing both ESM and CJS without separate `.d.mts` and `.d.ts` type files causes the `CJSResolvesToESM` error detected by `arethetypeswrong`: CJS consumers end up with ESM types that reference `import.meta`, which do not compile under `require`.

**Why it happens:**
The dual-build / dual-types setup is non-obvious and documentation for it is scattered across TypeScript, Node, and bundler docs. `tsup` and `tsdown` can generate correct configs but require explicit opt-in.

**How to avoid:**
Structure `package.json` exports as:
```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.mts",
        "default": "./dist/obc.esm.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/obc.cjs.js"
      }
    }
  }
}
```
Run `arethetypeswrong` (the `attw` CLI) on the packed tarball before every release as a CI gate. Catch the dual-package hazard (instance identity check) by ensuring the CJS and ESM builds do not each export a different class instance that breaks `instanceof`.

**Warning signs:**
- Consumers report `TS7016` or types resolving to `any` when using `"moduleResolution": "bundler"`
- `attw` reports `CJSResolvesToESM` or `FallbackCondition` errors
- CJS consumers get type errors referencing `import.meta` that do not exist in CJS context

**Phase to address:**
Phase — Packaging & Distribution. Run `attw` in CI. Never publish without it passing.

---

### Pitfall 10: Penpal Version in Child Iframe Older Than Parent (or Mismatched Major)

**What goes wrong:**
OBC (parent) ships Penpal v7. The capability iframe (child) is a third-party service running Penpal v5 or v6 internally. Penpal v7 parent is documented as compatible with v6 child, but this compatibility will be dropped in v8. More critically, a v5 child is incompatible with a v7 parent — the handshake protocol changed in v6 and again in v7.

The silent failure mode: `connection.promise` never resolves, the iframe timeout fires, and `IFRAME_TIMEOUT` is emitted — which tells the user nothing about the actual cause.

**Why it happens:**
OBC has no control over what Penpal version the third-party capability iframe includes. Third-party capability authors do not know what version of OBC their consumer is using.

**How to avoid:**
- Pin OBC to a specific Penpal major version and document that requirement in the capability author integration guide.
- Consider implementing a version-negotiation ping over postMessage before invoking Penpal `connectToChild`. The ping can return the capability's Penpal major version so OBC can emit a helpful diagnostic error instead of silently timing out.
- In the IFRAME_TIMEOUT error message, include a note: "If the capability iframe uses Penpal, ensure it uses Penpal v7 compatible version."
- Consider vendoring / bundling Penpal into OBC's build to eliminate the child-side version ambiguity entirely (at the cost of both sides running their own Penpal instance, which is acceptable because Penpal is stateless per connection).

**Warning signs:**
- `IFRAME_TIMEOUT` fires consistently for a specific capability URL but not others
- The child iframe's network tab shows Penpal loaded but no connection events fire
- Capability iframe console shows "Received handshake from unexpected origin" (Penpal v5/v6 error format)

**Phase to address:**
Phase — PostMessage RPC / Penpal Integration. Document the Penpal version contract in the capability author guide on day one.

---

### Pitfall 11: Supply-Chain Risk — Penpal as the Only Allowed Dependency

**What goes wrong:**
OBC's constraints explicitly allow only Penpal as a runtime dependency. Penpal (`penpal` on npm) is a small, low-traffic package maintained by a single author. If the maintainer's npm account is compromised (as happened to `chalk`, `debug`, and 16 other packages in the September 2025 npm supply-chain attack), a malicious Penpal version would ship inside every OBC build — and from there into every host application.

**Why it happens:**
Single-maintainer packages with low download counts are targets because they get less scrutiny. OBC consumers trust `@openburo/client`, which transitively trusts Penpal.

**How to avoid:**
- Pin Penpal to an exact version (`"penpal": "7.x.x"` not `"^7.0.0"`) in `package.json`. Use `npm ci` in CI, not `npm install`.
- Enable npm provenance attestation when publishing `@openburo/client` so consumers can verify the package was built from this exact repo.
- Evaluate vendoring Penpal (copy the source into `src/vendor/penpal/`) at build time. This eliminates the transitive dependency entirely and lets OBC own the security audit surface. Given Penpal's small size (~500 lines), this is feasible.
- Add Dependabot or Renovate with auto-merge only for patch updates after a 48-hour delay, allowing the community to surface compromised versions.
- Document in the README: "OBC pins Penpal. Do not `npm update penpal` without checking the changelog."

**Warning signs:**
- Penpal publishes a version with a sudden jump in minified bundle size or unusual new dependencies
- npm security advisories referencing Penpal
- Socket.dev or Snyk reports new obfuscated code in a Penpal release

**Phase to address:**
Phase — Packaging & Distribution. Exact version pinning and provenance setup belong in the project scaffold phase. Vendoring decision should be made before the first Penpal integration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip origin validation in auxiliary `message` handlers; rely on Penpal alone | Faster implementation | Any raw `message` listener becomes an XSS / data-theft vector | Never |
| Use anonymous arrow functions as event listeners | Cleaner syntax | Cannot `removeEventListener`; guaranteed leak when `destroy()` is called | Never for listeners that must be removed |
| Create Shadow DOM with `mode: 'closed'` | Slightly harder for host JS to tamper | `destroy()` cannot access shadow root; tests cannot assert DOM state | Never |
| Top-level `"types"` field only, no `exports`-map types | Works for legacy consumers | Breaks `moduleResolution: bundler` consumers; invisible until reported | Never for a public library |
| Pure exponential backoff without jitter for WebSocket | Simple implementation | Reconnection storm on server restart if library achieves any scale | Never |
| `^` range for Penpal in `package.json` | Picks up patches automatically | Auto-installs compromised minor/patch if Penpal is supply-chain attacked | Never for a published library |
| Implement `destroy()` after all features | Ship features faster | Features added without updating `destroy()` will leak; debt compounds | Only if a stub `destroy()` that throws is added immediately |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Penpal `connectToChild` | Call it inside an async callback or after `iframe.onload` | Set `iframe.src` and call `connectToChild` in the same synchronous block |
| Penpal `allowedOrigins` | Pass `['*']` during development and forget to restrict before shipping | Always pass `[new URL(capability.path).origin]` per session, never `*` |
| Penpal v7 MessagePorts | Assume the global `window.message` event sees all Penpal traffic | After handshake, Penpal v7 uses MessagePorts — the global message event does not fire for RPC calls |
| WebSocket auto-derive from `capabilitiesUrl` | Silently derive `ws://` when `capabilitiesUrl` is `http://` | Validate protocol match before connecting; reject `ws://` on HTTPS pages |
| Shadow DOM + `rem` units | Modal text sizes relative to host page's `html { font-size }` | Use `px` inside the shadow root or reset `font-size` explicitly on the modal root |
| Shadow DOM + `z-index` | Modal inside a shadow host still obeys the host element's stacking context | Set the shadow host element's `z-index` and `position` in the light DOM, not inside the shadow root |
| `fetch` for capabilities | No `signal` passed, so `destroy()` cannot abort in-flight requests | Always pass an `AbortController.signal` to every `fetch` call inside OBC |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-fetching capabilities on every `castIntent` call | Increased latency on each intent; capability server flooded | Cache capability list in-memory; `refreshCapabilities()` is explicit flush | Any usage at all |
| Opening multiple WebSocket connections per `OpenBuroClient` instance | Duplicate `REGISTRY_UPDATED` events; double capability refreshes | Enforce single WS per instance with an `_ws` private field guarded by `if (this._ws) return` | Multiple `refreshCapabilities()` calls |
| Not debouncing `REGISTRY_UPDATED` WebSocket messages | Rapid successive server events cause multiple concurrent HTTP fetches | Debounce the refresh handler: ignore subsequent events within a 500 ms window | Busy capability registries |
| Injecting `<style>` on every `castIntent` rather than once at construction | Style node count grows with each intent; small reflow cost accumulates | Inject styles once in the constructor; reuse the same node | After ~50 sequential intents |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing `allowedOrigins: ['*']` to Penpal | Any origin can complete handshake and call parent's `resolve()` method, injecting arbitrary results | Always restrict to `[new URL(capability.path).origin]` per session |
| Not validating `event.data.id` against active sessions | A stale message from a previous session resolves the wrong callback | Maintain `sessions: Map<id, SessionState>`; drop messages whose `id` is absent |
| Trusting capability-provided `appName` without sanitization | If rendered as `innerHTML`, XSS vector from a malicious capability registry | Always set `element.textContent`, never `element.innerHTML`, for untrusted capability metadata |
| Including sandbox `allow-popups` without restricting opener | Capability iframe can `window.open()` and access `window.opener` to reach the host page | Add `rel="noopener"` to any iframe-initiated pop-up; verify host CSP blocks `window.opener` access |
| Not checking that `capabilitiesUrl` is HTTPS before construction | Library silently sends HTTP requests from HTTPS host, triggering mixed-content block with no clear error | Validate URL protocol in constructor; emit `OBCError` immediately if mismatch detected |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing the capability selection modal before capabilities are loaded | Modal renders empty then flickers when capabilities arrive | Open modal only after capability list is confirmed non-empty |
| Not showing a loading indicator during iframe initialization | User sees blank backdrop for 1-3 s while capability iframe loads | Inject a spinner inside the backdrop; hide it on Penpal connection established |
| Silent `IFRAME_TIMEOUT` — no user feedback | User stares at an unresponsive modal; no way to cancel or retry | On timeout, close the modal, display an error state, and invoke both `onError` and the `castIntent` rejection |
| Cancel button missing from selection modal | User cannot abort a multi-capability selection; must close the whole tab | Always render an explicit cancel button; ESC key should also dismiss |
| z-index collision with host page overlays | OBC modal renders behind the host app's header or cookie banner | Default z-index of 9000/9001 covers most apps; provide an option to override; document how to set it |

---

## "Looks Done But Isn't" Checklist

- [ ] **`destroy()`:** Only removes DOM nodes — verify that WebSocket is closed (`readyState === CLOSED`), all `message` listeners removed from `window`, and Penpal `connection.destroy()` called per session.
- [ ] **Origin validation:** Penpal's `allowedOrigins` is set — verify that every raw `window.addEventListener('message')` handler also validates `event.origin` independently.
- [ ] **Concurrent sessions:** Happy path works with one session — verify two simultaneous `castIntent` calls deliver results to their respective callbacks without cross-contamination.
- [ ] **TypeScript types:** Package builds successfully — verify with `attw` that CJS consumers get `.d.ts` types and ESM consumers get `.d.mts` types under `moduleResolution: bundler`.
- [ ] **WebSocket reconnect storm:** Reconnect works — verify that jitter is applied and that post-`destroy()` reconnect timers are cancelled.
- [ ] **Shadow DOM CSS reset:** Modal renders correctly in isolation — verify against a host page that sets `html { font-size: 20px; color: red; font-family: Comic Sans }` and `* { box-sizing: content-box }`.
- [ ] **Mixed-content guard:** Works on localhost — verify that constructor throws an `OBCError` when `capabilitiesUrl` is `http://` and the test host is `https://`.
- [ ] **Supply chain:** Penpal is in `dependencies` — verify it is pinned to an exact version, not a range.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `destroy()` leak discovered post-release | MEDIUM | Patch release; advise consumers to call `destroy()` on every route change; add leak test as regression |
| Wrong Penpal version in child iframe causes silent timeout | LOW | Document the version contract; bump `IFRAME_TIMEOUT` error message to name Penpal version mismatch as likely cause |
| TypeScript types not resolving for consumers | LOW | Patch `package.json` exports map; republish; consumers re-install |
| Mixed-content block discovered in production | LOW | Add constructor validation; document; republish; consumer must also fix their capability server URL |
| Supply-chain attack via Penpal | HIGH | Yank the affected OBC version from npm; vendor Penpal in the next release; notify consumers to pin previous OBC version |
| Origin validation bypass via auxiliary `message` handler | HIGH | Security patch release; coordinated disclosure; advise all consumers to upgrade immediately |
| Concurrent session cross-contamination | MEDIUM | Patch session ID routing; add regression test for two concurrent sessions |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `connectToChild` called after iframe load | Iframe Lifecycle / PostMessage RPC | Integration test: connection established within 500 ms |
| `allow-scripts` + `allow-same-origin` | Security Hardening / Iframe Factory | Unit test: constructor throws on same-origin capability URL |
| Missing origin guard on auxiliary `message` handlers | PostMessage RPC Layer | Code review gate + grep for `addEventListener('message'` without origin check |
| `destroy()` leaks | Core Lifecycle | Integration test: zero listeners, closed WS, no DOM after `destroy()` |
| WebSocket reconnection storm | WebSocket Live Updates | Manual test: server restart; observe staggered reconnect in Network tab |
| Concurrent session isolation | Session Manager / Intent Orchestration | Unit test: two concurrent sessions deliver to correct callbacks |
| CSS bleed / Shadow DOM pitfalls | UI Isolation / Modal Injection | Visual test against aggressive host CSS reset |
| Mixed-content HTTPS/WSS | Capability Loading / HTTP Loader | Constructor validation unit test |
| TypeScript exports map misconfiguration | Packaging & Distribution | `attw` CI gate on packed tarball |
| Penpal version mismatch | PostMessage RPC / Penpal Integration | Capability author integration guide; version-negotiation ping |
| Supply-chain / Penpal dependency | Project Scaffold + Packaging | Exact version pin; vendoring decision; provenance attestation |

---

## Sources

- [Penpal v7.0.0 Release Notes — version compatibility, handshake protocol, MessagePort migration](https://github.com/Aaronius/penpal/releases/tag/v7.0.0)
- [MDN: Window.postMessage() — origin validation requirements](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [MSRC: PostMessaged and Compromised — Microsoft 365 wildcard origin vulnerabilities (Aug 2025)](https://msrc.microsoft.com/blog/2025/08/postmessaged-and-compromised/)
- [PostMessage Vulnerabilities — CyberCX Security Insights](https://cybercx.com.au/blog/post-message-vulnerabilities/)
- [Rocket Validator: allow-scripts + allow-same-origin sandbox warning](https://rocketvalidator.com/html-validation/bad-value-x-for-attribute-sandbox-on-element-iframe-setting-both-allow-scripts-and-allow-same-origin-is-not-recommended-because-it-effectively-enables-an-embedded-page-to-break-out-of-all-sandboxing)
- [Mozilla Discourse: allow-scripts + allow-same-origin sandbox breakout explanation](https://discourse.mozilla.org/t/an-iframe-which-has-both-allow-scripts-and-allow-same-origin-for-its-sandbox-attribute-can-remove-its-sandboxing/28255)
- [Shadow DOM CSS pitfalls — PixelFree Studio](https://blog.pixelfreestudio.com/css-shadow-dom-pitfalls-styling-web-components-correctly/)
- [WebSocket reconnection jitter — DEV Community](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [WebSocket Reconnection: State Sync and Recovery Guide — WebSocket.org](https://websocket.org/guides/reconnection/)
- [TypeScript in 2025 with ESM and CJS npm publishing is still a mess — Liran Tal](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)
- [arethetypeswrong: CJSResolvesToESM problem documentation](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md)
- [Dual Publishing ESM and CJS with tsup and arethetypeswrong — johnnyreilly](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong)
- [npm Supply Chain Attack 2025 — CISA Alert](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem)
- [npm Supply Chain Attack — Snyk Shai Hulud analysis](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)
- [MDN: Mixed Content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)
- [Memory Leaks from Event Listeners in SPAs — JavaScript Doctor](https://www.javascriptdoctor.blog/2026/03/how-javascript-memory-leaks-destroy.html)
- [WHATWG HTML Issue: cross-origin iframe load events vs postMessage timing](https://github.com/whatwg/html/issues/4730)
- [Z-index and stacking contexts — web.dev](https://web.dev/learn/css/z-index)

---
*Pitfalls research for: iframe-broker / PostMessage RPC / framework-agnostic TS library (OpenBuroClient)*
*Researched: 2026-04-10*
