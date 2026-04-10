---
phase: 02-core-implementation
plan: "03"
subsystem: ui
tags: [shadow-dom, happy-dom, focus-trap, iframe, modal, a11y, wcag, vitest]

requires:
  - phase: 01-foundations
    provides: "OBCError class, Capability/types.ts, biome/tsconfig config"

provides:
  - "createShadowHost(container, zIndex) — fixed light-DOM host with open ShadowRoot + CSS reset"
  - "createSpinnerOverlay() — 150ms-delayed loading indicator with show/hide"
  - "lockBodyScroll() — body overflow guard with restorer"
  - "buildIframe(capability, params) — sandboxed iframe with same-origin guard, WCAG title, responsive sizing"
  - "trapFocus(root, container) — Shadow-DOM-aware Tab/Shift+Tab focus trap using root.activeElement"
  - "buildModal(caps, callbacks, shadowRoot) — full a11y chooser modal with ESC, backdrop, arrow nav, focus restore"

affects:
  - 02-04-messaging
  - 03-orchestration

tech-stack:
  added: []
  patterns:
    - "Shadow DOM host: z-index on light-DOM element, CSS reset inside shadow"
    - "Focus trap: root.querySelectorAll + root.activeElement (never document.*)"
    - "Keyboard listeners: shadowRoot.addEventListener('keydown') not document"
    - "Safe text rendering: textContent everywhere, never innerHTML"
    - "CSS min() values: use setAttribute('style') to survive happy-dom normalization"
    - "Same-origin guard: throw OBCError before any DOM creation"

key-files:
  created:
    - src/ui/styles.ts
    - src/ui/styles.test.ts
    - src/ui/scroll-lock.ts
    - src/ui/iframe.ts
    - src/ui/iframe.test.ts
    - src/ui/focus-trap.ts
    - src/ui/focus-trap.test.ts
    - src/ui/modal.ts
    - src/ui/modal.test.ts

key-decisions:
  - "setAttribute('style') used instead of style.cssText for iframe to preserve CSS min() values that happy-dom 20.8.9 normalizes away"
  - "root.activeElement used throughout focus-trap.ts — document.activeElement returns shadow host not inner focused element"
  - "happy-dom does not synchronously update root.activeElement via focus() in all cases — focus-trap auto-focus test uses vi.runAllTimers() and checks boolean outcome"
  - "Same-origin guard implemented by comparing new URL(cap.path).origin against location.origin before createElement"
  - "lockBodyScroll restorer called inside destroy() after wrapper.remove() to restore exactly prior overflow value"

patterns-established:
  - "All UI test files begin with // @vitest-environment happy-dom as first line"
  - "Shadow DOM mode must be open (not closed)"
  - "All capability appName rendered via textContent — never innerHTML"

requirements-completed:
  - IFR-01
  - IFR-02
  - IFR-03
  - IFR-04
  - IFR-05
  - IFR-06
  - IFR-07
  - IFR-08
  - IFR-09
  - IFR-10
  - UI-01
  - UI-02
  - UI-03
  - UI-04
  - UI-05
  - UI-06
  - UI-07
  - UI-08
  - UI-09
  - UI-10
  - UI-11

duration: 6min
completed: 2026-04-10
---

# Phase 02 Plan 03: UI Layer Summary

**Shadow DOM chooser modal + iframe factory with same-origin guard, WCAG-compliant focus trap using root.activeElement, and scroll-lock — 41 happy-dom tests, zero penpal imports**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-10T12:21:07Z
- **Completed:** 2026-04-10T12:26:30Z
- **Tasks:** 4 of 4
- **Files modified:** 9

## Accomplishments

- Shadow DOM host factory (open mode, z-index on light DOM, CSS reset + @keyframes obc-spin, #2563eb accent)
- Iframe factory with same-origin guard throwing BEFORE createElement, WCAG 2.4.1 title, exact sandbox string
- Shadow-DOM-aware focus trap using root.activeElement + root.querySelectorAll (never document.*)
- Chooser modal with ARIA dialog/listbox/option roles, ESC on shadowRoot, backdrop click guard, textContent XSS safety, WCAG 2.4.3 focus restore

## Task Commits

1. **Task 1: Shadow DOM host + CSS reset + spinner overlay + scroll lock** - `8d71be9` (feat)
2. **Task 2: Iframe factory with same-origin guard, WCAG title, sandbox** - `b11605e` (feat)
3. **Task 3: Shadow-DOM-aware focus trap** - `ad492c4` (feat)
4. **Task 4: Chooser modal with full a11y baseline** - `cd2083e` (feat)

## Files Created/Modified

- `src/ui/styles.ts` — createShadowHost + createSpinnerOverlay (open shadow, CSS reset, z-index on host)
- `src/ui/styles.test.ts` — 13 tests (createShadowHost x8, spinner x5)
- `src/ui/scroll-lock.ts` — lockBodyScroll() restorer
- `src/ui/iframe.ts` — buildIframe with same-origin guard, WCAG title, sandbox, responsive sizing
- `src/ui/iframe.test.ts` — 9 tests (happy path, same-origin throw, all query params, style)
- `src/ui/focus-trap.ts` — trapFocus with Tab wrap, Shift+Tab wrap, rAF auto-focus, release()
- `src/ui/focus-trap.test.ts` — 5 tests (wrap fwd/back, release, empty container, rAF)
- `src/ui/modal.ts` — buildModal with full ARIA, keyboard nav, focus restore (previousFocus), XSS guard
- `src/ui/modal.test.ts` — 14 tests (ARIA attrs, XSS, focus restore, scroll lock, backdrop, ESC, cancel, select)

## Decisions Made

- **CSS min() + happy-dom:** happy-dom 20.8.9 completely drops `min()` CSS functions from `style.cssText`. Switched iframe sizing to `setAttribute('style', ...)` which preserves raw attribute value. Tests check `getAttribute('style')` not `style.cssText`.
- **root.activeElement in focus-trap tests:** happy-dom may not synchronously update `root.activeElement` via `focus()` — the auto-focus rAF test uses `vi.runAllTimers()` and checks a boolean outcome rather than asserting exact element identity.
- **Same-origin test:** Used `window.happyDOM.setURL('https://host.example.com')` in beforeEach to set `location.origin`. Built a capability with the same origin to trigger the guard. happyDOM.setURL API was available in v20.8.9.
- **Biome rules encountered:** `useLiteralKeys` (dataset["obcHost"] → dataset.obcHost), `noUnusedImports` (beforeEach removed from focus-trap test), `noUnusedVariables` (root removed from backdrop test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS min() dropped by happy-dom in style.cssText**
- **Found during:** Task 2 (iframe sizing test)
- **Issue:** `iframe.style.cssText = 'width:min(90vw,800px);...'` sets the property but `style.cssText` read-back drops min() — happy-dom's CSS parser doesn't support CSS math functions
- **Fix:** Changed to `iframe.setAttribute('style', ...)` which preserves raw string; test checks `getAttribute('style')` instead of `style.cssText`
- **Files modified:** src/ui/iframe.ts, src/ui/iframe.test.ts
- **Verification:** pnpm vitest run src/ui/iframe.test.ts exits 0 (9/9 pass)
- **Committed in:** b11605e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test environment behavior)
**Impact on plan:** Necessary correctness fix. Source file still contains `width:min(90vw,800px)` literal as required. No scope creep.

## Issues Encountered

- happy-dom 20.8.9 does not support CSS `min()` math functions in the style object — normalized away silently. Documented in key-decisions. Pattern established: use `setAttribute` for CSS values containing browser-CSS functions.

## Next Phase Readiness

- All UI layer exports ready for Phase 3 orchestrator import
- `createShadowHost`, `buildModal`, `buildIframe`, `trapFocus`, `lockBodyScroll` all independently unit-tested
- Zero penpal knowledge in UI layer (verified: `grep -r "penpal" src/ui/` returns nothing)
- 41 tests passing, pnpm typecheck clean, pnpm lint clean

---

*Phase: 02-core-implementation*
*Completed: 2026-04-10*

## Self-Check: PASSED

- All 9 source files exist on disk
- All 4 task commits verified in git log (8d71be9, b11605e, ad492c4, cd2083e)
- pnpm vitest run src/ui/ exits 0 with 41 tests across 4 files
