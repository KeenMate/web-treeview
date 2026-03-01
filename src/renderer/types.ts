/**
 * Pluggable renderer interface.
 * External packages (Svelte, React, Vue) can implement TreeViewRenderer
 * to provide framework-native rendering while using the shared TreeController.
 */

import type { TreeController } from '../controller/tree-controller';
import type { LTreeNode } from '../ltree/ltree-node';

export interface TreeViewRenderer<T = any> {
  /** Mount the renderer into a container, subscribing to controller state changes. */
  mount(container: HTMLElement, controller: TreeController<T>, config: RendererConfig<T>): void;
  /** Update renderer configuration without full re-mount. */
  updateConfig(config: Partial<RendererConfig<T>>): void;
  /** Tear down DOM and unsubscribe from controller events. */
  destroy(): void;
}

export interface RendererConfig<T> {
  /** Custom node content renderer. Receives the node and a container element to populate. */
  nodeTemplate?: (node: LTreeNode<T>, container: HTMLElement) => void;
  /** Rendered when the tree has no data. */
  emptyTemplate?: (container: HTMLElement) => void;
  /** Rendered when isLoading is true. */
  loadingTemplate?: (container: HTMLElement) => void;
  /** Rendered above the tree body. */
  headerTemplate?: (container: HTMLElement) => void;
  /** Rendered below the tree body. */
  footerTemplate?: (container: HTMLElement) => void;
  /** Context menu renderer. */
  contextMenuTemplate?: (node: LTreeNode<T>, close: () => void, container: HTMLElement) => void;
  /** Drop placeholder for empty tree during drag. */
  dropPlaceholderTemplate?: (container: HTMLElement) => void;
}
