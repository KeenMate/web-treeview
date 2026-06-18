# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0-rc03] - unreleased

Catch-up release pulling forward the features `@keenmate/svelte-treeview` shipped from `5.0.0-rc05` through `5.0.0-rc10` so the two packages expose the same surface again. Public API parity is the goal — prop names, method signatures, callback shapes, CSS class names, and event semantics mirror the Svelte side. The CSS variable prefix stays `--tv-*` (matching `--ms-*` / `--drp-*` in the sibling KeenMate components).

### Added
- **`theme` prop / attribute** (`'dark' | 'light' | null`): Per-instance theme override forwarded to the root `.ltree-container` as `data-theme="..."`. The new `_dark-mode.css` partial flips the `--tv-*` color tokens against four signals — OS preference (`@media (prefers-color-scheme: dark)`), framework theme classes (`[data-theme="dark"]`, `[data-bs-theme="dark"]`, `.dark`), per-instance `data-theme` on the container, and symmetric `light` variants so a single tree can force light on a dark page. Default behaviour with `theme=null|undefined` is to inherit from the page. Mirrors `@keenmate/svelte-treeview` rc10's `theme` prop.
- **`getIsExpandedCallback`, `getIsSelectableCallback`, `getIsSelectedCallback`, `getIsDropAllowedCallback` props**: Callback variants for the matching `is*Member` data-field props, matching the same pattern as the existing `getIsDraggableCallback` / `getIsCollapsibleCallback` / `getAllowedDropPositionsCallback`. Seed-only: invoked once per node at `insertArray` / `addNode` time so subsequent user mutations (checkbox clicks, expand button) aren't overridden by the callback. Precedence: callback > member > default. Mirrors `@keenmate/svelte-treeview` rc09–rc10. Also: `getIsDraggableCallback` is now actually applied at seed time (previously the prop existed but didn't run during insert). New `getNodeIsDropAllowed(node)` method on the LTree mirrors the lazy lookup helpers (`getNodeIsDraggable`, `getNodeIsCollapsible`).
- **`accordionExpand` prop / `accordion-expand` attribute** (boolean, default `false`): Per-parent accordion behaviour — expanding a node via the toggle UI automatically collapses any expanded siblings. Respects `isCollapsibleMember` / `getIsCollapsibleCallback` (non-collapsible siblings are not force-collapsed). Programmatic `expandNodes` / `expandAll` are unaffected. Implemented via a new `toggleNodeExpanded(path)` method on the controller / facade; the DOM renderer's toggle-icon click now routes through it. While here, the renderer's toggle now also matches svelte-treeview's gate of blocking the toggle entirely on nodes where `getNodeIsCollapsible(node)` is false. Mirrors `@keenmate/svelte-treeview` rc03.
- **Array variants + option bags on `expandNodes` / `collapseNodes` / `expandAll` / `collapseAll`**: all four now accept `string | string[] | null` instead of a single path. `expandNodes` and `expandAll` take `{ exclusive?: boolean; noEmit?: boolean }`; `collapseNodes` and `collapseAll` take `{ noEmit?: boolean }`. `exclusive` collapses anything off the union-of-spines so downstream listeners (URL sync, virtualised renderers, transition animations) don't see the intermediate fully-collapsed state. `noEmit` skips the change emission so consumers can batch several mutations and emit once at the end via `tree.refresh()`. Single emit per call regardless of array length. Mirrors `@keenmate/svelte-treeview` rc08.

### Changed
- **Three-level selection model (`focusedNode` / `highlightedPaths` / `selectedPaths`)** — biggest behaviour change in rc03. Mirrors svelte-treeview rc06+.
  - **`focusedNode`** (was `selectedNode`): single focused node (click, arrow keys). The web component now dispatches `focused-node-changed` (was `selected-node-changed`) with `detail.focusedNode`. The controller getter / setter is `focusedNode`.
  - **`highlightedPaths`**: multi-select set built by Ctrl/Shift+click and arrow extensions. New methods `highlightNode(path, mode, options)` / `highlightNodes(paths, options)` / `clearHighlight(options)` / `getHighlightedNodes()` / `getHighlightedPaths()` / `isNodeHighlighted(path)`. The web component dispatches `highlight-change` with `detail.highlightedNodes` and `detail.highlightedPaths`.
  - **`selectedPaths`** is now the checkbox / data-state selection set (was: the multi-select set). When `showCheckboxes` is false, every change to `highlightedPaths` is mirrored into `selectedPaths` so consumers reading the form-style selection still reflect what the user picked via the mouse. With checkboxes visible, the two sets stay independent.
  - **`selectionMode` prop** (`'single' | 'multi'`, default `'single'`): in `'single'`, Ctrl/Shift+click degrade to plain click. In `'multi'`, Ctrl+click toggles, Shift+click range-extends.
  - **`showCheckboxes`**, **`clickTogglesCheckbox`** props added (wiring; checkbox UI ports in the next commit).
  - **`onHighlightChange`** callback added.
  - **`{ silent: true }`** option on `highlightNode` / `highlightNodes` / `clearHighlight` / `deselectAll` skips the change callback + mirror. Useful for URL-restore flows where firing the change would re-trigger external sync.
  - **`highlightedNodeClass`** (was `selectedNodeClass`) is the CSS class applied to every node in the highlight set. **`focusedNodeClass`** is new — applied only to the single focused node.
  - **`node.isHighlighted`** added to `LTreeNode` (the existing `node.isSelected` now means "checked", not "selected via mouse").
  - `selectNode` / `selectNodes` are kept as `@deprecated` aliases that forward to `highlightNode` / `highlightNodes`.
- **`.ltree-container` paints its own background**: `background: var(--tv-bg-color)` and `color: var(--tv-text-color)` are now declared directly on `.ltree-container` (previously the surface was inherited from whatever element the consumer wrapped the tree in). Lets the tree render a visible surface without a colored wrapper, and makes the dark-mode flip self-contained. Set `--tv-bg-color: transparent` to restore the pre-rc03 layered behaviour. Mirrors svelte-treeview rc10's `--ltree-bg`.

### Fixed
- **`isSelectedMember` / `getIsSelectedCallback` now actually seed `selectedPaths`**: the previous rc02 code applied the value (via the buggy routing — see below) to `node.isSelectable`, never to `node.isSelected`, and the controller never walked the tree post-`insertArray` to populate the `_selectedPaths` Set. Selecting nodes via the initial data field was therefore a no-op. The new `_seedSelectedPathsFromTree()` walk runs after every `insertArray` (constructor, `data` setter, and tree recreation) and adds every path where `node.isSelected` is truthy. Consumers reading `getSelectedPaths()` / `getSelectedNodes()` immediately reflect server-side initial selection. Mirrors svelte-treeview rc07.
- **`isSelectedMember` was being routed into the `isSelectableMember` factory slot**: In `mapToControllerConfig` the line `isSelectedMember: options.isSelectedMember ?? options.isSelectableMember` and the matching positional call to `createLTree` plumbed `isSelectedMember` into `_isSelectableMember`, so the value documented as marking nodes as initially-selected was actually flipping their `isSelectable` flag (and the real `isSelectable` couldn't take effect). The factory signature and the wiring are now distinct. While here, the controller's `createLTree` call passes the new `is*Member` / `getIs*Callback` props explicitly (parallel to `getIsDraggableCallback`) and `updateProps` recreates the tree when any of them changes.

---

## [2.0.0-rc02] - 2026-03-15 (unpublished)

### Added

#### Multi-Select
- **Ctrl+click** toggles individual nodes in/out of selection
- **Shift+click** range-selects between the last selected node and the clicked node
- Plain click replaces selection with a single node (backward-compatible)
- `rangeSelectionMode` config: `'visual'` (uses visible flat nodes, default) or `'logical'` (walks full tree)
- `selectNode(path, modifiers?)`, `selectNodes(paths)`, `deselectAll()`, `selectAll()` API methods
- `getSelectedNodes()`, `getSelectedPaths()`, `isNodeSelected(path)` query methods
- `onSelectionChange` callback and `selection-change` CustomEvent
- `range-selection-mode` HTML attribute on `<web-treeview>`
- `selectedPaths: Set<string>` in `TreeControllerSnapshot` for renderer access

#### Clipboard (Copy/Cut/Paste)
- Module-level clipboard singleton (`src/clipboard.ts`) enabling cross-tree copy/paste
- `copyNodes(paths?)`, `cutNodes(paths?)`, `pasteNodes(targetPath, transformData?, position?)` API methods
- `cancelCut()`, `hasClipboardContent()`, `getClipboardOperation()` helpers
- Cut nodes rendered with `.ltree-cut` class (dimmed via `--tv-cut-opacity: 0.4`, italic)
- Deep clone of node data and descendants with relative path preservation
- Cut+paste removes source nodes after successful paste

#### Keyboard Navigation
- Tree body gains focus on click (`tabindex="0"`)
- **Arrow Down/Up** — navigate to next/previous visible node at the same level (crosses parent boundaries)
- **Arrow Right** — expand and move to first child
- **Arrow Left** — move to parent node
- **Backspace** — collapse parent and move to it
- **Enter/Space** — toggle expand/collapse on current node
- **Home/End** — jump to first/last visible node
- **Ctrl+A** — select all visible nodes
- **Ctrl+C/X/V** — copy/cut/paste selected nodes
- **Escape** — cancel cut or deselect all
- Full navigation API: `navTo`, `navNext`, `navPrev`, `navInto`, `navOut`, `navBackOut`, `navToggle`, `navFirst`, `navLast`, `navNextSibling`, `navPrevSibling`
- `TreeNavigation<T>` and `TreeNavigationOverrides<T>` interfaces (`src/navigation.ts`)

#### Bulk Operations (LTree)
- `insertBranch(parentPath, data[])` — insert multiple children under a parent in one operation
- `replaceBranch(parentPath, data[])` — remove all children then insert new data
- `deleteBranch(path, keepParent?)` — remove a node and all descendants (optionally keep the parent)
- Single `_emitTreeChanged()` per bulk operation for efficient rendering
- Proxied through TreeController, WebTreeView facade, and WebTreeViewElement

#### Examples
- `examples-multiselect.html` — interactive demos: multi-select, keyboard navigation, cross-tree clipboard, bulk operations, range selection mode, clickBehavior setting (persisted to localStorage)

### Changed
- **`clickBehavior`** replaces `shouldToggleOnNodeClick` — new `ClickBehavior` type: `'select'` | `'expand'` | `'expand-and-focus'` (default)
  - `'expand-and-focus'`: single click selects + expands (same as old `shouldToggleOnNodeClick: true`)
  - `'select'`: single click selects only, double-click expands/collapses
  - `'expand'`: single click expands/collapses only, no selection
- `NodeCallbacks.onNodeClicked` signature extended with optional `SelectionModifiers` parameter
- `TreeControllerSnapshot` now includes `selectedPaths` and `cutPaths` sets
- DomRenderer click handler respects `clickBehavior` and skips toggle when Ctrl or Shift is held
- `.ltree-selected-border` uses `outline` instead of `border`+`padding` to prevent layout shift on selected nodes
- **Context menu `offset` middleware reduced from `4` to `0`**: The root menu's top-left now lands exactly at `(cursor.x + contextMenuXOffset, cursor.y + contextMenuYOffset)` with no implicit 4px vertical gap. Restores the pre-Floating UI positioning so consumers' `xOffset` / `yOffset` props are honored pixel-exactly. Submenu positioning is unchanged.
- **`scrollToPath` retries the DOM lookup across rAF frames before giving up**: With `useFlatRendering` + `progressiveRender` (the default), `expandNodes` reveals new rows in rAF-deferred batches sized `initialBatchSize` (default 20) and doubling. Previously, `scrollToPath` queried the DOM after one microtask flush — only the immediate batch was rendered, so any target row past that batch produced a `console.warn("DOM element not found")` and the function returned `false` without scrolling or highlighting. Now retries for up to ~6 additional frames before giving up. Same fix as `@keenmate/svelte-treeview` rc-next.

### Removed
- `shouldToggleOnNodeClick` property/attribute — replaced by `clickBehavior`

---

## [2.0.0-rc01] - 2026-03-08

Complete rewrite as a framework-agnostic web component. The rendering engine, controller layer, and LTree core have been ported from `@keenmate/svelte-treeview` v4.0.0 to vanilla TypeScript with minimal runtime dependencies (`@floating-ui/dom` for context menu positioning, `flexsearch` for full-text indexing).

### Added

#### Core

- **Web Component** — `<web-treeview>` custom element with Shadow DOM, attribute/property binding, and SSR-safe base class
- **LTree Core Engine** — Hierarchical path-based tree data structure (`createLTree`) ported from svelte-treeview
  - Materialized path model (`1`, `1.1`, `1.1.2`) with configurable separator
  - Automatic parent path, level, and `hasChildren` calculation from paths
  - `insertArray`, `moveNode`, `removeNode`, `addNode`, `updateNode`, `applyChanges` mutations
  - `visibleFlatNodes` computed from expand/collapse and filter state
  - Full-text search indexing via FlexSearch with async batch indexing
  - `filterNodes` / `searchNodes` for tree filtering and search
  - `expandAll` / `collapseAll` / `expandNodes` / `collapseNodes`
  - `scrollToPath` with expand-ancestors, highlight, and smooth scroll options
- **TreeController** — Stateful controller managing tree logic, drag-and-drop, context menu, and progressive rendering
  - Ported from Svelte 5 runes (`$state`, `$derived`, `$effect`) to vanilla TS with `queueMicrotask` batching
  - Typed `EventEmitter` with `state-change`, `config-change`, `data-change` events
  - Snapshot pattern: controller emits frozen state snapshots, renderer never mutates controller
- **Pluggable Renderer Architecture** — `TreeViewRenderer<T>` interface for framework-specific renderers
  - `DomRenderer` — Default flat-mode DOM renderer with event delegation and keyed reconciliation
  - `setRenderer()` on `WebTreeView` to swap renderers at runtime without losing tree state
  - `RenderCoordinator` for progressive rendering with `requestAnimationFrame` batching
- **Batched Property Updates** — Web component property setters use `queueMicrotask` to coalesce multiple sync changes into a single update
- **Global API** — `window.components['web-treeview'].version()`, `.config`, `.register()`, `.getInstances()`
- **DOM Events** — Web component dispatches proper CustomEvents with `composed: true` to cross shadow DOM boundary: `node-clicked`, `selected-node-changed`, `node-drop`, `tree-changed`

#### Rendering

- **Two rendering modes** —
  - **Flat rendering** (`useFlatRendering`, default `true`) — single DOM list with `paddingLeft` indentation
  - **Virtual scroll** (`virtualScroll`, default `false`) — only renders rows visible in the viewport, suitable for 100k+ node trees. Configurable via `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight`.
- **Progressive rendering** — `requestAnimationFrame`-batched rendering for smooth initial load of large trees
- **Full-width clickable node rows** — Entire node row is clickable including indent zone, with uniform hover highlight
- **Node row layout** — Each row is `[toggle/icon column] [content]` with unified `--tv-column-width` (24px) controlling toggle, icon, and indent step
- **Per-node icons** — `iconMember` (data field) and `iconCallback` (dynamic function) for assigning icons to individual nodes. `alignNodeIcons` reserves column width for alignment.
- **Custom render callbacks** — `renderNodeCallback`, `renderEmptyStateCallback`, `renderEmptyZoneCallback`, `renderLoadingCallback`, `renderHeaderCallback`, `renderFooterCallback`, `renderContextMenuCallback`

#### Drag and Drop

- **Full DnD support** ported from svelte-treeview
  - `dragDropMode`: `'none'` | `'cross'` | `'both'`
  - Drop zone modes: `'glow'` (CSS highlight) and `'floating'` (positioned drop targets)
  - Drop zone layouts: `'around'` | `'above'` | `'below'` | `'wave'` | `'wave2'`
  - Drop positions: `'above'` | `'below'` | `'child'`
  - Configurable `dropZoneStart` threshold for child zone
  - Per-node `allowedDropPositionsMember` for restricted drop positions
  - Copy operations with `allowCopy` / `autoHandleCopy`
  - `beforeDropCallback` for validation/interception
  - Touch drag support with ghost element
  - Cross-tree drag detection via shared global state
- **Empty state vs empty zone** — `renderEmptyStateCallback` for informational "no data" display; `renderEmptyZoneCallback` for drop target in empty trees during drag

#### Context Menu

- **Multi-level context menu with Floating UI** — Viewport-aware positioning (flip, shift, offset). `ContextMenuItem` supports `children` for nested submenus at any depth. Submenus open on hover with a 150ms delay.
- **Unified ContextMenuItem interface** — Aligned types across `web-treeview`, `svelte-treeview`, and `canvas-tree`:
  - `ContextMenuEntry = ContextMenuItem | ContextMenuDivider` — discriminated union
  - `ContextMenuDivider` — `{ divider: true, label?: string }`. Named dividers render as `──── LABEL ────` (uppercase, letter-spaced).
  - `ContextMenuItem` fields: `label`, `id`, `icon`, `shortcut`, `isDisabled`, `isVisible`, `className`, `onclick`, `children`
- **Keyboard shortcuts** — `ContextMenuItem.shortcut` displays shortcut text and registers a `keydown` listener when menu is open. Escape closes the menu.
- **`renderContextMenuItemCallback`** — Per-item render callback with "fill or fall through" pattern for mixing custom and default items.
- **`contextMenuXOffset` / `contextMenuYOffset`** — Numeric offsets (px) applied via Floating UI `offset()` middleware.
- **`shouldDisplayContextMenuInDebugMode`** — Keeps context menu permanently open for debugging (ignores outside click and scroll).
- **Icon column alignment** — When any item in a menu level has an icon, all items reserve the icon column for label alignment.
- **19 scoped CSS variables** — `--tv-context-menu-*` variables for fully independent menu styling (bg, border, shadow, padding, font size, icon width, danger color, divider, disabled opacity).

#### CSS & Theming

- **Full CSS custom properties system** — All values flow from `--base-*` design system tokens through `--tv-*` component tokens with hardcoded fallbacks
- **`--base-*` variable alignment** — Uses canonical names from `@keenmate/theme-designer` (`--base-text-color-1`, `--base-text-color-3`, `--base-main-bg`, `--base-elevated-bg`)
- **90+ CSS variables** across 13 categories: colors, node states, typography, spacing, border radius, transitions, DnD glow indicators, DnD state colors, context menu, loading, empty zone, z-index layers
- **`customStylesCallback`** — Injects `<style>` into Shadow DOM for theme overrides
- **`component-variables.manifest.json`** — Machine-readable manifest of all base and component variables for `@keenmate/theme-designer`
- **`--tv-tree-min-height`** — Controls min-height for empty and loading states

#### Logging

- **Categorized Logging** — Runtime-configurable logging with categories: `TREEVIEW:INIT`, `TREEVIEW:DATA`, `TREEVIEW:INDEX`, `TREEVIEW:UI`, `TREEVIEW:DRAG`, `TREEVIEW:RENDER`
- **Performance Logging** — `enablePerfLogging()`, `setPerfThreshold()` for operation timing

#### Examples

- 8+ interactive example pages: basic usage, drag-drop, templates/context menus, programmatic API, logging, theming, icons grid, performance
- Example 3b: Node-aware context menu with `renderContextMenuItemCallback`, custom avatar/chip rendering, CSS variable config panel
- Live theme editor with `customStylesCallback` injection

### Changed

- **Architecture** — From monolithic web component to three-layer architecture:
  1. `WebTreeViewElement` (web component) — attribute/property binding, Shadow DOM
  2. `WebTreeView` (facade) — thin wrapper coordinating controller + renderer
  3. `TreeController` + `TreeViewRenderer` — decoupled state and rendering
- **Member Mapping Defaults** — Only `idMember` (`'id'`), `pathMember` (`'path'`), and `displayValueMember` (`'displayValue'`) have defaults. All other optional members are left `undefined` so LTree auto-calculates them from path structure.
- **`background-color:` → `background:`** — Themed surfaces use the `background` shorthand, allowing gradients or images through variables
- **Context menu offset handling** — Moved from controller (baked into raw coordinates) to renderer (applied as Floating UI `offset()` middleware)

### Removed

- **Svelte dependency** — No framework dependencies; pure vanilla TypeScript
- **Nested DOM rendering** — Replaced by flat rendering with CSS indentation for better performance at scale
