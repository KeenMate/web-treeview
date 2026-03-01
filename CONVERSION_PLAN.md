# Conversion Plan: svelte-treeview → web-treeview

## Source Analysis Findings

### Source: `C:/Git/KM/svelte-treeview` branch `feature/core-render-split`

**Key files to port:**
- `src/lib/ltree/ltree.svelte.ts` (1391 lines) — main engine, only Svelte code is `$state(Symbol())` on line 83
- `src/lib/ltree/ltree-node.svelte.ts` (75 lines) — pure TS, no Svelte
- `src/lib/ltree/types.ts` (162 lines) — pure TS
- `src/lib/ltree/flex.ts` (11 lines) — FlexSearch index factory
- `src/lib/ltree/indexer.ts` (235 lines) — only change: import path for logger
- `src/lib/helpers/string-helpers.ts` (3 lines) — pure TS
- `src/lib/helpers/ltree-helpers.ts` (25 lines) — pure TS
- `src/lib/logger.ts` (180 lines) — uses vendored loglevel, categories: LTREE:*
- `src/lib/perf-logger.ts` (226 lines) — uses vendored loglevel

### Vendor files from: `C:/Git/KM/web-multiselect/src/vendor/loglevel/`
- `index.js`, `prefix.js` — ESM wrappers
- `loglevel-esm.js` — core loglevel library (350 lines)
- `loglevel-plugin-prefix-esm.js` — prefix plugin (133 lines)
- `loglevel.js`, `loglevel-plugin-prefix.js` — UMD versions (not used but included)

### Target: `C:/Git/KM/web-treeview` (current repo)
- package.json: zero dependencies, needs `flexsearch`
- tsconfig: `strict: false`, bundler moduleResolution, `allowImportingTsExtensions: true`
- Existing scaffolding: stub WebTreeView class, WebTreeViewElement with Shadow DOM, types with old TreeNode interface

## Conversion Changes

| File | Change needed |
|------|--------------|
| `ltree.svelte.ts` → `ltree.ts` | Line 83: `$state(Symbol())` → plain variable + onChange callback |
| `_emitTreeChanged()` | Add: `if (onChangeCallback) onChangeCallback();` + cache invalidation |
| Import paths | All `.svelte.js` → `.js`, `../logger.js` → `../logger` |
| `types.ts` | Add `onChange` getter/setter to `Ltree<T>`, fix import path |
| `indexer.ts` | Update import paths only |
| `logger.ts` | Keep svelte-treeview's version (LTREE:* categories match this project) |
| `perf-logger.ts` | Direct copy, import paths already match |
| `src/types.ts` | Replace old `TreeNode<T>` with `LTreeNode<T>` re-export |
| `src/treeview.ts` | Replace stub with real `createLTree` wrapper |
| `src/web-component.ts` | Wire to real engine, add new properties |
| `src/index.ts` | Add core LTree exports + logging exports |

## Implementation Order
1. Add flexsearch dependency
2. Copy vendor/loglevel files
3. Create logger.ts and perf-logger.ts
4. Create helpers/ (string-helpers, ltree-helpers)
5. Create ltree/ (ltree-node, types, flex, indexer, ltree)
6. Update src/types.ts
7. Update src/treeview.ts
8. Update src/web-component.ts
9. Update src/index.ts
10. Update vite-env.d.ts / tsconfig if needed
11. Build verification
