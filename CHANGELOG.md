# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0-rc05] - 2026-06-19

### Changed (BlissFramework `/validate-web-component` cleanup — breaking)

Three batches of fixes landed against the `validation_2026-06-19_1918.md` punch-list. The RC cycle is still active so these are clean breaking renames — no deprecation aliases.

- **Theming migration to Strategy B (`color-scheme` flipping + `light-dark()`)**. The four dark-mode-signal blocks in `_dark-mode.css` (~100 lines of `--wtv-*` variable redeclarations) collapse to a single `color-scheme: dark` / `color-scheme: light` declaration on the same signal selectors (~50 lines). Every color fallback in `variables.css` now uses `light-dark(<light>, <dark>)` and the variables flip automatically based on the inherited `color-scheme`. `:root` selector dropped from `variables.css` (the rc09 subtree-theming bug: a consumer wrapping `<web-treeview>` in `<div style="--base-accent-color: red">` couldn't override anything because variables were resolved at `:root`). Hover / active / selected switched to `color-mix` chains so highlights stay visible at any base luminance. `--wtv-context-menu-bg` now chains through `--base-dropdown-bg` → `--base-elevated-bg`. Per-instance `:host([data-theme])` selectors added alongside the existing `.wtv__container[data-theme]` so consumers using `<web-treeview data-theme="dark">` get a flip without needing the JS-prop forwarder.
- **CSS structure cleanup**. The duplicate non-BEM `.web-treeview` class added in `render()` is gone (the BEM `.wtv__container` already lived on the same element; layout properties moved there). `main.css` now declares `@layer variables, component, overrides;` and wraps every `@import` in `layer(...)` so consumers can override component rules from outside the shadow root without specificity wars or `!important`. The four CSS files lost their SASS-partial `_` prefix (`_variables.css` → `variables.css`, etc.) — they're plain CSS modules, not partials. The 17 section markers in `tree.css` upgraded from box-drawing-char `── Section ──` to the canonical `==== SECTION ====` banner format.
- **Public API rename (every `on*` event handler → `*Callback`; boolean prefixes per `naming-conventions.md`)**. The web-component config now follows the `*Callback` convention universally (`on*` is the Svelte idiom — kept inside the internal renderer→controller `NodeCallbacks` bridge, but removed from every consumer-facing surface):
  - `onNodeClicked` → `nodeClickedCallback`
  - `onNodeDragStart` → `nodeDragStartCallback`
  - `onNodeDragOver` → `nodeDragOverCallback`
  - `onNodeDrop` → `nodeDropCallback`
  - `onSelectionChange` → `selectionChangeCallback`
  - `onHighlightChange` → `highlightChangeCallback`
  - `onRenderStart` → `renderStartCallback`
  - `onRenderProgress` → `renderProgressCallback`
  - `onRenderComplete` → `renderCompleteCallback`

  Boolean Config props now follow the `is*` / `should*` rule:
  - `accordionExpand` → `isAccordionExpand`
  - `progressiveRender` → `isProgressiveRender`
  - `useFlatRendering` → `isFlatRenderingEnabled`
  - `virtualScroll` → `isVirtualScrollEnabled`
  - `alignNodeIcons` → `shouldAlignNodeIcons`
  - `allowCopy` → `isCopyAllowed`
  - `autoHandleCopy` → `shouldAutoHandleCopy`
  - `autoHandleMove` → `shouldAutoHandleMove`
  - `showCheckboxes` → `shouldShowCheckboxes`
  - `clickTogglesCheckbox` → `shouldClickToggleCheckbox`

  HTML attribute names stay unchanged (`show-checkboxes`, `allow-copy`, `accordion-expand`, `virtual-scroll`, etc.) — they're already short and readable; the renames apply only to the JS property / config surface. The `ATTRIBUTE_TABLE` in `web-component.ts` maps each kebab-case attribute to its renamed camelCase config key (single source of truth — `observedAttributes` and the `buildConfig()` body both derive from it). Rename applied by `scripts/rename-api.mjs`, kept in-tree.

- **`component-variables.manifest.json` repaired.** Prefix field `tv` → `wtv`, all 108 entries renamed (`tv-*` → `wtv-*`), stale entries fixed (`glow-above` / `glow-below` → `glow-before` / `glow-after` to match the code, added missing `wtv-cut-opacity` and `wtv-font-family`).

- **`VALIDATION-NOTES.md` register** now documents four accepted deviations (C-CST-4/10 namespace-style Logic split, C-CSS-1 lean strategy, C-TC-15 `data-ready` FOUC guard, C-NC-6 D-NC-7=C member-only structural extractors). Future validation runs downgrade matching flags to ⚠️ Exception instead of re-promoting them on every run.

### Fixed
- **Escape now clears the highlight set instead of the checkbox set** (parity with the svelte-treeview rc13 fix). The previous handler in `dom-renderer.ts` Escape branch called `deselectAll()` (clears the checkbox / `selectedPaths` set) — that was written before the rc06 three-level selection split; in the new model the user's "selection" after Ctrl/Shift+click is the highlight set (`highlightedPaths`), not the checkbox set. Now Escape runs in priority order: pending cut → highlight set → fall through. Checkboxes are *not* cleared by Escape; consumers wanting that call `deselectAll()` themselves.
- **`.wtv__node-content--focused` is now a pure CSS hook with no default styles** (parity with the svelte-treeview rc13 fix). The rc03 always-on marker shipped a subtle outline as a built-in "keyboard focus is visible even without a custom `focusedNodeClass`" default, but consumers who explicitly chose to ship no focus visual were stuck with the ring anyway. Now the rule is empty — apps that want a built-in focus look write their own CSS targeting `.wtv__node-content--focused` (or pass a class via `focusedNodeClass`). `--wtv-focused-outline` is no longer referenced and is dropped. `.wtv__node-content--highlighted` keeps its rc03 default look — only the focused default went too far.
- **`collapseNodes`, `collapseAll`, `expandAll` now bump `_rev` on every `isExpanded` mutation** (parity with `expandNodes`). Mirrors the rc13 `@keenmate/svelte-treeview` fix where the same gap manifested as a stale toggle chevron (collapsed node, chevron still pointing down) in `clickBehavior='select'` dblclick-collapse. The DOM renderer here keys node refreshes off `data-expanded` directly, so the user-visible symptom didn't surface — but custom `TreeViewRenderer<T>` implementations that key off `_rev` (matching the documented invariant) would have hit the same staleness. Four sites fixed in `src/ltree/ltree.ts`: `expandAll`'s `setExpandedRecursive`, `expandAll`'s spine-walk, `collapseAll`'s `collapseRecursive`, and `collapseNodes`. Each is guarded by an "actually changed" check so already-correct rows don't churn.

## [2.0.0-rc04] - 2026-06-19

### Changed
- **BEM class shape**: every CSS class now follows the BlissFramework `naming-conventions.md` BEM rule (`<prefix>__element--modifier`, two underscore levels max). Mechanical for elements (`.wtv-X` → `.wtv__X`, e.g. `.wtv-node` → `.wtv__node`, `.wtv-node-content` → `.wtv__node-content`, `.wtv-context-menu-item` → `.wtv__context-menu-item`). State classes are explicit modifiers — `.wtv-drag-over` → `.wtv__node-content--drag-over`, `.wtv-context-menu-item-disabled` → `.wtv__context-menu-item--disabled`, `.wtv-icon-expand` → `.wtv__toggle-icon--expand`, `.wtv-drop-zones-around` → `.wtv__drop-zones--around`. Highlight family folded into BEM modifiers too: `.wtv-highlight-bold` → `.wtv__node-content--highlight-bold` (same for border / brackets), and the always-on `.wtv-highlighted` / `.wtv-focused` markers introduced in rc03 are now `.wtv__node-content--highlighted` / `--focused`. One non-BEM utility kept: `.wtv__clickable` (was `.wtv-clickable`) — applied to both the toggle-icon span and the node-content div, so it stays as a standalone block. CSS variables (`--wtv-*`) are unchanged. `BlissFramework/guidelines` reservation table now lists `wtv` (web-treeview) and `stv` (svelte-treeview) instead of the legacy `ltree` exception. The full rename was applied by `scripts/rename-bem.mjs`, kept in-tree.

## [2.0.0-rc03] - 2026-06-18 (unpublished)

Catch-up release pulling forward the features `@keenmate/svelte-treeview` shipped from `5.0.0-rc05` through `5.0.0-rc10` so the two packages expose the same surface again. Public API parity is the goal — prop names, method signatures, callback shapes, CSS class names, and event semantics mirror the Svelte side.

### Changed (5.0.0 consolidation rename)
- **CSS class prefix: `.ltree-*` → `.wtv-*`** across every class the package ships and applies. Every selector consumers may have written against the tree's DOM (e.g. `.ltree-node`, `.ltree-node-content`, `.ltree-checkbox`, `.ltree-context-menu`, `.ltree-drop-before`, `.ltree-glow-child`, etc.) must be renamed to the `wtv-` prefix. The `ltree-` prefix was inherited from the internal "LTree" data-structure name and leaked an implementation detail into the public CSS API; the new prefix is package-specific and parallels svelte-treeview's `stv-*` after the same 5.0.0 rename.
- **CSS variable prefix: `--tv-*` → `--wtv-*`** for the same reason. Every variable consumers override for theming (`--tv-accent-color`, `--tv-bg-color`, `--tv-node-height`, etc.) must rename to `--wtv-*`. The base-layer (`--base-accent-color`, `--base-text-color-1`, etc.) is **unchanged** — those are the shared KeenMate design tokens and continue to feed the component variables.
- **`.wtv-selected-{bold,border,brackets}` → `.wtv-highlight-{bold,border,brackets}`**: the three opt-in flavor classes you assign via the `highlightedNodeClass` prop are renamed to match the rc03 three-level model. In rc03 "selected" means the checkbox/data-state set (`selectedPaths`); "highlighted" means the multi-select set (`highlightedPaths`) — these classes paint the *highlighted* set, so the new name matches the semantics.
- **New always-on `.wtv-highlighted` marker class** applied to every node in the highlight set (in addition to whatever `highlightedNodeClass` you opt into). Ships a subtle default style (`--wtv-highlighted-bg` + `--wtv-highlighted-outline`) so enabling `selectionMode='multi'` produces visible feedback without configuring `highlightedNodeClass`. Pair it with `highlightedNodeClass="wtv-highlight-bold"` (or your own) for layered styling.
- **New always-on `.wtv-focused` marker class** applied to the single focused node, with a subtle default outline so keyboard navigation is visible without configuring `focusedNodeClass`.

### Added
- **Checkbox UI (`shouldShowCheckboxes`, `checkboxMode`, `beforeCheckboxToggleCallback`)**: Mirrors svelte-treeview rc06+. The DOM renderer draws an `.ltree-checkbox` element between the toggle column and the node content when `shouldShowCheckboxes` is true and the node is `isSelectable`. Clicks route through a new `nodeCallbacks.onCheckboxToggle` → `controller._onCheckboxToggle(node)` which honors:
  - **`checkboxMode='independent'`** (default): each checkbox is standalone; toggling a parent does NOT touch descendants and a parent never auto-checks itself from its descendants.
  - **`checkboxMode='cascade'`**: toggling a parent cascades to every descendant; a parent's `visualState` reflects its descendants (`selected` / `notSelected` / `indeterminate`) and is synced back to its `isSelected`.
  - **Bulk via highlight**: when the toggled node is in a multi-highlight set (`highlightedPaths.size > 1`), the toggle applies to every highlighted node.
  - **`beforeCheckboxToggleCallback(node, checked, affectedPaths)`** interceptor: return `false` to cancel, return a `string[]` to override which paths are actually affected, or return `void` to apply unchanged.
  - **`shouldClickToggleCheckbox`** (boolean, default `false`): when `true` AND `shouldShowCheckboxes` is on AND the node is selectable, a plain click on the node label runs the checkbox-toggle path instead of focusing/highlighting. Expand-on-click still fires when `clickBehavior` is `'expand'` or `'expand-and-focus'`.
- **`theme` prop / attribute** (`'dark' | 'light' | null`): Per-instance theme override forwarded to the root `.ltree-container` as `data-theme="..."`. The new `_dark-mode.css` partial flips the `--tv-*` color tokens against four signals — OS preference (`@media (prefers-color-scheme: dark)`), framework theme classes (`[data-theme="dark"]`, `[data-bs-theme="dark"]`, `.dark`), per-instance `data-theme` on the container, and symmetric `light` variants so a single tree can force light on a dark page. Default behaviour with `theme=null|undefined` is to inherit from the page. Mirrors `@keenmate/svelte-treeview` rc10's `theme` prop.
- **`getIsExpandedCallback`, `getIsSelectableCallback`, `getIsSelectedCallback`, `getIsDropAllowedCallback` props**: Callback variants for the matching `is*Member` data-field props, matching the same pattern as the existing `getIsDraggableCallback` / `getIsCollapsibleCallback` / `getAllowedDropPositionsCallback`. Seed-only: invoked once per node at `insertArray` / `addNode` time so subsequent user mutations (checkbox clicks, expand button) aren't overridden by the callback. Precedence: callback > member > default. Mirrors `@keenmate/svelte-treeview` rc09–rc10. Also: `getIsDraggableCallback` is now actually applied at seed time (previously the prop existed but didn't run during insert). New `getNodeIsDropAllowed(node)` method on the LTree mirrors the lazy lookup helpers (`getNodeIsDraggable`, `getNodeIsCollapsible`).
- **`isAccordionExpand` prop / `accordion-expand` attribute** (boolean, default `false`): Per-parent accordion behaviour — expanding a node via the toggle UI automatically collapses any expanded siblings. Respects `isCollapsibleMember` / `getIsCollapsibleCallback` (non-collapsible siblings are not force-collapsed). Programmatic `expandNodes` / `expandAll` are unaffected. Implemented via a new `toggleNodeExpanded(path)` method on the controller / facade; the DOM renderer's toggle-icon click now routes through it. While here, the renderer's toggle now also matches svelte-treeview's gate of blocking the toggle entirely on nodes where `getNodeIsCollapsible(node)` is false. Mirrors `@keenmate/svelte-treeview` rc03.
- **Array variants + option bags on `expandNodes` / `collapseNodes` / `expandAll` / `collapseAll`**: all four now accept `string | string[] | null` instead of a single path. `expandNodes` and `expandAll` take `{ exclusive?: boolean; noEmit?: boolean }`; `collapseNodes` and `collapseAll` take `{ noEmit?: boolean }`. `exclusive` collapses anything off the union-of-spines so downstream listeners (URL sync, virtualised renderers, transition animations) don't see the intermediate fully-collapsed state. `noEmit` skips the change emission so consumers can batch several mutations and emit once at the end via `tree.refresh()`. Single emit per call regardless of array length. Mirrors `@keenmate/svelte-treeview` rc08.

### Changed
- **`DropPosition` renamed `'above' | 'below' | 'child'` → `'before' | 'after' | 'child'`** for full naming parity with svelte-treeview (which renamed the same in its rc02). Knock-on effects:
  - Per-node `allowedDropPositions` data arrays must change from `['above', 'below']` → `['before', 'after']`. Same for the values returned by `getAllowedDropPositionsCallback`.
  - The `position` argument of `nodeDropCallback`, `beforeDropCallback`, `moveNode`, `pasteNodes`, `copyNodeWithDescendants` is now `'before' | 'after' | 'child'`.
  - CSS class names follow: `.ltree-drop-above` → `.ltree-drop-before`, `.ltree-drop-below` → `.ltree-drop-after`, `.ltree-glow-above` → `.ltree-glow-before`, `.ltree-glow-below` → `.ltree-glow-after`. Consumers theming the glow indicators or styling the drop zones via these classes will need to update their selectors.
  - CSS variables follow: `--tv-glow-above-*` → `--tv-glow-before-*`, `--tv-glow-below-*` → `--tv-glow-after-*`.
  - `dropZoneLayout` values (`'around' | 'above' | 'below' | 'wave' | 'wave2'`) are **unchanged** — those are layout names (where the floating zones sit), distinct from position values (which target the floating zones identify). The CSS class names `.ltree-drop-zones-above` / `.ltree-drop-zones-below` likewise stay.
- **Drag-and-drop: multi-drag, non-highlighted drag replaces highlight, `shouldAutoHandleMove` opt-out**:
  - **Multi-drag** (same-tree, `operation='move'`, `shouldAutoHandleMove=true`): when the dragged node is in `highlightedPaths` and the set has more than one entry, the controller moves every **top-level highlighted** subtree (a path whose nearest highlighted ancestor is NOT in the set). The first move uses the requested drop position; subsequent moves chain `'below'` the previously-moved node, so the whole set lands as siblings in source order: dropping `{A, B, C}` `'below D'` → `[D, A, B, C]`; `'above D'` → `[A, B, C, D]`; `'child of D'` → `D`'s children = `[A, B, C]`. Selected descendants of a top-level node are absorbed (they ride along inside their ancestor's subtree, not separately extracted).
  - **Non-highlighted drag**: dragging a node that isn't in `highlightedPaths` now replaces the highlight with that single node before the drag completes. Matches Windows Explorer / macOS Finder where mousedown on an unselected item selects it. Skipped when the node is already in the set (multi-drag) or is not selectable. Runs in a `requestAnimationFrame` after the browser commits the drag image so the source row's DOM isn't disturbed mid-drag.
  - **`shouldAutoHandleMove`** prop (boolean, default `true`): set to `false` to receive the `nodeDropCallback` callback without the controller mutating the tree (consumer handles the move). Mirrors svelte-treeview's `shouldAutoHandleMove`.
  - Mirrors `@keenmate/svelte-treeview` rc09.
- **Three-level selection model (`focusedNode` / `highlightedPaths` / `selectedPaths`)** — biggest behaviour change in rc03. Mirrors svelte-treeview rc06+.
  - **`focusedNode`** (was `selectedNode`): single focused node (click, arrow keys). The web component now dispatches `focused-node-changed` (was `selected-node-changed`) with `detail.focusedNode`. The controller getter / setter is `focusedNode`.
  - **`highlightedPaths`**: multi-select set built by Ctrl/Shift+click and arrow extensions. New methods `highlightNode(path, mode, options)` / `highlightNodes(paths, options)` / `clearHighlight(options)` / `getHighlightedNodes()` / `getHighlightedPaths()` / `isNodeHighlighted(path)`. The web component dispatches `highlight-change` with `detail.highlightedNodes` and `detail.highlightedPaths`.
  - **`selectedPaths`** is now the checkbox / data-state selection set (was: the multi-select set). When `shouldShowCheckboxes` is false, every change to `highlightedPaths` is mirrored into `selectedPaths` so consumers reading the form-style selection still reflect what the user picked via the mouse. With checkboxes visible, the two sets stay independent.
  - **`selectionMode` prop** (`'single' | 'multi'`, default `'single'`): in `'single'`, Ctrl/Shift+click degrade to plain click. In `'multi'`, Ctrl+click toggles, Shift+click range-extends.
  - **`shouldShowCheckboxes`**, **`shouldClickToggleCheckbox`** props added (wiring; checkbox UI ports in the next commit).
  - **`highlightChangeCallback`** callback added.
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
- `selectionChangeCallback` callback and `selection-change` CustomEvent
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
- `NodeCallbacks.nodeClickedCallback` signature extended with optional `SelectionModifiers` parameter
- `TreeControllerSnapshot` now includes `selectedPaths` and `cutPaths` sets
- DomRenderer click handler respects `clickBehavior` and skips toggle when Ctrl or Shift is held
- `.ltree-selected-border` uses `outline` instead of `border`+`padding` to prevent layout shift on selected nodes
- **Context menu `offset` middleware reduced from `4` to `0`**: The root menu's top-left now lands exactly at `(cursor.x + contextMenuXOffset, cursor.y + contextMenuYOffset)` with no implicit 4px vertical gap. Restores the pre-Floating UI positioning so consumers' `xOffset` / `yOffset` props are honored pixel-exactly. Submenu positioning is unchanged.
- **`scrollToPath` retries the DOM lookup across rAF frames before giving up**: With `isFlatRenderingEnabled` + `isProgressiveRender` (the default), `expandNodes` reveals new rows in rAF-deferred batches sized `initialBatchSize` (default 20) and doubling. Previously, `scrollToPath` queried the DOM after one microtask flush — only the immediate batch was rendered, so any target row past that batch produced a `console.warn("DOM element not found")` and the function returned `false` without scrolling or highlighting. Now retries for up to ~6 additional frames before giving up. Same fix as `@keenmate/svelte-treeview` rc-next.

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
  - **Flat rendering** (`isFlatRenderingEnabled`, default `true`) — single DOM list with `paddingLeft` indentation
  - **Virtual scroll** (`isVirtualScrollEnabled`, default `false`) — only renders rows visible in the viewport, suitable for 100k+ node trees. Configurable via `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight`.
- **Progressive rendering** — `requestAnimationFrame`-batched rendering for smooth initial load of large trees
- **Full-width clickable node rows** — Entire node row is clickable including indent zone, with uniform hover highlight
- **Node row layout** — Each row is `[toggle/icon column] [content]` with unified `--tv-column-width` (24px) controlling toggle, icon, and indent step
- **Per-node icons** — `iconMember` (data field) and `iconCallback` (dynamic function) for assigning icons to individual nodes. `shouldAlignNodeIcons` reserves column width for alignment.
- **Custom render callbacks** — `renderNodeCallback`, `renderEmptyStateCallback`, `renderEmptyZoneCallback`, `renderLoadingCallback`, `renderHeaderCallback`, `renderFooterCallback`, `renderContextMenuCallback`

#### Drag and Drop

- **Full DnD support** ported from svelte-treeview
  - `dragDropMode`: `'none'` | `'cross'` | `'both'`
  - Drop zone modes: `'glow'` (CSS highlight) and `'floating'` (positioned drop targets)
  - Drop zone layouts: `'around'` | `'above'` | `'below'` | `'wave'` | `'wave2'`
  - Drop positions: `'above'` | `'below'` | `'child'`
  - Configurable `dropZoneStart` threshold for child zone
  - Per-node `allowedDropPositionsMember` for restricted drop positions
  - Copy operations with `isCopyAllowed` / `shouldAutoHandleCopy`
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
