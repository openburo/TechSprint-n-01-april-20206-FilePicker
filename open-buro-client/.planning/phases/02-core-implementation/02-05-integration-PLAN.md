---
phase: 02-core-implementation
plan: 05
type: execute
wave: 2
depends_on:
  - "02-01"
  - "02-02"
  - "02-03"
  - "02-04"
files_modified:
  - src/index.ts
  - src/index.test.ts
autonomous: true
requirements:
  - PHASE-GATE-02
gap_closure: false

must_haves:
  truths:
    - "All Phase 2 modules are re-exported from src/index.ts so Phase 3 can import them from the barrel"
    - "pnpm run ci exits 0 — typecheck + lint + test + attw all green"
    - "@openburo/client type surface includes: resolve, fetchCapabilities, WsListener, deriveWsUrl, createAbortContext, AbortContext, planCast, createShadowHost, buildIframe, buildModal, trapFocus, lockBodyScroll, BridgeAdapter, ConnectionHandle, MockBridge, PenpalBridge, ActiveSession"
    - "No cross-layer import violations — grep enforcement rules satisfied"
    - "attw --pack continues to exit 0 after the barrel expansion"
  artifacts:
    - path: "src/index.ts"
      provides: "Public API barrel — re-exports every Phase 2 module consumed by Phase 3"
      min_lines: 40
    - path: "src/index.test.ts"
      provides: "Public API surface smoke test — verifies all Phase 2 exports are reachable and compile"
      min_lines: 30
  key_links:
    - from: "src/index.ts"
      to: "every Phase 2 module file"
      via: "export { ... } from './<layer>/<file>.js'"
      pattern: "export.*from.*\\./(capabilities|intent|ui|messaging)"
---

<objective>
Wire Phase 2 together. This plan runs in Wave 2 AFTER all four Phase 2 implementation plans (02-01, 02-02, 02-03, 02-04) have completed. It updates the public barrel (`src/index.ts`) to re-export every Phase 2 module that Phase 3's orchestrator will consume, extends the index test to verify the full public surface compiles and is reachable, and runs the full CI gate to prove Phase 2 is integrated and green.

This plan does NOT implement any new functionality. It is a phase gate — the deliverable is "everything Phase 2 built is actually exported and the whole project still passes CI."

**Requirement coverage:** `PHASE-GATE-02` is a pseudo-requirement claimed only by this plan. All 57 real Phase 2 requirements (CAP-*, RES-*, WS-*, INT-*, IFR-*, UI-*, MSG-*) are claimed by plans 02-01 through 02-04 and verified by those plans' individual CI-green acceptance criteria. This plan's CI run is the composite re-verification.

Output:
- Updated `src/index.ts` with all Phase 2 re-exports
- Extended `src/index.test.ts` covering the new public surface
- Full `pnpm run ci` green as the phase gate signal
</objective>

<execution_context>
@/home/ben/.claude/get-shit-done/workflows/execute-plan.md
@/home/ben/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-core-implementation/02-CONTEXT.md
@.planning/phases/02-core-implementation/02-RESEARCH.md
@.planning/phases/01-foundations/01-01-SUMMARY.md
@src/index.ts

<!-- Read the Phase 2 plan SUMMARYs if they exist; they contain the actual exported symbols -->
@.planning/phases/02-core-implementation/02-01-SUMMARY.md
@.planning/phases/02-core-implementation/02-02-SUMMARY.md
@.planning/phases/02-core-implementation/02-03-SUMMARY.md
@.planning/phases/02-core-implementation/02-04-SUMMARY.md

<interfaces>
<!-- Phase 1 barrel contents (src/index.ts before this plan runs): -->

```typescript
export type { OBCErrorCode } from "./errors";
export { OBCError } from "./errors";
export { generateSessionId } from "./intent/id";
export type {
  Capability,
  CastPlan,
  FileResult,
  IntentCallback,
  IntentRequest,
  IntentResult,
  OBCOptions,
} from "./types";
```

The Phase 2 additions must PRESERVE every Phase 1 export (nothing removed) and ADD the Phase 2 surface.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update public barrel + extend index test + run full CI gate</name>
  <files>src/index.ts, src/index.test.ts</files>

  <read_first>
    - src/index.ts (Phase 1 contents — must be preserved)
    - src/index.test.ts (Phase 1 contents — extend, do not replace)
    - .planning/phases/02-core-implementation/02-01-SUMMARY.md (actual exported names from capabilities layer)
    - .planning/phases/02-core-implementation/02-02-SUMMARY.md (actual exported names from intent layer)
    - .planning/phases/02-core-implementation/02-03-SUMMARY.md (actual exported names from ui layer)
    - .planning/phases/02-core-implementation/02-04-SUMMARY.md (actual exported names from messaging layer)
    - src/capabilities/resolver.ts, src/capabilities/loader.ts, src/capabilities/ws-listener.ts (verify actual exports)
    - src/intent/cast.ts, src/intent/session.ts
    - src/ui/styles.ts, src/ui/iframe.ts, src/ui/focus-trap.ts, src/ui/modal.ts, src/ui/scroll-lock.ts
    - src/messaging/bridge-adapter.ts, src/messaging/mock-bridge.ts, src/messaging/penpal-bridge.ts
  </read_first>

  <action>
    **Step 1: Verify all Phase 2 files exist.** Run:
    ```bash
    ls src/capabilities/ src/lifecycle/ src/intent/ src/ui/ src/messaging/
    ```
    Expected files (beyond Phase 1):
    - src/capabilities/resolver.ts, loader.ts, ws-listener.ts
    - src/lifecycle/abort-context.ts
    - src/intent/cast.ts, session.ts (id.ts is Phase 1)
    - src/ui/styles.ts, iframe.ts, focus-trap.ts, modal.ts, scroll-lock.ts
    - src/messaging/bridge-adapter.ts, mock-bridge.ts, penpal-bridge.ts

    If any file is missing, STOP — a prior plan did not complete. Report back which plan needs to be re-run.

    **Step 2: Rewrite `src/index.ts`** preserving all Phase 1 exports and adding Phase 2 re-exports. Exact content (double quotes; alphabetized within each layer; type exports first):

    ```typescript
    // @openburo/client — public API barrel
    //
    // Phase 1: errors + shared types + session id
    // Phase 2: capabilities + intent + ui + messaging layers (re-exported for Phase 3 orchestrator consumption)
    //
    // Phase 3 will add OpenBuroClient as the default entry point.

    // ---- Phase 1 exports (do not modify) ----

    export type { OBCErrorCode } from "./errors";
    export { OBCError } from "./errors";

    export { generateSessionId } from "./intent/id";

    export type {
      Capability,
      CastPlan,
      FileResult,
      IntentCallback,
      IntentRequest,
      IntentResult,
      OBCOptions,
    } from "./types";

    // ---- Phase 2: Capabilities layer ----

    export { resolve } from "./capabilities/resolver";
    export type { LoaderResult } from "./capabilities/loader";
    export { fetchCapabilities } from "./capabilities/loader";
    export type { WsListenerOptions } from "./capabilities/ws-listener";
    export { WsListener, deriveWsUrl } from "./capabilities/ws-listener";

    // ---- Phase 2: Lifecycle layer ----

    export type { AbortContext } from "./lifecycle/abort-context";
    export { createAbortContext } from "./lifecycle/abort-context";

    // ---- Phase 2: Intent layer ----

    export { planCast } from "./intent/cast";
    export type { ActiveSession } from "./intent/session";

    // ---- Phase 2: UI layer ----

    export type { ShadowHostResult } from "./ui/styles";
    export { createShadowHost, createSpinnerOverlay } from "./ui/styles";
    export { lockBodyScroll } from "./ui/scroll-lock";
    export type { IframeParams } from "./ui/iframe";
    export { buildIframe } from "./ui/iframe";
    export { trapFocus } from "./ui/focus-trap";
    export type { ModalCallbacks, ModalResult } from "./ui/modal";
    export { buildModal } from "./ui/modal";

    // ---- Phase 2: Messaging layer ----

    export type {
      BridgeAdapter,
      ConnectionHandle,
      ParentMethods,
    } from "./messaging/bridge-adapter";
    export { MockBridge } from "./messaging/mock-bridge";
    export { PenpalBridge } from "./messaging/penpal-bridge";
    ```

    **IMPORTANT**: If the actual exports from any Phase 2 file differ from this list (e.g., a function was renamed during implementation), reconcile with the ACTUAL file contents — the SUMMARY.md files are your source of truth. Do not invent exports.

    **Step 3: Extend `src/index.test.ts`**. Read the existing Phase 1 content first, then ADD (do not replace) a new `describe` block for the Phase 2 surface:

    ```typescript
    describe("public API surface — Phase 2", () => {
      it("re-exports capabilities layer", async () => {
        const mod = await import("./index");
        expect(typeof mod.resolve).toBe("function");
        expect(typeof mod.fetchCapabilities).toBe("function");
        expect(typeof mod.WsListener).toBe("function"); // class
        expect(typeof mod.deriveWsUrl).toBe("function");
      });

      it("re-exports lifecycle layer", async () => {
        const mod = await import("./index");
        expect(typeof mod.createAbortContext).toBe("function");
        const ctx = mod.createAbortContext();
        expect(ctx.signal.aborted).toBe(false);
        ctx.abort();
        expect(ctx.signal.aborted).toBe(true);
      });

      it("re-exports intent layer", async () => {
        const mod = await import("./index");
        expect(typeof mod.planCast).toBe("function");
        // ActiveSession is a type; compile-time only
      });

      it("re-exports UI layer", async () => {
        const mod = await import("./index");
        expect(typeof mod.createShadowHost).toBe("function");
        expect(typeof mod.createSpinnerOverlay).toBe("function");
        expect(typeof mod.lockBodyScroll).toBe("function");
        expect(typeof mod.buildIframe).toBe("function");
        expect(typeof mod.trapFocus).toBe("function");
        expect(typeof mod.buildModal).toBe("function");
      });

      it("re-exports messaging layer", async () => {
        const mod = await import("./index");
        expect(typeof mod.MockBridge).toBe("function"); // class
        expect(typeof mod.PenpalBridge).toBe("function"); // class
      });

      it("planCast returns the no-match branch for empty input", async () => {
        const { planCast } = await import("./index");
        const result = planCast([]);
        expect(result.kind).toBe("no-match");
      });
    });
    ```

    Preserve the Phase 1 `describe` block exactly as it is. Do NOT re-run `generateSessionId` or `OBCError` tests — those exist in their own test files.

    **Step 4: Run grep-level cross-layer isolation checks.** These commands MUST return empty output:

    ```bash
    # Messaging isolation: only penpal-bridge.ts may import penpal
    grep -rn 'from "penpal"' src/ --include="*.ts" | grep -v "src/messaging/penpal-bridge" || true
    # Expected: no output

    # UI layer must not import penpal
    grep -rn "penpal" src/ui/ || true
    # Expected: no output

    # UI layer must not import from capabilities or intent or messaging (except types)
    grep -rn 'from "\.\./messaging' src/ui/ || true
    grep -rn 'from "\.\./capabilities' src/ui/ || true
    # Expected: no output

    # Capabilities layer must not touch DOM or Penpal
    grep -rn "document\." src/capabilities/ || true
    grep -rn "penpal" src/capabilities/ || true
    # Expected: no output

    # Lifecycle layer must not touch DOM or Penpal (zero-dep leaf)
    grep -rn "document\." src/lifecycle/ || true
    grep -rn "penpal" src/lifecycle/ || true
    # Expected: no output

    # Messaging layer must not touch DOM directly (iframe param is OK, but no createElement)
    grep -rn "document.createElement" src/messaging/ || true
    # Expected: no output
    ```

    If any of these return output, the offending file violated layer strictness and must be fixed before running CI. File a deviation note in the summary.

    **Step 5: Run the full CI gate.**
    ```bash
    pnpm run ci
    ```
    This runs: `pnpm typecheck && pnpm lint && pnpm test && pnpm attw`. Must exit 0.

    If CI fails, diagnose the failure:
    - Typecheck: usually a stale type import after renames — reconcile with actual file contents
    - Lint: Biome rule (noUnusedImports, noParameterAssign, quotes) — auto-fix via `pnpm biome check --write src/`
    - Test: a flake or a real regression — re-read the failing test's plan and fix
    - attw: usually a dist/ output mismatch; run `pnpm build` first, then re-run attw

    Do NOT commit until `pnpm run ci` exits 0 on a clean run.

    **Step 6: Commit.**
    ```bash
    node "/home/ben/.claude/get-shit-done/bin/gsd-tools.cjs" commit "feat(02-core-implementation): integrate Phase 2 layers into public barrel" --files src/index.ts src/index.test.ts
    ```
  </action>

  <verify>
    <automated>pnpm run ci</automated>
  </verify>

  <acceptance_criteria>
    - `src/index.ts` contains the literal `export { resolve } from "./capabilities/resolver"`
    - `src/index.ts` contains the literal `export { fetchCapabilities } from "./capabilities/loader"`
    - `src/index.ts` contains the literal `export { WsListener, deriveWsUrl } from "./capabilities/ws-listener"`
    - `src/index.ts` contains the literal `export { createAbortContext } from "./lifecycle/abort-context"`
    - `src/index.ts` contains the literal `export type { AbortContext } from "./lifecycle/abort-context"`
    - `src/index.ts` contains the literal `export { planCast } from "./intent/cast"`
    - `src/index.ts` contains the literal `export type { ActiveSession } from "./intent/session"`
    - `src/index.ts` contains the literal `export { createShadowHost` and `from "./ui/styles"`
    - `src/index.ts` contains the literal `export { buildIframe } from "./ui/iframe"`
    - `src/index.ts` contains the literal `export { trapFocus } from "./ui/focus-trap"`
    - `src/index.ts` contains the literal `export { buildModal } from "./ui/modal"`
    - `src/index.ts` contains the literal `export { lockBodyScroll } from "./ui/scroll-lock"`
    - `src/index.ts` contains the literal `export { MockBridge } from "./messaging/mock-bridge"`
    - `src/index.ts` contains the literal `export { PenpalBridge } from "./messaging/penpal-bridge"`
    - `src/index.ts` contains the literal `export type { BridgeAdapter, ConnectionHandle, ParentMethods }`
    - `src/index.ts` PRESERVES the Phase 1 `export { OBCError }` line
    - `src/index.ts` PRESERVES the Phase 1 `export { generateSessionId }` line
    - `src/index.test.ts` contains a new `describe("public API surface — Phase 2"` block
    - `src/index.test.ts` contains at least 5 new `it(` calls inside the Phase 2 describe block
    - `pnpm run ci` exits 0 (composite: typecheck + lint + test + attw)
    - `grep -rn "from \"penpal\"" src/ --include="*.ts" | grep -v "src/messaging/penpal-bridge"` returns nothing
    - `grep -rn "penpal" src/ui/` returns nothing
    - `grep -rn "penpal" src/capabilities/` returns nothing
    - `grep -rn "penpal" src/intent/` returns nothing
    - `grep -rn "document\." src/capabilities/` returns nothing
    - `grep -rn "document.createElement" src/messaging/` returns nothing
  </acceptance_criteria>

  <done>
    Public barrel extended with all Phase 2 exports; index.test.ts verifies the public surface; `pnpm run ci` exits 0; all grep-level layer isolation checks pass; commit landed.
  </done>
</task>

</tasks>

<verification>
This is the phase gate. The single test to satisfy is `pnpm run ci` exiting 0, which composites typecheck, lint, unit tests (all Phase 2 plans combined), and attw. If this gate passes, Phase 2 is shippable — Phase 3 can import any Phase 2 symbol from `@openburo/client` and start wiring the orchestrator.
</verification>

<success_criteria>
- `pnpm run ci` exits 0
- Every Phase 2 export listed in the acceptance criteria is reachable via `import { X } from "./index"`
- Layer isolation (grep checks) passes
- `src/index.test.ts` public API surface test runs green for both Phase 1 and Phase 2 describe blocks
- attw reports "No problems found"
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-implementation/02-05-SUMMARY.md`. Record:
- Confirmation that all 4 prior Phase 2 plans landed successfully (list the SUMMARYs read)
- Any export-name reconciliation needed between the pre-written barrel and actual file contents
- The full CI gate runtime (pnpm run ci wall-clock time)
- Total Phase 2 test count across all layers (sum of resolver + loader + ws-listener + cast + styles + iframe + focus-trap + modal + bridge-adapter + mock-bridge + penpal-bridge + index tests)
- Any layer isolation grep violations discovered and how they were fixed
- Phase 3 readiness checklist: can Phase 3 `import { resolve, planCast, fetchCapabilities, WsListener, createAbortContext, createShadowHost, buildIframe, buildModal, trapFocus, lockBodyScroll, MockBridge, PenpalBridge, ActiveSession, BridgeAdapter, AbortContext } from "@openburo/client"` successfully?
</output>
