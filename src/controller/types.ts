/**
 * Controller-layer type definitions.
 * Ported from TreeController.svelte.ts interfaces.
 */

import type { LTreeNode } from '../ltree/ltree-node';
import type {
  DropPosition,
  DragDropMode,
  DropOperation,
  ContextMenuEntry,
  InsertArrayResult,
  TreeChange,
  ApplyChangesResult
} from '../ltree/types';
import type { RenderStats } from '../renderer/render-coordinator';
import type { Index, SearchOptions } from 'flexsearch';

// ─── Selection ──────────────────────────────────────────────────────────

export interface SelectionModifiers {
  ctrl: boolean;
  shift: boolean;
}

export type RangeSelectionMode = 'visual' | 'logical';

// ─── Shared interfaces (also used by renderers) ────────────────────────

export interface NodeCallbacks<T> {
  onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => void;
  onNodeRightClicked: (node: LTreeNode<T>, event: MouseEvent) => void;
  onNodeDragStart: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragOver: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragLeave: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDrop: (node: LTreeNode<T>, event: DragEvent) => void;
  onZoneDrop: (node: LTreeNode<T>, position: DropPosition, event: DragEvent) => void;
  onTouchDragStart: (node: LTreeNode<T>, event: TouchEvent) => void;
  onTouchDragMove: (node: LTreeNode<T>, event: TouchEvent) => void;
  onTouchDragEnd: (node: LTreeNode<T>, event: TouchEvent) => void;
  onCheckboxToggle: (node: LTreeNode<T>, options?: { skipFocus?: boolean }) => void;
}

export type ToggleIconMode = 'rotate' | 'swap';
export type ClickBehavior = 'select' | 'expand' | 'expand-and-focus';
export type CheckboxMode = 'independent' | 'cascade';

export interface NodeConfig {
  clickBehavior: ClickBehavior;
  expandIconClass: string;
  collapseIconClass: string;
  leafIconClass: string;
  toggleIconMode: ToggleIconMode;
  highlightedNodeClass: string | null | undefined;
  focusedNodeClass: string | null | undefined;
  dragOverNodeClass: string | null | undefined;
  dragDropMode: DragDropMode;
  dropZoneMode: 'floating' | 'glow';
  dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  dropZoneStart: number | string;
  dropZoneMaxWidth: number;
  isCopyAllowed: boolean;
  iconMember: string | null | undefined;
  shouldShowCheckboxes: boolean;
}

// ─── Controller props ─────────────────────────────────────────────────────

export interface TreeControllerConfig<T> {
  // MAPPINGS
  idMember: string;
  pathMember: string;
  parentPathMember?: string | null | undefined;
  levelMember?: string | null | undefined;
  isExpandedMember?: string | null | undefined;
  getIsExpandedCallback?: (node: LTreeNode<T>) => boolean;
  isSelectedMember?: string | null | undefined;
  getIsSelectedCallback?: (node: LTreeNode<T>) => boolean;
  isSelectableMember?: string | null | undefined;
  getIsSelectableCallback?: (node: LTreeNode<T>) => boolean;
  isDraggableMember?: string | null | undefined;
  getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  isDropAllowedMember?: string | null | undefined;
  getIsDropAllowedCallback?: (node: LTreeNode<T>) => boolean;
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
  focusedNode?: LTreeNode<T> | null | undefined;
  highlightedPaths?: Set<string>;
  selectedPaths?: Set<string>;

  // BEHAVIOUR
  expandLevel?: number | null | undefined;
  /** When true, expanding a node via the toggle UI auto-collapses its
   *  siblings. Programmatic `expandNodes` / `expandAll` are NOT constrained.
   *  Respects `isCollapsibleMember` / `getIsCollapsibleCallback`.
   *  Mirrors svelte-treeview rc03. */
  isAccordionExpand?: boolean | null | undefined;
  clickBehavior?: ClickBehavior | null | undefined;
  initializeIndexCallback?: () => Index;
  searchText?: string | null | undefined;
  shouldUseInternalSearchIndex?: boolean | null | undefined;
  indexerBatchSize?: number | null | undefined;
  indexerTimeout?: number | null | undefined;
  shouldDisplayDebugInformation?: boolean;
  shouldDisplayContextMenuInDebugMode?: boolean;
  isLoading?: boolean;

  // Progressive rendering
  isProgressiveRender?: boolean;
  initialBatchSize?: number;
  maxBatchSize?: number;
  renderStartCallback?: () => void;
  renderProgressCallback?: (stats: RenderStats) => void;
  renderCompleteCallback?: (stats: RenderStats) => void;

  // Flat rendering
  isFlatRenderingEnabled?: boolean;
  flatIndentSize?: string;

  // Virtual scroll
  isVirtualScrollEnabled?: boolean;
  virtualRowHeight?: number;
  virtualOverscan?: number;
  virtualContainerHeight?: string;

  // DRAG AND DROP
  dragDropMode?: DragDropMode;
  dropZoneMode?: 'floating' | 'glow';
  dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  dropZoneStart?: number | string;
  dropZoneMaxWidth?: number;
  isCopyAllowed?: boolean;
  shouldAutoHandleCopy?: boolean;
  shouldAutoHandleMove?: boolean;

  // SELECTION MODEL (rc06+: focusedNode / highlightedPaths / selectedPaths)
  rangeSelectionMode?: RangeSelectionMode;
  selectionMode?: 'single' | 'multi';
  shouldShowCheckboxes?: boolean;
  checkboxMode?: CheckboxMode;
  shouldClickToggleCheckbox?: boolean;
  beforeCheckboxToggleCallback?: (
    node: LTreeNode<T>,
    checked: boolean,
    affectedPaths: string[]
  ) => boolean | string[] | void;
  selectionChangeCallback?: (selectedNodes: LTreeNode<T>[], selectedPaths: Set<string>) => void;
  highlightChangeCallback?: (highlightedPaths: Set<string>, highlightedNodes: LTreeNode<T>[]) => void;

  // EVENTS
  nodeClickedCallback?: (node: LTreeNode<T>) => void;
  nodeDragStartCallback?: (node: LTreeNode<T>, event: DragEvent) => void;
  nodeDragOverCallback?: (node: LTreeNode<T>, event: DragEvent) => void;
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
  nodeDropCallback?: (
    dropNode: LTreeNode<T> | null,
    draggedNode: LTreeNode<T>,
    position: DropPosition,
    event: DragEvent | TouchEvent,
    operation: DropOperation
  ) => void;
  contextMenuCallback?: (
    node: LTreeNode<T>,
    closeMenuCallback: () => void
  ) => ContextMenuEntry[];

  // Tells the controller whether a context menu renderer exists
  hasContextMenuRenderer?: boolean;

  // VISUALS
  bodyClass?: string | null | undefined;
  highlightedNodeClass?: string | null | undefined;
  focusedNodeClass?: string | null | undefined;
  dragOverNodeClass?: string | null | undefined;
  expandIconClass?: string | null | undefined;
  collapseIconClass?: string | null | undefined;
  leafIconClass?: string | null | undefined;
  toggleIconMode?: ToggleIconMode | null | undefined;
  scrollHighlightTimeout?: number | null | undefined;
  scrollHighlightClass?: string | null | undefined;
  contextMenuXOffset?: number | null | undefined;
  contextMenuYOffset?: number | null | undefined;

  // Per-node icons
  iconMember?: string | null | undefined;
  iconCallback?: (node: LTreeNode<T>) => string | null;
  shouldAlignNodeIcons?: boolean | null | undefined;
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
  contextMenuXOffset: number;
  contextMenuYOffset: number;
  contextMenuNode: LTreeNode<T> | null;
  isDropPlaceholderActive: boolean;
  isLoading: boolean;
  isRendering: boolean;
  bodyClass: string | null | undefined;
  isFlatRenderingEnabled: boolean;
  flatIndentSize: string;
  shouldDisplayDebugInformation: boolean;
  focusedNode: LTreeNode<T> | null | undefined;
  highlightedPaths: Set<string>;
  selectedPaths: Set<string>;
  cutPaths: Set<string>;

  // Virtual scroll
  isVirtualScrollEnabled: boolean;
  virtualRowHeight: number;
  virtualContainerHeight: string;
  virtualTotalHeight: number;
  virtualStartIndex: number;
  virtualOffsetY: number;
}

// ─── Events emitted by TreeController ─────────────────────────────────────

export interface TreeControllerEvents<T> {
  'state-change': TreeControllerSnapshot<T>;
  'config-change': NodeConfig;
  'data-change': { nodes: LTreeNode<T>[] };
}
