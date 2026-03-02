# @keenmate/web-treeview

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-treeview.svg)](https://www.npmjs.com/package/@keenmate/web-treeview)

A lightweight, framework-agnostic treeview web component built with vanilla TypeScript. Zero runtime framework dependencies. Supports hierarchical data display, search, expand/collapse, drag-and-drop, context menus, custom templates, and pluggable renderers.

## Features

- **Web Component** - Standard `<web-treeview>` custom element, works in any framework or vanilla HTML
- **LTree Path Model** - Materialized path hierarchy (`1`, `1.1`, `1.1.2`) with configurable separator
- **Drag and Drop** - Internal and cross-tree DnD with glow/floating drop zones, copy support, touch drag
- **Full-Text Search** - Built-in FlexSearch indexing with async batch processing, filter and highlight
- **Progressive Rendering** - `requestAnimationFrame`-batched rendering for smooth loading of large trees (100k+ nodes)
- **Custom Templates** - Callback-based templates for nodes, empty state, loading, header, footer, context menu
- **Pluggable Renderers** - `TreeViewRenderer<T>` interface for framework-specific renderers (Svelte, React, Vue)
- **CSS Theming** - Full customization via `--tv-*` CSS custom properties
- **Categorized Logging** - Runtime-configurable log categories for debugging
- **TypeScript** - Fully typed API with generic `<T>` data support
- **SSR Safe** - Compatible with server-side rendering environments

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
| `should-toggle-on-node-click` | `boolean` | `true` | Toggle expand/collapse on node click |
| `progressive-render` | `boolean` | `true` | Enable progressive rendering for large trees |
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
| `contextMenuCallback` | `(node, close) => ContextMenuItem[]` | Context menu items |
| `nodeTemplate` | `(node, container) => void` | Custom node rendering |
| `emptyTemplate` | `(container) => void` | Empty state template |
| `loadingTemplate` | `(container) => void` | Loading state template |
| `headerTemplate` | `(container) => void` | Tree header template |
| `footerTemplate` | `(container) => void` | Tree footer template |
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
| `getTree` | `(): Ltree<T>` | Access the underlying LTree instance |
| `getController` | `(): TreeController<T>` | Access the TreeController directly |
| `update` | `(props: Partial<TreeViewConfig<T>>)` | Update multiple properties at once |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `node-clicked` | `{ node: LTreeNode<T> }` | Node was clicked |
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

## Custom Templates

```javascript
tree.nodeTemplate = (node, container) => {
  container.innerHTML = `
    <span class="icon">${node.hasChildren ? '📁' : '📄'}</span>
    <span class="label">${node.displayValue}</span>
    <span class="badge">${node.children?.length ?? 0}</span>
  `;
};

tree.emptyTemplate = (container) => {
  container.innerHTML = '<p>No items to display</p>';
};
```

## Theming

Style the tree using CSS custom properties:

```css
web-treeview {
  --tv-accent-color: #8b5cf6;
  --tv-text-color: #1e293b;
  --tv-hover-bg: #f1f5f9;
  --tv-selected-bg: #ede9fe;
  --tv-indent-size: 1.5rem;
  --tv-node-height: 2rem;
  --tv-border-radius: 0.25rem;
  --tv-font-size: 0.875rem;
}
```

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
