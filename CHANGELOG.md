# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
  - Drop positions: `'before'` | `'after'` | `'child'`
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
