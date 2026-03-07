# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0-rc05] - 2026-03-06

### Added

- **Per-node icons** — Two new ways to assign icons to individual nodes:
  - `iconMember` (attribute: `icon-member`) — data field name containing CSS class(es) for the node icon
  - `iconCallback` (JS only) — function `(node) => string | null` for dynamic icon resolution; takes priority over `iconMember`
- **`alignNodeIcons`** (attribute: `align-node-icons`, default `true`) — reserves icon column width even for nodes without icons, keeping labels aligned across the tree.
- **Unified column grid** — `--tv-column-width` (default 24px) is a single variable controlling the toggle column, per-node icon column, and indent step. `--tv-indent-size` and `--tv-toggle-size` now alias `--tv-column-width`, so adjusting one value keeps the entire grid aligned.
- **`examples-icons-grid.html`** — New example page demonstrating column alignment, `iconMember`, `iconCallback`, mixed icons, icons + `renderNodeCallback`, and icons + drag-and-drop.
- **Multi-level context menu with Floating UI** — Context menus now use `@floating-ui/dom` for viewport-aware positioning (flip, shift, offset). `ContextMenuItem` supports `children` for nested submenus at any depth. Submenus open on hover with a 150ms delay and position to the right (or left if no space). Added runtime dependency: `@floating-ui/dom` (~3KB gzipped).
- **Rendering modes documented** — The `DomRenderer` supports two rendering modes:
  - **Flat rendering** (`useFlatRendering`, default `true`) — single DOM list with `paddingLeft` indentation
  - **Virtual scroll** (`virtualScroll`, default `false`) — only renders rows visible in the viewport, suitable for 100k+ node trees. Configurable via `virtualRowHeight`, `virtualOverscan`, and `virtualContainerHeight`.

### Changed

- **`examples-virtual-scroll.html` → `examples-performance.html`** — Renamed to better reflect its purpose as a performance comparison page.
- **`*Template` → `render*Callback`** — All template properties renamed to follow the `render*Callback` convention from `web-daterangepicker`. Migration: `nodeTemplate` → `renderNodeCallback`, `emptyTemplate` → `renderEmptyZoneCallback`, `loadingTemplate` → `renderLoadingCallback`, `headerTemplate` → `renderHeaderCallback`, `footerTemplate` → `renderFooterCallback`, `contextMenuTemplate` → `renderContextMenuCallback`, `dropPlaceholderTemplate` → `renderDropPlaceholderCallback`.

- **Full-width clickable node rows** — Clicking anywhere on a node row (including the indent/padding zone left of the toggle icon) now triggers node selection and `node-clicked` event. Previously only clicks on `.ltree-node-content` or `.ltree-toggle-icon` were handled. Right-click in the indent zone also triggers `node-right-clicked`.
- **Selected state applied to `.ltree-node`** — The `selectedNodeClass` (e.g. `ltree-selected-border`) is now applied to the `.ltree-node` element instead of `.ltree-node-content`, so selected background/border covers the full row width including the indent zone.
- **Pointer cursor on full row** — `.ltree-node` now has `cursor: pointer` so the entire row (including indent zone) shows a hand cursor on hover.
- **Node row layout** — Each row is `[toggle/icon column] [content]`. The toggle/icon column is a fixed-width slot (`--tv-column-width`) that shows toggle arrows for parent nodes and per-node icons (or `leafIconClass`) for leaf nodes.

### Fixed

- **Removed debug backgrounds** — Removed leftover debug background colors (blue on `.ltree-toggle-icon`, green on `.ltree-node-content`) from `examples-icons-grid.html`.

## [2.0.0-rc04] - 2026-03-05

### Added

- **Semantic node state variables** — New `--tv-node-bg-hover` and `--tv-node-bg-active` variables (alias `--tv-hover-bg` / `--tv-active-bg`) following the DRP `--drp-day-bg-hover` naming pattern. Node `:hover` now uses `--tv-node-bg-hover` instead of `--tv-light-bg`.
- **Node `:active` state** — Added `.ltree-node-content:active` rule using `--tv-node-bg-active` for press feedback.
- **`--tv-node-transition`** — Dedicated variable for node hover/active transition. Set to `none` to disable animation without affecting other transitions.
- **Border shorthands** — `--tv-border` (full border), `--tv-border-width-base`, `--tv-selected-border` (selected node border).
- **Context menu hover variables** — `--tv-context-menu-bg-hover` and `--tv-context-menu-danger-bg-hover` extracted from hardcoded values.
- **DnD state variables** — All inline `color-mix()` / `rgba()` values extracted into variables: `--tv-drag-over-bg`, `--tv-drag-over-border`, `--tv-drag-over-glow-shadow`, `--tv-drop-valid-bg`, `--tv-drop-valid-border-color`, `--tv-drop-invalid-bg`, `--tv-drop-invalid-border-color`, `--tv-dragover-highlight-bg`, `--tv-dragover-highlight-border`, `--tv-touch-ghost-bg`, `--tv-touch-ghost-shadow`, `--tv-scroll-highlight-bg`, `--tv-scroll-highlight-shadow`.
- **Drop zone active state variables** — `--tv-glow-{above,below,child}-bg-active`, `--tv-glow-{above,below,child}-color-active`, `--tv-glow-{above,below,child}-shadow`, `--tv-glow-{above,below,child}-text` (12 variables total) extracted from hardcoded `rgba()` values in `_tree.css`.
- **Live Theme Editor: transition slider** — Range input (0–500ms) for `--tv-node-transition` in the theming example page. Setting to 0 outputs `none`.
- **README: CSS Custom Properties Reference** — Full variable reference with 13 categorized tables covering all 90+ variables.

### Changed

- **`background-color:` → `background:`** — Themed surfaces in `_tree.css` now use the `background` shorthand, allowing theme authors to pass gradients or images through variables. Affected: node hover, selected border, dragover highlight/glow, drag-over, drop-valid/invalid, drop placeholder, touch ghost, scroll highlight, context menu hover.
- **`transition: background-color` → `transition: background`** — Node content transition updated to match the `background` shorthand change.
- **`component-variables.manifest.json`** — Added 31 new variable entries. Updated `base-elevated-bg` usage to "Elevated surface background (debug stats badges)" and `base-hover-bg` usage to "Node hover background, context menu item hover".

## [2.0.0-rc03] - 2026-03-05

### Breaking — CSS variable renames (theme-designer alignment)

All `--base-*` variable references in `_variables.css` have been renamed to match the canonical names generated by `@keenmate/theme-designer`. If you were setting these variables directly, update your CSS:

| Old name | New name |
|---|---|
| `--base-text-color` | `--base-text-color-1` |
| `--base-text-color-2` | `--base-text-color-3` |
| `--base-bg-color` | `--base-main-bg` |
| `--base-light-bg` | `--base-elevated-bg` |

Component-level `--tv-*` variable names are unchanged.

### Added

- **`customStylesCallback`** — New property on `<web-treeview>` that injects a `<style>` element into the Shadow DOM, matching the `web-daterangepicker` pattern. Accepts a function returning a CSS string. Setting the callback replaces any previously injected stylesheet. Useful for injecting `--base-*` overrides, custom node classes, or `@import` rules into the shadow root.
- **`component-variables.manifest.json`** — Machine-readable manifest describing all `--base-*` variables consumed (20 entries with required flags and usage descriptions) and all `--tv-*` component variables (58 entries organized by category). Exported from `package.json` for use by `@keenmate/theme-designer`.
- **Theme-designer integration** — Registered `web-treeview` (prefix `tv`) in `@keenmate/theme-designer`: added generator (`generators/treeview.ts`), component prefix, and type definition.

### Changed

- **`_variables.css` documentation** — Added header comment block with usage examples, priority chain docs (`--tv-* → --base-* → fallback`), full `--base-*` manifest, `===` section dividers, and `/* Npx */` pixel comments on all `calc()` values. Added `:root` alongside `:host` for non-web-component usage.
- **Live Theme Editor** — Now uses `customStylesCallback` to inject `:host { --base-*: ... }` directly into the Shadow DOM instead of setting inline styles on the host element. Listens for both `input` and `change` events on color pickers.

### Fixed

- **Live Theme Editor did nothing** — Setting `--tv-*` or `--base-*` CSS variables via inline style on the `<web-treeview>` host element did not override `:host` declarations inside the Shadow DOM. The editor now injects styles directly into the shadow root via `customStylesCallback`.

## [2.0.0-rc02] - 2026-03-04

### Changed

- **CSS design system alignment** — Replaced all `--ltree-*` Bootstrap-style variables and hardcoded values in `_tree.css` with `--tv-*` tokens that reference `--base-*` design system tokens with hardcoded fallbacks. Same pattern as `web-multiselect`. Removed the `:root` block and 4 duplicate `font-family` declarations from `_tree.css`.
- **Expanded `_variables.css` token system** — From 26 lines / 8 `--base-*` references to 93 lines with full coverage: colors (accent, success, danger, light-bg), typography scale (xs/sm/base + weights), border-radius scale (sm/md/lg), spacing scale (xs–xl), transitions, DnD glow colors, context menu, loading/spinner, drop placeholder, z-index layers, and misc tokens. All values flow from `--base-*` with hardcoded fallbacks.
- **`rgba()` to `color-mix()`** — Replaced `rgba(var(--ltree-*-rgb), X)` patterns with modern `color-mix(in srgb, var(--tv-*) X%, transparent)` for opacity variants.
- **Font family inheritance** — Single `font-family` declaration in `_variables.css` via `var(--tv-font-family, var(--base-font-family, inherit))`. Removed from `_base.css` and all 4 instances in `_tree.css`.

### Added

- **Theming example page** — Rewrote `examples-theming.html` with 8 theme cards (Default, Dark Mode, Neon/Cyberpunk, Audi Corporate, Rounded/Soft, Sharp/Minimal, Material Design, Glassmorphism), live theme editor with color pickers, and CSS variables reference. All themes use `--base-*` for design system integration, matching `web-multiselect`'s theming pattern.

### Added

- **Virtual scroll rendering mode** — Only renders nodes visible in the viewport plus an overscan buffer. Three-div structure (scroll container, spacer, translateY content wrapper) with RAF-throttled scroll handler. Configurable via `virtualScroll`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight` attributes/properties.
- **Fast synchronous scroll path** — Virtual scroll bypasses the controller's `queueMicrotask` batching pipeline. Scroll events compute the visible window and reconcile DOM synchronously in the RAF callback, skipping drag/drop/context-menu/debug updates for smooth 60fps scrolling.
- **Auto row height measurement** — When no explicit `virtualRowHeight` is set, measures the first rendered node's height as fallback (32px default).
- **Performance test example page** — New `examples-performance.html` with flat vs virtual scroll comparison, synthetic data generation, countries+states dataset, timed expand/collapse/update operations, and search with filter/search modes.

### Fixed

- **Scrollbar slowly shrinking during filter** — Progressive rendering batches were running alongside virtual scroll, firing `_scheduleNotify()` on each batch and causing heavy rebuilds. Virtual scroll now bypasses progressive rendering entirely and cancels pending batches.
- **Spurious tree rebuild from indexer completion** — FlexSearch indexer's completion callback was calling `_emitTreeChanged()`, triggering a full state-change + reconciliation even though indexing doesn't affect visible tree structure.
- **`scrollToPath` race condition in virtual scroll** — Rapid `scrollToPath` calls (e.g. holding Enter in search) would race each other due to async 2xRAF waits. Now uses synchronous `_flushNotify()` so the renderer reconciles the target node into the DOM before querying for it.
- **Stale scroll cache after state changes** — `_performScrollUpdate` could incorrectly early-exit after filter/expand/collapse because the cached start/end indices were stale. Now reset on every `_onStateChange`.

### Fixed

- **Floating drop zones not reactive** — Zones were destroyed and recreated on every state change (~60ms), preventing cursor from ever landing on a stable zone element. Now zones are reused when the hovered path hasn't changed, with only position coordinates updated for scroll tracking.
- **Drop zone hover clearing on zone transition** — When cursor moved from node content to a floating drop zone, the `dragleave` event would clear hover state and destroy the zones. Added guard to detect when `relatedTarget` is inside a drop zone container.
- **Drop position ignored without `orderMember`** — `moveNode` and `copyNodeWithDescendants` both relied on `orderMember` for above/below positioning. Without it, `refreshSiblings` sorted alphabetically, ignoring the requested position entirely. Now manually positions nodes in the `children` object when no `orderMember` is set.
- **Glow mode child threshold ignoring `dropZoneStart`** — `calculateDropPositionFromEvent` used a hardcoded `width / 2` threshold for the child zone. Now uses the configurable `dropZoneStart` value (matching svelte-treeview behavior).

### Added

- **Restricted Drop Positions example** — New "Restricted Drop Positions" section in the drag-drop example page demonstrating `allowedDropPositionsMember` with per-node drop position restrictions (child-only, above/below-only, all positions).
- **Zone Start control always visible** — The "Zone Start" setting in the drag-drop example control panel is now visible for both glow and floating modes, since it affects the child zone threshold in glow mode too.

## [2.0.0-rc01] - RC - 2026-03-01

Complete rewrite as a framework-agnostic web component. The rendering engine, controller layer, and LTree core have been ported from `@keenmate/svelte-treeview` v4.0.0 to vanilla TypeScript with zero runtime dependencies (except FlexSearch for full-text indexing).

### Added

- **Web Component** - `<web-treeview>` custom element with Shadow DOM, attribute/property binding, and SSR-safe base class
- **LTree Core Engine** - Hierarchical path-based tree data structure (`createLTree`) ported from svelte-treeview
  - Materialized path model (`1`, `1.1`, `1.1.2`) with configurable separator
  - Automatic parent path, level, and `hasChildren` calculation from paths
  - `insertArray`, `moveNode`, `removeNode`, `addNode`, `updateNode`, `applyChanges` mutations
  - `visibleFlatNodes` computed from expand/collapse and filter state
  - Full-text search indexing via FlexSearch with async batch indexing
  - `filterNodes` / `searchNodes` for tree filtering and search
  - `expandAll` / `collapseAll` / `expandNodes` / `collapseNodes`
  - `scrollToPath` with expand-ancestors, highlight, and smooth scroll options
- **TreeController** - Stateful controller managing tree logic, drag-and-drop, context menu, and progressive rendering
  - Ported from Svelte 5 runes (`$state`, `$derived`, `$effect`) to vanilla TS with `queueMicrotask` batching
  - Typed `EventEmitter` with `state-change`, `config-change`, `data-change` events
  - Snapshot pattern: controller emits frozen state snapshots, renderer never mutates controller
- **Pluggable Renderer Architecture** - `TreeViewRenderer<T>` interface for framework-specific renderers
  - `DomRenderer` - Default flat-mode DOM renderer with event delegation and keyed reconciliation
  - `setRenderer()` on `WebTreeView` to swap renderers at runtime without losing tree state
  - `RenderCoordinator` for progressive rendering with `requestAnimationFrame` batching
- **Drag and Drop** - Full DnD support ported from svelte-treeview
  - `dragDropMode`: `'none'` | `'cross'` | `'both'`
  - Drop zone modes: `'glow'` (CSS highlight) and `'floating'` (positioned drop targets)
  - Drop positions: `'above'` | `'below'` | `'child'`
  - Copy operations with `allowCopy` / `autoHandleCopy`
  - `beforeDropCallback` for validation/interception
  - Touch drag support with ghost element
  - Cross-tree drag detection via shared global state
- **Context Menu** - Right-click context menu with `contextMenuCallback` or custom `renderContextMenuCallback`
- **Custom Templates** - Callback-based templates for nodes, empty state, loading, header, footer, context menu, drop placeholder
- **CSS Custom Properties** - Full theming via `--tv-*` variables with `--base-*` design system fallbacks
- **Categorized Logging** - Runtime-configurable logging with `loglevel`
  - Categories: `TREEVIEW:INIT`, `TREEVIEW:DATA`, `TREEVIEW:INDEX`, `TREEVIEW:UI`, `TREEVIEW:DRAG`, `TREEVIEW:RENDER`
  - Color-coded console output with timestamps
  - `enableLogging()`, `disableLogging()`, `setLogLevel()`, `setCategoryLevel()`
- **Performance Logging** - `enablePerfLogging()`, `setPerfThreshold()` for operation timing
- **Batched Property Updates** - Web component property setters use `queueMicrotask` to coalesce multiple sync changes into a single update
- **Global API** - `window.components['web-treeview'].version()`, `.config`, `.register()`, `.getInstances()`
- **Example Pages** - 8 interactive example pages: basic usage, drag-drop, templates, programmatic API, logging, theming
- **DOM Events** - Web component dispatches proper CustomEvents with `composed: true` to cross shadow DOM boundary
  - `node-clicked` with `{ node }` detail
  - `selected-node-changed` with `{ selectedNode }` detail
  - `node-drop` with `{ node, draggedNode, position, event, operation }` detail
  - `tree-changed` on every state change

### Changed

- **Architecture** - From monolithic web component to three-layer architecture:
  1. `WebTreeViewElement` (web component) - attribute/property binding, Shadow DOM
  2. `WebTreeView` (facade) - thin wrapper coordinating controller + renderer
  3. `TreeController` + `TreeViewRenderer` - decoupled state and rendering
- **Member Mapping Defaults** - Only `idMember` (`'id'`), `pathMember` (`'path'`), and `displayValueMember` (`'displayValue'`) have defaults. All other optional members (`parentPathMember`, `levelMember`, `hasChildrenMember`, `isExpandedMember`, etc.) are left `undefined` so LTree auto-calculates them from the path structure

### Removed

- **Svelte dependency** - No framework dependencies; pure vanilla TypeScript
- **Nested DOM rendering** - Replaced by flat rendering with CSS indentation for better performance at scale
