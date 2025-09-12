import { SvelteTreeView } from './svelte-treeview.js';
import type { TreeEventMap, TreeWebComponentMethods, TreeWebComponentProps } from './types.js';

// Register the custom element
if (!customElements.get('svelte-tree-view')) {
  customElements.define('svelte-tree-view', SvelteTreeView);
}

// Export everything for programmatic usage
export { SvelteTreeView };
export type { TreeEventMap, TreeWebComponentMethods, TreeWebComponentProps };
export type { LTreeNode, Ltree } from '@keenmate/svelte-treeview';
export type { NodeTemplateFunction as TemplateFunction, HeaderFooterTemplate, TemplateSlots } from './template-system.js';

// Global declaration for TypeScript
declare global {
  interface HTMLElementTagNameMap {
    'svelte-tree-view': SvelteTreeView;
  }
}

export default SvelteTreeView;