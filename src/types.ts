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

// Re-export context menu types from ltree types
export type { ContextMenuItem, ContextMenuDivider, ContextMenuEntry } from './ltree/types';

// Re-export controller types
export type {
  NodeCallbacks,
  NodeConfig,
  ClickBehavior,
  SelectionModifiers,
  RangeSelectionMode,
  TreeControllerConfig,
  TreeControllerSnapshot,
  TreeControllerEvents
} from './controller/types';

// Re-export clipboard types
export type { ClipboardEntry, TreeClipboard, ClipboardOperation, PasteResult } from './clipboard';

// Re-export navigation types
export type { TreeNavigation, TreeNavigationOverrides } from './navigation';

// Re-export renderer types
export type { TreeViewRenderer, RendererConfig } from './renderer/types';
export type { RenderCoordinator, RenderStats, RenderCoordinatorCallbacks } from './renderer/render-coordinator';

// ── Configuration ──────────────────────────────────────────────────────

import type { LTreeNode } from './ltree/ltree-node';
import type { DropPosition } from './ltree/ltree-node';
import type { DragDropMode, DropOperation, ContextMenuItem, ContextMenuEntry } from './ltree/types';
import type { ClickBehavior, RangeSelectionMode, SelectionModifiers } from './controller/types';
import type { PasteResult } from './clipboard';
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
  clickBehavior?: ClickBehavior | null;
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

  // Virtual scroll
  virtualScroll?: boolean | null;
  virtualRowHeight?: number | null;
  virtualOverscan?: number | null;
  virtualContainerHeight?: string | null;

  // Visual
  bodyClass?: string | null;
  selectedNodeClass?: string | null;
  dragOverNodeClass?: string | null;
  expandIconClass?: string | null;
  collapseIconClass?: string | null;
  leafIconClass?: string | null;
  toggleIconMode?: 'rotate' | 'swap' | null;
  scrollHighlightTimeout?: number | null;
  scrollHighlightClass?: string | null;

  // Per-node icons
  iconMember?: string | null;
  iconCallback?: (node: LTreeNode<T>) => string | null;
  alignNodeIcons?: boolean | null;

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
  contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuEntry[];
  indexingCompleteCallback?: () => void;

  // Context Menu
  contextMenuXOffset?: number | null;
  contextMenuYOffset?: number | null;

  // Multi-select
  rangeSelectionMode?: RangeSelectionMode;
  onSelectionChange?: (selectedNodes: LTreeNode<T>[], selectedPaths: Set<string>) => void;

  // Debug
  shouldDisplayDebugInformation?: boolean | null;
  shouldDisplayContextMenuInDebugMode?: boolean | null;

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

  // Render callbacks (for DomRenderer)
  renderNodeCallback?: (node: LTreeNode<T>, container: HTMLElement) => void;
  renderEmptyStateCallback?: (container: HTMLElement) => void;
  renderEmptyZoneCallback?: (container: HTMLElement) => void;
  renderLoadingCallback?: (container: HTMLElement) => void;
  renderHeaderCallback?: (container: HTMLElement) => void;
  renderFooterCallback?: (container: HTMLElement) => void;
  renderContextMenuCallback?: (node: LTreeNode<T>, close: () => void, container: HTMLElement) => void;
  renderContextMenuItemCallback?: (item: ContextMenuItem, node: LTreeNode<T>, container: HTMLElement) => void;
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

  // Bulk operations
  insertBranch(parentPath: string, data: T[]): { success: boolean; count: number; error?: string };
  replaceBranch(parentPath: string, data: T[]): { success: boolean; removed: number; added: number; error?: string };
  deleteBranch(path: string, keepParent?: boolean): { success: boolean; count: number; error?: string };

  // Multi-select
  selectNode(path: string, modifiers?: SelectionModifiers): void;
  selectNodes(paths: string[]): void;
  deselectAll(): void;
  getSelectedNodes(): LTreeNode<T>[];
  getSelectedPaths(): Set<string>;
  isNodeSelected(path: string): boolean;
  selectAll(): void;

  // Navigation
  navTo(path: string): void;
  navNext(): void;
  navPrev(): void;
  navNextSibling(): void;
  navPrevSibling(): void;
  navInto(): void;
  navOut(): void;
  navBackOut(): void;
  navToggle(): void;
  navFirst(): void;
  navLast(): void;

  // Clipboard
  copyNodes(paths?: string[]): void;
  cutNodes(paths?: string[]): void;
  pasteNodes(targetPath: string, transformData?: (data: T) => T, position?: 'above' | 'below' | 'child'): PasteResult<T>;
  cancelCut(): void;
  hasClipboardContent(): boolean;
  getClipboardOperation(): 'copy' | 'cut' | null;

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
  'selection-change': CustomEvent<{ selectedNodes: LTreeNode<T>[]; selectedPaths: Set<string> }>;
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
