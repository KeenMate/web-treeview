# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This project is a **web-component-first** treeview (`<web-treeview>`) built with vanilla TypeScript. No framework dependencies. Consistent with sibling projects `web-multiselect` and `web-daterangepicker`.

## Development Commands

### Build & Development
```bash
npm run dev          # Start development server on port 21111
npm run build        # Clean dist + Vite build
npm run preview      # Preview production build
npm run package      # Build + npm pack
npm run clean        # Remove dist and tarballs
npm run clean:dist   # Remove dist only
```

### Makefile
```bash
make help            # Show all available targets
make setup           # npm install
make dev             # Start dev server
make build           # Production build
make package         # Build + pack
make publish-dry     # Dry-run publish
```

## Architecture

### File Structure
```
src/
├── index.ts              # Entry point, global API, exports
├── web-component.ts      # WebTreeViewElement (extends HTMLElement)
├── treeview.ts           # WebTreeView core engine (pure logic)
├── types.ts              # All TypeScript interfaces
├── vite-env.d.ts         # Vite environment types
└── css/
    ├── main.css          # Entry point importing partials
    ├── _variables.css    # CSS custom properties with --base fallbacks
    └── _base.css         # Host styles, FOUC prevention, layout
```

### Two-Layer Architecture
1. **`WebTreeView<T>`** (`treeview.ts`) — Pure engine class. Takes an `HTMLElement` + config, manages tree state and rendering. No `HTMLElement` subclass, works anywhere.
2. **`WebTreeViewElement<T>`** (`web-component.ts`) — Custom element wrapper. Extends `HTMLElement`, uses Shadow DOM, proxies attributes/properties to the engine, dispatches `CustomEvent`s.

### Data Flow
- **Attributes** (kebab-case HTML) → `attributeChangedCallback` → engine config
- **Properties** (camelCase JS) → setters → engine `update()`
- **Engine → Events**: Tree interactions dispatch `CustomEvent`s on the host element

### CSS Custom Properties
All CSS variables use the `--tv-` prefix and fall back to `--base-*` variables from the design system:
```css
--tv-accent-color: var(--base-accent-color, #3b82f6);
--tv-text-color: var(--base-text-color, #1e293b);
--tv-indent-size: calc(var(--tv-rem) * 2);
```

### Build Output
- **ES Module**: `dist/web-treeview.js`
- **UMD**: `dist/web-treeview.umd.js`
- **Types**: `dist/index.d.ts`
- **Styles**: `dist/style.css`

### Build-Time Constants
Defined in `vite.config.ts` from `package.json`:
- `__VERSION__`, `__PACKAGE_NAME__`, `__AUTHOR__`, `__LICENSE__`, `__REPOSITORY__`, `__HOMEPAGE__`

### Global API
```js
window.components['web-treeview'].version()
window.components['web-treeview'].config
window.components['web-treeview'].register()
window.components['web-treeview'].getInstances()
```

## Key Technical Considerations

### Tree Data Model
- Uses LTree-style hierarchical paths: `"1"`, `"1.1"`, `"1.1.2"`
- `TreeNode<T>` wraps user data with tree metadata (path, level, expanded, selected, etc.)
- `TreeViewConfig<T>` specifies member mappings (`idMember`, `pathMember`, etc.) to map arbitrary data shapes

### SSR Safety
Web component uses the `BaseElement` pattern for SSR compatibility:
```ts
const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;
```

### Instance Tracking
All mounted `<web-treeview>` elements are tracked in a `Set` and exposed via `getAllInstances()`.

## Dependencies

- **Runtime**: None (zero dependencies)
- **Dev**: Vite, TypeScript, vite-plugin-dts, rimraf
