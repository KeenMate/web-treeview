// Re-export core types from LTree engine
export type { LTreeNode as TreeNode, LTreeNode, NodeId, DropPosition } from './ltree/ltree-node';
export { VisualState } from './ltree/ltree-node';
export type {
  Ltree,
  InsertArrayResult,
  TreeChange,
  ApplyChangesResult,
  DragDropMode,
  DropZoneLayout,
  DropOperation
} from './ltree/types';

// Re-export ContextMenuItem from ltree types
export type { ContextMenuItem } from './ltree/types';

// Re-export controller types
export type {
  NodeCallbacks,
  NodeConfig,
  TreeControllerConfig,
  TreeControllerSnapshot,
  TreeControllerEvents
} from './controller/types';

// Re-export renderer types
export type { TreeViewRenderer, RendererConfig } from './renderer/types';
export type { RenderCoordinator, RenderStats, RenderCoordinatorCallbacks } from './renderer/render-coordinator';

// ── Configuration ──────────────────────────────────────────────────────

import type { LTreeNode } from './ltree/ltree-node';
import type { DropPosition } from './ltree/ltree-node';
import type { DragDropMode, DropOperation, ContextMenuItem } from './ltree/types';
import type { RenderStats } from './renderer/render-coordinator';

export interface TreeViewConfig<T = any> {
  // Required
  data: T[];
  idMember: string;
  pathMember: string;

  // Tree identification
  treeId?: string | null;

  // Optional member mappings
  parentPathMember?: string | null;
  levelMember?: string | null;
  isExpandedMember?: string | null;
  isSelectedMember?: string | null;
  isDraggableMember?: string | null;
  isDropAllowedMember?: string | null;
  hasChildrenMember?: string | null;
  displayValueMember?: string | null;
  searchValueMember?: string | null;
  isSelectableMember?: string | null;
  isCollapsibleMember?: string | null;
  orderMember?: string | null;
  allowedDropPositionsMember?: string | null;

  // Behavior
  expandLevel?: number | null;
  treePathSeparator?: string | null;
  shouldToggleOnNodeClick?: boolean | null;
  isSorted?: boolean | null;

  // Search
  shouldUseInternalSearchIndex?: boolean | null;
  indexerBatchSize?: number | null;
  indexerTimeout?: number | null;

  // Progressive rendering
  progressiveRender?: boolean | null;
  initialBatchSize?: number | null;
  maxBatchSize?: number | null;

  // Flat rendering
  useFlatRendering?: boolean | null;
  flatIndentSize?: string | null;

  // Visual
  bodyClass?: string | null;
  selectedNodeClass?: string | null;
  dragOverNodeClass?: string | null;
  expandIconClass?: string | null;
  collapseIconClass?: string | null;
  leafIconClass?: string | null;
  scrollHighlightTimeout?: number | null;
  scrollHighlightClass?: string | null;

  // Bindable properties
  searchText?: string | null;
  selectedNode?: LTreeNode<T> | null;

  // Loading
  isLoading?: boolean | null;

  // Callbacks
  getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  getSearchValueCallback?: (node: LTreeNode<T>) => string;
  getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[];
  indexingCompleteCallback?: () => void;

  // Context Menu
  contextMenuXOffset?: number | null;
  contextMenuYOffset?: number | null;

  // Debug
  shouldDisplayDebugInformation?: boolean | null;

  // Drag and Drop
  dragDropMode?: DragDropMode;
  dropZoneMode?: 'floating' | 'glow';
  dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  dropZoneStart?: number | string;
  dropZoneMaxWidth?: number;
  allowCopy?: boolean;
  autoHandleCopy?: boolean;

  // Event handlers
  onNodeClicked?: (node: LTreeNode<T>) => void;
  onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
  beforeDropCallback?: (
    dropNode: LTreeNode<T> | null,
    draggedNode: LTreeNode<T>,
    position: DropPosition,
    event: DragEvent | TouchEvent,
    operation: DropOperation
  ) =>
    | boolean
    | { position?: DropPosition; operation?: DropOperation }
    | void
    | Promise<
        | boolean
        | { position?: DropPosition; operation?: DropOperation }
        | void
      >;
  onNodeDrop?: (
    dropNode: LTreeNode<T> | null,
    draggedNode: LTreeNode<T>,
    position: DropPosition,
    event: DragEvent | TouchEvent,
    operation: DropOperation
  ) => void;

  // Render callbacks
  onRenderStart?: () => void;
  onRenderProgress?: (stats: RenderStats) => void;
  onRenderComplete?: (stats: RenderStats) => void;

  // Template callbacks (for DomRenderer)
  nodeTemplate?: (node: LTreeNode<T>, container: HTMLElement) => void;
  emptyTemplate?: (container: HTMLElement) => void;
  loadingTemplate?: (container: HTMLElement) => void;
  headerTemplate?: (container: HTMLElement) => void;
  footerTemplate?: (container: HTMLElement) => void;
  contextMenuTemplate?: (node: LTreeNode<T>, close: () => void, container: HTMLElement) => void;
  dropPlaceholderTemplate?: (container: HTMLElement) => void;
}

// ── Methods ────────────────────────────────────────────────────────────

export interface TreeViewMethods<T = any> {
  expandNodes(nodePath: string): void;
  collapseNodes(nodePath: string): void;
  expandAll(nodePath?: string | null): void;
  collapseAll(nodePath?: string | null): void;
  filterNodes(searchText: string): void;
  searchNodes(searchText: string | null): LTreeNode<T>[];
  scrollToPath(path: string, options?: ScrollToPathOptions): Promise<boolean>;
  closeContextMenu(): void;
  update(props: Partial<TreeViewConfig<T>>): void;
  getTree(): import('./ltree/types').Ltree<T>;
  destroy(): void;
}

// ── Events ─────────────────────────────────────────────────────────────

export interface TreeEventMap<T = any> {
  'node-clicked': CustomEvent<{ node: LTreeNode<T> }>;
  'node-drag-start': CustomEvent<{ node: LTreeNode<T>; event: DragEvent }>;
  'node-drag-over': CustomEvent<{ node: LTreeNode<T>; event: DragEvent }>;
  'node-drop': CustomEvent<{ node: LTreeNode<T>; draggedNode: LTreeNode<T>; event: DragEvent }>;
  'data-changed': CustomEvent<{ data: T[] }>;
  'selected-node-changed': CustomEvent<{ selectedNode: LTreeNode<T> | null }>;
  'search-text-changed': CustomEvent<{ searchText: string }>;
  'tree-changed': CustomEvent<void>;
}

// ── Scroll Options ─────────────────────────────────────────────────────

export interface ScrollToPathOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
  expand?: boolean;
  expandTarget?: boolean;
  highlight?: boolean;
  scrollOptions?: ScrollIntoViewOptions;
  containerScroll?: boolean;
  containerElement?: HTMLElement;
}
