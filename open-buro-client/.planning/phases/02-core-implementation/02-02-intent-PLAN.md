---
phase: 02-core-implementation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/intent/cast.ts
  - src/intent/cast.test.ts
  - src/intent/session.ts
autonomous: true
requirements:
  - RES-07
  - INT-01
  - INT-02
  - INT-03
  - INT-04
  - INT-05
  - INT-06
  - INT-07
  - INT-08
  - INT-09

must_haves:
  truths:
    - "planCast([]) returns { kind: 'no-match' }"
    - "planCast([cap]) returns { kind: 'direct', capability: cap }"
    - "planCast([cap1, cap2]) returns { kind: 'select', capabilities: [cap1, cap2] }"
    - "planCast is a pure function — no side effects, no DOM, no I/O"
    - "ActiveSession type exists and includes id, capability, iframe, shadowHost, connectionHandle, timeoutHandle, resolve, reject, callback"
  artifacts:
    - path: "src/intent/cast.ts"
      provides: "Pure planCast discriminated-union function"
      exports: ["planCast"]
      min_lines: 15
    - path: "src/intent/cast.test.ts"
      provides: "Unit tests for all 3 CastPlan branches"
      min_lines: 40
    - path: "src/intent/session.ts"
      provides: "ActiveSession type used by Phase 3 orchestrator's Map<string, ActiveSession>"
      exports: ["ActiveSession"]
      min_lines: 15
  key_links:
    - from: "src/intent/cast.ts"
      to: "src/types.ts (CastPlan discriminated union)"
      via: "import type"
      pattern: "import type.*CastPlan"
    - from: "src/intent/session.ts"
      to: "src/messaging/bridge-adapter.ts (ConnectionHandle)"
      via: "import type"
      pattern: "import type.*ConnectionHandle"
    - from: "src/intent/cast.ts"
      to: "noUncheckedIndexedAccess guard"
      via: "matches[0] !== undefined check"
      pattern: "first !== undefined"
---

<objective>
Build the Intent layer — a pure `planCast()` function that converts a list of matching capabilities into a three-way `CastPlan` discriminated union, and the `ActiveSession` type that Phase 3's orchestrator will use to key its session Map. This layer has zero DOM and zero Penpal knowledge.

Purpose: The orchestrator calls `resolve()` (from Plan 02-01) then `planCast()` to decide the next step: error, open iframe directly, or show chooser modal. `planCast()` is the unit-testable decision point that removes the need for DOM stubs when testing orchestrator logic. The `ActiveSession` type centralizes what the orchestrator stores per in-flight `castIntent` call.

Output:
- `src/intent/cast.ts` + test (Node env)
- `src/intent/session.ts` (type-only; no test file — type is verified by compile-time usage from Plan 02-01 Task test imports and Phase 3)

**Requirement coverage note:** Most INT-* requirements describe orchestrator-level behavior that only makes sense when the orchestrator wires `planCast` + session Map + modal + bridge together in Phase 3. This plan lays the two pure building blocks (`planCast` + `ActiveSession` type) that those requirements depend on. The Phase 3 orchestrator plan will claim the same requirement IDs as the _integration_ — dual-listing is intentional because each side of the split is verifiable independently. For Phase 2, the verifiable slice of each INT-* is:
  - INT-01: Promise+callback shape documented via ActiveSession.callback + resolve signature
  - INT-02: planCast 'no-match' branch
  - INT-03: planCast 'direct' branch
  - INT-04: planCast 'select' branch
  - INT-05: ActiveSession includes `id: string` (the UUID slot; generateSessionId already exists from Phase 1)
  - INT-06: ActiveSession is per-session (no shared state in the type)
  - INT-07: ActiveSession.callback receives the cancel shape
  - INT-08: ActiveSession includes `timeoutHandle: ReturnType<typeof setTimeout>` for watchdog
  - INT-09: ActiveSession.id is the stale-check key (orchestrator wires Map.has)
</objective>

<execution_context>
@/home/ben/.claude/get-shit-done/workflows/execute-plan.md
@/home/ben/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-core-implementation/02-CONTEXT.md
@.planning/phases/02-core-implementation/02-RESEARCH.md
@.planning/phases/01-foundations/01-01-SUMMARY.md
@src/types.ts
@src/intent/id.ts

<interfaces>
<!-- Types already exported from Phase 1. -->

From src/types.ts:
```typescript
export type CastPlan =
  | { kind: "no-match" }
  | { kind: "direct"; capability: Capability }
  | { kind: "select"; capabilities: Capability[] };

export interface Capability {
  id: string;
  appName: string;
  action: string;
  path: string;
  iconUrl?: string;
  properties: { mimeTypes: string[] };
}

export type IntentCallback = (result: IntentResult) => void;
export interface IntentResult {
  id: string;
  status: "done" | "cancel";
  results: FileResult[];
}
```

From src/intent/id.ts:
```typescript
export function generateSessionId(): string;
```

**Forward reference** (created in Plan 02-04, same wave):
```typescript
// src/messaging/bridge-adapter.ts
export interface ConnectionHandle {
  destroy(): void;
}
```

Because Plan 02-04 and this plan run in the same wave, `src/intent/session.ts` must use a **type-only import** from `../messaging/bridge-adapter.js`. TypeScript's type-only imports are erased at runtime, and the compile step only runs after both plans have committed. Execute this plan's Task 2 (session.ts) AFTER Plan 02-04 has committed `bridge-adapter.ts`, OR stub the import. See Task 2 action for the exact approach.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: planCast discriminated-union function (RES-07, INT-02/03/04)</name>
  <files>src/intent/cast.ts, src/intent/cast.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (Pattern 1: Pure Resolver + planCast, Pitfall 2 noUncheckedIndexedAccess)
    - .planning/phases/02-core-implementation/02-CONTEXT.md
    - src/types.ts (CastPlan, Capability definitions)
  </read_first>

  <behavior>
    - planCast([]) returns exactly { kind: "no-match" }
    - planCast([cap]) returns { kind: "direct", capability: cap } where capability === the input cap (reference equality)
    - planCast([cap1, cap2]) returns { kind: "select", capabilities: [cap1, cap2] } (array preserved)
    - planCast([cap1, cap2, cap3]) returns { kind: "select", capabilities: [cap1, cap2, cap3] }
    - The TypeScript discriminated union narrows correctly: after `if (plan.kind === "direct") { plan.capability }` the `capability` field is accessible without error
  </behavior>

  <action>
    Create `src/intent/cast.ts`. Exact source (copy verbatim, adjusting quote style to double quotes per Biome):

    ```typescript
    import type { Capability, CastPlan } from "../types.js";

    /**
     * Pure decision function: given a pre-filtered list of matching capabilities,
     * return the CastPlan that the orchestrator should execute.
     *
     * - 0 matches: no-match (orchestrator fires NO_MATCHING_CAPABILITY + cancel callback)
     * - 1 match: direct (orchestrator opens iframe, skips modal)
     * - 2+ matches: select (orchestrator shows chooser modal)
     *
     * This function has no DOM dependency and no side effects — it is fully
     * unit-testable in a Node environment.
     */
    export function planCast(matches: Capability[]): CastPlan {
      if (matches.length === 0) {
        return { kind: "no-match" };
      }
      const first = matches[0];
      if (matches.length === 1 && first !== undefined) {
        return { kind: "direct", capability: first };
      }
      return { kind: "select", capabilities: matches };
    }
    ```

    **CRITICAL: `noUncheckedIndexedAccess: true` is active** (verified in Phase 1 tsconfig.json). `matches[0]` returns `Capability | undefined`. The guard `first !== undefined` is REQUIRED by the compiler; without it, assigning `capability: first` fails type checking because `CastPlan.direct.capability` expects `Capability`, not `Capability | undefined`. Do NOT remove this guard thinking it is dead code — the type system demands it.

    Use **double quotes** for all string literals. Use **type-only** import for `Capability` and `CastPlan`.

    Create `src/intent/cast.test.ts` (Node env, no docblock) with at least **6 tests**:
    1. Empty array → `{ kind: "no-match" }` (strict equality via `toEqual`)
    2. Single capability → `{ kind: "direct", capability: theCap }` and `result.capability === theCap` (reference)
    3. Two capabilities → `{ kind: "select", capabilities: [cap1, cap2] }`
    4. Three capabilities → `{ kind: "select", capabilities: [...] }` length 3
    5. `select` branch preserves order: pass `[cap1, cap2]`, assert `result.capabilities[0] === cap1`
    6. Type narrowing compile check: write a function that switches on `result.kind` and accesses `result.capability` in the `direct` branch and `result.capabilities` in the `select` branch — the test body calls this function to verify it runs without error. This is a **compile-time smoke test** — if the discriminant union narrows incorrectly, `pnpm typecheck` fails, not the runtime test.

    Build fixtures inline — do not create a shared fixture file. Use `const cap1: Capability = { id: "a", appName: "App A", action: "PICK", path: "https://a.example.com/pick", properties: { mimeTypes: ["image/png"] } }` shape.
  </action>

  <verify>
    <automated>pnpm vitest run src/intent/cast.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/intent/cast.ts` exports `planCast`
    - `src/intent/cast.ts` contains the literal `first !== undefined`
    - `src/intent/cast.ts` contains the literal `kind: "no-match"`
    - `src/intent/cast.ts` contains the literal `kind: "direct"`
    - `src/intent/cast.ts` contains the literal `kind: "select"`
    - `src/intent/cast.ts` does NOT contain `document` or `penpal` or `fetch(`
    - `src/intent/cast.test.ts` contains at least 6 `it(` or `test(` calls
    - `pnpm vitest run src/intent/cast.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    All three CastPlan branches verified; noUncheckedIndexedAccess guard present; discriminated-union narrowing compile-checked.
  </done>
</task>

<task type="auto">
  <name>Task 2: ActiveSession type for Phase 3 session Map (INT-01, INT-05..09)</name>
  <files>src/intent/session.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (ActiveSession Type section, ~line 1153)
    - .planning/phases/02-core-implementation/02-CONTEXT.md
    - src/types.ts (Capability, IntentResult)
    - src/messaging/bridge-adapter.ts (ConnectionHandle — created in Plan 02-04 same wave)
  </read_first>

  <action>
    Create `src/intent/session.ts` — a **type-only** file that defines the `ActiveSession` interface used by Phase 3's `Map<string, ActiveSession>`.

    Exact source (copy verbatim from RESEARCH.md line ~1162, quotes normalized):

    ```typescript
    import type { ConnectionHandle } from "../messaging/bridge-adapter.js";
    import type { Capability, IntentResult } from "../types.js";

    /**
     * Per-session state held by the orchestrator's Map<string, ActiveSession>.
     *
     * Every field is load-bearing for leak-free teardown:
     * - id: used as the Map key and the stale-message filter (INT-09)
     * - capability: the selected capability (for error context)
     * - iframe / shadowHost: DOM nodes to remove in destroy() (IFR-01..10)
     * - connectionHandle: destroy() closes the Penpal bridge (MSG-06)
     * - timeoutHandle: watchdog setTimeout to clear on resolve/cancel (INT-08)
     * - resolve / reject: the Promise returned by castIntent() (INT-01)
     * - callback: the user's IntentCallback, called exactly once (INT-01)
     *
     * Phase 3 instantiates this type inside OpenBuroClient; Phase 2 only
     * defines the shape so each layer can reference it.
     */
    export interface ActiveSession {
      id: string;
      capability: Capability;
      iframe: HTMLIFrameElement;
      shadowHost: HTMLElement;
      connectionHandle: ConnectionHandle;
      timeoutHandle: ReturnType<typeof setTimeout>;
      resolve: (result: IntentResult) => void;
      reject: (err: Error) => void;
      callback: (result: IntentResult) => void;
    }
    ```

    **Wave-ordering note:** Plan 02-04 creates `src/messaging/bridge-adapter.ts` in the same wave. The `import type` statement is erased at runtime but still requires the file to exist at `tsc --noEmit` time. If Plan 02-04 has not yet committed `bridge-adapter.ts` when this task runs:
    - Option A: Run this task AFTER Plan 02-04 Task 1 is committed (the execute-phase runner should sequence this naturally since the committed file tree is shared).
    - Option B: Inline the type locally as a fallback and file an issue. The **preferred** option is A — both plans are in the same wave and share the same working tree.

    The executor should verify `src/messaging/bridge-adapter.ts` exists before committing this file. If not, wait or skip and return to it. This is the only inter-plan dependency in Wave 1 and is resolved by committing bridge-adapter.ts first (Plan 02-04 Task 1 is the very first task of that plan).

    Use **`import type`** for both imports (tree-shaken at runtime, enforced by Biome verbatim-module-syntax if enabled). Use double quotes.

    No test file for this task — the type is verified at compile time. The Phase 3 orchestrator and this plan's Task 1 do not instantiate it, so a runtime test would require manufacturing a fake `HTMLIFrameElement` in happy-dom which is out of scope here.

    **Compile verification**: After writing, run `pnpm typecheck`. It must exit 0 with no new errors. If `bridge-adapter.ts` is missing, the error will be "Cannot find module '../messaging/bridge-adapter.js'" — at that point, wait for Plan 02-04 Task 1 to commit, then retry.
  </action>

  <verify>
    <automated>pnpm typecheck</automated>
  </verify>

  <verify_note>
    If `pnpm typecheck` fails with errors NOT in session.ts, the session.ts type additions are fine — proceed to commit. The project-wide typecheck is only considered relevant here if errors reference `src/intent/session.ts` or the `ActiveSession` symbol. Errors elsewhere (e.g. a stale module in an unrelated layer) are out of scope for this task and should be surfaced in the plan SUMMARY, not blocked on.
  </verify_note>

  <acceptance_criteria>
    - `src/intent/session.ts` exists
    - `src/intent/session.ts` exports `interface ActiveSession`
    - `src/intent/session.ts` contains all 9 literal field names: `id`, `capability`, `iframe`, `shadowHost`, `connectionHandle`, `timeoutHandle`, `resolve`, `reject`, `callback`
    - `src/intent/session.ts` contains the literal `import type { ConnectionHandle }`
    - `src/intent/session.ts` does NOT contain runtime code (no `function`, no `class`, no `const` except comments)
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    ActiveSession type committed with all 9 fields, type-only imports, and zero runtime footprint.
  </done>
</task>

</tasks>

<verification>
Both tasks produce a green `pnpm vitest run src/intent/cast.test.ts` and a green `pnpm typecheck`. No file in this plan imports `penpal` or touches `document`/`window`. The ActiveSession type correctly references `ConnectionHandle` from Plan 02-04.
</verification>

<success_criteria>
- `pnpm vitest run src/intent/cast.test.ts` exits 0 with 6+ tests
- `pnpm typecheck` exits 0
- `grep -r "penpal" src/intent/cast.ts src/intent/session.ts` returns nothing
- `grep -r "document\." src/intent/cast.ts src/intent/session.ts` returns nothing
- All 10 requirement IDs claimed (RES-07, INT-01..09) have a verifiable Phase 2 slice (type shape or test assertion)
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-implementation/02-02-SUMMARY.md`. Record:
- planCast test count and branches covered
- Any timing issue with ActiveSession importing from bridge-adapter.ts (i.e., did you need to wait for Plan 02-04?)
- Confirmation that Phase 3 can now type-check against `Map<string, ActiveSession>` without further type work in Phase 2
</output>
