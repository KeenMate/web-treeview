# @keenmate/web-treeview

A lightweight, framework-agnostic treeview web component with hierarchical data display, search, expand/collapse, drag-drop, and keyboard navigation.

> **Note:** This project is under active reconstruction as a web-component-first implementation. The rendering engine is being built from scratch — no framework dependencies.

## Installation

```bash
npm install @keenmate/web-treeview
```

## Quick Start

```html
<script type="module" src="./node_modules/@keenmate/web-treeview/dist/web-treeview.js"></script>

<web-treeview
  id="my-tree"
  id-member="id"
  path-member="path"
  display-value-member="name"
  expand-level="2">
</web-treeview>

<script>
  const tree = document.getElementById('my-tree');
  tree.data = [
    { id: '1', path: '1', name: 'Documents' },
    { id: '2', path: '1.1', name: 'Projects' },
    { id: '3', path: '1.1.1', name: 'Web App' },
  ];

  tree.addEventListener('node-clicked', (e) => {
    console.log('Clicked:', e.detail.node);
  });
</script>
```

## License

MIT
