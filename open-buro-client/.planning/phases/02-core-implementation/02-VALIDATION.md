---
phase: 2
slug: core-implementation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` (existing, `environment: 'node'` default) |
| **Environment switch** | Per-file `// @vitest-environment happy-dom` docblock |
| **Quick run command** | `pnpm vitest run src/<module>/` |
| **Full suite command** | `pnpm run ci` (typecheck + lint + test + attw) |
| **Estimated runtime** | ~10-20 seconds full, ~2-3 seconds per module |

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run src/<touched-module>/`
- **After every plan wave:** `pnpm run ci`
- **Before verifier:** Full `pnpm run ci` must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement(s) | Test Type | Automated Command | Status |
|---------|------|------|----------------|-----------|-------------------|--------|
| 2-01-01 | capabilities | 1 | RES-01..07 | unit (node) | `pnpm vitest run src/capabilities/resolver.test.ts` | ⬜ |
| 2-01-02 | capabilities | 1 | CAP-01..07 | unit (node) | `pnpm vitest run src/capabilities/loader.test.ts` | ⬜ |
| 2-01-03 | capabilities | 1 | WS-01..07 | unit (node) | `pnpm vitest run src/capabilities/ws-listener.test.ts` | ⬜ |
| 2-01-04 | capabilities | 1 | LIFECYCLE-01 | unit (node) | `pnpm vitest run src/lifecycle/abort-context.test.ts` | ⬜ |
| 2-02-01 | intent | 1 | INT-01..09 (logic), RES-07 | unit (node) | `pnpm vitest run src/intent/cast.test.ts` | ⬜ |
| 2-03-01 | ui | 1 | IFR-01..10 | unit (happy-dom) | `pnpm vitest run src/ui/iframe.test.ts` | ⬜ |
| 2-03-02 | ui | 1 | UI-08, UI-09, UI-11, IFR-09 | unit (happy-dom) | `pnpm vitest run src/ui/styles.test.ts` | ⬜ |
| 2-03-03 | ui | 1 | UI-06, UI-07 | unit (happy-dom) | `pnpm vitest run src/ui/focus-trap.test.ts` | ⬜ |
| 2-03-04 | ui | 1 | UI-01..11 (composite) | unit (happy-dom) | `pnpm vitest run src/ui/modal.test.ts` | ⬜ |
| 2-04-01 | messaging | 1 | MSG-01 | unit (node) | `pnpm vitest run src/messaging/bridge-adapter.test.ts` | ⬜ |
| 2-04-02 | messaging | 1 | MSG-05 | unit (happy-dom) | `pnpm vitest run src/messaging/mock-bridge.test.ts` | ⬜ |
| 2-04-03 | messaging | 1 | MSG-02, MSG-03, MSG-04, MSG-06 | unit (happy-dom) | `pnpm vitest run src/messaging/penpal-bridge.test.ts` | ⬜ |
| 2-05-01 | integration | 2 | phase gate | composite | `pnpm run ci` | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `happy-dom` devDependency (installed in Phase 1; verify)
- [ ] `src/capabilities/resolver.ts` — pure MIME matcher
- [ ] `src/capabilities/loader.ts` — HTTP fetch with AbortController
- [ ] `src/capabilities/ws-listener.ts` — WebSocket with full-jitter backoff + destroyed guard
- [ ] `src/lifecycle/abort-context.ts` — createAbortContext() helper for Phase 3 destroy() composition (LIFECYCLE-01)
- [ ] `src/intent/cast.ts` — pure `planCast()` discriminated union
- [ ] `src/intent/session.ts` — `ActiveSession` type + `SessionMap` (used by Phase 3 orchestrator)
- [ ] `src/ui/styles.ts` — Shadow DOM host + CSS reset + keyframes
- [ ] `src/ui/iframe.ts` — iframe factory with same-origin guard + title + sandbox + loading spinner
- [ ] `src/ui/focus-trap.ts` — Shadow DOM focus trap utility
- [ ] `src/ui/modal.ts` — chooser modal with full a11y baseline
- [ ] `src/messaging/bridge-adapter.ts` — `BridgeAdapter` + `ConnectionHandle` interfaces
- [ ] `src/messaging/mock-bridge.ts` — test double
- [ ] `src/messaging/penpal-bridge.ts` — Penpal v7 `connect` + `WindowMessenger`
- [ ] `src/index.ts` — re-exports for Phase 3 consumer
- [ ] All `*.test.ts` files for above modules

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual layout in a real browser | UI-08, IFR-07 | happy-dom does not render pixels | Deferred to Phase 3 smoke test — load a demo HTML in Chrome |
| Real Penpal handshake across origins | MSG-02 | happy-dom cannot route cross-window postMessage correctly | Deferred to Phase 4 Playwright end-to-end test |

*All logic-level phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references *(set on execution)*
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
