# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0-rc02] - 2026-03-02

### Added

- **Virtual scroll rendering mode** — Only renders nodes visible in the viewport plus an overscan buffer. Three-div structure (scroll container, spacer, translateY content wrapper) with RAF-throttled scroll handler. Configurable via `virtualScroll`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight` attributes/properties.
- **Fast synchronous scroll path** — Virtual scroll bypasses the controller's `queueMicrotask` batching pipeline. Scroll events compute the visible window and reconcile DOM synchronously in the RAF callback, skipping drag/drop/context-menu/debug updates for smooth 60fps scrolling.
- **Auto row height measurement** — When no explicit `virtualRowHeight` is set, measures the first rendered node's height as fallback (32px default).
- **Performance test example page** — New `examples-virtual-scroll.html` with flat vs virtual scroll comparison, synthetic data generation, countries+states dataset, timed expand/collapse/update operations, and search with filter/search modes.

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
- **Context Menu** - Right-click context menu with `contextMenuCallback` or custom `contextMenuTemplate`
- **Custom Templates** - Callback-based templates for nodes, empty state, loading, header, footer, context menu, drop placeholder
- **CSS Custom Properties** - Full theming via `--tv-*` and `--ltree-*` variables with `--base-*` fallbacks
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
