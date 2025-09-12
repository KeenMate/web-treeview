# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-12

### Added

- **Initial release** of the Svelte TreeView Web Component
- **Framework-agnostic web component wrapper** for [@keenmate/svelte-treeview](https://github.com/keenmate/svelte-treeview)
- **Shadow DOM encapsulation** for style isolation and component encapsulation
- **Automatic property conversion** between camelCase JavaScript properties and kebab-case HTML attributes
- **Template system** supporting HTML `<template slot="...">` elements for:
  - `node-template` - Custom node rendering
  - `tree-header` - Tree header content
  - `tree-footer` - Tree footer content  
  - `no-data-found` - Empty state template
  - `context-menu` - Custom context menu
- **Complete API proxy** to underlying Svelte TreeView component:
  - `expandAll()`, `collapseAll()`, `expandNodes()`, `collapseNodes()`
  - `searchNodes()`, `filterNodes()` 
  - `scrollToPath()` with Shadow DOM compatibility
- **Custom events** for framework integration:
  - `node-clicked` - Node selection events
  - `selected-node-changed` - Selection change events
  - `search-text-changed` - Search text updates
  - `node-drag-start`, `node-drag-over`, `node-drop` - Drag & drop events
- **Search and filtering capabilities**:
  - Two modes: Search (navigation) and Filter (visibility)
  - Real-time search with result navigation
  - Enter key and arrow button navigation through results
  - Search results list with clickable navigation
- **Visual feedback features**:
  - Scroll highlighting with `ltree-scroll-highlight-arrow` class
  - Red arrow indicators when navigating to search results
  - Smooth scrolling with configurable highlight timeout
- **Large dataset performance** demonstration:
  - 1000+ node generation with realistic business terms
  - 6-level deep hierarchical structures
  - Word bank with 200+ realistic terms
  - Performance statistics and dataset information
- **Comprehensive examples**:
  - Vanilla HTML/JavaScript with Bootstrap UI
  - React integration example with TypeScript
  - Vue 3 Composition API example
  - Multiple demo modes: Basic, Templates, Events, Advanced, Large Dataset
- **TypeScript support** with complete type definitions
- **Build system** producing both ES Module and UMD outputs:
  - `dist/web-treeview.js` (ES Module)  
  - `dist/web-treeview.umd.js` (UMD)
  - `dist/web-treeview.d.ts` (TypeScript definitions)

### Technical Implementation

- **Shadow DOM-aware scrollToPath** - Custom implementation that handles `document.getElementById()` limitations in Shadow DOM by temporarily replacing the method with a shadow-root-aware version
- **Template interpolation system** - Converts HTML template strings with `${node.property}` syntax to Svelte snippets
- **Reactive property updates** - Proper synchronization between web component properties and internal Svelte component state
- **Event delegation** - Clean conversion from Svelte component events to web component CustomEvents
- **Automatic builds** - Vite-based build system with TypeScript compilation and SCSS processing

### Framework Compatibility

- ✅ **Vanilla JavaScript/HTML** - Direct web component usage
- ✅ **React** - Custom element support with ref handling and event listeners
- ✅ **Vue 3** - Template integration with reactive property binding  
- ✅ **Angular** - Component integration with custom element schemas
- ✅ **Any framework** supporting custom elements (web components)

### Browser Support

- Chrome/Edge 88+
- Firefox 63+  
- Safari 13.1+
- Requires: Custom Elements v1, Shadow DOM v1

### Dependencies

- `@keenmate/svelte-treeview: ^4.0.0-rc09` - Core TreeView component
- `svelte: ^5.38.9` - Runtime (bundled)
- `flexsearch: ^0.8.212` - Search functionality (optional)

[1.0.0]: https://github.com/keenmate/svelte-treeview-webcomponent/releases/tag/v1.0.0