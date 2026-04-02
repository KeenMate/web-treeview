# @keenmate/web-treeview

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-treeview.svg)](https://www.npmjs.com/package/@keenmate/web-treeview)

A lightweight, framework-agnostic treeview web component built with vanilla TypeScript. Works in any framework or plain HTML — just drop in `<web-treeview>` and go.

## v2.0: Framework-Agnostic Treeview

> [!IMPORTANT]
> **`web-treeview` is built on the same core as [`@keenmate/svelte-treeview`](https://github.com/KeenMate/svelte-treeview) but is completely independent of it.** It shares the same LTree data engine, naming conventions, and architectural principles — ported to vanilla TypeScript with zero framework dependencies. If you know svelte-treeview, you already know the API.

**What's in v2:**
- **Web Component** — Standard `<web-treeview>` custom element with Shadow DOM, works in React, Vue, Angular, or plain HTML
- **Two rendering modes** — Flat rendering (default) for most trees, virtual scroll for 100k+ nodes
- **Multi-select** — Ctrl+click toggle, Shift+click range select, `selectAll()`, visual or logical range modes
- **Clipboard** — Copy/cut/paste nodes (including cross-tree) with Ctrl+C/X/V keyboard shortcuts
- **Keyboard navigation** — Arrow keys, Home/End, Enter/Space toggle, Escape to deselect
- **Full drag & drop** — Internal reordering, cross-tree drag, glow/floating drop zones, touch support, copy operations
- **Multi-level context menus** — Viewport-aware positioning via Floating UI, keyboard shortcuts, named dividers, custom item rendering
- **Bulk operations** — `insertBranch`, `replaceBranch`, `deleteBranch` for efficient batch mutations
- **Full-text search** — FlexSearch-powered indexing with filter and highlight modes
- **90+ CSS variables** — Complete theming via `--base-*` design system tokens and `--tv-*` component tokens, compatible with `@keenmate/theme-designer`
- **Pluggable renderers** — `TreeViewRenderer<T>` interface for building custom renderers (Canvas, WebGL, framework-specific)

### Rendering Modes

| Mode | Config | DOM Nodes | Best For |
|------|--------|-----------|----------|
| Flat (default) | `use-flat-rendering="true"` | All | Most trees (up to ~10K nodes) |
| Virtual | `virtual-scroll="true"` | ~50 | Large trees (10K+) |

```html
<!-- Virtual scroll for large trees -->
<web-treeview virtual-scroll="true" virtual-container-height="500px"></web-treeview>

<!-- Flat mode (default) with progressive batching -->
<web-treeview progressive-render="true"></web-treeview>
```

## Features

- **LTree Path Model** — Materialized path hierarchy (`1`, `1.1`, `1.1.2`) with configurable separator
- **Multi-Select** — Ctrl+click toggle, Shift+click range, `selectAll()`, visual/logical range modes, `onSelectionChange` callback
- **Clipboard** — Copy/cut/paste with cross-tree support, cut nodes dimmed with `--tv-cut-opacity`
- **Keyboard Navigation** — Arrow keys, Home/End, Enter/Space, Ctrl+A/C/X/V, Escape
- **Bulk Operations** — `insertBranch`, `replaceBranch`, `deleteBranch` for efficient batch tree mutations
- **Full-Width Hitbox** — Entire node row is clickable including indent zone, with uniform hover highlight
- **Per-Node Icons** — Via data field (`iconMember`) or dynamic callback (`iconCallback`) with aligned column grid
- **Progressive Rendering** — `requestAnimationFrame`-batched rendering for smooth initial load of large trees
- **Custom Render Callbacks** — Callback-based templates for nodes, empty state, loading, header, footer, context menu items
- **Categorized Logging** — Runtime-configurable log categories for debugging
- **TypeScript** — Fully typed API with generic `<T>` data support
- **SSR Safe** — Compatible with server-side rendering environments

## Installation

```bash
npm install @keenmate/web-treeview
```

## Quick Start

### Declarative (HTML only)

```html
<script type="module" src="./node_modules/@keenmate/web-treeview/dist/web-treeview.js"></script>

<web-treeview id="my-tree" expand-level="2"></web-treeview>

<script>
  const tree = document.getElementById('my-tree');
  tree.data = [
    { id: 1, path: '1',     displayValue: 'Documents' },
    { id: 2, path: '1.1',   displayValue: 'Projects' },
    { id: 3, path: '1.1.1', displayValue: 'Web App' },
    { id: 4, path: '1.1.2', displayValue: 'Mobile App' },
    { id: 5, path: '1.2',   displayValue: 'Photos' },
    { id: 6, path: '2',     displayValue: 'Downloads' },
  ];
</script>
```

### With Custom Member Mappings

If your data uses different property names, map them via attributes:

```html
<web-treeview
  id="my-tree"
  id-member="nodeId"
  path-member="treePath"
  display-value-member="label"
  expand-level="1">
</web-treeview>

<script>
  document.getElementById('my-tree').data = [
    { nodeId: 1, treePath: '1',   label: 'Root' },
    { nodeId: 2, treePath: '1.1', label: 'Child' },
  ];
</script>
```

### Programmatic (ES Module)

```typescript
import '@keenmate/web-treeview';
import { WebTreeView } from '@keenmate/web-treeview';

const container = document.getElementById('tree-container')!;
const tree = new WebTreeView(container, {
  data: myData,
  idMember: 'id',
  pathMember: 'path',
  displayValueMember: 'name',
  expandLevel: 2,
  onNodeClicked: (node) => console.log('Clicked:', node),
});
```

### Headless (LTree Core Only)

Use the tree engine directly without any DOM rendering:

```typescript
import { createLTree } from '@keenmate/web-treeview';

const tree = createLTree('id', 'path');
tree.insertArray([
  { id: 1, path: '1',   name: 'Root' },
  { id: 2, path: '1.1', name: 'Child' },
]);

console.log(tree.tree);           // Root nodes
console.log(tree.visibleFlatNodes); // Flat list of visible nodes
```

## API

### Attributes

All attributes use kebab-case. Equivalent camelCase property setters are available on the element.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `id-member` | `string` | `'id'` | Property name for node ID |
| `path-member` | `string` | `'path'` | Property name for hierarchical path |
| `display-value-member` | `string` | `'displayValue'` | Property name for display text |
| `parent-path-member` | `string` | — | Property name for parent path (auto-calculated if omitted) |
| `level-member` | `string` | — | Property name for depth level (auto-calculated if omitted) |
| `has-children-member` | `string` | — | Property name for has-children flag (auto-calculated if omitted) |
| `is-expanded-member` | `string` | — | Property name for expanded state in data |
| `is-selected-member` | `string` | — | Property name for selected state in data |
| `is-draggable-member` | `string` | — | Property name for per-node draggable flag |
| `is-drop-allowed-member` | `string` | — | Property name for per-node drop-allowed flag |
| `is-collapsible-member` | `string` | — | Property name for per-node collapsible flag |
| `search-value-member` | `string` | — | Property name for search text (defaults to display value) |
| `order-member` | `string` | — | Property name for sort order |
| `expand-level` | `number` | — | Auto-expand nodes up to this depth |
| `tree-path-separator` | `string` | `'.'` | Separator character in paths |
| `tree-id` | `string` | — | Unique tree identifier (for cross-tree DnD) |
| `drag-drop-mode` | `string` | `'none'` | `'none'` \| `'cross'` \| `'both'` |
| `drop-zone-mode` | `string` | `'glow'` | `'glow'` \| `'floating'` |
| `drop-zone-layout` | `string` | `'around'` | `'around'` \| `'above'` \| `'below'` \| `'wave'` \| `'wave2'` |
| `drop-zone-start` | `number\|string` | `33` | Child zone threshold (number = %, string = CSS value) |
| `allowed-drop-positions-member` | `string` | — | Property name for per-node allowed drop positions array |
| `allow-copy` | `boolean` | `false` | Enable copy operations (Ctrl+drag) |
| `icon-member` | `string` | — | Property name for per-node icon CSS class(es) |
| `align-node-icons` | `boolean` | `true` | Reserve icon column width even for nodes without icons |
| `click-behavior` | `string` | `'expand-and-focus'` | `'select'` \| `'expand'` \| `'expand-and-focus'` — what happens on click |
| `use-flat-rendering` | `boolean` | `true` | Flat rendering mode (single DOM list with `paddingLeft` indent) |
| `virtual-scroll` | `boolean` | `false` | Virtual scroll mode — only renders visible rows in the viewport |
| `virtual-row-height` | `number` | auto | Row height in px for virtual scroll (auto-measured if omitted) |
| `virtual-overscan` | `number` | `5` | Extra rows rendered above/below viewport in virtual scroll |
| `virtual-container-height` | `string` | `'400px'` | Container height for virtual scroll viewport |
| `progressive-render` | `boolean` | `true` | RAF-batched progressive rendering for large trees |
| `range-selection-mode` | `string` | `'visual'` | `'visual'` \| `'logical'` — range select mode for Shift+click |
| `search-text` | `string` | — | Current search/filter text |
| `should-display-debug-information` | `boolean` | `false` | Show debug overlay |

### Properties (JS only)

These properties are set via JavaScript, not HTML attributes:

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T[]` | Array of data objects to display as tree |
| `renderer` | `TreeViewRenderer<T>` | Custom renderer (replaces default DomRenderer) |
| `onNodeClicked` | `(node) => void` | Click handler |
| `onNodeDragStart` | `(node, event) => void` | Drag start handler |
| `onNodeDragOver` | `(node, event) => void` | Drag over handler |
| `onNodeDrop` | `(dropNode, draggedNode, position, event, operation) => void` | Drop handler |
| `beforeDropCallback` | `(dropNode, draggedNode, position, event, operation) => boolean \| void` | Drop validation |
| `contextMenuCallback` | `(node, close) => ContextMenuEntry[]` | Context menu items |
| `renderContextMenuItemCallback` | `(item, node, container) => void` | Per-item custom rendering (fill or fall through) |
| `contextMenuXOffset` | `number` | Horizontal offset (px) for context menu position |
| `contextMenuYOffset` | `number` | Vertical offset (px) for context menu position |
| `iconCallback` | `(node) => string \| null` | Dynamic icon class resolution (overrides `iconMember`) |
| `renderNodeCallback` | `(node, container) => void` | Custom node content rendering |
| `renderEmptyStateCallback` | `(container) => void` | Informational display when tree has no data |
| `renderEmptyZoneCallback` | `(container) => void` | Drop zone rendered in empty tree during drag |
| `renderLoadingCallback` | `(container) => void` | Loading state rendering |
| `renderHeaderCallback` | `(container) => void` | Tree header rendering |
| `renderFooterCallback` | `(container) => void` | Tree footer rendering |
| `onSelectionChange` | `(selectedNodes, selectedPaths) => void` | Selection change handler |
| `sortCallback` | `(items) => items` | Custom sort function |
| `getDisplayValueCallback` | `(node) => string` | Dynamic display value |
| `getIsDraggableCallback` | `(node) => boolean` | Dynamic draggable check |
| `getIsCollapsibleCallback` | `(node) => boolean` | Dynamic collapsible check |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `expandAll` | `(nodePath?: string)` | Expand all nodes (or subtree) |
| `collapseAll` | `(nodePath?: string)` | Collapse all nodes (or subtree) |
| `expandNodes` | `(nodePath: string)` | Expand ancestors up to node |
| `collapseNodes` | `(nodePath: string)` | Collapse a node |
| `filterNodes` | `(searchText: string)` | Filter tree by search text |
| `searchNodes` | `(searchText: string): LTreeNode[]` | Search without filtering |
| `scrollToPath` | `(path: string, options?): Promise<boolean>` | Scroll to and highlight a node |
| `closeContextMenu` | `()` | Close the context menu |
| `selectNode` | `(path, modifiers?)` | Select a node (plain/ctrl/shift) |
| `selectNodes` | `(paths: string[])` | Select multiple nodes by path |
| `deselectAll` | `()` | Deselect all nodes |
| `selectAll` | `()` | Select all visible nodes |
| `getSelectedNodes` | `(): LTreeNode[]` | Get all selected nodes |
| `getSelectedPaths` | `(): Set<string>` | Get all selected paths |
| `isNodeSelected` | `(path): boolean` | Check if a node is selected |
| `copyNodes` | `(paths?)` | Copy selected/specified nodes to clipboard |
| `cutNodes` | `(paths?)` | Cut selected/specified nodes to clipboard |
| `pasteNodes` | `(targetPath, transformData?, position?): PasteResult` | Paste clipboard at target |
| `cancelCut` | `()` | Cancel cut operation |
| `navTo` | `(path)` | Navigate to a specific node |
| `navNext` / `navPrev` | `()` | Navigate to next/previous visible node |
| `navInto` / `navOut` | `()` | Navigate into child / to parent |
| `navToggle` | `()` | Toggle expand/collapse on current node |
| `navFirst` / `navLast` | `()` | Navigate to first/last visible node |
| `insertBranch` | `(parentPath, data[]): result` | Insert multiple children at once |
| `replaceBranch` | `(parentPath, data[]): result` | Replace all children of a node |
| `deleteBranch` | `(path, keepParent?): result` | Delete node and descendants |
| `getTree` | `(): Ltree<T>` | Access the underlying LTree instance |
| `getController` | `(): TreeController<T>` | Access the TreeController directly |
| `update` | `(props: Partial<TreeViewConfig<T>>)` | Update multiple properties at once |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `node-clicked` | `{ node: LTreeNode<T> }` | Node was clicked |
| `selection-change` | `{ selectedNodes, selectedPaths }` | Selection changed (multi-select) |
| `selected-node-changed` | `{ selectedNode }` | Last-selected node changed |
| `tree-changed` | — | Tree state changed (expand, collapse, data) |

## Drag and Drop

Enable drag-and-drop with the `drag-drop-mode` attribute:

```html
<!-- Internal + cross-tree reordering -->
<web-treeview drag-drop-mode="both"></web-treeview>

<!-- Cross-tree only (no internal reordering) -->
<web-treeview id="tree-a" drag-drop-mode="cross" tree-id="source"></web-treeview>
<web-treeview id="tree-b" drag-drop-mode="cross" tree-id="target"></web-treeview>
```

### Restricted Drop Positions

Control which drop positions (`above`, `below`, `child`) are valid per node:

```javascript
tree.data = [
  // Trash: only accept drops as children
  { id: 1, path: '1', name: 'Trash', allowedDropPositions: ['child'] },

  // Regular folder: all positions (default)
  { id: 2, path: '2', name: 'Projects' },

  // Files: can't drop INTO them
  { id: 3, path: '3', name: 'Readme.md', allowedDropPositions: ['above', 'below'] },
];

tree.allowedDropPositionsMember = 'allowedDropPositions';
```

### Drop Zone Start

The `dropZoneStart` property controls where the "child" zone begins (as a percentage of the node width). It applies to both glow and floating modes:

```javascript
tree.dropZoneStart = '50%';  // Child zone starts at 50% (default: 33%)
```

### Drop Validation

```javascript
tree.beforeDropCallback = (dropNode, draggedNode, position, event, operation) => {
  // Return false to cancel the drop
  if (draggedNode.level === 0) return false;

  // Return modified position/operation
  return { position: 'child', operation: 'move' };
};
```

## Multi-Select

Multi-select works out of the box with no configuration:

```javascript
// Ctrl+click and Shift+click work automatically in the UI

// Programmatic multi-select
tree.selectNodes(['1.1', '1.2', '1.3']);
tree.selectAll();
tree.deselectAll();

// Query selection
const nodes = tree.getSelectedNodes();
const paths = tree.getSelectedPaths(); // Set<string>

// Listen for changes
tree.addEventListener('selection-change', (e) => {
  console.log('Selected:', e.detail.selectedPaths);
});
```

### Range Selection Mode

```html
<!-- Visual mode (default): range uses visible flat nodes -->
<web-treeview range-selection-mode="visual"></web-treeview>

<!-- Logical mode: range walks the full tree structure -->
<web-treeview range-selection-mode="logical"></web-treeview>
```

See `examples-multiselect.html` for interactive demos of multi-select, clipboard, keyboard navigation, and bulk operations.

## Clipboard (Copy/Cut/Paste)

```javascript
// Copy selected nodes
tree.copyNodes();

// Cut selected nodes (dimmed in UI)
tree.cutNodes();

// Paste at a target node
tree.pasteNodes('1.2');

// Cancel cut
tree.cancelCut();

// Keyboard: Ctrl+C, Ctrl+X, Ctrl+V, Escape
```

## Keyboard Navigation

When the tree body has focus (click any node first), keyboard navigation is active:

| Key | Action |
|-----|--------|
| Arrow Down / Up | Navigate to next / previous sibling |
| Arrow Right | Expand and move to first child |
| Arrow Left | Move to parent node |
| Backspace | Collapse parent and move to it |
| Enter / Space | Toggle expand/collapse |
| Home / End | Jump to first / last visible node |
| Ctrl+A | Select all visible nodes |
| Ctrl+C / X / V | Copy / cut / paste |
| Escape | Cancel cut or deselect all |

## Per-Node Icons

Each node row is laid out as `[toggle/icon column] [content]`. The toggle/icon column has a fixed width (`--tv-column-width`, default 24px) shared by toggle arrows, leaf icons, and per-node icons. The indent step also equals `--tv-column-width`, so labels at every depth align vertically.

### Via data field (`iconMember`)

```html
<web-treeview icon-member="icon" expand-level="2"></web-treeview>

<script>
  tree.data = [
    { id: 1, path: '1',   displayValue: 'Documents', icon: 'icon-folder' },
    { id: 2, path: '1.1', displayValue: 'report.pdf', icon: 'icon-file-pdf' },
  ];
</script>
```

### Via callback (`iconCallback`)

```javascript
tree.iconCallback = (node) => {
  if (node.hasChildren) return 'icon-folder';
  const ext = node.data.name.split('.').pop();
  return { ts: 'icon-ts', css: 'icon-css' }[ext] || 'icon-file';
};
```

`iconCallback` takes priority over `iconMember`. Both return CSS class name(s) applied to the toggle column element for leaf nodes. Return `null` to fall back to `leafIconClass`.

## Render Callbacks

```javascript
tree.renderNodeCallback = (node, container) => {
  container.innerHTML = `
    <span class="icon">${node.hasChildren ? '📁' : '📄'}</span>
    <span class="label">${node.displayValue}</span>
    <span class="badge">${node.children?.length ?? 0}</span>
  `;
};

tree.renderEmptyStateCallback = (container) => {
  container.innerHTML = '<p>No items to display</p>';
};
```

## Context Menu

Right-click context menus are defined via `contextMenuCallback`:

```javascript
tree.contextMenuCallback = (node, closeMenu) => [
  { label: 'Edit', icon: 'fa fa-edit', shortcut: 'E', onclick: () => editNode(node) },
  { label: 'Duplicate', icon: 'fa fa-copy', onclick: () => duplicateNode(node) },
  { divider: true, label: 'Danger zone' },
  { label: 'Delete', className: 'danger', shortcut: 'Delete', onclick: () => deleteNode(node) },
];
```

### ContextMenuEntry

`ContextMenuEntry = ContextMenuItem | ContextMenuDivider`

### ContextMenuItem

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Display text (required) |
| `id` | `string` | Optional identifier |
| `icon` | `string` | CSS class(es) for item icon |
| `shortcut` | `string` | Keyboard shortcut text (displayed + active when menu is open) |
| `isDisabled` | `boolean` | Grey out and prevent interaction |
| `isVisible` | `boolean` | Set `false` to hide the item |
| `className` | `string` | CSS class(es) on the item button (e.g. `'danger'` for red styling) |
| `onclick` | `() => void \| Promise<void>` | Action handler |
| `children` | `ContextMenuEntry[]` | Nested submenu items |

### ContextMenuDivider

| Field | Type | Description |
|-------|------|-------------|
| `divider` | `true` | Discriminator (required) |
| `label` | `string` | Optional label rendered as `──── label ────` |

### Custom Item Rendering

Use `renderContextMenuItemCallback` for node-aware or styled menu items. The callback uses a "fill or fall through" pattern — if you populate the container, your custom markup is used; if you leave it empty, the default rendering applies:

```javascript
tree.renderContextMenuItemCallback = (item, node, container) => {
  if (item.id === 'profile') {
    container.innerHTML = `
      <div class="avatar">${node.data.name[0]}</div>
      <div>
        <strong>${node.data.name}</strong>
        <small>${node.data.role}</small>
      </div>
    `;
    return; // custom rendering used
  }
  // All other items: leave container empty → default rendering
};
```

### Menu Position Offsets

```javascript
tree.contextMenuXOffset = 10;  // Shift menu 10px right
tree.contextMenuYOffset = -30; // Shift menu 30px up
```

## Theming

All CSS values flow from `--base-*` design system tokens through `--tv-*` component tokens. Override at any level:

```css
/* Design system level — affects ALL components sharing the design system */
:root {
  --base-accent-color: #8b5cf6;
  --base-text-color-1: #1e293b;
  --base-border-color: #e2e8f0;
  --base-hover-bg: #f1f5f9;
  --base-rem: 10px;              /* Base unit for all sizing */
}

/* Component level — affects only this treeview instance */
web-treeview {
  --tv-accent-color: #8b5cf6;   /* Overrides --base-accent-color */
  --tv-selected-bg: #ede9fe;
  --tv-indent-size: 1.5rem;
  --tv-node-height: 2rem;
  --tv-border-radius-sm: 4px;
  --tv-font-size: 0.875rem;
}
```

See `examples-theming.html` for 8 complete theme examples (dark mode, neon, corporate, glassmorphism, etc.).

### CSS Custom Properties Reference

#### Core Colors

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-accent-color` | `--base-accent-color` \| `#3b82f6` | Primary accent color |
| `--tv-accent-color-hover` | `--base-accent-color-hover` \| `#2563eb` | Accent hover state |
| `--tv-text-color` | `--base-text-color-1` \| `#1e293b` | Primary text color |
| `--tv-text-color-2` | `--base-text-color-3` \| `#64748b` | Secondary/muted text |
| `--tv-text-color-on-accent` | `--base-text-color-on-accent` \| `#ffffff` | Text on accent backgrounds |
| `--tv-bg-color` | `--base-main-bg` \| `#ffffff` | Main background |
| `--tv-border-color` | `--base-border-color` \| `#e2e8f0` | Default border color |
| `--tv-success-color` | `--base-success-color` \| `#198754` | Success/valid color |
| `--tv-danger-color` | `--base-danger-color` \| `#dc3545` | Danger/invalid color |
| `--tv-light-bg` | `--base-elevated-bg` \| `#f8f9fa` | Elevated surface background |

#### Node States

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-hover-bg` | `--base-hover-bg` \| `#f1f5f9` | Base hover background |
| `--tv-active-bg` | `--base-active-bg` \| `#e2e8f0` | Base active/pressed background |
| `--tv-selected-bg` | `--base-accent-color-light` \| `#eff6ff` | Selected node background |
| `--tv-selected-border-color` | `= --tv-accent-color` | Selected node border color |
| `--tv-selected-border` | `2px solid --tv-selected-border-color` | Selected node border shorthand |
| `--tv-node-bg-hover` | `= --tv-hover-bg` | Node hover background |
| `--tv-node-bg-active` | `= --tv-active-bg` | Node active/pressed background |
| `--tv-node-transition` | `background 150ms, box-shadow 150ms ease` | Node content transition (set `none` to disable) |

#### Border

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-border-width-base` | `1px` | Base border width |
| `--tv-border` | `1px solid --tv-border-color` | Full border shorthand |

#### Typography

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-font-size-xs` | `calc(1.2 * --tv-rem)` | 12px |
| `--tv-font-size-sm` | `calc(1.4 * --tv-rem)` | 14px |
| `--tv-font-size-base` | `calc(1.6 * --tv-rem)` | 16px |
| `--tv-font-size` | `= --tv-font-size-sm` | Default font size |
| `--tv-font-weight-medium` | `500` | Medium weight |
| `--tv-font-weight-semibold` | `600` | Semibold weight |

#### Spacing & Layout

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-rem` | `--base-rem` \| `10px` | Base unit for proportional scaling |
| `--tv-spacing-xs` | `2px` | Extra small spacing |
| `--tv-spacing-sm` | `4px` | Small spacing |
| `--tv-spacing-md` | `8px` | Medium spacing |
| `--tv-spacing-lg` | `12px` | Large spacing |
| `--tv-spacing-xl` | `16px` | Extra large spacing |
| `--tv-column-width` | `calc(--tv-rem * 2.4)` | Unified column width (24px) for toggle, icon, and indent step |
| `--tv-indent-size` | `= --tv-column-width` | Tree indent per level (equals column width) |
| `--tv-node-padding` | `4px 8px` | Node content padding |
| `--tv-node-height` | `calc(--tv-rem * 3.2)` | Node row height (32px) |
| `--tv-icon-size` | `calc(--tv-rem * 1.6)` | Node icon size (16px) |
| `--tv-toggle-size` | `= --tv-column-width` | Toggle icon column size |
| `--tv-toggle-color` | `= --tv-text-color-2` | Toggle icon color |

#### Border Radius

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-border-radius-sm` | `calc(0.4 * --tv-rem)` | 4px |
| `--tv-border-radius-md` | `calc(0.6 * --tv-rem)` | 6px |
| `--tv-border-radius-lg` | `calc(0.8 * --tv-rem)` | 8px |

#### Transitions

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-transition-speed` | `150ms` | Fast transition duration |
| `--tv-transition-normal` | `200ms` | Normal transition duration |
| `--tv-easing` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing curve |

#### Drag & Drop — Glow Indicators

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-glow-above-color` | `rgba(134,179,152,0.8)` | Above glow border color |
| `--tv-glow-below-color` | `rgba(242,182,158,0.8)` | Below glow border color |
| `--tv-glow-child-color` | `rgba(167,155,198,0.8)` | Child glow border color |
| `--tv-glow-above-bg` | `rgba(134,179,152,0.25)` | Above zone background |
| `--tv-glow-below-bg` | `rgba(242,182,158,0.25)` | Below zone background |
| `--tv-glow-child-bg` | `rgba(167,155,198,0.25)` | Child zone background |
| `--tv-glow-above-text` | `rgba(62,89,72,0.7)` | Above zone text color |
| `--tv-glow-below-text` | `rgba(120,70,50,0.7)` | Below zone text color |
| `--tv-glow-child-text` | `rgba(72,62,98,0.7)` | Child zone text color |
| `--tv-glow-above-bg-active` | `rgba(134,179,152,0.85)` | Above zone active background |
| `--tv-glow-below-bg-active` | `rgba(242,182,158,0.85)` | Below zone active background |
| `--tv-glow-child-bg-active` | `rgba(167,155,198,0.85)` | Child zone active background |
| `--tv-glow-above-color-active` | `rgb(32,54,40)` | Above zone active text |
| `--tv-glow-below-color-active` | `rgb(80,45,30)` | Below zone active text |
| `--tv-glow-child-color-active` | `rgb(45,38,62)` | Child zone active text |
| `--tv-glow-above-shadow` | `0 2px 12px rgba(134,179,152,0.4)` | Above zone active shadow |
| `--tv-glow-below-shadow` | `0 2px 12px rgba(242,182,158,0.4)` | Below zone active shadow |
| `--tv-glow-child-shadow` | `0 2px 12px rgba(167,155,198,0.4)` | Child zone active shadow |

#### Drag & Drop — State Colors

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-drag-over-bg` | `accent 10%` | Drag-over node background |
| `--tv-drag-over-border` | `2px dashed accent` | Drag-over node border |
| `--tv-drag-over-glow-shadow` | `0 0 8px accent 40%` | Drag-over glow shadow |
| `--tv-drop-valid-bg` | `success 10%` | Valid drop background |
| `--tv-drop-valid-border-color` | `= --tv-success-color` | Valid drop border color |
| `--tv-drop-invalid-bg` | `danger 10%` | Invalid drop background |
| `--tv-drop-invalid-border-color` | `= --tv-danger-color` | Invalid drop border color |
| `--tv-dragover-highlight-bg` | `success 15%` | Dragover highlight background |
| `--tv-dragover-highlight-border` | `2px dashed success` | Dragover highlight border |
| `--tv-touch-ghost-bg` | `accent 90%` | Touch drag ghost background |
| `--tv-touch-ghost-shadow` | `0 4px 12px rgba(0,0,0,0.3)` | Touch ghost shadow |
| `--tv-scroll-highlight-bg` | `accent 30%` | Scroll-to-node highlight |
| `--tv-scroll-highlight-shadow` | `0 0 8px accent 40%` | Scroll highlight shadow |
| `--tv-dragged-opacity` | `0.5` | Dragged node opacity |
| `--tv-cut-opacity` | `0.4` | Cut node opacity (clipboard) |
| `--tv-empty-zone-border` | `2px dashed accent` | Empty zone border (during drag) |
| `--tv-empty-zone-bg` | `accent 10%` | Empty zone background |
| `--tv-empty-zone-radius` | `= --tv-border-radius-lg` | Empty zone border radius |

#### Context Menu

Each variable defaults to the corresponding higher-order `--tv-*` variable, so the menu inherits the tree's theme by default but can be styled independently.

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-context-menu-bg` | `= --tv-bg-color` | Menu background |
| `--tv-context-menu-bg-hover` | `= --tv-hover-bg` | Item hover background |
| `--tv-context-menu-text-color` | `= --tv-text-color` | Menu text color |
| `--tv-context-menu-border` | `1px solid --tv-border-color` | Menu border |
| `--tv-context-menu-border-radius` | `= --tv-border-radius-sm` | Menu border radius |
| `--tv-context-menu-shadow` | `0 2px 10px rgba(0,0,0,0.1)` | Menu shadow |
| `--tv-context-menu-min-width` | `calc(--tv-rem * 15)` | Menu min width |
| `--tv-context-menu-padding` | `--tv-spacing-sm 0` | Menu padding |
| `--tv-context-menu-font-size` | `= --tv-font-size-sm` | Menu font size |
| `--tv-context-menu-item-padding` | `--tv-spacing-md --tv-spacing-xl` | Item padding |
| `--tv-context-menu-item-gap` | `= --tv-spacing-md` | Gap between icon, label, shortcut |
| `--tv-context-menu-icon-width` | `= --tv-icon-size` | Item icon column width |
| `--tv-context-menu-icon-font-size` | `= --tv-font-size-xs` | Item icon font size |
| `--tv-context-menu-arrow-font-size` | `= --tv-font-size-xs` | Submenu arrow font size |
| `--tv-context-menu-danger-color` | `= --tv-danger-color` | Danger item text color |
| `--tv-context-menu-danger-bg-hover` | `danger 10%` | Danger item hover background |
| `--tv-context-menu-divider-color` | `= --tv-border-color` | Divider line color |
| `--tv-context-menu-divider-margin` | `--tv-spacing-sm 0` | Divider margin |
| `--tv-context-menu-disabled-opacity` | `0.5` | Disabled item opacity |

#### Loading

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-tree-min-height` | `calc(6 * --tv-rem)` | Min height for empty/loading states (60px) |
| `--tv-spinner-size` | `32px` | Spinner size |
| `--tv-spinner-track` | `= --tv-border-color` | Spinner track color |
| `--tv-spinner-color` | `= --tv-accent-color` | Spinner accent color |
| `--tv-loading-bg` | `rgba(255,255,255,0.8)` | Loading overlay background |

#### Z-Index

| Variable | Default | Description |
|----------|---------|-------------|
| `--tv-z-index-dropdown` | `1000` | Context menu, drop zones |
| `--tv-z-index-ghost` | `10000` | Touch drag ghost |
| `--tv-z-index-overlay` | `10` | Loading overlay |

## Pluggable Renderers

The default `DomRenderer` handles flat DOM rendering with event delegation. You can replace it with a framework-specific renderer:

```typescript
import { WebTreeView } from '@keenmate/web-treeview';
import type { TreeViewRenderer } from '@keenmate/web-treeview';

const customRenderer: TreeViewRenderer<MyData> = {
  mount(container, controller, config) { /* ... */ },
  updateConfig(config) { /* ... */ },
  destroy() { /* ... */ },
};

const tree = new WebTreeView(element, options, customRenderer);

// Or swap at runtime:
tree.setRenderer(customRenderer);
```

## Logging

All logging is disabled by default. Enable at runtime for debugging:

```javascript
import {
  enableLogging, disableLogging,
  setLogLevel, setCategoryLevel
} from '@keenmate/web-treeview';

// Enable all logging
enableLogging();

// Or specific categories
disableLogging();
setCategoryLevel('TREEVIEW:DATA', 'debug');
setCategoryLevel('TREEVIEW:UI', 'debug');

// Performance timing
import { enablePerfLogging, setPerfThreshold } from '@keenmate/web-treeview';
enablePerfLogging();
setPerfThreshold(5); // Only log operations > 5ms
```

**Categories:** `TREEVIEW:INIT`, `TREEVIEW:DATA`, `TREEVIEW:INDEX`, `TREEVIEW:UI`, `TREEVIEW:DRAG`, `TREEVIEW:RENDER`

## Architecture

```
WebTreeViewElement (web component)
  └── WebTreeView (facade)
        ├── TreeController (state, logic, DnD)
        │     └── LTree (path-based tree engine)
        └── TreeViewRenderer (pluggable rendering)
              └── DomRenderer (default, flat DOM + event delegation)
```

- **TreeController** manages all state and emits snapshots via `EventEmitter`
- **TreeViewRenderer** subscribes to snapshots and renders the DOM
- **LTree** is the pure data engine — can be used headless without any DOM

## Development

```bash
npm install
npm run dev          # Dev server on port 21111
npm run build        # Production build
npm run package      # Build + npm pack
```

## License

MIT
