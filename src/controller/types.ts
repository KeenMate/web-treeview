/**
 * Controller-layer type definitions.
 * Ported from TreeController.svelte.ts interfaces.
 */

import type { LTreeNode } from '../ltree/ltree-node';
import type {
  DropPosition,
  DragDropMode,
  DropOperation,
  ContextMenuItem,
  InsertArrayResult,
  TreeChange,
  ApplyChangesResult
} from '../ltree/types';
import type { RenderStats } from '../renderer/render-coordinator';
import type { Index, SearchOptions } from 'flexsearch';

// ─── Shared interfaces (also used by renderers) ────────────────────────

export interface NodeCallbacks<T> {
  onNodeClicked: (node: LTreeNode<T>) => void;
  onNodeRightClicked: (node: LTreeNode<T>, event: MouseEvent) => void;
  onNodeDragStart: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragOver: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragLeave: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDrop: (node: LTreeNode<T>, event: DragEvent) => void;
  onZoneDrop: (node: LTreeNode<T>, position: DropPosition, event: DragEvent) => void;
  onTouchDragStart: (node: LTreeNode<T>, event: TouchEvent) => void;
  onTouchDragMove: (node: LTreeNode<T>, event: TouchEvent) => void;
  onTouchDragEnd: (node: LTreeNode<T>, event: TouchEvent) => void;
}

export interface NodeConfig {
  shouldToggleOnNodeClick: boolean;
  expandIconClass: string;
  collapseIconClass: string;
  leafIconClass: string;
  selectedNodeClass: string | null | undefined;
  dragOverNodeClass: string | null | undefined;
  dragDropMode: DragDropMode;
  dropZoneMode: 'floating' | 'glow';
  dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  dropZoneStart: number | string;
  dropZoneMaxWidth: number;
  allowCopy: boolean;
}

// ─── Controller props ─────────────────────────────────────────────────────

export interface TreeControllerConfig<T> {
  // MAPPINGS
  idMember: string;
  pathMember: string;
  parentPathMember?: string | null | undefined;
  levelMember?: string | null | undefined;
  isExpandedMember?: string | null | undefined;
  isSelectedMember?: string | null | undefined;
  isDraggableMember?: string | null | undefined;
  getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  isDropAllowedMember?: string | null | undefined;
  allowedDropPositionsMember?: string | null | undefined;
  getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  isCollapsibleMember?: string | null | undefined;
  getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  hasChildrenMember?: string | null | undefined;
  isSorted?: boolean | null | undefined;

  displayValueMember?: string | null | undefined;
  getDisplayValueCallback?: (node: LTreeNode<T>) => string;

  searchValueMember?: string | null | undefined;
  getSearchValueCallback?: (node: LTreeNode<T>) => string;

  orderMember?: string | null | undefined;

  treeId?: string | null | undefined;
  treePathSeparator?: string | null | undefined;
  sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

  // DATA
  data: T[];
  selectedNode?: LTreeNode<T> | null | undefined;

  // BEHAVIOUR
  expandLevel?: number | null | undefined;
  shouldToggleOnNodeClick?: boolean | null | undefined;
  initializeIndexCallback?: () => Index;
  searchText?: string | null | undefined;
  shouldUseInternalSearchIndex?: boolean | null | undefined;
  indexerBatchSize?: number | null | undefined;
  indexerTimeout?: number | null | undefined;
  shouldDisplayDebugInformation?: boolean;
  shouldDisplayContextMenuInDebugMode?: boolean;
  isLoading?: boolean;

  // Progressive rendering
  progressiveRender?: boolean;
  initialBatchSize?: number;
  maxBatchSize?: number;
  onRenderStart?: () => void;
  onRenderProgress?: (stats: RenderStats) => void;
  onRenderComplete?: (stats: RenderStats) => void;

  // Flat rendering
  useFlatRendering?: boolean;
  flatIndentSize?: string;

  // DRAG AND DROP
  dragDropMode?: DragDropMode;
  dropZoneMode?: 'floating' | 'glow';
  dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  dropZoneStart?: number | string;
  dropZoneMaxWidth?: number;
  allowCopy?: boolean;
  autoHandleCopy?: boolean;

  // EVENTS
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
  contextMenuCallback?: (
    node: LTreeNode<T>,
    closeMenuCallback: () => void
  ) => ContextMenuItem[];

  // Tells the controller whether a context menu template exists
  hasContextMenuTemplate?: boolean;

  // VISUALS
  bodyClass?: string | null | undefined;
  selectedNodeClass?: string | null | undefined;
  dragOverNodeClass?: string | null | undefined;
  expandIconClass?: string | null | undefined;
  collapseIconClass?: string | null | undefined;
  leafIconClass?: string | null | undefined;
  scrollHighlightTimeout?: number | null | undefined;
  scrollHighlightClass?: string | null | undefined;
  contextMenuXOffset?: number | null | undefined;
  contextMenuYOffset?: number | null | undefined;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────

export interface TreeControllerSnapshot<T> {
  flatNodesToRender: LTreeNode<T>[];
  draggedNodePath: string | null;
  isDragInProgress: boolean;
  hoveredNodeForDropPath: string | null;
  activeDropPosition: DropPosition | null;
  currentDropOperation: DropOperation;
  contextMenuVisible: boolean;
  contextMenuX: number;
  contextMenuY: number;
  contextMenuNode: LTreeNode<T> | null;
  isDropPlaceholderActive: boolean;
  isLoading: boolean;
  isRendering: boolean;
  bodyClass: string | null | undefined;
  useFlatRendering: boolean;
  flatIndentSize: string;
  shouldDisplayDebugInformation: boolean;
  selectedNode: LTreeNode<T> | null | undefined;
}

// ─── Events emitted by TreeController ─────────────────────────────────────

export interface TreeControllerEvents<T> {
  'state-change': TreeControllerSnapshot<T>;
  'config-change': NodeConfig;
  'data-change': { nodes: LTreeNode<T>[] };
}
