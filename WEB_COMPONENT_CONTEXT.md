# Svelte TreeView Web Component Wrapper - Implementation Context

## Project Overview

**Goal**: Convert @keenmate/svelte-treeview (Svelte 5 component) to a framework-agnostic web component using wrapper approach with build pipeline.

**Source Component**: Advanced hierarchical tree component with drag & drop, search, filtering, and custom templates.

**Approach**: Wrapper pattern - Create custom element class that instantiates and manages the Svelte component internally while exposing web standards API.

## Source Component Architecture

**Package**: @keenmate/svelte-treeview v4.0.0-rc08  
**Framework**: Svelte 5 with runes ($state, $derived, $effect)  
**Data Structure**: LTree (PostgreSQL ltree-style paths: "1", "1.1", "1.2.3")  
**Dependencies**: FlexSearch (optional), TypeScript

### svelte-treeview library location
Library files can be find at C:\Git\KM\svelte-treeview\

### Key Files Structure
```
src/lib/
├── components/
│   ├── Tree.svelte (main component)
│   └── Node.svelte (recursive node renderer)
├── ltree/
│   ├── types.ts (TypeScript interfaces)
│   ├── ltree.svelte.ts (core LTree logic)
│   ├── ltree-node.svelte.ts (node interface)
│   └── indexer.ts (async search indexing)
├── styles/
│   └── main.scss (component styles)
└── index.ts (public exports)
```

### Core Interfaces

```typescript
// Main tree interface
interface Ltree<T> {
  insertArray(data: T[]): InsertArrayResult<T>;
  filterNodes(searchText: string, searchOptions?: SearchOptions): void;
  searchNodes(searchText: string, searchOptions?: SearchOptions): LTreeNode<T>[];
  expandAll(nodePath?: string): void;
  collapseAll(nodePath?: string): void;
  getNodeByPath(path: string): LTreeNode<T> | null;
  // ... other methods
}

// Node interface  
interface LTreeNode<T> {
  path: string;
  pathSegment: string;
  parentPath: string | null;
  level: number;
  children: Record<string, LTreeNode<T>>;
  data: T | null;
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  isDraggable?: boolean;
  // ... other properties
}
```

### Required Props (Tree.svelte)
```typescript
interface Props {
  // REQUIRED
  data: T[];
  idMember: string;
  pathMember: string;
  
  // MAPPINGS  
  parentPathMember?: string;
  levelMember?: string;
  displayValueMember?: string;
  searchValueMember?: string;
  isDraggableMember?: string;
  isDropAllowedMember?: string;
  
  // BEHAVIOR
  expandLevel?: number; // default: 2
  shouldUseInternalSearchIndex?: boolean;
  shouldDisplayDebugInformation?: boolean;
  treePathSeparator?: string; // default: "."
  
  // STYLING
  selectedNodeClass?: string;
  dragOverNodeClass?: string;
  scrollHighlightClass?: string;
  
  // CALLBACKS
  getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  getSearchValueCallback?: (node: LTreeNode<T>) => string;
  sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  
  // EVENT HANDLERS
  onNodeClicked?: (node: LTreeNode<T>) => void;
  onNodeRightClicked?: (node: LTreeNode<T>, event: MouseEvent) => void;
  onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDrop?: (dropNode: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;
  
  // BINDABLE
  searchText?: string;
  selectedNode?: LTreeNode<T> | null;
  insertResult?: InsertArrayResult<T> | null;
  
  // SNIPPETS (MAJOR CHALLENGE)
  nodeTemplate?: Snippet<[LTreeNode<T>]>;
  treeHeader?: Snippet;
  treeFooter?: Snippet;
  noDataFound?: Snippet;
  contextMenu?: Snippet<[LTreeNode<T>]>;
}
```

### Public Methods (Tree.svelte exports)
```typescript
export function expandNodes(nodePath: string): void;
export function collapseNodes(nodePath: string): void;
export function expandAll(nodePath?: string): void;
export function collapseAll(nodePath?: string): void;
export function filterNodes(searchText: string, searchOptions?: SearchOptions): void;
export function searchNodes(searchText: string, searchOptions?: SearchOptions): LTreeNode<T>[];
export function scrollToPath(path: string, options?: ScrollToPathOptions): Promise<boolean>;
```

## Web Component Requirements

### Must Support
1. **All core functionality**: Search, filter, drag & drop, expand/collapse
2. **Property binding**: Data updates, search text, selected node
3. **Event delegation**: Node clicks, drags, context menu
4. **Public methods**: All export functions from Tree.svelte
5. **Custom templates**: Most critical challenge - convert snippets
6. **Styling**: CSS encapsulation with Shadow DOM
7. **TypeScript**: Generate proper .d.ts declarations

### Template System Challenge
**Problem**: Svelte snippets cannot be directly used in web components
**Solutions**:
1. Template strings with interpolation
2. Slot-based system with named slots
3. Render function approach
4. HTML template elements

### Target API Design
```html
<!-- Basic Usage -->
<svelte-tree-view 
  id-member="id" 
  path-member="path"
  search-text="query"
  expand-level="3">
</svelte-tree-view>

<!-- With Custom Templates -->
<svelte-tree-view id-member="id" path-member="path">
  <template slot="node-template">
    <div class="custom-node">
      <span class="icon">${icon}</span>
      <span class="name">${name}</span>
    </div>
  </template>
</svelte-tree-view>
```

## Implementation Tasks

### Phase 1: Core Wrapper
1. **Create wrapper class**: Custom element extending HTMLElement
2. **Property management**: Getters/setters for all Tree props
3. **Svelte integration**: Mount/unmount Svelte component
4. **Event delegation**: Convert Svelte events to CustomEvents
5. **Method proxying**: Expose all public methods

### Phase 2: Template System
1. **Design template API**: Slot-based or function-based
2. **Template parsing**: Convert HTML templates to render functions
3. **Context passing**: Provide node data to templates
4. **Fallback rendering**: Default templates when none provided

### Phase 3: Build Pipeline
1. **Bundle configuration**: Vite/Rollup setup
2. **CSS handling**: Extract and encapsulate styles
3. **TypeScript declarations**: Generate .d.ts files
4. **Tree shaking**: Minimize bundle size
5. **Output formats**: ES modules, UMD, IIFE

### Phase 4: Testing & Documentation
1. **Framework tests**: React, Vue, Angular, Vanilla JS
2. **API documentation**: MDN-style web component docs
3. **Migration guide**: Svelte to web component
4. **Demo pages**: Live examples

## Technical Challenges

### 1. Template Conversion
```typescript
// Svelte snippet
{#snippet nodeTemplate(node)}
  <div>{node.data.name}</div>
{/snippet}

// Web component equivalent (option 1: template element)
<template slot="node-template">
  <div>${node.data.name}</div>
</template>

// Web component equivalent (option 2: function)
tree.setNodeTemplate((node) => `
  <div>${node.data.name}</div>
`);
```

### 2. Complex Props (Functions/Objects)
```typescript
// Svelte
<Tree sortCallback={customSort} onNodeClicked={handler} />

// Web component
tree.sortCallback = customSort;
tree.addEventListener('node-clicked', handler);
```

### 3. Reactive Updates
```typescript
// Ensure Svelte component updates when properties change
set data(newData) {
  this._data = newData;
  if (this.svelteComponent) {
    this.svelteComponent.$set({ data: newData });
  }
}
```

## File Structure Target
```
web-component/
├── src/
│   ├── svelte-tree-web-component.ts (main wrapper)
│   ├── template-system.ts (template handling)
│   ├── property-mapper.ts (prop/attribute mapping)
│   └── event-system.ts (event delegation)
├── styles/
│   └── web-component.scss (shadow DOM styles)
├── dist/
│   ├── svelte-tree-view.js (ES module)
│   ├── svelte-tree-view.umd.js (UMD)
│   └── svelte-tree-view.d.ts (TypeScript declarations)
├── examples/
│   ├── vanilla.html
│   ├── react.tsx
│   └── vue.vue
└── package.json
```

## Success Criteria

1. **Functionality Parity**: All Svelte component features work
2. **Performance**: Minimal overhead from wrapper layer
3. **DX**: Good TypeScript intellisense and documentation
4. **Framework Agnostic**: Works in React, Vue, Angular, Vanilla
5. **Bundle Size**: Reasonable size (~200KB gzipped target)
6. **Template System**: Flexible enough for common use cases

## Next Steps

1. Start with basic wrapper - mount Svelte component in shadow DOM
2. Implement property system for core props (data, idMember, pathMember)
3. Add event delegation for basic events (node-clicked)
4. Design and implement template system
5. Set up build pipeline
6. Create comprehensive examples and documentation

## Notes

- Original component uses Svelte 5 runes - ensure compatibility
- FlexSearch integration must be preserved for search functionality
- Drag & drop events need special handling in web components
- CSS custom properties should be preserved for theming
- Consider lazy loading for large datasets
- May need polyfills for older browsers

This context provides everything needed to implement the web component wrapper while preserving all functionality of the original Svelte TreeView component.