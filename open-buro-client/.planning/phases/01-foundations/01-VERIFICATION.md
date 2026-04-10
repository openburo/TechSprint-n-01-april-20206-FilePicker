---
phase: 01-foundations
verified: 2026-04-10T11:39:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
gaps: []
human_verification: []
---

# Phase 1: Foundations — Verification Report

**Phase Goal:** Developers (and Claude) can write and test typed OBC code — the project scaffold, shared type contracts, error model, and session-id utility are all in place.
**Verified:** 2026-04-10T11:39:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `pnpm build` and `pnpm test` complete without errors — tooling (tsdown, Vitest 4, Biome, TypeScript 6) is wired correctly | VERIFIED | `pnpm tsc --noEmit` exits 0; `pnpm vitest run` exits 0 with 10/10 tests passing in 147ms; `pnpm build` (tsdown 0.21.7) exits 0 |
| 2 | `import { OBCError, OBCErrorCode } from '@openburo/client'` resolves all six error codes at compile time with no type errors | VERIFIED | `errors.ts` exports `OBCErrorCode` union with all 6 codes; `index.ts` barrel re-exports both; `index.test.ts` assigns all codes at compile time; `tsc --noEmit` exits 0 |
| 3 | All shared interfaces (`Capability`, `IntentRequest`, `IntentResult`, `OBCOptions`, `CastPlan`) are exported and type-check in an isolated consumer file | VERIFIED | `types.ts` exports all 7 types (includes `FileResult` and `IntentCallback`); `index.ts` re-exports all; `index.test.ts` assigns all types with full shape — tsc exits 0 |
| 4 | `generateSessionId()` returns a valid UUID v4 string in environments lacking `crypto.randomUUID()` — verified via Vitest test | VERIFIED | `id.test.ts` explicitly deletes `globalThis.crypto.randomUUID` and confirms fallback returns UUID v4 matching `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`; test passes |
| 5 | `@arethetypeswrong/cli --pack` exits 0 and Penpal is pinned to an exact version in `package.json` | VERIFIED | `pnpm dlx @arethetypeswrong/cli --pack` exits 0 with "No problems found" across node10, node16 CJS/ESM, and bundler; `package.json` has `"penpal": "7.0.6"` (no caret) |

**Score:** 5/5 success criteria verified

---

### Required Artifacts (Three-Level Verification)

| Artifact | Status | Level 1: Exists | Level 2: Substantive | Level 3: Wired |
|----------|--------|-----------------|----------------------|----------------|
| `package.json` | VERIFIED | Yes | Contains `"penpal": "7.0.6"`, nested exports map with types per condition, scripts for build/test/typecheck/lint/ci/attw | Referenced by tsdown (entry), all scripts resolve real dist files |
| `tsconfig.json` | VERIFIED | Yes | `"target": "ES2020"`, `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noEmit": true`, `"types": []` | Used by `pnpm typecheck` and tsdown build; tsc exits 0 |
| `tsdown.config.ts` | VERIFIED | Yes | Two-array `defineConfig([...])` config — array 1: ESM+CJS with `deps.neverBundle: ['penpal']`, globalName absent; array 2: UMD with `globalName: 'OpenBuroClient'` and penpal bundled | `pnpm build` invokes this; produces 9 dist artifacts including `index.umd.js` |
| `vitest.config.ts` | VERIFIED | Yes | `environment: 'node'`, v8 coverage configured | `pnpm vitest run` uses this; 10/10 tests pass |
| `biome.json` | VERIFIED | Yes | Biome 2.4.11 schema, `assist.actions.source.organizeImports: "on"`, strict lint rules (`noUnusedVariables`, `noUnusedImports`, `noExplicitAny`), formatter configured | `pnpm lint` (`biome check .`) runs against this |
| `.gitignore` | VERIFIED | Yes | Contains `dist/`, `node_modules/`, `*.tsbuildinfo`, `*.tgz` | Standard git ignore |
| `src/errors.ts` | VERIFIED | Yes | Exports `OBCErrorCode` union (6 values) + `OBCError` class with `Object.setPrototypeOf` for instanceof safety, `cause` as plain property (ES2020 compat) | Re-exported by `src/index.ts`; tested in `errors.test.ts` |
| `src/errors.test.ts` | VERIFIED | Yes | 4 tests: instanceof check, all 6 codes, cause propagation, cause undefined — all pass | Runs in `pnpm vitest run` |
| `src/types.ts` | VERIFIED | Yes | 7 exported types: `Capability`, `IntentRequest`, `IntentResult`, `FileResult`, `IntentCallback`, `OBCOptions`, `CastPlan` (discriminated union) | Re-exported by `src/index.ts`; tested in `index.test.ts` |
| `src/intent/id.ts` | VERIFIED | Yes | `generateSessionId()` with call-time `typeof crypto.randomUUID === 'function'` check; RFC 4122 v4 fallback via `getRandomValues`; biome-ignore protects operator precedence | Re-exported by `src/index.ts`; tested in `id.test.ts` |
| `src/intent/id.test.ts` | VERIFIED | Yes | 3 tests: happy path (UUID v4 regex), fallback branch (delete randomUUID + call), uniqueness 100x — all pass | Runs in `pnpm vitest run` |
| `src/index.ts` | VERIFIED | Yes | Barrel re-exports `OBCError`, `OBCErrorCode` (type), `generateSessionId`, and all 7 shared types | Tested in `index.test.ts`; is the tsdown entry point |
| `src/index.test.ts` | VERIFIED | Yes | Imports all public symbols; assigns all 7 types with full shape (compile-time check); runtime assertions on OBCError constructor and generateSessionId return value | Runs in `pnpm vitest run` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` | `dist/index.js` (ESM) | `exports["."].import.default` | WIRED | `"default": "./dist/index.js"` in exports map; file exists post-build |
| `package.json` | `dist/index.cjs` (CJS) | `exports["."].require.default` | WIRED | `"default": "./dist/index.cjs"` in exports map; file exists post-build |
| `package.json` | `dist/index.d.ts` / `index.d.cts` | `exports["."].[import|require].types` | WIRED | Both `.d.ts` and `.d.cts` present in dist/; attw confirms no type resolution errors |
| `tsdown.config.ts` | `src/index.ts` | `entry: ['src/index.ts']` in both config objects | WIRED | Both ESM+CJS and UMD config objects specify `src/index.ts` as entry |
| `src/index.ts` | `src/errors.ts` | `export { OBCError } from './errors'` + `export type { OBCErrorCode }` | WIRED | Confirmed in source; tsc traverses and exits 0 |
| `src/index.ts` | `src/types.ts` | `export type { Capability, CastPlan, ... } from './types'` | WIRED | Confirmed in source; all 7 types re-exported |
| `src/index.ts` | `src/intent/id.ts` | `export { generateSessionId } from './intent/id'` | WIRED | Confirmed in source |
| `src/intent/id.test.ts` | `src/intent/id.ts` | `delete (globalThis.crypto as any).randomUUID` before calling `generateSessionId()` | WIRED | Call-time typeof check in `id.ts` means fallback executes; test verifies UUID v4 shape |

**Note on PLAN key_links mismatch:** The PLAN's `key_links` section specified the pattern `"default": "./dist/obc\.esm\.js"` (research-phase filenames). The actual implementation correctly uses `./dist/index.js` matching tsdown 0.21.7's real output. This was an intentional, documented deviation (SUMMARY key-decision #1) — the live wiring is correct and attw confirms it.

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| FOUND-01 | Project scaffolds with tsdown, TypeScript 6, Vitest 4, Biome, npm package name `@openburo/client` | SATISFIED | `package.json` name is `@openburo/client`; devDependencies include tsdown 0.21.7, typescript 6.0.2, vitest 4.1.4, @biomejs/biome 2.4.11; all config files exist and functional |
| FOUND-02 | `OBCError` class exported with code + message + optional cause | SATISFIED | `src/errors.ts`: `OBCError extends Error` with `readonly code: OBCErrorCode`, `message` from `super(message)`, `readonly cause?: unknown`; 4 unit tests pass |
| FOUND-03 | `OBCErrorCode` union covers all six codes | SATISFIED | `src/errors.ts` exports union of exactly: `CAPABILITIES_FETCH_FAILED`, `NO_MATCHING_CAPABILITY`, `IFRAME_TIMEOUT`, `WS_CONNECTION_FAILED`, `INTENT_CANCELLED`, `SAME_ORIGIN_CAPABILITY`; test enumerates all 6 |
| FOUND-04 | Shared types exported: `Capability`, `IntentRequest`, `IntentResult`, `FileResult`, `IntentCallback`, `OBCOptions`, `CastPlan` | SATISFIED | All 7 types in `src/types.ts`, all re-exported from `src/index.ts`, all assigned in `index.test.ts` compile-time check |
| FOUND-05 | `generateSessionId()` uses `crypto.randomUUID()` with inline `getRandomValues` fallback | SATISFIED | `src/intent/id.ts`: call-time `typeof crypto.randomUUID === 'function'` guard; RFC 4122 v4 fallback via `getRandomValues`; `id.test.ts` exercises both branches — both pass |
| FOUND-06 | Penpal pinned to exact version (no `^` range) in `package.json` | SATISFIED | `package.json` `dependencies`: `"penpal": "7.0.6"` — no caret, exact pin confirmed |
| FOUND-07 | `@arethetypeswrong/cli` runs as CI gate on every build | SATISFIED | `pnpm dlx @arethetypeswrong/cli --pack` in `ci` script; exits 0 with "No problems found"; green across node10, node16 CJS/ESM, and bundler resolution modes |

**Requirements coverage: 7/7 — all FOUND-01..07 satisfied**

---

### Anti-Pattern Scan

Files scanned: `src/errors.ts`, `src/types.ts`, `src/intent/id.ts`, `src/index.ts`, `src/errors.test.ts`, `src/intent/id.test.ts`, `src/index.test.ts`

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| All source files | TODO/FIXME/PLACEHOLDER | — | None found |
| All source files | `return null` / `return {}` / stub bodies | — | None found |
| `src/intent/id.ts` | `biome-ignore format:` comment | Info | Intentional — protects load-bearing operator precedence in UUID fallback RFC 4122 expression; not a stub |
| `src/intent/id.test.ts` | `biome-ignore lint/suspicious/noExplicitAny` | Info | Intentional — necessary cast to delete `crypto.randomUUID` for fallback branch coverage |

No blocker or warning anti-patterns found.

---

### Human Verification Required

None — all FOUND-01..07 behaviors are fully verifiable programmatically. All automated gates pass.

---

### Deviations from PLAN (Not Gaps)

These are intentional, documented changes that improve correctness; they are not gaps:

1. **tsdown output filenames:** PLAN key_links referenced `dist/obc.esm.js`; actual tsdown 0.21.7 output is `dist/index.js/index.cjs`. Exports map updated to match. `attw` exits 0.
2. **`OBCError.cause` as plain property:** ES2020 lib lacks `Error.cause`; `override` would fail tsc. Declared as own property. Functionally equivalent.
3. **biome.json API:** Research template used keys absent from Biome 2.4.11; rewritten to actual API. `biome check` exits 0.
4. **`super(message)` only (not `super(message, { cause })`):** `ErrorOptions` is ES2022+, absent from ES2020 lib. Single-arg call is correct.

---

## Summary

Phase 1 goal is **fully achieved**. Every observable truth holds:

- The toolchain (tsdown 0.21.7 + TypeScript 6 + Vitest 4 + Biome 2.4.11) is installed, configured, and produces clean output.
- `OBCError` and all six `OBCErrorCode` values are substantive, exported, and unit-tested.
- All 7 shared type contracts are exported from the public barrel and verified at compile time.
- `generateSessionId()` has real implementations of both the primary (`crypto.randomUUID`) and fallback (`getRandomValues`) paths, with tests confirming both branches return valid UUID v4 strings.
- Penpal is pinned to exact `7.0.6` with no range operator.
- `@arethetypeswrong/cli --pack` exits 0 ("No problems found") across all resolution modes.
- `pnpm vitest run`: 3 test files, 10 tests, 10 passed. `pnpm tsc --noEmit`: exits 0. `pnpm build`: exits 0.

Phase 2 can import from `@openburo/client` immediately.

---

_Verified: 2026-04-10T11:39:00Z_
_Verifier: Claude (gsd-verifier)_
