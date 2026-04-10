# Feature Research

**Domain:** Browser-side intent/capability-brokering library (sandboxed iframe orchestration)
**Researched:** 2026-04-10
**Confidence:** HIGH (spec is detailed; analogous systems are well-documented)

---

## Analogous Systems Reference

Before classifying features, it is worth framing what each comparable system teaches OBC:

| System | Analogy to OBC | Key lesson |
|--------|---------------|------------|
| **Android Intents** | Direct architectural ancestor — action + type → chooser → result | Decentralized capability declaration; dynamic resolution; bidirectional data |
| **Cozy/Twake intents** | Closest web equivalent — iframe + postMessage handshake + `service.terminate()` | Handshake `ready` → `ack` → `data` cycle; permission scoping on returned docs |
| **Google Picker API** | Most mature file-picker UX — Builder pattern, rich `DocumentObject` response | 10-year-iterated response schema; multi-select; PICK vs SAVE modes; locale is service's responsibility |
| **Web Share Target API** | Capability declaration via manifest; system chooser; origin-isolated handler | MIME/extension filtering at discovery time; user must understand where data goes (security disclosure) |
| **W3C Web Intents (2012)** | Failed predecessor — native browser support attempt abandoned by Chrome 24 | Failed from over-broad verb space + ecosystem chicken-and-egg; userland approach (OBC's model) is the right lesson |
| **OAuth popup flows** | Trusted-third-party modal, user interaction, result returned to opener | Focus management on open/close; backdrop; ESC to cancel; opener waits for async result |
| **openDesk ICS** | Anti-model — tightly coupled frontend components baked into every caller | OBC's iframe isolation avoids the maintenance/versioning hell of embedding foreign UI directly |
| **Stripe Elements / zoid** | Production iframe-component patterns — title attribute, ARIA label, focus delegation | `title` on iframe for screen readers; focus delegation into sandboxed content; loading/error states |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that adopting developers assume exist. Missing any of these makes OBC feel unfinished or unsafe.

| Feature | Why Expected | Complexity | Spec Status | Notes |
|---------|--------------|------------|-------------|-------|
| `castIntent(intent, cb)` — single call orchestration | Core value proposition; without it the library is just plumbing | LOW (API shape) / HIGH (impl) | Specified | Promise + callback dual API aligns with google Picker callback pattern |
| Capability discovery via HTTP | Required to know what services exist | LOW | Specified | `GET /api/v1/capabilities` |
| MIME-type matching with wildcards (`*/*`, `image/*`, exact) | Standard filtering contract across Android/Cozy/Google Picker | MEDIUM | Specified | Wildcard rules must handle absent filter (= match all) |
| Zero-match → cancel with clear error | Android/Cozy/Google all surface this; silent failure is unacceptable | LOW | Specified | `NO_MATCHING_CAPABILITY` error code |
| One-match → skip chooser, open directly | Android "implicit intent" fast-path; users expect no unnecessary friction | LOW | Specified | — |
| N-match → capability chooser modal | Android Chooser, Cozy chooser, Google's service picker | MEDIUM | Specified | Shows `appName` + icon |
| Sandboxed iframe with origin restriction | Security baseline; without this OBC is a XSS vector | MEDIUM | Specified | `allow-scripts allow-same-origin allow-forms allow-popups`; Penpal `allowedOrigins` |
| PostMessage round-trip result | The only viable cross-origin return channel | MEDIUM | Specified | Penpal `connectToChild` / parent exposes `resolve()` |
| Session isolation by UUID | Multiple concurrent intents must not cross-contaminate | LOW | Specified | UUID v4 per `castIntent` call |
| Timeout with clean teardown | Any blocking modal needs a timeout; users abandon tasks | LOW | Specified | Default 5 min, configurable |
| `destroy()` — zero-leak teardown | SPAs hot-reload constantly; leaking WS + listeners is unacceptable | MEDIUM | Specified | Must remove DOM, WS, Penpal connection |
| CSS isolation (no bleed into host) | Library injected into unknown host pages — any bleed is a bug | MEDIUM | Specified | Shadow DOM preferred |
| ESC key closes the chooser modal | Universal browser convention; WCAG 2.1 SC 2.1.2 (No Keyboard Trap) | LOW | **MISSING** | Must dismiss modal and resolve with `cancel` |
| Focus trap inside chooser modal while open | WCAG 2.1 SC 2.1.2; `role="dialog"` + `aria-modal="true"` require it | MEDIUM | **MISSING** | Tab/Shift-Tab must cycle within modal |
| Focus returns to trigger element on modal close | WCAG 2.1 SC 2.4.3 (Focus Order); expected by all screen reader users | LOW | **MISSING** | Store `document.activeElement` before opening |
| `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on chooser | Makes the chooser usable with screen readers at all | LOW | **MISSING** | Without this, screen reader announces nothing useful |
| `title` attribute on injected iframe | WCAG 2.4.1 (Bypass Blocks); required by ACT rule cae760; Stripe Elements sets this | LOW | **MISSING** | e.g. `title="File picker — TDrive"` using `capability.appName` |
| Backdrop click dismisses chooser | Convention shared by OAuth popups, Google Picker, every modal library | LOW | **MISSING** | Should resolve `castIntent` with `cancel`, same as ESC |
| Body scroll lock while modal open | Standard modal behavior; without it users scroll the page behind the overlay | LOW | **MISSING** | `overflow: hidden` on `<body>` while backdrop is shown; must restore on close |
| Loading indicator inside iframe region | Google Picker shows spinner; Cozy shows loader component; blank iframe for 5 min is terrible UX | MEDIUM | **MISSING** | Show spinner in the iframe area until Penpal handshake completes (`intent:ready`) |
| Error codes with human-readable messages | Adopting developer cannot debug bare numbers | LOW | Specified | `OBCError { code, message, cause? }` |
| TypeScript types published | 2024 expectation for any serious library | LOW | Specified | `types/index.d.ts` |
| ESM + CJS + UMD builds | Bundler + Node + CDN consumers all need different formats | MEDIUM | Specified | — |

### Differentiators (Competitive Advantage)

Features that set OBC apart. These are where OBC competes; not every item is required for v1.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| WebSocket live registry updates | No competing web-intent library does this; capabilities refresh in real time without page reload | MEDIUM | `REGISTRY_UPDATED` event; exponential backoff; already specified |
| Exponential backoff WS reconnect | Production-grade resilience out of the box; most toy implementations lack this | MEDIUM | 1s→2s→4s→8s→30s cap, 5 attempts; already specified |
| Multiple concurrent `castIntent` sessions | Android supports this; Cozy does not; Google Picker does not | MEDIUM | Session-id isolation already specified |
| Open capability protocol (not proprietary SDK) | Contrast with Google Picker (SDK lock-in) and openDesk ICS (tight coupling) — any drive implementing the spec works | LOW (protocol is the lib) | Core differentiator of the whole Open Buro project |
| Shadow DOM style isolation | Stronger than prefixed CSS; no cascade issues regardless of host framework | MEDIUM | Specified; more robust than Cozy's approach |
| Zero framework lock-in | React/Vue/Angular all work; `obc.esm.js` drops into any host | LOW | Vanilla TS; already decided |
| `onCapabilitiesUpdated` callback | Host app can reactively show "new picker available" notice | LOW | Already specified |
| Configurable container injection | Modal renders into caller-supplied DOM node, not always `<body>` | LOW | Already specified; useful for SPA route containers |
| SAVE intent (bidirectional) | Android SAVE / Google Picker `DocsUploadView` equivalent; most file-picker libs are pick-only | MEDIUM | Protocol spec already covers `data: { content, filename }` |

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly NOT build. Document these to prevent scope creep and misdirected PRs.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Custom modal theming API (CSS variables, slots) | Developers want brand consistency | Infinite surface area; every host has different needs; breaks Shadow DOM guarantees; ties OBC to a visual contract it cannot own | Host wraps the `container` div with their own brand; `v2` can expose a CSS custom-properties subset inside Shadow DOM |
| OAuth / SSO token exchange inside OBC | "Can OBC handle auth so the iframe auto-logs in?" | Auth between host and capability is an entirely separate trust domain; adding it couples OBC to specific identity providers; Google Picker's auth story is its biggest DX pain point | Capability iframe handles its own session (assumed pre-authenticated); future: capability server advertises required auth flows separately |
| Capability caching / offline mode | "Avoid the HTTP round-trip on every `castIntent`" | Stale capabilities cause silent mismatches; the WS listener already handles freshness; cache invalidation is a well-known complexity trap | WS listener keeps capabilities fresh; `getCapabilities()` returns in-memory list synchronously after first fetch |
| React/Vue/Angular bindings in core | "Ship a `<IntentPicker>` component" | Couples core library to framework release cycles; increases bundle size for non-framework users; bindings are trivial wrappers | Publish `@openburo/react`, `@openburo/vue` as separate thin packages post-v1 |
| Parent-to-iframe method calls beyond `resolve` | "Can I call methods inside the iframe?" | Turns the capability into a remote-controlled object — breaks capability sovereignty; security surface explodes | Capability drives its own UI; host only receives the result |
| iframe resize negotiation / dynamic sizing | "The picker wants to tell the parent how tall to be" | `postMessage`-based resize requires the iframe to send arbitrary dimensions to the host DOM — CSP and sandboxing complications; implementation complexity for marginal UX gain | Fixed responsive sizing `min(90vw, 800px) × min(85vh, 600px)` covers the vast majority of use cases |
| Retry on capability fetch failure | "Automatically retry if `/capabilities` 503s" | Silent auto-retry with arbitrary backoff masks infrastructure problems; host app cannot distinguish transient from permanent outage | Surface `CAPABILITIES_FETCH_FAILED` via `onError`; let the host app decide on retry via `refreshCapabilities()` |
| Global `window.OpenBuro` singleton | "Make it easy to use without a bundler" | Pollutes global namespace; causes conflicts when multiple host apps embed OBC at different versions | UMD build for CDN already exposes a `window.OpenBuroClient` opt-in; not a default |
| Capability iframe navigation interception | "Stop the iframe from navigating away" | Cross-origin iframe navigation is undetectable post-sandbox; attempts to intercept break sandboxing guarantees | Timeout is the safety net; Penpal connection tear-down signals end-of-session |

---

## Feature Dependencies

```
castIntent()
    └──requires──> HTTP capability fetch (refreshCapabilities)
                       └──requires──> OBCOptions.capabilitiesUrl

castIntent()
    └──requires──> MIME resolver
                       └──requires──> capability list in memory

castIntent() → N matches
    └──requires──> chooser modal
                       └──requires──> Shadow DOM / scoped CSS isolation
                       └──requires──> focus trap
                       └──requires──> ESC + backdrop-click handlers
                       └──requires──> ARIA dialog attributes

castIntent() → iframe open
    └──requires──> Penpal connectToChild
                       └──requires──> allowedOrigins from capability URL
    └──requires──> iframe title (a11y)
    └──requires──> loading spinner (until intent:ready)
    └──requires──> timeout watchdog

WebSocket live updates
    └──requires──> HTTP capability fetch (initial population)
    └──enhances──> castIntent() (always-fresh capability list)

destroy()
    └──requires──> reference to all: WS, Penpal connections, injected DOM, event listeners
```

### Dependency Notes

- **Focus trap requires Shadow DOM boundary to be established first:** The focus trap must scope to the modal container; if Shadow DOM is used, `querySelectorAll` for focusable elements must use `shadowRoot.querySelectorAll`, not `document.querySelectorAll`.
- **Loading spinner conflicts with iframe content:** The spinner must be in the host-side overlay layer (not inside the sandboxed iframe), then hidden once Penpal fires the `intent:ready` signal.
- **Body scroll lock must be paired with restoration on any close path:** ESC, backdrop click, timeout, `resolve()`, and `destroy()` all terminate the session — all must restore `overflow` on `<body>`.

---

## MVP Definition

### Launch With (v1)

- [ ] `castIntent()` full orchestration (discovery → match → modal|direct → iframe → result) — core value, without this nothing else matters
- [ ] HTTP capability loader + MIME resolver — prerequisite for all intent flows
- [ ] Penpal iframe messaging with origin restriction — security baseline
- [ ] Session UUID isolation for concurrent intents — correctness requirement
- [ ] Chooser modal with capability list (appName + icon) — required for N-match path
- [ ] ESC key + backdrop click dismiss — table stakes UX (currently missing from spec)
- [ ] Focus trap in chooser modal — WCAG 2.1 SC 2.1.2 (currently missing from spec)
- [ ] Focus restoration on modal close — WCAG 2.1 SC 2.4.3 (currently missing from spec)
- [ ] `role="dialog"` + `aria-modal` + `aria-labelledby` on chooser — screen reader baseline (currently missing from spec)
- [ ] `title` attribute on injected iframe — WCAG 2.4.1 / ACT cae760 (currently missing from spec)
- [ ] Body scroll lock while modal/iframe open — table stakes UX (currently missing from spec)
- [ ] Loading indicator until `intent:ready` — without this, blank iframe for up to 5 min is unacceptable UX
- [ ] Timeout with `IFRAME_TIMEOUT` error — safety net for hung sessions
- [ ] `destroy()` with zero leaks — SPA requirement
- [ ] Shadow DOM style isolation — correctness requirement (no host CSS bleed)
- [ ] `OBCError` structured errors via `onError` + Promise rejection — debuggability
- [ ] ESM + CJS + UMD builds with TypeScript types — distribution requirement

### Add After Validation (v1.x)

- [ ] WebSocket live registry updates with exponential backoff — useful once multiple adopters exist; not critical for hackathon demo with a single server
- [ ] `onCapabilitiesUpdated` callback — only meaningful when WS is in use
- [ ] Multiple simultaneous `castIntent` sessions — verify isolation works correctly under load before advertising

### Future Consideration (v2+)

- [ ] Framework bindings (`@openburo/react`, `@openburo/vue`) — trivial once core API is stable
- [ ] CSS custom-properties theming within Shadow DOM — requires stable design system first
- [ ] Capability manifest schema versioning — needed when the protocol has multiple adopters with different server versions
- [ ] `intent:resize` message support — if fixed sizing proves insufficient for real capabilities

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `castIntent()` orchestration | HIGH | HIGH | P1 |
| HTTP capability fetch + MIME resolver | HIGH | MEDIUM | P1 |
| Penpal iframe messaging | HIGH | MEDIUM | P1 |
| Chooser modal | HIGH | MEDIUM | P1 |
| ESC key / backdrop click dismiss | HIGH | LOW | P1 |
| Focus trap in chooser | HIGH | MEDIUM | P1 |
| ARIA dialog attributes | HIGH | LOW | P1 |
| `title` on iframe | HIGH | LOW | P1 |
| Body scroll lock | MEDIUM | LOW | P1 |
| Loading spinner (until intent:ready) | MEDIUM | LOW | P1 |
| Session UUID isolation | HIGH | LOW | P1 |
| Timeout + clean teardown | HIGH | LOW | P1 |
| `destroy()` zero-leak | HIGH | MEDIUM | P1 |
| Shadow DOM isolation | HIGH | MEDIUM | P1 |
| Focus restoration on close | HIGH | LOW | P1 |
| ESM + CJS + UMD + types | HIGH | MEDIUM | P1 |
| WebSocket live updates | MEDIUM | MEDIUM | P2 |
| WS exponential backoff | MEDIUM | LOW | P2 |
| `onCapabilitiesUpdated` | LOW | LOW | P2 |
| Multiple concurrent sessions | MEDIUM | LOW | P2 |
| Framework bindings | LOW | LOW | P3 |
| Modal theming API | LOW | HIGH | P3 (anti-feature in v1) |

---

## Competitor Feature Analysis

| Feature | Android Intents | Cozy/Twake intents | Google Picker | OBC Approach |
|---------|----------------|-------------------|---------------|--------------|
| Capability declaration | App manifest (XML) | App manifest (JSON) | Google-registered app | Server `GET /capabilities` (centralized registry) |
| Capability discovery | OS resolves at runtime | Stack queries manifests | Google SDK call | HTTP fetch + optional WS subscription |
| Live capability updates | App install/uninstall events | Not applicable (server-side) | N/A | WebSocket `REGISTRY_UPDATED` |
| Chooser UI | OS-native Chooser dialog | Client renders modal from returned list | Google's own modal | OBC renders modal (Shadow DOM isolated) |
| Zero-match handling | System message / silent | Returns empty list | SDK throws | `NO_MATCHING_CAPABILITY` error + `cancel` result |
| Result channel | `onActivityResult()` callback | `postMessage` handshake | JS callback function | Penpal Promise (`resolve()`) |
| Security boundary | OS permission model | Stack permission scoping | OAuth 2.0 token | iframe sandbox + Penpal `allowedOrigins` |
| Auth between caller and service | OS-mediated (intents don't carry creds) | Stack-mediated token | OAuth token passed by host | Not OBC's concern — service manages its own session |
| Multi-select | `FLAG_GRANT_READ_URI_PERMISSION` + array return | `multiple` parameter | `MULTISELECT_ENABLED` Feature flag | `multiple: true` query param to iframe URL |
| SAVE / upload mode | `ACTION_CREATE_DOCUMENT` | `CREATE` action | `DocsUploadView` | `SAVE` action with `data: { content, filename }` |
| Timeout | Activity lifecycle (back-press) | Not specified | Not specified | Configurable, default 5 min |
| a11y | OS handles (native UI) | Not documented | Google handles internally | OBC must handle: focus trap, ARIA, ESC, `title` |
| Style isolation | Not applicable (native UI) | Not specified | Handled by Google | Shadow DOM |

---

## Missing Features the Spec Overlooked

The following table stakes features are present in analogous systems but absent from `PROJECT.md`. They should be added to the Active requirements:

| Missing Feature | Evidence it is Table Stakes | WCAG / Reference |
|-----------------|-----------------------------|------------------|
| ESC key closes chooser modal | Every modal library; WCAG 2.1 SC 2.1.2 (No Keyboard Trap); OAuth popup convention | WCAG 2.1 SC 2.1.2 |
| Backdrop click closes chooser modal | Google Picker, every OAuth popup, every modal library | UX convention |
| Focus trap inside chooser modal while open | `role="dialog" aria-modal="true"` semantics require it; WCAG 2.1 SC 2.1.2 | WCAG 2.1 SC 2.1.2 |
| Focus restored to trigger element on close | WCAG 2.1 SC 2.4.3 (Focus Order); screen reader users need this | WCAG 2.1 SC 2.4.3 |
| `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on chooser | Without these, the chooser is invisible to screen readers | WCAG 2.1 SC 4.1.2 |
| `title` attribute on injected iframe | ACT rule cae760; Stripe Elements bug report shows how badly this fails without it | ACT cae760, WCAG 2.4.1 |
| Body scroll lock while overlay is shown | Standard modal behavior; without it the host page scrolls behind the backdrop | UX convention |
| Loading indicator until `intent:ready` | Google Picker shows spinner; blank iframe for 5 min is catastrophically bad UX | Google Picker, Cozy loader component |
| iframe `onerror` / load failure detection | If the capability URL 404s, the iframe silently stays blank without this | — |

---

## Sources

- Android Intents documentation: https://developer.android.com/reference/android/content/Intent
- Cozy intent spec and cycle de vie: https://docs.cozy.io/en/cozy-stack/intents/
- Google Picker API (10-year reference for response schema and UX): referenced via project spec docs (`/docs/etat-de-lart/google-picker.md`)
- Web Share Target API: https://w3c.github.io/web-share-target/
- W3C Web Intents failure analysis: https://paul.kinlan.me/what-happened-to-web-intents/ (Paul Kinlan, Google)
- openDesk ICS architecture (anti-model): https://docs.opendesk.eu/operations/architecture/#filepicker
- Penpal library capabilities: https://github.com/Aaronius/penpal
- WCAG 2.1 modal dialog requirements: https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html
- ACT rule for iframe accessible name: https://act-rules.github.io/rules/cae760/
- Stripe Elements `aria-hidden` iframe accessibility bug: https://github.com/stripe/react-stripe-js/issues/236
- Scroll lock patterns: https://frontendmasters.com/blog/scroll-locked-dialogs/
- Modal accessibility patterns: https://testparty.ai/blog/modal-dialog-accessibility

---

*Feature research for: OpenBuroClient — browser-side intent/capability-brokering library*
*Researched: 2026-04-10*
