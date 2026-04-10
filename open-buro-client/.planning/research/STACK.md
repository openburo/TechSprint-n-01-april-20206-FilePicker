# Stack Research

**Domain:** Framework-agnostic vanilla TypeScript browser library (ESM + CJS + UMD)
**Researched:** 2026-04-10
**Confidence:** MEDIUM-HIGH (core tooling verified via official sources / npm; Penpal API shape HIGH confidence from official release notes)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 6.0 | Source language | Released March 2026. Strict mode default is now on; ES2020 target must be set explicitly (TS6 default shifted to es2025). The native Go port arrives in TS7; TS6 is the last JS-based release and still the safe choice for library tooling. |
| tsdown | 0.21.7 | Library bundler (ESM + CJS + UMD) | Official successor to tsup (tsup repo now shows a "not actively maintained" warning pointing to tsdown). Built on Rolldown (Rust); supports ESM, CJS, IIFE, **and UMD** natively — tsup/esbuild do NOT support UMD. tsdown is API-compatible with tsup config so migration is trivial. Still pre-1.0 but used in production by TresJS and others; no show-stopper issues for a pure-TS library with no CSS. |
| Vitest | 4.1.4 | Unit + integration testing | Vitest 4.0 shipped late 2025 with Browser Mode graduated to stable. Jest-compatible API, native ESM, TypeScript-native, 10–20× faster than Jest. The ecosystem default in 2026 (17 M weekly downloads). |
| Biome | 2.4 | Linting + formatting | Single binary, zero peer-deps, replaces ESLint + Prettier. 10–25× faster. 450+ rules including TypeScript-aware linting. Correct choice for a greenfield library with no framework plugins needed. |
| Penpal | 7.0.6 | Parent↔iframe PostMessage | Purpose-built for iframe PostMessage with Promise-native API, origin restriction, and clean teardown. **v7 rewrote the API** — see the Penpal API Shape section below. The spec's `connectToChild` / `allowedOrigins` references are v6 idioms and must be updated. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | latest | Code coverage | Always — use `--coverage` for CI; v8 provider needs no extra dependencies. |
| `happy-dom` | latest | DOM simulation in Vitest | For tests that touch DOM/Shadow DOM APIs (modal, iframe injection). 2–4× faster than jsdom. Use jsdom only if you hit missing API gaps. |
| `msw` (Mock Service Worker) | 2.x | HTTP + WS mocking in tests | For integration tests of `refreshCapabilities()` HTTP fetch and WebSocket backoff logic. Preferred over manual `fetch` mocks. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsdown` | Build + watch | `tsdown --watch` for local dev. Config in `tsdown.config.ts`. |
| `typescript` | Type-checking + declaration emit | Run `tsc --noEmit` as a separate type-check step; tsdown handles emit via Rolldown (faster). |
| `@arethetypeswrong/cli` | Validate published exports map | Run `attw --pack` before publish to catch CJS/ESM/types mismatches. Critical for dual-format libraries. |
| `publint` | Validate package.json | Catches common `exports`, `main`, `module`, `types` field errors before publish. |
| GitHub Actions | CI | Node 22 LTS matrix; run `tsc --noEmit && biome check && vitest run && attw --pack`. |

---

## Installation

```bash
# Runtime dependency (only one)
npm install penpal

# Dev dependencies — build
npm install -D tsdown typescript

# Dev dependencies — test
npm install -D vitest @vitest/coverage-v8 happy-dom msw

# Dev dependencies — lint/format
npm install -D @biomejs/biome

# Dev dependencies — publish validation
npm install -D @arethetypeswrong/cli publint
```

---

## Penpal v7 API Shape (CRITICAL — spec uses v6 idioms)

**Confidence: HIGH** (verified against official v7.0.0 release notes and GitHub README)

Penpal v7 unified `connectToChild` / `connectToParent` into a single `connect` function. All communication is now mediated by a **`WindowMessenger`** instance.

### Parent side (OBC — connecting to iframe child)

```typescript
import { connect, WindowMessenger } from 'penpal';

// iframe must already exist in the DOM with src set
const messenger = new WindowMessenger({
  remoteWindow: iframe.contentWindow!,
  allowedOrigins: ['https://capability.example.com'],  // restrict to capability origin
});

const connection = connect<ChildMethods>({
  messenger,
  methods: {
    // methods the child can call on the parent
    resolve(result: IntentResult) { ... },
  },
});

const child = await connection.promise;
// child.someChildMethod() — remote methods are a Proxy
await connection.destroy(); // clean teardown
```

### Key v6 → v7 migration deltas relevant to OBC

| v6 (spec references) | v7 (what to build) |
|----------------------|--------------------|
| `connectToChild({ iframe, allowedOrigins, methods })` | `connect({ messenger: new WindowMessenger({ remoteWindow, allowedOrigins }), methods })` |
| `connectToParent({ methods })` (child side) | `connect({ messenger: new WindowMessenger({ remoteWindow: window.parent, allowedOrigins }), methods })` |
| `allowedOrigins: ['https://...']` on connectToChild | `allowedOrigins: ['https://...']` on `WindowMessenger` constructor — same semantics, different location |
| Default `childOrigin` derived from iframe `src` | Default is now **parent document's own origin** — must pass `allowedOrigins` explicitly for cross-origin capabilities |
| `debug: true` | `log: (level, ...args) => console[level](...args)` |
| `AsyncMethodReturns<T>` TypeScript type | `RemoteProxy<T>` |
| `ConnectionDestroyed` error code string | `PenpalError` class, code `CONNECTION_DESTROYED` |
| All messages over `window.postMessage` | Handshake only over `postMessage`; subsequent messages over `MessagePort` (less global noise) |
| Remote methods are plain object properties | Remote methods are a `Proxy` — `Object.keys(child)` returns `[]`, do not enumerate |

**Implication for OBC:** The `castIntent` implementation in `IframeLifecycle` / `SessionManager` must use `WindowMessenger` and the new `connect` API. The iframe must have `contentWindow` available before `connect` is called (set `src` on iframe before calling `connect`, then the Penpal handshake resolves when child calls `connect` too).

---

## TypeScript 6 tsconfig for a Library

**Confidence: HIGH** (verified against TS6 release announcement and migration guide)

TypeScript 6.0 changed several defaults. For OBC, set everything explicitly to avoid surprises:

```jsonc
// tsconfig.json (type-checking only — tsdown drives emit)
{
  "compilerOptions": {
    "target": "ES2020",          // explicit — TS6 default shifted to es2025
    "lib": ["ES2020", "DOM"],    // ES2020 + browser APIs
    "module": "ESNext",          // needed with moduleResolution bundler
    "moduleResolution": "bundler", // correct for tsdown / esbuild consumers
    "strict": true,              // was already the intent; now TS6 default
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",          // explicit — TS6 default rootDir changed
    "types": [],                 // TS6 no longer auto-discovers @types; explicit is safer
    "esModuleInterop": true,     // TS6 always-on; stating explicitly is harmless
    "skipLibCheck": true,
    "noEmit": true               // tsdown handles emit; tsc only type-checks
  },
  "include": ["src"]
}
```

---

## package.json Exports Map Pattern

**Confidence: HIGH** (verified against multiple official sources and Liran Tal's 2025 analysis)

```jsonc
{
  "name": "@openburo/client",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/obc.cjs.js",        // legacy Node CJS entrypoint
  "module": "./dist/obc.esm.js",      // bundler-aware ESM entrypoint
  "types": "./dist/types/index.d.ts", // root types fallback
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/obc.esm.js"
      },
      "require": {
        "types": "./dist/types/index.d.cts",
        "default": "./dist/obc.cjs.js"
      }
    }
  },
  "files": ["dist"],
  "sideEffects": false
}
```

**Gotchas:**
- Place `"types"` **inside** each conditional branch, not only at the top level. TypeScript resolves `require` types from `.d.cts`, `import` types from `.d.ts`.
- `"sideEffects": false` enables tree-shaking for bundlers.
- `"type": "module"` means `.js` files are treated as ESM; CJS output must use `.cjs` extension.
- Run `attw --pack` and `publint` before every publish to catch mismatches.

---

## UUID Generation

**Confidence: HIGH** (verified against MDN and caniuse.com)

Use **`crypto.randomUUID()`** (native Web Crypto API) — no dependency needed.

**Browser support reality check against OBC's targets:**

| Browser | OBC target | `crypto.randomUUID()` support |
|---------|-----------|-------------------------------|
| Chrome | 90+ | ✅ from Chrome 92 |
| Firefox | 88+ | ✅ from Firefox 95 |
| Safari | 14+ | ✅ from Safari 15.4 |

**Chrome 90 and 91, Firefox 88–94, and Safari 14–15.3 do NOT support `crypto.randomUUID()`.**

This is a gap. OBC targets Chrome 90 / Firefox 88 / Safari 14, which are below the `crypto.randomUUID()` baseline. Two options:

1. **Narrow the browser target** to Chrome 92 / Firefox 95 / Safari 15.4 (reasonable in 2026 — these browsers are ~4–5 years old).
2. **Inline a tiny fallback** using `crypto.getRandomValues()` which has full support back to Chrome 37:

```typescript
function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 via getRandomValues
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}
```

**Recommendation:** Use the inline fallback — it adds 3 lines, zero dependencies, and covers the full stated target range. Do not add the `uuid` npm package (extra dependency, supply chain surface).

---

## Build Tool: tsdown Configuration

**Confidence: MEDIUM** (tsdown 0.x, Rolldown in beta — stable for pure-TS, no-CSS libraries)

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'umd'],
  outDir: 'dist',
  target: 'es2020',
  platform: 'browser',
  dts: true,           // emit .d.ts declarations
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [],        // penpal is a runtime dep, bundle it? See note below.
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
```

**Penpal bundling decision:** Because OBC is a library, `penpal` should be listed in `dependencies` (not bundled) for ESM/CJS builds so consumers can deduplicate. For the UMD/CDN build, bundle Penpal in so the UMD file is self-contained. tsdown supports per-format config:

```typescript
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    external: ['penpal'],  // don't bundle — host project provides it
  },
  {
    entry: ['src/index.ts'],
    format: ['umd'],
    globalName: 'OpenBuroClient',
    minify: true,
    // penpal NOT in external → bundled into UMD
  },
]);
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tsdown | tsup | tsup is no longer actively maintained (repo shows deprecation notice). Use tsdown unless you hit a tsdown bug. |
| tsdown | Rollup (raw) | Raw Rollup if you need granular plugin control unavailable in tsdown. For a single-entry pure-TS library, tsdown's defaults are sufficient. |
| tsdown | Vite library mode | Vite lib mode is good for component libraries with CSS. OBC has no CSS to bundle; tsdown is simpler. |
| tsdown | microbundle | microbundle is unmaintained (last release 2022). Avoid. |
| Vitest | Jest | Jest requires ESM transform configuration that is still painful in 2026. Vitest is native ESM. No reason to use Jest for a new project. |
| Vitest | node:test | node:test lacks mocking primitives for DOM and PostMessage simulation needed for OBC integration tests. |
| Biome | ESLint + Prettier | Only prefer ESLint if you need framework-specific plugins (react-hooks, etc.). OBC has none. |
| `crypto.randomUUID()` fallback | `uuid` npm package | `uuid` is a valid choice but adds a dependency. The 3-line inline fallback is preferable for a library. |
| Penpal v7 | Comlink | Comlink is more abstract and does not expose iframe lifecycle control (`destroy()`). OBC needs explicit teardown. |
| Penpal v7 | post-robot | post-robot is less maintained and heavier. Penpal is the right call (already decided in spec). |
| Shadow DOM for modal | Scoped CSS classes (`.obc-*`) | Shadow DOM provides stronger host-CSS isolation. Use scoped classes only as a fallback for very old browsers that don't support Shadow DOM (all OBC targets do). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| tsup | Officially deprecated in its own README; points to tsdown | tsdown |
| microbundle | Last release 2022, unmaintained | tsdown |
| Jest | ESM support painful, slow, legacy | Vitest 4 |
| ESLint + Prettier separately | Two tools, 127+ deps, slow | Biome |
| `uuid` npm package | Unnecessary dependency for a library that can inline 3 lines | `crypto.randomUUID()` + `getRandomValues` fallback |
| `window.postMessage` directly | Security and protocol complexity — reinventing Penpal | Penpal v7 |
| Penpal v6 API (`connectToChild`) | Breaking change in v7 — connectToChild no longer exists | Penpal v7 `connect` + `WindowMessenger` |
| `outFile` in tsconfig | Removed in TypeScript 6.0 | tsdown handles output concatenation |
| `"target": "ES5"` in tsconfig | Deprecated in TypeScript 6.0 (minimum is ES2015) | `"target": "ES2020"` |
| Webpack | Correct for app bundling, wrong for library bundling (no library-mode simplicity) | tsdown |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| TypeScript 6.0 | tsdown 0.21+ | tsdown supports TS6; confirm `isolatedDeclarations` behavior if enabled |
| Penpal 7.0.6 | Any modern browser | MessagePort-based; requires `iframe.contentWindow` to be accessible (same-origin or CORS-ready) |
| Vitest 4.1 | Vite 8 beta | Vitest 4.1 adds Vite 8 beta support; pin Vite 7.x if you want stability |
| tsdown 0.21 | Node.js 22+ | tsdown now warns on Node < 22.18.0 |
| Biome 2.4 | TypeScript 6 | Full TS6 syntax support confirmed |
| `crypto.randomUUID()` | Chrome 92+, Firefox 95+, Safari 15.4+ | Below these versions, use `getRandomValues` fallback |

---

## Stack Patterns by Variant

**For the ESM/CJS library builds (npm consumers):**
- External: `penpal` — let host project deduplicate
- No minification — let consumer's bundler handle it
- Emit `.d.ts` declarations alongside

**For the UMD build (CDN `<script>` usage):**
- Bundle `penpal` in — self-contained
- Minify — smaller download
- Global name: `OpenBuroClient`
- No `.d.ts` needed for UMD (CDN users don't use TypeScript tooling against it)

**If tsdown hits a bug before the project ships:**
- Fallback to Rollup 4 with `@rollup/plugin-typescript` + `rollup-plugin-dts` — more config but fully stable and supports UMD via the `umd` output option.

---

## Sources

- Penpal v7.0.0 release notes: https://github.com/Aaronius/penpal/releases/tag/v7.0.0 — HIGH confidence for API shape
- Penpal GitHub README (current): https://github.com/Aaronius/penpal — HIGH confidence for v7 usage examples
- Penpal npm (7.0.6 latest): https://www.npmjs.com/package/penpal — version confirmed
- tsup deprecation notice: https://github.com/egoist/tsup — tsup repo README
- tsdown introduction: https://tsdown.dev/guide/ — version 0.21.7, UMD support confirmed
- tsdown GitHub: https://github.com/rolldown/tsdown — Rolldown beta status confirmed
- TypeScript 6.0 announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ — HIGH confidence
- TypeScript 5.x → 6.0 migration guide: https://gist.github.com/privatenumber/3d2e80da28f84ee30b77d53e1693378f — MEDIUM confidence (community guide, cross-checked)
- `crypto.randomUUID()` caniuse: https://caniuse.com/mdn-api_crypto_randomuuid — HIGH confidence, Chrome 92 / Firefox 95 / Safari 15.4 baseline
- Vitest 4.0 announcement: https://vitest.dev/blog/vitest-4 — HIGH confidence, Browser Mode stable
- Biome v2.4: https://biomejs.dev/ — current version 2.4 confirmed
- ESM/CJS exports map pattern: https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing — MEDIUM confidence, cross-checked with TypeScript docs
- `@arethetypeswrong/cli`: https://github.com/arethetypeswrong/arethetypeswrong.github.io — MEDIUM confidence (tool widely referenced in library publishing guides)

---
*Stack research for: @openburo/client — framework-agnostic TypeScript browser library*
*Researched: 2026-04-10*
