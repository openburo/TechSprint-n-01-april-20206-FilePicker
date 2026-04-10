---
phase: 3
slug: orchestration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Env** | `// @vitest-environment happy-dom` per-file docblock |
| **Quick run command** | `pnpm vitest run src/client.test.ts` |
| **Full suite command** | `pnpm run ci` |
| **Estimated runtime** | ~5s (client tests), ~20s (full ci) |

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run src/client.test.ts`
- **Before phase gate:** `pnpm run ci`
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 3-01-01 | orchestrator | 1 | FOUND-03+ (add DESTROYED error code) | unit (node) | `pnpm vitest run src/errors.test.ts` | ⬜ |
| 3-01-02 | orchestrator | 1 | ORCH-01, ORCH-02 (constructor) | unit (happy-dom) | `pnpm vitest run src/client.test.ts -t "constructor"` | ⬜ |
| 3-01-03 | orchestrator | 1 | ORCH-03, ORCH-04, ORCH-05 (castIntent + destroy integration) | integration (happy-dom) | `pnpm vitest run src/client.test.ts -t "castIntent\|destroy"` | ⬜ |
| 3-01-04 | orchestrator | 1 | ORCH-06 (post-destroy) | unit (happy-dom) | `pnpm vitest run src/client.test.ts -t "destroyed"` | ⬜ |
| 3-01-05 | orchestrator | 2 | phase gate | composite | `pnpm run ci` | ⬜ |

---

## Wave 0 Requirements

- [ ] `src/errors.ts` extended with `DESTROYED` error code
- [ ] `src/client.ts` — `OpenBuroClient` class
- [ ] `src/client.test.ts` — integration tests with `MockBridge`
- [ ] `src/index.ts` updated to export `OpenBuroClient`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Penpal handshake visual demo | MSG-02, IFR-09 | happy-dom lacks visual rendering | Deferred to Phase 4 Playwright demo |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity OK
- [ ] Wave 0 covers MISSING refs *(set on execution)*
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true`

**Approval:** pending
