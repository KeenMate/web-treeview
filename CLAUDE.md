# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This project creates a framework-agnostic web component wrapper for `@keenmate/svelte-treeview`. The architecture converts Svelte 5 components with runes into standard web components that work in React, Vue, Angular, or vanilla JavaScript.

## Development Commands

### Build & Development
```bash
npm run dev          # Start development server on port 11111  
npm run build        # Build for production (TypeScript compilation + Vite build)
npm run preview      # Preview production build
npm run type-check   # TypeScript type checking without emission
```

### Package Management
```bash
npm install          # Install dependencies including @keenmate/svelte-treeview from ../svelte-treeview/dist
```

Note: The source `@keenmate/svelte-treeview` is aliased to `../svelte-treeview/dist` in vite.config.ts, indicating the original Svelte component is in a sibling directory.

## Architecture Overview

### Core Web Component Wrapper Pattern

**SvelteTreeView Class** (`src/svelte-tree-view.ts`) - The main web component that:
- Extends `HTMLElement` and uses Shadow DOM for encapsulation
- Mounts the original Svelte `Tree` component in a shadow DOM container
- Proxies all 37+ observed attributes to Svelte component properties
- Converts Svelte events to standard CustomEvents (node-clicked, node-drag-start, etc.)
- Exposes all original Tree methods (expandNodes, collapseNodes, searchNodes, etc.)

### Template System Architecture

**TemplateSystem Class** (`src/template-system.ts`) - Handles the critical challenge of converting HTML templates to Svelte snippets:
- Parses `<template slot="...">` elements from light DOM
- Supports template interpolation with `${node.property}` syntax
- Converts templates to Svelte snippet equivalents via `getSvelteSnippets()`
- Supports: node-template, tree-header, tree-footer, no-data-found, context-menu slots

### Property & Event Flow

1. **Attributes → Properties**: `attributeChangedCallback` parses HTML attributes (kebab-case) to camelCase properties
2. **Properties → Svelte**: Properties are passed to Svelte component via `$set()` calls
3. **Svelte → Events**: Svelte event handlers dispatch CustomEvents on the web component
4. **Template Conversion**: HTML templates are parsed and converted to Svelte snippets on mount

### Build Output Architecture

The build produces dual outputs:
- **ES Module**: `dist/svelte-tree-view.js` (modern bundlers)
- **UMD**: `dist/svelte-tree-view.umd.js` (legacy/browser)
- **TypeScript**: `dist/svelte-tree-view.d.ts` (type definitions)

## Key Technical Considerations

### Template System Limitations
- Template interpolation uses simple regex replacement, not full expression evaluation
- Supports nested property access: `${node.data.name}`, `${node.path}`
- Templates are parsed once on component creation, not reactive to changes

### Svelte Integration Points
- Component mounting/unmounting handled in `connectedCallback`/`disconnectedCallback`
- All original Tree.svelte props are mapped through `TreeWebComponentProps<T>` interface
- Event delegation converts Svelte callbacks to standard DOM events
- Method proxying ensures all original Tree methods remain available

### Data Flow Patterns
- Uses LTree-style hierarchical paths ("1", "1.1", "1.1.1") for tree structure
- Data is stored in `_data` and `_props` private fields with reactive updates
- Selected node and search text are bidirectionally bound with events

### Shadow DOM Styling
- Component styles are encapsulated in Shadow DOM using SCSS architecture
- TreeView styles imported via `src/styles/web-component.scss` using modern `@use` syntax
- Styles are compiled by Sass and embedded directly into the component bundle (no external CSS dependencies)
- Supports CSS custom properties for theming (CSS variables prefixed with `--ltree-`)
- Template slot content inherits from light DOM styles

## Framework Integration Examples

The `/examples` directory contains complete working examples for:
- **Vanilla HTML**: Direct web component usage with template slots
- **React**: TypeScript integration with refs and event handling  
- **Vue**: Composition API with reactive properties

Each example demonstrates the same core functionality: data binding, event handling, search, expand/collapse, and template customization.

## Testing Strategy

When testing this component:
1. Build the component first (`npm run build`)
2. Test examples by serving them (they import from `/dist`)
3. The component requires the source Svelte TreeView to be built in the sibling directory
4. Events are CustomEvents, so use `addEventListener` not React-style props

## Dependencies Structure

- **Runtime**: Only `svelte` (bundled into the web component)
- **Development**: Standard Vite + TypeScript + Svelte + Sass toolchain
- **Source Dependency**: `@keenmate/svelte-treeview` from `../svelte-treeview/dist`

The web component bundles everything into a self-contained package that works without framework dependencies.