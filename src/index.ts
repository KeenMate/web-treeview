// Import styles
import './css/main.css';

// Import for export and global API
import { getAllInstances, WebTreeViewElement } from './web-component';

// Export the web component
export { WebTreeViewElement };

// Export the core engine wrapper
export { WebTreeView } from './treeview';

// Core LTree (for direct usage without web component)
export { createLTree } from './ltree/ltree';
export type { Ltree } from './ltree/types';
export type { LTreeNode, NodeId, DropPosition } from './ltree/ltree-node';
export { VisualState } from './ltree/ltree-node';

// Controller
export { TreeController } from './controller/tree-controller';
export { EventEmitter } from './controller/event-emitter';
export type {
  NodeCallbacks,
  NodeConfig,
  TreeControllerConfig,
  TreeControllerSnapshot,
  TreeControllerEvents
} from './controller/types';

// Renderer
export { DomRenderer } from './renderer/dom-renderer';
export { createRenderCoordinator } from './renderer/render-coordinator';
export type { TreeViewRenderer, RendererConfig } from './renderer/types';
export type { RenderCoordinator, RenderStats, RenderCoordinatorCallbacks } from './renderer/render-coordinator';

// Export types
export type {
  TreeNode,
  TreeViewConfig,
  TreeViewMethods,
  TreeEventMap,
  ContextMenuItem,
  ScrollToPathOptions,
  InsertArrayResult,
  TreeChange,
  ApplyChangesResult,
  DragDropMode,
  DropZoneLayout,
  DropOperation
} from './types';

// Logging
export { enableLogging, disableLogging, setLogLevel, setCategoryLevel, LOGGING_CATEGORIES } from './logger';
export { enablePerfLogging, disablePerfLogging, setPerfThreshold } from './perf-logger';

// Auto-register the custom element
import './web-component';

// Type declarations for build-time constants
declare const __VERSION__: string;
declare const __PACKAGE_NAME__: string;
declare const __AUTHOR__: string;
declare const __LICENSE__: string;
declare const __REPOSITORY__: string;
declare const __HOMEPAGE__: string;

// Global API interface
export interface GlobalTreeViewAPI {
  version: () => string;
  config: {
    name: string;
    version: string;
    author: string;
    license: string;
    repository: string;
    homepage: string;
  };
  register: () => void;
  getInstances: () => HTMLElement[];
}

// Declare global namespace
declare global {
  interface HTMLElementTagNameMap {
    'web-treeview': WebTreeViewElement;
  }
  interface Window {
    components?: {
      'web-treeview'?: GlobalTreeViewAPI;
    };
  }
}

// Initialize global API
if (typeof window !== 'undefined') {
  window.components = window.components || {};
  window.components['web-treeview'] = {
    version: () => __VERSION__,
    config: {
      name: __PACKAGE_NAME__,
      version: __VERSION__,
      author: __AUTHOR__,
      license: __LICENSE__,
      repository: __REPOSITORY__,
      homepage: __HOMEPAGE__
    },
    register: () => {
      if (typeof customElements !== 'undefined' && !customElements.get('web-treeview')) {
        customElements.define('web-treeview', WebTreeViewElement);
      }
    },
    getInstances: () => getAllInstances()
  };
}
