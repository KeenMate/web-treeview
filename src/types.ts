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

// ── Configuration ──────────────────────────────────────────────────────

import type { LTreeNode } from './ltree/ltree-node';
import type { DropPosition } from './ltree/ltree-node';

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

  // Progressive rendering (for future use)
  progressiveRender?: boolean | null;
  initialBatchSize?: number | null;
  maxBatchSize?: number | null;

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

  // Callbacks
  getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  getSearchValueCallback?: (node: LTreeNode<T>) => string;
  getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => import('./ltree/types').ContextMenuItem[];
  indexingCompleteCallback?: () => void;

  // Context Menu
  contextMenuXOffset?: number | null;
  contextMenuYOffset?: number | null;

  // Debug
  shouldDisplayDebugInformation?: boolean | null;

  // Event handlers
  onNodeClicked?: (node: LTreeNode<T>) => void;
  onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDrop?: (node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;
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
}
