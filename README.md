# 🌲 Svelte TreeView Web Component

A framework-agnostic web component wrapper for [@keenmate/svelte-treeview](https://github.com/keenmate/svelte-treeview), bringing powerful tree visualization capabilities to any web framework or vanilla JavaScript application.

## ✨ Features

- 🌐 **Framework Agnostic**: Works with React, Vue, Angular, or vanilla JavaScript
- 🔍 **Full-text Search**: Built-in search with FlexSearch integration
- 🎯 **Drag & Drop**: Native drag and drop support with customizable handlers
- 🎨 **Custom Templates**: Flexible template system using slots or functions
- 📱 **Responsive**: Mobile-friendly with touch support
- ⚡ **Performance**: Virtual scrolling for large datasets
- 🎭 **TypeScript**: Full TypeScript support with type definitions
- 🧩 **Extensible**: Rich API with events and methods
- 🎯 **Accessible**: ARIA compliant and keyboard navigation

## 📦 Installation

```bash
npm install @keenmate/svelte-treeview-webcomponent
```

## 🚀 Quick Start

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module" src="./node_modules/@keenmate/svelte-treeview-webcomponent/dist/svelte-tree-view.js"></script>
</head>
<body>
    <svelte-tree-view 
        id-member="id" 
        path-member="path"
        expand-level="2">
    </svelte-tree-view>

    <script>
        const treeView = document.querySelector('svelte-tree-view');
        treeView.data = [
            { id: '1', path: '1', name: 'Documents' },
            { id: '2', path: '1.1', name: 'Projects' },
            { id: '3', path: '1.1.1', name: 'Web App' },
            { id: '4', path: '1.1.1.1', name: 'index.html' }
        ];
    </script>
</body>
</html>
```

### React

```tsx
import React, { useEffect, useRef } from 'react';
import '@keenmate/svelte-treeview-webcomponent';
import type { SvelteTreeView } from '@keenmate/svelte-treeview-webcomponent';

const MyComponent = () => {
  const treeRef = useRef<SvelteTreeView>(null);

  useEffect(() => {
    if (treeRef.current) {
      treeRef.current.data = [
        { id: '1', path: '1', name: 'Root' },
        { id: '2', path: '1.1', name: 'Child' }
      ];
    }
  }, []);

  return (
    <svelte-tree-view
      ref={treeRef}
      id-member="id"
      path-member="path"
      expand-level={2}
      onNodeClicked={(e) => console.log('Node clicked:', e.detail.node)}
    />
  );
};
```

### Vue 3

```vue
<template>
  <svelte-tree-view
    ref="treeRef"
    id-member="id"
    path-member="path"
    :expand-level="2"
    @node-clicked="handleNodeClick"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue';
import '@keenmate/svelte-treeview-webcomponent';

const treeRef = ref();

onMounted(() => {
  treeRef.value.data = [
    { id: '1', path: '1', name: 'Root' },
    { id: '2', path: '1.1', name: 'Child' }
  ];
});

const handleNodeClick = (event) => {
  console.log('Node clicked:', event.detail.node);
};
</script>
```

## 🎨 Custom Templates

Use HTML templates with slot attributes to customize rendering:

```html
<svelte-tree-view id-member="id" path-member="path">
  <!-- Custom node template -->
  <template slot="node-template">
    <div class="custom-node">
      <span class="icon">\${node.data.type === 'folder' ? '📁' : '📄'}</span>
      <span class="name">\${node.data.name}</span>
      <span class="size">\${node.data.size || ''}</span>
    </div>
  </template>
  
  <!-- Header template -->
  <template slot="tree-header">
    <h3>📂 File Explorer</h3>
  </template>
  
  <!-- Empty state template -->
  <template slot="no-data-found">
    <div class="empty-state">No files found 📭</div>
  </template>
</svelte-tree-view>
```

Or set templates programmatically:

```javascript
const tree = document.querySelector('svelte-tree-view');

tree.setNodeTemplate((node) => `
  <div class="custom-node">
    <strong>\${node.data.name}</strong>
    <small>\${node.path}</small>
  </div>
`);
```

## 🔧 Configuration

### Required Attributes

- `id-member`: Property name for unique node identifiers
- `path-member`: Property name for hierarchical paths (e.g., "1", "1.1", "1.2.3")

### Optional Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `expand-level` | number | 2 | Default expansion level |
| `search-text` | string | "" | Current search query |
| `tree-path-separator` | string | "." | Path separator character |
| `should-toggle-on-node-click` | boolean | true | Toggle expansion on click |
| `should-use-internal-search-index` | boolean | true | Enable FlexSearch integration |
| `should-display-debug-information` | boolean | false | Show debug info |

### Visual Styling

| Attribute | Description |
|-----------|-------------|
| `selected-node-class` | CSS class for selected nodes |
| `drag-over-node-class` | CSS class during drag over |
| `expand-icon-class` | CSS class for expand icons |
| `collapse-icon-class` | CSS class for collapse icons |
| `leaf-icon-class` | CSS class for leaf node icons |

## 🎯 API Methods

```javascript
const tree = document.querySelector('svelte-tree-view');

// Expansion control
await tree.expandNodes('1.2');      // Expand specific path
await tree.collapseNodes('1.2');    // Collapse specific path
tree.expandAll();                    // Expand all nodes
tree.collapseAll();                  // Collapse all nodes

// Search and filtering
tree.filterNodes('search term');    // Filter visible nodes
const results = tree.searchNodes('query'); // Get search results

// Navigation
await tree.scrollToPath('1.2.3', {
  behavior: 'smooth',
  block: 'center'
});

// Event handlers
tree.onNodeClicked = (node) => console.log('Clicked:', node);
tree.onNodeDragStart = (node, event) => console.log('Drag start:', node);
tree.onNodeDragOver = (node, event) => console.log('Drag over:', node);
tree.onNodeDrop = (dropNode, draggedNode, event) => {
  console.log('Dropped:', draggedNode, 'on:', dropNode);
};
```

## 🎪 Events

Listen for custom events:

```javascript
tree.addEventListener('node-clicked', (e) => {
  console.log('Node clicked:', e.detail.node);
});

tree.addEventListener('selected-node-changed', (e) => {
  console.log('Selection changed:', e.detail.selectedNode);
});

tree.addEventListener('search-text-changed', (e) => {
  console.log('Search changed:', e.detail.searchText);
});

tree.addEventListener('node-drag-start', (e) => {
  console.log('Drag started:', e.detail.node, e.detail.event);
});

tree.addEventListener('node-drop', (e) => {
  console.log('Node dropped:', e.detail.node, e.detail.draggedNode);
});
```

## 🗄️ Data Format

The component expects hierarchical data using LTree-style paths:

```javascript
const data = [
  {
    id: '1',           // Unique identifier
    path: '1',         // Hierarchical path
    name: 'Documents', // Display name
    // ... custom properties
  },
  {
    id: '2',
    path: '1.1',       // Child of '1'
    name: 'Projects',
  },
  {
    id: '3',
    path: '1.1.1',     // Child of '1.1'
    name: 'Web App',
  },
  {
    id: '4',
    path: '1.2',       // Another child of '1'
    name: 'Images',
  }
];
```

## 🎨 Styling

The component includes default styles but can be customized:

```css
/* Custom CSS variables */
svelte-tree-view {
  --tree-indent: 20px;
  --node-height: 32px;
  --selected-bg: #e3f2fd;
  --hover-bg: #f5f5f5;
  --icon-size: 16px;
  --font-size: 14px;
}

/* Custom node styling */
svelte-tree-view .custom-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
}

svelte-tree-view .custom-node:hover {
  background-color: var(--hover-bg);
}
```

## 📚 Examples

Check out the `examples/` directory for complete implementations:

- [`vanilla.html`](./examples/vanilla.html) - Pure JavaScript implementation
- [`react.tsx`](./examples/react.tsx) - React integration
- [`vue.vue`](./examples/vue.vue) - Vue 3 composition API

## 🔄 Migration from Svelte TreeView

If you're migrating from the original Svelte component:

```diff
<!-- Svelte component -->
- <Tree bind:data {idMember} {pathMember} />

<!-- Web component -->
+ <svelte-tree-view id-member="id" path-member="path"></svelte-tree-view>
+ <script>
+   document.querySelector('svelte-tree-view').data = yourData;
+ </script>
```

### Key differences:

1. **Attributes**: Use kebab-case instead of camelCase
2. **Data binding**: Set data property programmatically
3. **Events**: Listen for custom events instead of component events
4. **Templates**: Use HTML templates with slots instead of Svelte snippets

## 🤝 Contributing

Contributions are welcome! Please read the [contributing guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Related Projects

- [@keenmate/svelte-treeview](https://github.com/keenmate/svelte-treeview) - Original Svelte component
- [FlexSearch](https://github.com/nextapps-de/flexsearch) - Search engine integration

## 🆘 Support

- 📖 [Documentation](https://github.com/keenmate/svelte-treeview-webcomponent/wiki)
- 🐛 [Issue Tracker](https://github.com/keenmate/svelte-treeview-webcomponent/issues)
- 💬 [Discussions](https://github.com/keenmate/svelte-treeview-webcomponent/discussions)

---

Made with ❤️ by [KeenMate](https://github.com/keenmate)