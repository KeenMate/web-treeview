/**
 * TreeController — all tree state & logic.
 * Ported from TreeController.svelte.ts to vanilla TypeScript.
 *
 * Svelte → vanilla conversions:
 *   $state<X>        → plain property + _scheduleNotify()
 *   $state.raw<X>    → plain property + _scheduleNotify()
 *   $derived(expr)   → getter
 *   $effect(fn)      → explicit call from the setter that drives it
 *   tick()           → queueMicrotask()
 */

import type { Index, SearchOptions } from 'flexsearch';
import { type LTreeNode, VisualState } from '../ltree/ltree-node';
import { createLTree } from '../ltree/ltree';
import {
  type Ltree,
  type InsertArrayResult,
  type ContextMenuItem,
  type DropPosition,
  type DragDropMode,
  type DropOperation,
  type TreeChange,
  type ApplyChangesResult
} from '../ltree/types';
import {
  createRenderCoordinator,
  type RenderCoordinator,
  type RenderStats
} from '../renderer/render-coordinator';
import { EventEmitter } from './event-emitter';
import type {
  NodeCallbacks,
  NodeConfig,
  SelectionModifiers,
  TreeControllerConfig,
  TreeControllerSnapshot,
  TreeControllerEvents
} from './types';
import {
  setClipboard,
  getClipboard,
  clearClipboard,
  hasClipboard as hasClipboardFn,
  getClipboardOperation as getClipboardOp,
  type ClipboardEntry,
  type PasteResult
} from '../clipboard';
import { initLogger, uiLogger, dragLogger } from '../logger';
import { perfStart, perfEnd } from '../perf-logger';

// ─── TreeController ───────────────────────────────────────────────────────

export class TreeController<T> extends EventEmitter<TreeControllerEvents<T>> {
  // ── LTree instance ──────────────────────────────────────────────────
  tree!: Ltree<T>;

  // ── Render coordinator ──────────────────────────────────────────────
  renderCoordinator!: RenderCoordinator | null;

  // ── Stable callback & config objects for renderer ───────────────────
  nodeCallbacks!: NodeCallbacks<T>;
  private _nodeConfig: NodeConfig = {
    clickBehavior: 'expand-and-focus',
    expandIconClass: 'wtv__toggle-icon--expand',
    collapseIconClass: 'wtv__toggle-icon--collapse',
    leafIconClass: 'wtv__toggle-icon--leaf',
    toggleIconMode: 'rotate',
    highlightedNodeClass: undefined,
    focusedNodeClass: undefined,
    dragOverNodeClass: undefined,
    dragDropMode: 'none',
    dropZoneMode: 'glow',
    dropZoneLayout: 'around',
    dropZoneStart: 33,
    dropZoneMaxWidth: 120,
    allowCopy: false,
    iconMember: undefined,
    showCheckboxes: false
  };

  get nodeConfig(): NodeConfig { return this._nodeConfig; }

  // ── State properties ────────────────────────────────────────────────
  private _treeId: string = '';
  private _treePathSeparator: string = '.';
  private _data: T[] = [];
  private _focusedNode: LTreeNode<T> | null | undefined = null;
  private _insertResult: InsertArrayResult<T> | null | undefined = null;
  private _searchText: string | null | undefined = undefined;
  private _isRendering: boolean = false;

  // Behaviour
  private _shouldDisplayDebugInformation: boolean = false;
  private _shouldDisplayContextMenuInDebugMode: boolean = false;
  private _isLoading: boolean = false;
  private _useFlatRendering: boolean = true;
  private _flatIndentSize: string = 'var(--wtv-column-width)';
  private _progressiveRender: boolean = true;
  private _initialBatchSize: number = 20;
  private _maxBatchSize: number = 500;
  private _bodyClass: string | null | undefined = undefined;

  // Drag and drop
  private _dragDropMode: DragDropMode = 'none';
  private _allowCopy: boolean = false;
  private _autoHandleCopy: boolean = true;
  private _autoHandleMove: boolean = true;

  // Three-level selection model (rc06+)
  private _highlightedPaths: Set<string> = new Set();
  private _selectedPaths: Set<string> = new Set();
  private _lastHighlightedPath: string | null = null;
  private _rangeSelectionMode: import('./types').RangeSelectionMode = 'visual';
  private _selectionMode: 'single' | 'multi' = 'single';
  private _showCheckboxes: boolean = false;
  private _checkboxMode: import('./types').CheckboxMode = 'independent';
  private _clickTogglesCheckbox: boolean = false;
  private beforeCheckboxToggleCb: TreeControllerConfig<T>['beforeCheckboxToggleCallback'];

  // Clipboard (cut paths for dimming)
  private _cutPaths: Set<string> = new Set();

  // Events / callbacks
  private onSelectionChangeCb: TreeControllerConfig<T>['onSelectionChange'];
  private onHighlightChangeCb:
    | ((paths: Set<string>, nodes: LTreeNode<T>[]) => void)
    | undefined;
  private onNodeClickedCb: ((node: LTreeNode<T>) => void) | undefined;
  private onNodeDragStartCb: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined;
  private onNodeDragOverCb: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined;
  private beforeDropCallbackCb: TreeControllerConfig<T>['beforeDropCallback'];
  private onNodeDropCb: TreeControllerConfig<T>['onNodeDrop'];
  /** @internal Used by renderers to check if a callback is available */
  contextMenuCallbackCb: TreeControllerConfig<T>['contextMenuCallback'];
  private onRenderStartCb: (() => void) | undefined;
  private onRenderProgressCb: ((stats: RenderStats) => void) | undefined;
  private onRenderCompleteCb: ((stats: RenderStats) => void) | undefined;

  // Visual config
  private _clickBehavior: import('./types').ClickBehavior = 'expand-and-focus';
  private _accordionExpand: boolean = false;
  private _expandIconClass: string = 'wtv__toggle-icon--expand';
  private _collapseIconClass: string = 'wtv__toggle-icon--collapse';
  private _leafIconClass: string = 'wtv__toggle-icon--leaf';
  private _toggleIconMode: import('./types').ToggleIconMode = 'rotate';
  private _highlightedNodeClass: string | null | undefined = undefined;
  private _focusedNodeClass: string | null | undefined = undefined;
  private _dragOverNodeClass: string | null | undefined = undefined;
  private _dropZoneMode: 'floating' | 'glow' = 'glow';
  private _dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2' = 'around';
  private _dropZoneStart: number | string = 33;
  private _dropZoneMaxWidth: number = 120;
  private _scrollHighlightTimeout: number = 4000;
  private _scrollHighlightClass: string | null | undefined = 'wtv__node-content--scroll-highlight';
  private _contextMenuXOffset: number = 8;
  private _contextMenuYOffset: number = 0;
  private _hasContextMenuRenderer: boolean = false;

  // Per-node icons
  private _iconMember: string | null | undefined = undefined;
  private _iconCallback: ((node: LTreeNode<T>) => string | null) | undefined = undefined;
  private _alignNodeIcons: boolean = true;

  // ── Internal mutable state ──────────────────────────────────────────

  // Context menu
  private _contextMenuVisible: boolean = false;
  private _contextMenuX: number = 0;
  private _contextMenuY: number = 0;
  private _contextMenuNode: LTreeNode<T> | null = null;
  private _isDebugMenuActive: boolean = false;

  // Scroll highlight
  private currentHighlight: {
    element: HTMLElement;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null = null;

  // Drag and drop state
  private _draggedNode: LTreeNode<any> | null = null;
  private _isDragInProgress: boolean = false;
  private _hoveredNodeForDrop: LTreeNode<any> | null = null;
  private _activeDropPosition: DropPosition | null = null;
  private _currentDropOperation: DropOperation = 'move';
  // Snapshot of `highlightedPaths` taken in the dragstart rAF before the
  // OS-convention sync replaces it with the dragged node. Restored on
  // Esc-cancel so the user isn't left with the dragged node "stuck" selected.
  private _preDragHighlightSnapshot: Set<string> | null = null;

  // Touch drag
  private touchDragState: {
    node: LTreeNode<any> | null;
    startX: number;
    startY: number;
    isDragging: boolean;
    ghostElement: HTMLElement | null;
    currentDropTarget: LTreeNode<any> | null;
  } = {
    node: null, startX: 0, startY: 0,
    isDragging: false, ghostElement: null, currentDropTarget: null
  };
  private touchTimer: ReturnType<typeof setTimeout> | null = null;

  // Progressive flat rendering
  private flatRenderedIds: Set<string> = new Set();
  private flatRenderQueue: string[] = [];
  private flatRenderAnimationFrame: number | null = null;
  private currentBatchSize: number = 0;

  // Drop placeholder
  private _isDropPlaceholderActive: boolean = false;

  // Virtual scroll
  private _virtualScroll: boolean = false;
  private _virtualRowHeight?: number;
  private _virtualOverscan: number = 5;
  private _virtualContainerHeight?: string;
  private _vsScrollTop: number = 0;
  private _vsMeasuredRowHeight: number | null = null;
  private _vsDetectedHeight: string | null = null;

  // Skip insertArray flag
  private _skipInsertArray = false;

  // Progressive flat rendering tracker
  private lastFlatNodesTracker: Symbol | undefined | null = null;

  // Container element (set by the host component for scrollToPath / debug menu)
  containerElement: HTMLElement | null = null;

  // Context menu global listener cleanup
  private _contextMenuCleanup: (() => void) | null = null;

  // ── Batched notification ────────────────────────────────────────────
  private _dirty = false;
  private _scheduleNotify() {
    if (this._dirty) return;
    this._dirty = true;
    queueMicrotask(() => {
      this._dirty = false;
      this.emit('state-change', this.getSnapshot());
    });
  }

  /** Synchronously emit state-change snapshot, bypassing microtask batching.
   *  Used when the DOM must be updated before the caller continues (e.g. scrollToPath). */
  private _flushNotify() {
    this._dirty = false;
    this.emit('state-change', this.getSnapshot());
  }

  // ── Property accessors ──────────────────────────────────────────────

  get treeId() { return this._treeId; }
  set treeId(v: string) {
    this._treeId = v;
    if (this.tree) this.tree.treePathSeparator = this._treePathSeparator;
  }

  get treePathSeparator() { return this._treePathSeparator; }
  set treePathSeparator(v: string) {
    this._treePathSeparator = v;
    if (this.tree) this.tree.treePathSeparator = v;
  }

  get data() { return this._data; }
  set data(v: T[]) {
    this._data = v;
    this._onDataChanged();
  }

  get focusedNode() { return this._focusedNode; }
  set focusedNode(v: LTreeNode<T> | null | undefined) {
    this._focusedNode = v;
    this._scheduleNotify();
  }

  get rangeSelectionMode() { return this._rangeSelectionMode; }
  set rangeSelectionMode(v: import('./types').RangeSelectionMode) {
    this._rangeSelectionMode = v;
  }

  get selectionMode() { return this._selectionMode; }
  set selectionMode(v: 'single' | 'multi') {
    this._selectionMode = v;
  }

  get showCheckboxes() { return this._showCheckboxes; }
  set showCheckboxes(v: boolean) {
    this._showCheckboxes = v;
    this._updateNodeConfig();
  }

  get clickTogglesCheckbox() { return this._clickTogglesCheckbox; }
  set clickTogglesCheckbox(v: boolean) { this._clickTogglesCheckbox = v; }

  get checkboxMode() { return this._checkboxMode; }
  set checkboxMode(v: import('./types').CheckboxMode) { this._checkboxMode = v; }

  /** Bindable: the multi-select highlight set. */
  get highlightedPaths(): Set<string> { return this._highlightedPaths; }

  /** Bindable: the checkbox / data-state selection set. */
  get selectedPaths(): Set<string> { return this._selectedPaths; }

  get cutPaths(): Set<string> { return this._cutPaths; }

  get focusedNodeClass() { return this._focusedNodeClass; }
  set focusedNodeClass(v: string | null | undefined) { this._focusedNodeClass = v; this._updateNodeConfig(); }

  get insertResult() { return this._insertResult; }
  get searchText() { return this._searchText; }
  set searchText(v: string | null | undefined) {
    this._searchText = v;
    this.tree?.filterNodes(v as string);
    this._scheduleNotify();
  }

  get isRendering() { return this._isRendering; }
  get shouldDisplayDebugInformation() { return this._shouldDisplayDebugInformation; }
  set shouldDisplayDebugInformation(v: boolean) {
    this._shouldDisplayDebugInformation = v;
    this._scheduleNotify();
  }

  get shouldDisplayContextMenuInDebugMode() { return this._shouldDisplayContextMenuInDebugMode; }
  set shouldDisplayContextMenuInDebugMode(v: boolean) {
    this._shouldDisplayContextMenuInDebugMode = v;
    this._updateDebugContextMenu();
  }

  get isLoading() { return this._isLoading; }
  set isLoading(v: boolean) { this._isLoading = v; this._scheduleNotify(); }

  get useFlatRendering() { return this._useFlatRendering; }
  set useFlatRendering(v: boolean) { this._useFlatRendering = v; this._scheduleNotify(); }

  get flatIndentSize() { return this._flatIndentSize; }
  set flatIndentSize(v: string) { this._flatIndentSize = v; this._scheduleNotify(); }

  get progressiveRender() { return this._progressiveRender; }
  get initialBatchSize() { return this._initialBatchSize; }
  get maxBatchSize() { return this._maxBatchSize; }

  get bodyClass() { return this._bodyClass; }
  set bodyClass(v: string | null | undefined) { this._bodyClass = v; this._scheduleNotify(); }

  get dragDropMode() { return this._dragDropMode; }
  set dragDropMode(v: DragDropMode) { this._dragDropMode = v; this._updateNodeConfig(); }

  get allowCopy() { return this._allowCopy; }
  set allowCopy(v: boolean) {
    this._allowCopy = v;
    this._updateNodeConfig();
  }

  get autoHandleCopy() { return this._autoHandleCopy; }
  set autoHandleCopy(v: boolean) { this._autoHandleCopy = v; }

  get autoHandleMove() { return this._autoHandleMove; }
  set autoHandleMove(v: boolean) { this._autoHandleMove = v; }

  get clickBehavior() { return this._clickBehavior; }
  set clickBehavior(v: import('./types').ClickBehavior) { this._clickBehavior = v; this._updateNodeConfig(); }

  get accordionExpand() { return this._accordionExpand; }
  set accordionExpand(v: boolean) { this._accordionExpand = v; }

  get expandIconClass() { return this._expandIconClass; }
  set expandIconClass(v: string) { this._expandIconClass = v; this._updateNodeConfig(); }

  get collapseIconClass() { return this._collapseIconClass; }
  set collapseIconClass(v: string) { this._collapseIconClass = v; this._updateNodeConfig(); }

  get leafIconClass() { return this._leafIconClass; }
  set leafIconClass(v: string) { this._leafIconClass = v; this._updateNodeConfig(); }

  get toggleIconMode() { return this._toggleIconMode; }
  set toggleIconMode(v: import('./types').ToggleIconMode) { this._toggleIconMode = v; this._updateNodeConfig(); }

  get highlightedNodeClass() { return this._highlightedNodeClass; }
  set highlightedNodeClass(v: string | null | undefined) { this._highlightedNodeClass = v; this._updateNodeConfig(); }

  get dragOverNodeClass() { return this._dragOverNodeClass; }
  set dragOverNodeClass(v: string | null | undefined) { this._dragOverNodeClass = v; this._updateNodeConfig(); }

  get dropZoneMode() { return this._dropZoneMode; }
  set dropZoneMode(v: 'floating' | 'glow') { this._dropZoneMode = v; this._updateNodeConfig(); }

  get dropZoneLayout() { return this._dropZoneLayout; }
  set dropZoneLayout(v: 'around' | 'above' | 'below' | 'wave' | 'wave2') { this._dropZoneLayout = v; this._updateNodeConfig(); }

  get dropZoneStart() { return this._dropZoneStart; }
  set dropZoneStart(v: number | string) { this._dropZoneStart = v; this._updateNodeConfig(); }

  get dropZoneMaxWidth() { return this._dropZoneMaxWidth; }
  set dropZoneMaxWidth(v: number) { this._dropZoneMaxWidth = v; this._updateNodeConfig(); }

  get scrollHighlightTimeout() { return this._scrollHighlightTimeout; }
  set scrollHighlightTimeout(v: number) { this._scrollHighlightTimeout = v; }

  get scrollHighlightClass() { return this._scrollHighlightClass; }
  set scrollHighlightClass(v: string | null | undefined) { this._scrollHighlightClass = v; }

  get contextMenuXOffset() { return this._contextMenuXOffset; }
  set contextMenuXOffset(v: number) { this._contextMenuXOffset = v; }

  get contextMenuYOffset() { return this._contextMenuYOffset; }
  set contextMenuYOffset(v: number) { this._contextMenuYOffset = v; }

  get hasContextMenuRenderer() { return this._hasContextMenuRenderer; }
  set hasContextMenuRenderer(v: boolean) { this._hasContextMenuRenderer = v; }

  // Per-node icons
  get iconMember() { return this._iconMember; }
  set iconMember(v: string | null | undefined) { this._iconMember = v; this._updateNodeConfig(); }

  get iconCallback() { return this._iconCallback; }
  set iconCallback(v: ((node: LTreeNode<T>) => string | null) | undefined) { this._iconCallback = v; this._updateNodeConfig(); }

  get alignNodeIcons() { return this._alignNodeIcons; }
  set alignNodeIcons(v: boolean) { this._alignNodeIcons = v; this._updateNodeConfig(); }

  get hasIconSupport(): boolean {
    return !!(this._iconMember || this._iconCallback);
  }

  getNodeIcon(node: LTreeNode<T>): string | null {
    if (this._iconCallback) {
      return this._iconCallback(node);
    }
    if (this._iconMember && node.data) {
      const val = (node.data as any)[this._iconMember];
      return val ? String(val) : null;
    }
    return null;
  }

  // Context menu state
  get contextMenuVisible() { return this._contextMenuVisible; }
  get contextMenuX() { return this._contextMenuX; }
  get contextMenuY() { return this._contextMenuY; }
  get contextMenuNode() { return this._contextMenuNode; }

  // Drag and drop state (read by renderer)
  get draggedNode() { return this._draggedNode; }
  get isDragInProgress() { return this._isDragInProgress; }
  get hoveredNodeForDrop() { return this._hoveredNodeForDrop; }
  get activeDropPosition() { return this._activeDropPosition; }
  get currentDropOperation() { return this._currentDropOperation; }
  get isDropPlaceholderActive() { return this._isDropPlaceholderActive; }

  // Virtual scroll accessors
  get virtualScroll() { return this._virtualScroll; }
  set virtualScroll(v: boolean) {
    this._virtualScroll = v;
    // Cancel pending progressive render batches — virtual scroll replaces progressive rendering
    if (v && this.flatRenderAnimationFrame) {
      cancelAnimationFrame(this.flatRenderAnimationFrame);
      this.flatRenderAnimationFrame = null;
      this.flatRenderQueue = [];
    }
    this._scheduleNotify();
  }

  get virtualRowHeight() { return this._virtualRowHeight; }
  set virtualRowHeight(v: number | undefined) { this._virtualRowHeight = v; this._scheduleNotify(); }

  get virtualOverscan() { return this._virtualOverscan; }
  set virtualOverscan(v: number) { this._virtualOverscan = v; this._scheduleNotify(); }

  get virtualContainerHeight() { return this._virtualContainerHeight; }
  set virtualContainerHeight(v: string | undefined) { this._virtualContainerHeight = v; this._scheduleNotify(); }

  /** Called by renderer on scroll (triggers full state-change pipeline). */
  setVirtualScrollTop(scrollTop: number): void {
    this._vsScrollTop = scrollTop;
    this._scheduleNotify();
  }

  /** Silently sync scroll position without triggering state notification.
   *  Used by the renderer's fast synchronous scroll path. */
  syncVirtualScrollTop(scrollTop: number): void {
    this._vsScrollTop = scrollTop;
  }

  /** Called by renderer after first render to auto-measure row height. */
  setMeasuredRowHeight(height: number): void {
    if (this._vsMeasuredRowHeight !== height) {
      this._vsMeasuredRowHeight = height;
      this._scheduleNotify();
    }
  }

  /** Called by renderer to report detected container height. */
  setDetectedContainerHeight(height: string): void {
    if (this._vsDetectedHeight !== height) {
      this._vsDetectedHeight = height;
      this._scheduleNotify();
    }
  }

  /** Resolved row height: explicit > measured > 32px default */
  get resolvedRowHeight(): number {
    return this._virtualRowHeight ?? this._vsMeasuredRowHeight ?? 32;
  }

  /** Resolved container height string: explicit > detected > '400px' */
  get resolvedContainerHeight(): string {
    return this._virtualContainerHeight ?? this._vsDetectedHeight ?? '400px';
  }

  /** All visible flat nodes (before virtual scroll slicing).
   *  When virtual scroll is active, bypasses the progressive render filter
   *  because virtual scroll already limits rendered nodes to the visible window. */
  get allVisibleFlatNodes(): LTreeNode<T>[] {
    if (!this._virtualScroll && this._useFlatRendering && this._progressiveRender) {
      return this.tree?.visibleFlatNodes?.filter(
        (n) => this.flatRenderedIds.has(String(n.id))
      ) ?? [];
    }
    return this.tree?.visibleFlatNodes ?? [];
  }

  // ── Derived ─────────────────────────────────────────────────────────

  get flatNodesToRender(): LTreeNode<T>[] {
    const all = this.allVisibleFlatNodes;
    if (!this._virtualScroll) return all;

    const rowHeight = this.resolvedRowHeight;
    const containerHeightPx = parseFloat(this.resolvedContainerHeight) || 400;
    const startIndex = Math.max(0, Math.floor(this._vsScrollTop / rowHeight) - this._virtualOverscan);
    const endIndex = Math.min(all.length, Math.ceil((this._vsScrollTop + containerHeightPx) / rowHeight) + this._virtualOverscan);
    return all.slice(startIndex, endIndex);
  }

  get statistics() {
    return this.tree?.statistics;
  }

  // ── Constructor ─────────────────────────────────────────────────────

  constructor(props: TreeControllerConfig<T>) {
    super();

    // Assign prop values (with defaults)
    this._treeId = props.treeId || this.generateTreeId();
    this._treePathSeparator = props.treePathSeparator ?? '.';

    this._data = props.data;
    this._focusedNode = props.focusedNode ?? null;
    this._searchText = props.searchText;
    this._rangeSelectionMode = props.rangeSelectionMode ?? 'visual';
    this._selectionMode = props.selectionMode ?? 'single';
    this._showCheckboxes = props.showCheckboxes ?? false;
    this._checkboxMode = props.checkboxMode ?? 'independent';
    this._clickTogglesCheckbox = props.clickTogglesCheckbox ?? false;
    this.beforeCheckboxToggleCb = props.beforeCheckboxToggleCallback;

    this._shouldDisplayDebugInformation = props.shouldDisplayDebugInformation ?? false;
    this._shouldDisplayContextMenuInDebugMode = props.shouldDisplayContextMenuInDebugMode ?? false;
    this._isLoading = props.isLoading ?? false;

    this._useFlatRendering = props.useFlatRendering ?? true;
    this._flatIndentSize = props.flatIndentSize ?? 'var(--wtv-column-width)';
    this._progressiveRender = props.progressiveRender ?? true;
    this._initialBatchSize = props.initialBatchSize ?? 20;
    this._maxBatchSize = props.maxBatchSize ?? 500;
    this._bodyClass = props.bodyClass;

    this._dragDropMode = props.dragDropMode ?? 'none';
    this._allowCopy = props.allowCopy ?? false;
    this._autoHandleCopy = props.autoHandleCopy ?? true;
    this._autoHandleMove = props.autoHandleMove ?? true;

    this._virtualScroll = props.virtualScroll ?? false;
    this._virtualRowHeight = props.virtualRowHeight;
    this._virtualOverscan = props.virtualOverscan ?? 5;
    this._virtualContainerHeight = props.virtualContainerHeight;

    this._clickBehavior = props.clickBehavior ?? 'expand-and-focus';
    this._accordionExpand = props.accordionExpand ?? false;
    this._expandIconClass = props.expandIconClass ?? 'wtv__toggle-icon--expand';
    this._collapseIconClass = props.collapseIconClass ?? 'wtv__toggle-icon--collapse';
    this._leafIconClass = props.leafIconClass ?? 'wtv__toggle-icon--leaf';
    this._toggleIconMode = props.toggleIconMode ?? 'rotate';
    this._highlightedNodeClass = props.highlightedNodeClass;
    this._focusedNodeClass = props.focusedNodeClass;
    this._dragOverNodeClass = props.dragOverNodeClass;
    this._dropZoneMode = props.dropZoneMode ?? 'glow';
    this._dropZoneLayout = props.dropZoneLayout ?? 'around';
    this._dropZoneStart = props.dropZoneStart ?? 33;
    this._dropZoneMaxWidth = props.dropZoneMaxWidth ?? 120;
    this._scrollHighlightTimeout = props.scrollHighlightTimeout ?? 4000;
    this._scrollHighlightClass = props.scrollHighlightClass ?? 'wtv__node-content--scroll-highlight';
    this._contextMenuXOffset = props.contextMenuXOffset ?? 8;
    this._contextMenuYOffset = props.contextMenuYOffset ?? 0;
    this._hasContextMenuRenderer = props.hasContextMenuRenderer ?? false;
    this._iconMember = props.iconMember ?? undefined;
    this._iconCallback = props.iconCallback;
    this._alignNodeIcons = props.alignNodeIcons ?? true;

    // Store callbacks
    this.onSelectionChangeCb = props.onSelectionChange;
    this.onHighlightChangeCb = props.onHighlightChange;
    this.onNodeClickedCb = props.onNodeClicked;
    this.onNodeDragStartCb = props.onNodeDragStart;
    this.onNodeDragOverCb = props.onNodeDragOver;
    this.beforeDropCallbackCb = props.beforeDropCallback;
    this.onNodeDropCb = props.onNodeDrop;
    this.contextMenuCallbackCb = props.contextMenuCallback;
    this.onRenderStartCb = props.onRenderStart;
    this.onRenderProgressCb = props.onRenderProgress;
    this.onRenderCompleteCb = props.onRenderComplete;

    // ── Create LTree ────────────────────────────────────────────────
    this.tree = createLTree<T>(
      props.idMember,
      props.pathMember,
      props.parentPathMember,
      props.levelMember,
      props.hasChildrenMember,
      props.isExpandedMember,
      props.getIsExpandedCallback,
      props.isSelectableMember,
      props.getIsSelectableCallback,
      props.isSelectedMember,
      props.getIsSelectedCallback,
      props.isDraggableMember,
      props.getIsDraggableCallback,
      props.isDropAllowedMember,
      props.getIsDropAllowedCallback,
      props.allowedDropPositionsMember,
      props.displayValueMember,
      props.getDisplayValueCallback,
      props.searchValueMember,
      props.getSearchValueCallback,
      props.getAllowedDropPositionsCallback,
      props.isCollapsibleMember,
      props.getIsCollapsibleCallback,
      props.orderMember,
      this._treeId,
      this._treePathSeparator,
      props.expandLevel,
      props.shouldUseInternalSearchIndex,
      props.initializeIndexCallback,
      props.indexerBatchSize,
      props.indexerTimeout,
      {
        shouldDisplayDebugInformation: props.shouldDisplayDebugInformation,
        isSorted: props.isSorted,
        sortCallback: props.sortCallback
      }
    );

    initLogger.debug(`[${this._treeId}] TreeController created`, {
      idMember: props.idMember,
      pathMember: props.pathMember,
      displayValueMember: props.displayValueMember,
      parentPathMember: props.parentPathMember,
      expandLevel: props.expandLevel,
      dataLength: props.data?.length ?? 0,
      dragDropMode: this._dragDropMode
    });

    // Wire tree change notifications
    this.tree.onChange = () => this._onTreeChanged();

    // ── Create render coordinator ───────────────────────────────────
    this.renderCoordinator = this._progressiveRender
      ? createRenderCoordinator(2, {
          onStart: () => {
            this._isRendering = true;
            this.onRenderStartCb?.();
          },
          onProgress: (stats) => {
            this.onRenderProgressCb?.(stats);
          },
          onComplete: (stats) => {
            this._isRendering = false;
            this.onRenderCompleteCb?.(stats);
          }
        })
      : null;

    // ── Create stable nodeCallbacks ─────────────────────────────────
    this.nodeCallbacks = {
      onNodeClicked: this._onNodeClicked.bind(this),
      onNodeRightClicked: this._onNodeRightClicked.bind(this),
      onNodeDragStart: this._onNodeDragStartInternal.bind(this),
      onNodeDragOver: this._onNodeDragOverInternal.bind(this),
      onNodeDragLeave: this._onNodeDragLeaveInternal.bind(this),
      onNodeDrop: this._onNodeDropInternal.bind(this),
      onZoneDrop: this._onZoneDrop.bind(this),
      onTouchDragStart: this._onTouchStart.bind(this),
      onTouchDragMove: this._onTouchMove.bind(this),
      onTouchDragEnd: this._onTouchEnd.bind(this),
      onCheckboxToggle: this._onCheckboxToggle.bind(this)
    };

    // ── Initial nodeConfig ──────────────────────────────────────────
    this._updateNodeConfig();

    // Insert initial data
    if (this._data?.length) {
      this.renderCoordinator?.reset();
      this.flatRenderedIds = new Set();
      this.flatRenderQueue = [];
      this.currentBatchSize = 0;
      this._insertResult = this.tree.insertArray(this._data);
      this._seedSelectedPathsFromTree();
    }

    // Apply initial search filter
    if (this._searchText) {
      this.tree.filterNodes(this._searchText as string);
    }
  }

  // ── Public API methods ──────────────────────────────────────────────

  expandNodes(
    nodePath: string | string[],
    options?: { exclusive?: boolean; noEmit?: boolean }
  ) {
    this.tree.expandNodes(nodePath, options);
  }

  collapseNodes(
    nodePath: string | string[],
    options?: { noEmit?: boolean }
  ) {
    this.tree.collapseNodes(nodePath, options);
  }

  /** Toggle expand/collapse for a node clicked via the toggle UI. Honors the
   *  `accordionExpand` config: when expanding under accordion mode, every
   *  expanded sibling (whose `isCollapsible` allows it) is first collapsed
   *  in a single batch. Programmatic `expandNodes` / `expandAll` callers
   *  bypass the accordion. Mirrors svelte-treeview Node.svelte's
   *  toggleExpanded() flow. */
  toggleNodeExpanded(path: string): void {
    const node = this.getNodeByPath(path);
    if (!node || !node.hasChildren) return;
    // svelte-treeview blocks the entire toggle (both directions) when
    // a node is marked non-collapsible. Match that gate exactly so the
    // two packages behave the same way.
    if (!this.tree.getNodeIsCollapsible(node)) return;

    const shouldExpand = !node.isExpanded;

    if (shouldExpand && this._accordionExpand) {
      const siblings = this.tree.getSiblings(path);
      for (const sibling of siblings) {
        if (sibling.path !== path && sibling.isExpanded && this.tree.getNodeIsCollapsible(sibling)) {
          sibling.isExpanded = false;
          (sibling as any)._rev = ((sibling as any)._rev || 0) + 1;
        }
      }
    }

    if (shouldExpand) this.tree.expandNodes(path);
    else this.tree.collapseNodes(path);
  }

  expandAll(
    nodePath?: string | string[] | null | undefined,
    options?: { exclusive?: boolean; noEmit?: boolean }
  ) {
    this.tree?.expandAll(nodePath, options);
  }

  collapseAll(
    nodePath?: string | string[] | null | undefined,
    options?: { noEmit?: boolean }
  ) {
    this.tree?.collapseAll(nodePath, options);
  }

  filterNodes(searchTextVal: string, searchOptions?: SearchOptions): void {
    this.tree?.filterNodes(searchTextVal, searchOptions);
  }

  searchNodes(
    searchTextVal: string | null | undefined,
    searchOptions?: SearchOptions
  ): LTreeNode<T>[] {
    return this.tree?.searchNodes(searchTextVal, searchOptions) || [];
  }

  getChildren(parentPath: string): LTreeNode<T>[] {
    return this.tree?.getChildren(parentPath) || [];
  }

  getSiblings(path: string): LTreeNode<T>[] {
    return this.tree?.getSiblings(path) || [];
  }

  refreshSiblings(parentPath: string): void {
    this.tree?.refreshSiblings(parentPath);
  }

  refreshNode(path: string): void {
    this.tree?.refreshNode(path);
  }

  getNodeByPath(path: string): LTreeNode<T> | null {
    return this.tree?.getNodeByPath(path) || null;
  }

  // ── Tree editor mutation methods ────────────────────────────────────

  moveNode(
    sourcePath: string,
    targetPath: string,
    position: DropPosition
  ): { success: boolean; error?: string } {
    this._skipInsertArray = true;
    // Capture the affected path set BEFORE the move: any highlighted /
    // selected path that is the source itself or a descendant of it needs
    // to be remapped onto the new location. Without this the path Sets
    // keep stale strings after a multi-drag, so the next plain click leaves
    // visually-highlighted ghosts in the old positions and downstream
    // operations work on dangling paths.
    const sourceNode = this.tree?.getNodeByPath(sourcePath);
    const sep = this._treePathSeparator;
    const collect = (paths: Set<string>): Map<string, string> => {
      const m = new Map<string, string>();
      for (const p of paths) {
        if (p === sourcePath || p.startsWith(sourcePath + sep)) {
          m.set(p, p.substring(sourcePath.length));
        }
      }
      return m;
    };
    const highlightAffected = collect(this._highlightedPaths);
    const selectedAffected = collect(this._selectedPaths);
    const lastHighlightSuffix =
      this._lastHighlightedPath && highlightAffected.has(this._lastHighlightedPath)
        ? highlightAffected.get(this._lastHighlightedPath)
        : undefined;
    const focusedAffectedSuffix =
      this._focusedNode &&
      (this._focusedNode.path === sourcePath ||
        this._focusedNode.path.startsWith(sourcePath + sep))
        ? this._focusedNode.path.substring(sourcePath.length)
        : undefined;

    const result = this.tree?.moveNode(sourcePath, targetPath, position) || {
      success: false,
      error: 'Tree not initialized'
    };

    if (result.success && sourceNode) {
      const newPath = sourceNode.path; // tree.moveNode mutates this in place
      const remap = (paths: Set<string>, affected: Map<string, string>) => {
        if (affected.size === 0) return;
        for (const [oldP, suffix] of affected) {
          paths.delete(oldP);
          paths.add(newPath + suffix);
        }
      };
      remap(this._highlightedPaths, highlightAffected);
      remap(this._selectedPaths, selectedAffected);
      if (lastHighlightSuffix !== undefined) {
        this._lastHighlightedPath = newPath + lastHighlightSuffix;
      }
      if (focusedAffectedSuffix !== undefined && this._focusedNode) {
        // _focusedNode is the same node reference; its .path was already
        // updated by tree.moveNode. Nothing extra to do here — the suffix
        // capture above is just a witness that focus belongs to the moved
        // subtree, so we don't need to clear it.
      }
    }

    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  removeNode(
    path: string,
    includeDescendants: boolean = true
  ): { success: boolean; node?: LTreeNode<T>; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.removeNode(path, includeDescendants) || {
      success: false,
      error: 'Tree not initialized'
    };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  addNode(
    parentPath: string,
    nodeData: T,
    pathSegment?: string
  ): { success: boolean; node?: LTreeNode<T>; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.addNode(parentPath, nodeData, pathSegment) || {
      success: false,
      error: 'Tree not initialized'
    };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  updateNode(
    path: string,
    dataUpdates: Partial<T>
  ): { success: boolean; node?: LTreeNode<T>; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.updateNode(path, dataUpdates) || {
      success: false,
      error: 'Tree not initialized'
    };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  applyChanges(changes: TreeChange<T>[]): ApplyChangesResult {
    this._skipInsertArray = true;
    const result = this.tree?.applyChanges(changes) || { successful: 0, failed: [] };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  copyNodeWithDescendants(
    sourceNode: LTreeNode<T>,
    targetParentPath: string,
    transformData: (data: T) => T,
    siblingPath?: string,
    position?: 'before' | 'after'
  ): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.copyNodeWithDescendants(
      sourceNode, targetParentPath, transformData, siblingPath, position
    ) || { success: false, count: 0, error: 'Tree not initialized' };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  insertBranch(parentPath: string, data: T[]): { success: boolean; count: number; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.insertBranch(parentPath, data) || { success: false, count: 0, error: 'Tree not initialized' };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  replaceBranch(parentPath: string, data: T[]): { success: boolean; removed: number; added: number; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.replaceBranch(parentPath, data) || { success: false, removed: 0, added: 0, error: 'Tree not initialized' };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  deleteBranch(path: string, keepParent?: boolean): { success: boolean; count: number; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.deleteBranch(path, keepParent) || { success: false, count: 0, error: 'Tree not initialized' };
    queueMicrotask(() => { this._skipInsertArray = false; });
    return result;
  }

  getExpandedPaths(): string[] {
    return this.tree?.getExpandedPaths() || [];
  }

  setExpandedPaths(paths: string[]): void {
    this.tree?.setExpandedPaths(paths);
  }

  getAllData(): T[] {
    return this.tree?.getAllData() || [];
  }

  // ── Highlight API (multi-select via Ctrl/Shift+click) ────────────────
  //
  // Three-level selection model (mirrors svelte-treeview rc06+):
  //   - focusedNode     = single focused node (click, arrow keys)
  //   - highlightedPaths = multi-select set built by Ctrl/Shift+click
  //   - selectedPaths    = checkbox data state (touched by check/uncheck)
  //
  // When `showCheckboxes` is false, every change to `highlightedPaths` is
  // mirrored into `selectedPaths` so the form-style selection still reflects
  // what the user picked via the mouse. With checkboxes visible the two sets
  // stay independent.

  /** Programmatically update the highlight set.
   *  - `mode='replace'`: replaces the set with `path`
   *  - `mode='toggle'`: toggles `path` in/out of the set
   *  - `mode='range'`: range-selects from focused node to `path`
   *  Pass `{ silent: true }` to skip the `onHighlightChange` / mirror callbacks. */
  highlightNode(
    path: string,
    mode: 'replace' | 'toggle' | 'range' = 'replace',
    options?: { silent?: boolean }
  ): void {
    const modifiers: SelectionModifiers | undefined =
      mode === 'toggle' ? { ctrl: true, shift: false }
      : mode === 'range' ? { ctrl: false, shift: true }
      : undefined;
    this._applyHighlight(path, modifiers, options);
  }

  /** Replace the highlight set with the given paths. Pass `{ silent: true }`
   *  to skip `onHighlightChange`. */
  highlightNodes(paths: string[], options?: { silent?: boolean }): void {
    this._clearHighlightFlags();
    this._highlightedPaths.clear();
    let lastNode: LTreeNode<T> | null = null;
    for (const path of paths) {
      const node = this.tree?.getNodeByPath(path);
      if (node && node.isSelectable) {
        this._highlightedPaths.add(path);
        node.isHighlighted = true;
        node._rev++;
        lastNode = node;
      }
    }
    if (lastNode) {
      this._lastHighlightedPath = lastNode.path;
      this._focusedNode = lastNode;
    }
    if (!options?.silent) {
      this._emitHighlightChange();
      this._mirrorHighlightToSelected();
    }
    this.tree.refresh();
    this._scheduleNotify();
  }

  /** Clear the highlight set. Pass `{ silent: true }` to skip
   *  `onHighlightChange`. */
  clearHighlight(options?: { silent?: boolean }): void {
    this._clearHighlightFlags();
    this._highlightedPaths.clear();
    this._lastHighlightedPath = null;
    this._focusedNode = null;
    if (!options?.silent) {
      this._emitHighlightChange();
      this._mirrorHighlightToSelected();
    }
    this.tree.refresh();
    this._scheduleNotify();
  }

  /** Get all currently highlighted nodes. */
  getHighlightedNodes(): LTreeNode<T>[] {
    const nodes: LTreeNode<T>[] = [];
    for (const path of this._highlightedPaths) {
      const node = this.tree?.getNodeByPath(path);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  /** Get a snapshot of the highlighted-path set. */
  getHighlightedPaths(): Set<string> {
    return new Set(this._highlightedPaths);
  }

  /** Check if a node is in the highlight set. */
  isNodeHighlighted(path: string): boolean {
    return this._highlightedPaths.has(path);
  }

  /** @deprecated Use `highlightNode()` instead. */
  selectNode(path: string, modifiers?: SelectionModifiers): void {
    this._applyHighlight(path, modifiers);
  }

  /** @deprecated Use `highlightNodes()` instead. */
  selectNodes(paths: string[]): void {
    this.highlightNodes(paths);
  }

  /** Highlight every visible node. */
  selectAll(): void {
    this._clearHighlightFlags();
    this._highlightedPaths.clear();
    const visible = this.tree?.visibleFlatNodes ?? [];
    for (const node of visible) {
      if (!node.isSelectable) continue;
      this._highlightedPaths.add(node.path);
      node.isHighlighted = true;
      node._rev++;
    }
    if (visible.length > 0) {
      this._lastHighlightedPath = visible[visible.length - 1].path;
      this._focusedNode = visible[visible.length - 1];
    }
    this._emitHighlightChange();
    this._mirrorHighlightToSelected();
    this.tree.refresh();
    this._scheduleNotify();
  }

  /** Clear `isHighlighted` flag on every node currently in the highlight set. */
  private _clearHighlightFlags(): void {
    for (const path of this._highlightedPaths) {
      const node = this.tree?.getNodeByPath(path);
      if (node) {
        node.isHighlighted = false;
        node._rev++;
      }
    }
  }

  /** Range-highlight between two paths. */
  private _rangeSelect(fromPath: string, toPath: string): void {
    const nodes = this._rangeSelectionMode === 'visual'
      ? (this.tree?.visibleFlatNodes ?? [])
      : (this.tree?.tree ?? []);

    let fromIndex = -1;
    let toIndex = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].path === fromPath) fromIndex = i;
      if (nodes[i].path === toPath) toIndex = i;
      if (fromIndex >= 0 && toIndex >= 0) break;
    }

    if (fromIndex < 0 || toIndex < 0) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    this._clearHighlightFlags();
    this._highlightedPaths.clear();

    for (let i = start; i <= end; i++) {
      const node = nodes[i];
      if (!node.isSelectable) continue;
      this._highlightedPaths.add(node.path);
      node.isHighlighted = true;
      node._rev++;
    }

    this._focusedNode = this.tree?.getNodeByPath(toPath) ?? null;
  }

  /** Internal: do the click-driven highlight work. Called by both the
   *  click handler (with `modifiers` from the event) and the public
   *  `highlightNode(path, mode, options)` (which builds modifiers from
   *  the mode string). */
  private _applyHighlight(
    path: string,
    modifiers?: SelectionModifiers,
    options?: { silent?: boolean }
  ): void {
    const node = this.tree?.getNodeByPath(path);
    if (!node) return;

    const ctrl = modifiers?.ctrl ?? false;
    const shift = modifiers?.shift ?? false;
    // Single-mode degrades Ctrl/Shift+click to plain click (matches rc09).
    const isMulti = this._selectionMode === 'multi';
    const useCtrl = ctrl && isMulti;
    const useShift = shift && isMulti;

    if (useShift && this._lastHighlightedPath) {
      this._rangeSelect(this._lastHighlightedPath, path);
    } else if (useCtrl) {
      if (!node.isSelectable) return;
      if (this._highlightedPaths.has(path)) {
        this._highlightedPaths.delete(path);
        node.isHighlighted = false;
        node._rev++;
      } else {
        this._highlightedPaths.add(path);
        node.isHighlighted = true;
        node._rev++;
      }
      this._lastHighlightedPath = path;
      this._focusedNode = node;
    } else {
      // Replace
      this._clearHighlightFlags();
      this._highlightedPaths.clear();
      if (node.isSelectable) {
        this._highlightedPaths.add(path);
        node.isHighlighted = true;
        node._rev++;
        this._lastHighlightedPath = path;
      } else {
        this._lastHighlightedPath = null;
      }
      this._focusedNode = node;
    }

    if (!options?.silent) {
      this._emitHighlightChange();
      this._mirrorHighlightToSelected();
    }
    this.tree.refresh();
    this._scheduleNotify();
  }

  /** Emit the `onHighlightChange` callback. */
  private _emitHighlightChange(): void {
    this.onHighlightChangeCb?.(new Set(this._highlightedPaths), this.getHighlightedNodes());
  }

  /** Emit the `onSelectionChange` callback (checkbox state). */
  private _emitSelectionChange(): void {
    this.onSelectionChangeCb?.(this.getSelectedNodes(), new Set(this._selectedPaths));
  }

  /** When `showCheckboxes` is false, the highlight set IS the selection set —
   *  mirror it onto `_selectedPaths` so consumers reading the bindable
   *  checkbox state see what the user picked via the mouse. With checkboxes
   *  visible the two sets stay independent. Mirrors svelte-treeview rc09. */
  private _mirrorHighlightToSelected(): void {
    if (this._showCheckboxes) return;
    this._selectedPaths = new Set(this._highlightedPaths);
    this._emitSelectionChange();
  }

  // ── Selection API (checkbox / data state) ────────────────────────────

  /** Get all selected (checked) nodes. */
  getSelectedNodes(): LTreeNode<T>[] {
    const nodes: LTreeNode<T>[] = [];
    for (const path of this._selectedPaths) {
      const node = this.tree?.getNodeByPath(path);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  /** Get a snapshot of the selected-path set (checkbox state). */
  getSelectedPaths(): Set<string> {
    return new Set(this._selectedPaths);
  }

  /** Check if a node is in the selected (checked) set. */
  isNodeSelected(path: string): boolean {
    return this._selectedPaths.has(path);
  }

  /** Clear the selected (checked) set. Pass `{ silent: true }` to skip
   *  `onSelectionChange`. */
  deselectAll(options?: { silent?: boolean }): void {
    for (const path of this._selectedPaths) {
      const node = this.tree?.getNodeByPath(path);
      if (node) {
        node.isSelected = false;
        node.visualState = VisualState.notSelected;
        node._rev++;
      }
    }
    this._selectedPaths.clear();
    if (!options?.silent) this._emitSelectionChange();
    this.tree.refresh();
    this._scheduleNotify();
  }

  // ── Checkbox toggle (called by the renderer) ─────────────────────────

  /** Handle checkbox toggle. Honors checkboxMode (cascade/independent),
   *  multi-highlight bulk toggle, beforeCheckboxToggleCallback interceptor.
   *  Mirrors svelte-treeview rc06+ flow. */
  private _onCheckboxToggle(
    node: LTreeNode<T>,
    options?: { skipFocus?: boolean }
  ): void {
    // In cascade mode, indeterminate → check all (not fully selected yet).
    const newChecked =
      this._checkboxMode === 'cascade' && node.visualState === VisualState.indeterminate
        ? true
        : !node.isSelected;

    // Bulk via highlight: if the clicked node is in a multi-highlight,
    // apply to every highlighted node.
    const isMultiHighlighted =
      this._highlightedPaths.size > 1 && this._highlightedPaths.has(node.path);

    let affectedPaths: string[] = isMultiHighlighted
      ? [...this._highlightedPaths]
      : [node.path];

    if (this._checkboxMode === 'cascade') {
      const expanded = new Set(affectedPaths);
      for (const path of affectedPaths) {
        const n = this.tree?.getNodeByPath(path);
        if (n) {
          for (const dp of this._getDescendantPaths(n)) expanded.add(dp);
        }
      }
      affectedPaths = [...expanded];
    }

    // Interceptor: false → cancel, string[] → override affected paths.
    if (this.beforeCheckboxToggleCb) {
      const result = this.beforeCheckboxToggleCb(node, newChecked, affectedPaths);
      if (result === false) return;
      if (Array.isArray(result)) affectedPaths = result;
    }

    const newPaths = new Set(this._selectedPaths);
    for (const path of affectedPaths) {
      const n = this.tree?.getNodeByPath(path);
      if (!n) continue;
      if (newChecked) {
        newPaths.add(path);
        n.isSelected = true;
      } else {
        newPaths.delete(path);
        n.isSelected = false;
      }
      n._rev++;
    }
    this._selectedPaths = newPaths;

    if (!options?.skipFocus) this._focusedNode = node;

    // Update visual states (cascade only — independent mode never auto-checks
    // a parent based on descendants).
    if (this._checkboxMode === 'cascade') {
      const rootPaths = isMultiHighlighted ? [...this._highlightedPaths] : [node.path];
      for (const rp of rootPaths) {
        const rn = this.tree?.getNodeByPath(rp);
        if (!rn) continue;
        const vs = this._computeVisualState(rn);
        if (rn.visualState !== vs) {
          rn.visualState = vs;
          rn._rev++;
        }
        this._updateAncestorVisualStates(rp);
      }
    }

    this.onNodeClickedCb?.(node);
    this._emitSelectionChange();
    this.tree.refresh();
    this._scheduleNotify();
  }

  /** Collect every descendant path of a node (depth-first). */
  private _getDescendantPaths(node: LTreeNode<T>): string[] {
    const result: string[] = [];
    const traverse = (n: LTreeNode<T>) => {
      for (const child of Object.values(n.children)) {
        result.push(child.path);
        traverse(child);
      }
    };
    traverse(node);
    return result;
  }

  /** Walk up from a node and set visualState on each ancestor based on its
   *  descendant selection. Syncs `isSelected` on the ancestors (all
   *  descendants selected → ancestor selected). */
  private _updateAncestorVisualStates(startPath: string): void {
    const newPaths = new Set(this._selectedPaths);
    let path: string | null | undefined = this.tree?.getNodeByPath(startPath)?.parentPath;
    while (path) {
      const ancestor = this.tree?.getNodeByPath(path);
      if (!ancestor) break;
      const vs = this._computeVisualState(ancestor);

      const shouldBeSelected = vs === VisualState.selected;
      if (ancestor.isSelected !== shouldBeSelected) {
        ancestor.isSelected = shouldBeSelected;
        if (shouldBeSelected) newPaths.add(path);
        else newPaths.delete(path);
      }
      if (ancestor.visualState !== vs) ancestor.visualState = vs;
      ancestor._rev++;
      path = ancestor.parentPath;
    }
    this._selectedPaths = newPaths;
  }

  /** Compute the visualState (selected / notSelected / indeterminate) for a
   *  node based on its descendants' `isSelected`. Leaves use the node's own
   *  `isSelected`. */
  private _computeVisualState(node: LTreeNode<T>): VisualState {
    const children = Object.values(node.children);
    if (children.length === 0) {
      return node.isSelected ? VisualState.selected : VisualState.notSelected;
    }
    let allSelected = true;
    let noneSelected = true;
    const check = (n: LTreeNode<T>) => {
      if (!allSelected && !noneSelected) return;
      if (n.isSelected) noneSelected = false;
      else allSelected = false;
      for (const child of Object.values(n.children)) {
        if (!allSelected && !noneSelected) return;
        check(child);
      }
    };
    for (const child of children) {
      check(child);
      if (!allSelected && !noneSelected) break;
    }
    if (allSelected) return VisualState.selected;
    if (noneSelected) return VisualState.notSelected;
    return VisualState.indeterminate;
  }

  // ── Navigation API ────────────────────────────────────────────────

  /** Navigate to a specific path (selects and focuses it). */
  navTo(path: string): void {
    this.selectNode(path);
  }

  /** Navigate to the next visible node. */
  navNext(): void {
    const visible = this.tree?.visibleFlatNodes ?? [];
    if (visible.length === 0) return;
    const currentPath = this._focusedNode?.path;
    if (!currentPath) {
      this.selectNode(visible[0].path);
      return;
    }
    const idx = visible.findIndex(n => n.path === currentPath);
    if (idx >= 0 && idx < visible.length - 1) {
      this.selectNode(visible[idx + 1].path);
    }
  }

  /** Navigate to the previous visible node. */
  navPrev(): void {
    const visible = this.tree?.visibleFlatNodes ?? [];
    if (visible.length === 0) return;
    const currentPath = this._focusedNode?.path;
    if (!currentPath) {
      this.selectNode(visible[visible.length - 1].path);
      return;
    }
    const idx = visible.findIndex(n => n.path === currentPath);
    if (idx > 0) {
      this.selectNode(visible[idx - 1].path);
    }
  }

  /** Navigate into first child (expand if collapsed, then move to child). */
  navInto(): void {
    const node = this._focusedNode;
    if (!node || !node.hasChildren) return;

    if (!node.isExpanded) {
      this.tree?.expandNodes(node.path);
    }
    // visibleFlatNodes updated synchronously — move to first child
    const visible = this.tree?.visibleFlatNodes ?? [];
    const idx = visible.findIndex(n => n.path === node.path);
    if (idx >= 0 && idx + 1 < visible.length) {
      this.selectNode(visible[idx + 1].path);
    }
  }

  /** Navigate to parent node (no collapse — matches svelte-treeview). */
  navOut(): void {
    const node = this._focusedNode;
    if (!node) return;
    const sep = this._treePathSeparator;
    const lastSep = node.path.lastIndexOf(sep);
    if (lastSep > 0) {
      const parentPath = node.path.substring(0, lastSep);
      this.selectNode(parentPath);
    }
  }

  /** Navigate to parent and collapse it. */
  navBackOut(): void {
    const node = this._focusedNode;
    if (!node) return;
    const sep = this._treePathSeparator;
    const lastSep = node.path.lastIndexOf(sep);
    if (lastSep > 0) {
      const parentPath = node.path.substring(0, lastSep);
      this.tree?.collapseNodes(parentPath);
      this.selectNode(parentPath);
    }
  }

  /** Toggle expand/collapse on current node. */
  navToggle(): void {
    const node = this._focusedNode;
    if (!node || !node.hasChildren) return;
    if (node.isExpanded) {
      this.tree?.collapseNodes(node.path);
    } else {
      this.tree?.expandNodes(node.path);
    }
    this._scheduleNotify();
  }

  /** Navigate to first visible node. */
  navFirst(): void {
    const visible = this.tree?.visibleFlatNodes ?? [];
    if (visible.length > 0) {
      this.selectNode(visible[0].path);
    }
  }

  /** Navigate to last visible node. */
  navLast(): void {
    const visible = this.tree?.visibleFlatNodes ?? [];
    if (visible.length > 0) {
      this.selectNode(visible[visible.length - 1].path);
    }
  }

  /** Navigate to next visible node at the same level. */
  navNextSibling(): void {
    const visible = this.tree?.visibleFlatNodes ?? [];
    if (visible.length === 0) return;
    const currentPath = this._focusedNode?.path;
    const currentIndex = currentPath ? visible.findIndex(n => n.path === currentPath) : -1;
    if (currentIndex === -1) {
      this.selectNode(visible[0].path);
      return;
    }
    const currentLevel = visible[currentIndex].level;
    for (let i = currentIndex + 1; i < visible.length; i++) {
      if (visible[i].level === currentLevel) {
        this.selectNode(visible[i].path);
        return;
      }
    }
  }

  /** Navigate to previous visible node at the same level. */
  navPrevSibling(): void {
    const visible = this.tree?.visibleFlatNodes ?? [];
    if (visible.length === 0) return;
    const currentPath = this._focusedNode?.path;
    const currentIndex = currentPath ? visible.findIndex(n => n.path === currentPath) : -1;
    if (currentIndex === -1) {
      this.selectNode(visible[visible.length - 1].path);
      return;
    }
    const currentLevel = visible[currentIndex].level;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (visible[i].level === currentLevel) {
        this.selectNode(visible[i].path);
        return;
      }
    }
  }

  // ── Clipboard API ─────────────────────────────────────────────────

  /** Copy selected nodes (or specified paths) to clipboard. */
  copyNodes(paths?: string[]): void {
    const targetPaths = paths ?? [...this._highlightedPaths];
    if (targetPaths.length === 0) return;

    const entries = targetPaths
      .map(p => this._collectClipboardEntry(p))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length > 0) {
      setClipboard('copy', entries);
    }
  }

  /** Cut selected nodes (or specified paths) to clipboard. */
  cutNodes(paths?: string[]): void {
    const targetPaths = paths ?? [...this._highlightedPaths];
    if (targetPaths.length === 0) return;

    const entries = targetPaths
      .map(p => this._collectClipboardEntry(p))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length > 0) {
      setClipboard('cut', entries);
      // Mark cut nodes for visual dimming
      this._cutPaths.clear();
      for (const path of targetPaths) {
        this._cutPaths.add(path);
        // Also mark descendants
        const node = this.tree?.getNodeByPath(path);
        if (node) {
          this._walkDescendants(node, (desc) => {
            this._cutPaths.add(desc.path);
          });
        }
      }
      this.tree.refresh();
      this._scheduleNotify();
    }
  }

  /** Paste clipboard content at target path. */
  pasteNodes(
    targetPath: string,
    transformData?: (data: T) => T,
    position?: DropPosition
  ): PasteResult<T> {
    const clipboard = getClipboard<T>();
    if (!clipboard || clipboard.entries.length === 0) {
      return { success: false, pastedCount: 0, error: 'Clipboard is empty' };
    }

    const targetNode = this.tree?.getNodeByPath(targetPath);
    if (!targetNode) {
      return { success: false, pastedCount: 0, error: 'Target node not found' };
    }

    const operation = clipboard.operation;
    let pastedCount = 0;
    const parentPath = position === 'child' || !position ? targetPath : targetPath;

    this._skipInsertArray = true;

    for (const entry of clipboard.entries) {
      // Add root node
      const rootData = transformData ? transformData({ ...entry.data }) : { ...entry.data };
      const addResult = this.tree?.addNode(parentPath, rootData);
      if (addResult?.success && addResult.node) {
        pastedCount++;
        const newRootPath = addResult.node.path;
        // Add descendants
        for (const desc of entry.descendants) {
          const descData = transformData ? transformData({ ...desc.data }) : { ...desc.data };
          // Compute the absolute path for this descendant relative to the new root
          const descParentRelative = desc.relativePath.substring(0, desc.relativePath.lastIndexOf(this._treePathSeparator));
          const descParentPath = descParentRelative
            ? `${newRootPath}${this._treePathSeparator}${descParentRelative}`
            : newRootPath;
          const descResult = this.tree?.addNode(descParentPath, descData);
          if (descResult?.success) pastedCount++;
        }
      }
    }

    // If cut operation, remove source nodes
    if (operation === 'cut') {
      for (const entry of clipboard.entries) {
        this.tree?.removeNode(entry.sourcePath, true);
      }
      this._cutPaths.clear();
      clearClipboard();
    }

    queueMicrotask(() => { this._skipInsertArray = false; });
    this.tree.refresh();
    this._scheduleNotify();
    return { success: true, pastedCount };
  }

  /** Cancel cut operation, clear cut visual state. */
  cancelCut(): void {
    if (getClipboardOp() === 'cut') {
      clearClipboard();
    }
    this._cutPaths.clear();
    this.tree.refresh();
    this._scheduleNotify();
  }

  /** Check if clipboard has content. */
  hasClipboardContent(): boolean {
    return hasClipboardFn();
  }

  /** Get clipboard operation type. */
  getClipboardOperation(): 'copy' | 'cut' | null {
    return getClipboardOp();
  }

  /** Collect a clipboard entry for a node path. */
  private _collectClipboardEntry(path: string): ClipboardEntry<T> | null {
    const node = this.tree?.getNodeByPath(path);
    if (!node || !node.data) return null;

    const descendants: Array<{ relativePath: string; data: T }> = [];
    this._walkDescendants(node, (desc) => {
      if (desc.data) {
        // Compute path relative to the source node
        const relativePath = desc.path.substring(node.path.length + this._treePathSeparator.length);
        descendants.push({
          relativePath,
          data: JSON.parse(JSON.stringify(desc.data))
        });
      }
    });

    return {
      sourceTreeId: this._treeId,
      sourcePath: path,
      data: JSON.parse(JSON.stringify(node.data)),
      descendants
    };
  }

  /** Walk all descendants of a node. */
  private _walkDescendants(node: LTreeNode<T>, callback: (node: LTreeNode<T>) => void): void {
    if (!node.children) return;
    for (const child of Object.values(node.children)) {
      callback(child);
      this._walkDescendants(child, callback);
    }
  }

  /** Open the context menu at the given screen coordinates. Offsets are applied by the renderer via Floating UI. */
  openContextMenu(node: LTreeNode<T>, screenX: number, screenY: number) {
    this._contextMenuNode = node;
    this._contextMenuX = screenX;
    this._contextMenuY = screenY;
    this._contextMenuVisible = true;
    this._isDebugMenuActive = false;
    this._updateContextMenuListeners();
    this._scheduleNotify();
  }

  closeContextMenu() {
    this._contextMenuVisible = false;
    this._contextMenuNode = null;
    this._isDebugMenuActive = false;
    this._updateContextMenuListeners();
    this._scheduleNotify();
  }

  // ── Public Drag-and-Drop API ────────────────────────────────────────

  /** Call from ondragstart. Sets up dataTransfer, stores drag state, fires callback. */
  startDrag(node: LTreeNode<T>, event: DragEvent): void {
    dragLogger.debug('startDrag', { path: node.path, isDraggable: this.getNodeIsDraggable(node), dragDropMode: this._dragDropMode, hasDataTransfer: !!event.dataTransfer });
    if (this._dragDropMode === 'none' || !this.getNodeIsDraggable(node) || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = this._allowCopy ? 'copyMove' : 'move';
    event.dataTransfer.setData('application/svelte-treeview', JSON.stringify(node));
    const displayValue = this.tree.getNodeDisplayValue(node);
    if (displayValue) event.dataTransfer.setData('text/plain', displayValue);
    this._onNodeDragStartInternal(node, event);
  }

  /** Call from ondragover. Calculates drop position, updates hover state. */
  dragOver(node: LTreeNode<T>, event: DragEvent, element?: HTMLElement): void {
    if (!event.dataTransfer?.types.includes('application/svelte-treeview')) return;

    let effectiveDraggedNode = this._draggedNode;
    let isCrossTreeDrag = false;
    if (!effectiveDraggedNode) {
      isCrossTreeDrag = true;
      try {
        const data = event.dataTransfer.getData('application/svelte-treeview');
        if (data) effectiveDraggedNode = JSON.parse(data);
      } catch { /* getData might fail during dragover */ }
      this._isDragInProgress = true;
    }

    const dropAllowed = isCrossTreeDrag
      ? this._dragDropMode === 'both' || this._dragDropMode === 'cross'
      : this.isDropAllowedByMode(effectiveDraggedNode?.treeId);

    if (!dropAllowed) {
      this._hoveredNodeForDrop = null;
      return;
    }

    const isValidDrop = effectiveDraggedNode
      ? isCrossTreeDrag || effectiveDraggedNode.path !== node.path
      : this._isDragInProgress;

    if (!isValidDrop) return;

    event.preventDefault();
    this._hoveredNodeForDrop = node;
    this._currentDropOperation = (this._allowCopy && event.ctrlKey) ? 'copy' : 'move';

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this._currentDropOperation;
    }

    if (element) {
      const positions = this.getNodeAllowedDropPositions(node);
      this._activeDropPosition = this.calculateDropPositionFromEvent(event, element, positions);
    } else {
      const el = (event.currentTarget || event.target) as Element;
      if (el) {
        this._activeDropPosition = this.calculateDropPosition(event, el);
      }
    }

    this.onNodeDragOverCb?.(node, event);
    this._scheduleNotify();
  }

  /** Call from ondragleave. Clears hover state when cursor leaves element bounds. */
  dragLeave(_node: LTreeNode<T>, event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      this._hoveredNodeForDrop = null;
      this._activeDropPosition = null;
      this._scheduleNotify();
    }
  }

  /** Call from ondrop. Uses calculated position or defaults to 'child'. */
  drop(node: LTreeNode<T>, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = (this._allowCopy && event.ctrlKey) ? 'copy' : 'move';
    }

    let isCrossTreeDrag = false;
    if (!this._draggedNode) {
      const data = event.dataTransfer?.getData('application/svelte-treeview');
      if (data) {
        this._draggedNode = JSON.parse(data);
        isCrossTreeDrag = this._draggedNode?.treeId !== this._treeId;
      }
    }

    if (this._draggedNode) {
      const dropAllowed = isCrossTreeDrag
        ? this._dragDropMode === 'both' || this._dragDropMode === 'cross'
        : this.isDropAllowedByMode(this._draggedNode.treeId);

      if (dropAllowed && (isCrossTreeDrag || this._draggedNode.path !== node.path)) {
        const position = this._activeDropPosition || 'child';
        this._handleDrop(node, this._draggedNode, position, event);
      }
    }

    this._resetDragState();
  }

  /** Drop with explicit position (for custom drop zones). */
  dropAt(node: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent): void {
    if (event instanceof DragEvent) {
      event.preventDefault();
      if (!this._draggedNode) {
        const data = event.dataTransfer?.getData('application/svelte-treeview');
        if (data) this._draggedNode = JSON.parse(data);
      }
    }

    if (this._draggedNode) {
      this._handleDrop(node, this._draggedNode, position, event);
    }

    this._resetDragState();
  }

  /** Cancel current drag and reset all state. */
  cancelDrag(): void {
    dragLogger.debug('Drag cancelled via public API');
    this._resetDragState();
  }

  /** Touch drag start */
  touchStart(node: LTreeNode<T>, event: TouchEvent): void {
    this._onTouchStart(node, event);
  }

  /** Touch drag move */
  touchMove(node: LTreeNode<T>, event: TouchEvent): void {
    this._onTouchMove(node, event);
  }

  /** Touch drag end */
  touchEnd(node: LTreeNode<T>, event: TouchEvent): void {
    this._onTouchEnd(node, event);
  }

  /** Get allowed drop positions for a node */
  getNodeAllowedDropPositions(node: LTreeNode<T>): DropPosition[] | null {
    return this.tree?.getNodeAllowedDropPositions(node) ?? null;
  }

  /** Get whether a node is draggable */
  getNodeIsDraggable(node: LTreeNode<T>): boolean {
    return this.tree?.getNodeIsDraggable(node) ?? true;
  }

  /** Get whether a node is collapsible */
  getNodeIsCollapsible(node: LTreeNode<T>): boolean {
    return this.tree?.getNodeIsCollapsible(node) ?? true;
  }

  /** Calculate drop position from cursor location within an element */
  calculateDropPositionFromEvent(
    event: DragEvent | MouseEvent,
    element: HTMLElement,
    allowedPositions?: DropPosition[] | null
  ): DropPosition {
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Convert dropZoneStart to pixels: number = percentage, string = as-is (px or %)
    const dzs = this._dropZoneStart;
    const startPx = typeof dzs === 'number'
      ? (dzs / 100) * width
      : String(dzs).endsWith('px')
        ? parseFloat(String(dzs))
        : (parseFloat(String(dzs)) / 100) * width;

    let idealPosition: DropPosition;
    if (x > startPx) {
      idealPosition = 'child';
    } else if (y < height / 2) {
      idealPosition = 'before';
    } else {
      idealPosition = 'after';
    }

    if (!allowedPositions || allowedPositions.length === 0) {
      return idealPosition;
    }

    if (allowedPositions.includes(idealPosition)) {
      return idealPosition;
    }

    if (allowedPositions.length === 1) {
      return allowedPositions[0];
    }

    if (allowedPositions.includes('before') && allowedPositions.includes('after')) {
      return y < height / 2 ? 'before' : 'after';
    }

    return allowedPositions[0];
  }

  async scrollToPath(
    path: string,
    options?: {
      expand?: boolean;
      expandTarget?: boolean;
      highlight?: boolean;
      scrollOptions?: ScrollIntoViewOptions;
      containerScroll?: boolean;
      containerElement?: HTMLElement;
    }
  ): Promise<boolean> {
    perfStart(`[${this._treeId}] scrollToPath`);
    const {
      expand = true,
      expandTarget = false,
      highlight = true,
      scrollOptions = { behavior: 'smooth', block: 'center' },
      containerScroll = false,
      containerElement
    } = options || {};

    const node = this.tree.getNodeByPath(path);
    if (!node || !node.id) {
      console.warn(`[Tree ${this._treeId}] Node not found for path: ${path}`);
      perfEnd(`[${this._treeId}] scrollToPath`);
      return false;
    }

    if (expand && node.parentPath) {
      this.tree.expandNodes(node.parentPath);
    }

    if (expandTarget) {
      this.tree.expandNodes(path);
    }

    if (expand || expandTarget) {
      await new Promise<void>(resolve => queueMicrotask(resolve));
    }

    // Virtual scroll: programmatically scroll the container to bring the node into view
    if (this._virtualScroll) {
      const allNodes = this.allVisibleFlatNodes;
      const nodeIndex = allNodes.findIndex(n => n.path === path);
      if (nodeIndex >= 0) {
        const rowHeight = this.resolvedRowHeight;
        const containerPx = parseFloat(this.resolvedContainerHeight) || 400;
        const targetScrollTop = Math.max(0, nodeIndex * rowHeight - containerPx / 2 + rowHeight / 2);
        this._vsScrollTop = targetScrollTop;
        // Set the actual DOM scroll position
        const scrollEl = (containerElement || this.containerElement)?.querySelector('.wtv__tree') as HTMLElement;
        if (scrollEl) {
          scrollEl.scrollTop = targetScrollTop;
        }
        // Synchronous flush — renderer reconciles the visible window immediately,
        // so the target node element is in the DOM before we query for it below.
        // This also prevents race conditions when scrollToPath is called rapidly.
        this._flushNotify();
      }
    }

    const elementId = `${this._treeId}-${node.id}`;
    const rootEl = containerElement || this.containerElement;
    const findContent = (): HTMLElement | null => {
      const el = rootEl
        ? rootEl.querySelector(`#${CSS.escape(elementId)}`)
        : document.getElementById(elementId);
      return (el?.querySelector('.wtv__node-content') as HTMLElement | null) ?? null;
    };
    // Progressive flat rendering adds newly-revealed rows in rAF-deferred
    // batches (initialBatchSize, doubling each step). After expandNodes and
    // the microtask flush above, the immediate batch is in DOM but rows past
    // that batch arrive over subsequent frames. Retry across up to ~6 frames
    // before giving up — without this, scrollToPath silently no-ops on any
    // target that lands past the first batch.
    let contentDiv = findContent();
    if (!contentDiv) {
      for (let i = 0; i < 6 && !contentDiv; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        contentDiv = findContent();
      }
    }

    if (!contentDiv) {
      console.warn(`[Tree ${this._treeId}] DOM element not found for node ID: ${elementId}`);
      perfEnd(`[${this._treeId}] scrollToPath`);
      return false;
    }

    if (containerScroll) {
      // Caller can pass `containerElement` explicitly — useful when the
      // scrollable wrapper sits in the light DOM (outside the web-component's
      // Shadow DOM), where `findScrollableAncestor` can't walk to it.
      const container = containerElement ?? this.findScrollableAncestor(contentDiv);
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = contentDiv.getBoundingClientRect();
        const scrollTop =
          container.scrollTop +
          (elementRect.top - containerRect.top) -
          containerRect.height / 2 +
          elementRect.height / 2;
        container.scrollTo({
          top: scrollTop,
          behavior: scrollOptions?.behavior || 'smooth'
        });
      }
    } else {
      contentDiv.scrollIntoView(scrollOptions);
    }

    if (highlight && this._scrollHighlightClass) {
      if (this.currentHighlight) {
        this.currentHighlight.element.classList.remove(this._scrollHighlightClass);
        clearTimeout(this.currentHighlight.timeoutId);
        this.currentHighlight = null;
      }

      contentDiv.classList.add(this._scrollHighlightClass);
      const highlightClass = this._scrollHighlightClass;
      const timeoutId = setTimeout(() => {
        contentDiv.classList.remove(highlightClass);
        this.currentHighlight = null;
      }, this._scrollHighlightTimeout);

      this.currentHighlight = { element: contentDiv, timeoutId };
    }

    perfEnd(`[${this._treeId}] scrollToPath`);
    return true;
  }

  // ── updateProps (batch property updates) ────────────────────────────

  updateProps(updates: Partial<TreeControllerConfig<T>>) {
    // Check if any LTree-baked member mappings changed — requires tree recreation
    const needsTreeRecreation =
      updates.idMember !== undefined ||
      updates.pathMember !== undefined ||
      updates.parentPathMember !== undefined ||
      updates.levelMember !== undefined ||
      updates.hasChildrenMember !== undefined ||
      updates.isExpandedMember !== undefined ||
      updates.isSelectedMember !== undefined ||
      updates.isDraggableMember !== undefined ||
      updates.isDropAllowedMember !== undefined ||
      updates.allowedDropPositionsMember !== undefined ||
      updates.displayValueMember !== undefined ||
      updates.searchValueMember !== undefined ||
      updates.isCollapsibleMember !== undefined ||
      updates.orderMember !== undefined ||
      updates.getDisplayValueCallback !== undefined ||
      updates.getSearchValueCallback !== undefined ||
      updates.getIsDraggableCallback !== undefined ||
      updates.getIsExpandedCallback !== undefined ||
      updates.getIsSelectableCallback !== undefined ||
      updates.getIsSelectedCallback !== undefined ||
      updates.getIsDropAllowedCallback !== undefined ||
      updates.getIsCollapsibleCallback !== undefined ||
      updates.getAllowedDropPositionsCallback !== undefined ||
      updates.sortCallback !== undefined;

    if (updates.treeId !== undefined) this._treeId = updates.treeId || this._treeId;
    if (updates.treePathSeparator !== undefined)
      this.treePathSeparator = updates.treePathSeparator ?? '.';
    if (updates.focusedNode !== undefined) this._focusedNode = updates.focusedNode;
    if (updates.highlightedPaths !== undefined)
      this._highlightedPaths = new Set(updates.highlightedPaths);
    if (updates.selectedPaths !== undefined)
      this._selectedPaths = new Set(updates.selectedPaths);
    if (updates.selectionMode !== undefined)
      this._selectionMode = updates.selectionMode ?? 'single';
    if (updates.showCheckboxes !== undefined) {
      this._showCheckboxes = updates.showCheckboxes ?? false;
      this._updateNodeConfig();
    }
    if (updates.checkboxMode !== undefined)
      this._checkboxMode = updates.checkboxMode ?? 'independent';
    if (updates.clickTogglesCheckbox !== undefined)
      this._clickTogglesCheckbox = updates.clickTogglesCheckbox ?? false;
    if (updates.beforeCheckboxToggleCallback !== undefined)
      this.beforeCheckboxToggleCb = updates.beforeCheckboxToggleCallback;
    if (updates.searchText !== undefined) this.searchText = updates.searchText;
    if (updates.shouldDisplayDebugInformation !== undefined)
      this._shouldDisplayDebugInformation = updates.shouldDisplayDebugInformation ?? false;
    if (updates.shouldDisplayContextMenuInDebugMode !== undefined) {
      this._shouldDisplayContextMenuInDebugMode = updates.shouldDisplayContextMenuInDebugMode ?? false;
    }
    if (updates.isLoading !== undefined) this._isLoading = updates.isLoading ?? false;
    if (updates.bodyClass !== undefined) this._bodyClass = updates.bodyClass;

    if (updates.clickBehavior !== undefined)
      this._clickBehavior = updates.clickBehavior ?? 'expand-and-focus';
    if (updates.accordionExpand !== undefined)
      this._accordionExpand = updates.accordionExpand ?? false;
    if (updates.expandIconClass !== undefined)
      this._expandIconClass = updates.expandIconClass ?? 'wtv__toggle-icon--expand';
    if (updates.collapseIconClass !== undefined)
      this._collapseIconClass = updates.collapseIconClass ?? 'wtv__toggle-icon--collapse';
    if (updates.leafIconClass !== undefined)
      this._leafIconClass = updates.leafIconClass ?? 'wtv__toggle-icon--leaf';
    if (updates.toggleIconMode !== undefined)
      this._toggleIconMode = updates.toggleIconMode ?? 'rotate';
    if (updates.highlightedNodeClass !== undefined)
      this._highlightedNodeClass = updates.highlightedNodeClass;
    if (updates.focusedNodeClass !== undefined)
      this._focusedNodeClass = updates.focusedNodeClass;
    if (updates.dragOverNodeClass !== undefined)
      this._dragOverNodeClass = updates.dragOverNodeClass;
    if (updates.dropZoneMode !== undefined)
      this._dropZoneMode = updates.dropZoneMode ?? 'glow';
    if (updates.dropZoneLayout !== undefined)
      this._dropZoneLayout = updates.dropZoneLayout ?? 'around';
    if (updates.dropZoneStart !== undefined)
      this._dropZoneStart = updates.dropZoneStart ?? 33;
    if (updates.dropZoneMaxWidth !== undefined)
      this._dropZoneMaxWidth = updates.dropZoneMaxWidth ?? 120;
    if (updates.allowCopy !== undefined) this._allowCopy = updates.allowCopy ?? false;
    if (updates.autoHandleCopy !== undefined)
      this._autoHandleCopy = updates.autoHandleCopy ?? true;
    if (updates.autoHandleMove !== undefined)
      this._autoHandleMove = updates.autoHandleMove ?? true;
    if (updates.dragDropMode !== undefined)
      this._dragDropMode = updates.dragDropMode ?? 'none';
    if (updates.scrollHighlightTimeout !== undefined)
      this._scrollHighlightTimeout = updates.scrollHighlightTimeout ?? 4000;
    if (updates.scrollHighlightClass !== undefined)
      this._scrollHighlightClass = updates.scrollHighlightClass ?? 'wtv__node-content--scroll-highlight';
    if (updates.contextMenuXOffset !== undefined)
      this._contextMenuXOffset = updates.contextMenuXOffset ?? 8;
    if (updates.contextMenuYOffset !== undefined)
      this._contextMenuYOffset = updates.contextMenuYOffset ?? 0;

    // Per-node icons
    if (updates.iconMember !== undefined) this._iconMember = updates.iconMember ?? undefined;
    if (updates.iconCallback !== undefined) this._iconCallback = updates.iconCallback;
    if (updates.alignNodeIcons !== undefined) this._alignNodeIcons = updates.alignNodeIcons ?? true;

    // Virtual scroll
    if (updates.virtualScroll !== undefined) this._virtualScroll = updates.virtualScroll ?? false;
    if (updates.virtualRowHeight !== undefined) this._virtualRowHeight = updates.virtualRowHeight;
    if (updates.virtualOverscan !== undefined) this._virtualOverscan = updates.virtualOverscan ?? 5;
    if (updates.virtualContainerHeight !== undefined) this._virtualContainerHeight = updates.virtualContainerHeight;

    // Multi-select
    if (updates.rangeSelectionMode !== undefined) this._rangeSelectionMode = updates.rangeSelectionMode ?? 'visual';
    if (updates.onSelectionChange !== undefined) this.onSelectionChangeCb = updates.onSelectionChange;
    if (updates.onHighlightChange !== undefined) this.onHighlightChangeCb = updates.onHighlightChange;

    // Callbacks
    if (updates.onNodeClicked !== undefined) this.onNodeClickedCb = updates.onNodeClicked;
    if (updates.onNodeDragStart !== undefined) this.onNodeDragStartCb = updates.onNodeDragStart;
    if (updates.onNodeDragOver !== undefined) this.onNodeDragOverCb = updates.onNodeDragOver;
    if (updates.beforeDropCallback !== undefined) this.beforeDropCallbackCb = updates.beforeDropCallback;
    if (updates.onNodeDrop !== undefined) this.onNodeDropCb = updates.onNodeDrop;
    if (updates.contextMenuCallback !== undefined) this.contextMenuCallbackCb = updates.contextMenuCallback;
    if (updates.hasContextMenuRenderer !== undefined) this._hasContextMenuRenderer = updates.hasContextMenuRenderer;
    if (updates.onRenderStart !== undefined) this.onRenderStartCb = updates.onRenderStart;
    if (updates.onRenderProgress !== undefined) this.onRenderProgressCb = updates.onRenderProgress;
    if (updates.onRenderComplete !== undefined) this.onRenderCompleteCb = updates.onRenderComplete;

    if (needsTreeRecreation) {
      // Recreate LTree with updated member mappings
      const resolvedIdMember = updates.idMember ?? this.tree.idMember;
      const resolvedPathMember = updates.pathMember ?? this.tree.pathMember;
      const resolvedDisplayValueMember = updates.displayValueMember ?? this.tree.displayValueMember;
      const resolvedExpandLevel = updates.expandLevel ?? null;
      const data = updates.data ?? this._data;
      initLogger.debug(`[${this._treeId}] Recreating LTree due to member mapping changes`, {
        idMember: resolvedIdMember,
        pathMember: resolvedPathMember,
        displayValueMember: resolvedDisplayValueMember,
        parentPathMember: updates.parentPathMember ?? this.tree.parentPathMember,
        expandLevel: resolvedExpandLevel,
        dataLength: data?.length ?? 0
      });
      this.tree = createLTree<T>(
        updates.idMember ?? this.tree.idMember,
        updates.pathMember ?? this.tree.pathMember,
        updates.parentPathMember ?? this.tree.parentPathMember,
        updates.levelMember ?? this.tree.levelMember,
        updates.hasChildrenMember ?? this.tree.hasChildrenMember,
        updates.isExpandedMember ?? this.tree.isExpandedMember,
        updates.getIsExpandedCallback ?? this.tree.getIsExpandedCallback,
        updates.isSelectableMember ?? this.tree.isSelectableMember,
        updates.getIsSelectableCallback ?? this.tree.getIsSelectableCallback,
        updates.isSelectedMember ?? this.tree.isSelectedMember,
        updates.getIsSelectedCallback ?? this.tree.getIsSelectedCallback,
        updates.isDraggableMember ?? this.tree.isDraggableMember,
        updates.getIsDraggableCallback ?? this.tree.getIsDraggableCallback,
        updates.isDropAllowedMember ?? this.tree.isDropAllowedMember,
        updates.getIsDropAllowedCallback ?? this.tree.getIsDropAllowedCallback,
        updates.allowedDropPositionsMember ?? this.tree.allowedDropPositionsMember,
        updates.displayValueMember ?? this.tree.displayValueMember,
        updates.getDisplayValueCallback ?? this.tree.getDisplayValueCallback,
        updates.searchValueMember ?? this.tree.searchValueMember,
        updates.getSearchValueCallback ?? this.tree.getSearchValueCallback,
        updates.getAllowedDropPositionsCallback,
        updates.isCollapsibleMember,
        updates.getIsCollapsibleCallback,
        updates.orderMember,
        this._treeId,
        this._treePathSeparator,
        updates.expandLevel ?? null,
        updates.shouldUseInternalSearchIndex,
        undefined,
        updates.indexerBatchSize,
        updates.indexerTimeout,
        {
          shouldDisplayDebugInformation: this._shouldDisplayDebugInformation,
          isSorted: updates.isSorted ?? this.tree.isSorted,
          sortCallback: updates.sortCallback
        }
      );
      this.tree.onChange = () => this._onTreeChanged();

      // Insert data into the new tree
      if (data) {
        this._data = data;
        this._skipInsertArray = true;
        queueMicrotask(() => { this._skipInsertArray = false; });
        this._insertResult = this.tree.insertArray(data);
        this._seedSelectedPathsFromTree();
        const result = this._insertResult;
        initLogger.debug(`[${this._treeId}] insertArray result`, {
          successful: result.successful,
          failed: result.failed?.length ?? 0,
          total: result.total,
          visibleFlatNodes: this.tree.visibleFlatNodes?.length ?? 0,
          stats: this.tree.statistics
        });
        this._updateProgressiveRendering();
        initLogger.debug(`[${this._treeId}] after progressive rendering`, {
          flatRenderedIds: this.flatRenderedIds.size,
          flatRenderQueue: this.flatRenderQueue.length,
          flatNodesToRender: this.flatNodesToRender.length
        });
      }
    } else if (updates.data !== undefined) {
      this.data = updates.data;
    }

    this._updateNodeConfig();
    this._updateDebugContextMenu();
    this._scheduleNotify();
  }

  /** Get a snapshot of the current state for the renderer. */
  getSnapshot(): TreeControllerSnapshot<T> {
    return {
      flatNodesToRender: this.flatNodesToRender,
      draggedNodePath: this._draggedNode?.path ?? null,
      isDragInProgress: this._isDragInProgress,
      hoveredNodeForDropPath: this._hoveredNodeForDrop?.path ?? null,
      activeDropPosition: this._activeDropPosition,
      currentDropOperation: this._currentDropOperation,
      contextMenuVisible: this._contextMenuVisible,
      contextMenuX: this._contextMenuX,
      contextMenuY: this._contextMenuY,
      contextMenuXOffset: this._contextMenuXOffset,
      contextMenuYOffset: this._contextMenuYOffset,
      contextMenuNode: this._contextMenuNode,
      isDropPlaceholderActive: this._isDropPlaceholderActive,
      isLoading: this._isLoading,
      isRendering: this._isRendering,
      bodyClass: this._bodyClass,
      useFlatRendering: this._useFlatRendering,
      flatIndentSize: this._flatIndentSize,
      shouldDisplayDebugInformation: this._shouldDisplayDebugInformation,
      focusedNode: this._focusedNode,
      highlightedPaths: this._highlightedPaths,
      selectedPaths: this._selectedPaths,
      cutPaths: this._cutPaths,

      // Virtual scroll
      virtualScroll: this._virtualScroll,
      virtualRowHeight: this.resolvedRowHeight,
      virtualContainerHeight: this.resolvedContainerHeight,
      virtualTotalHeight: this._virtualScroll ? this.allVisibleFlatNodes.length * this.resolvedRowHeight : 0,
      virtualStartIndex: this._virtualScroll
        ? Math.max(0, Math.floor(this._vsScrollTop / this.resolvedRowHeight) - this._virtualOverscan)
        : 0,
      virtualOffsetY: this._virtualScroll
        ? Math.max(0, Math.floor(this._vsScrollTop / this.resolvedRowHeight) - this._virtualOverscan) * this.resolvedRowHeight
        : 0,
    };
  }

  /** Clean up document-level listeners and ghost elements. */
  destroy() {
    if (typeof document !== 'undefined') {
      this._removeDocumentTouchListeners();
      this.removeGhostElement();
      document.querySelectorAll('.wtv__touch-ghost').forEach(el => el.remove());
    }
    this._contextMenuCleanup?.();
    this._contextMenuCleanup = null;
    if (this.flatRenderAnimationFrame) {
      cancelAnimationFrame(this.flatRenderAnimationFrame);
      this.flatRenderAnimationFrame = null;
    }
    this.renderCoordinator?.reset();
    this.tree.onChange = null;
    this.offAll();
  }

  // ── Internal: data changed ──────────────────────────────────────────

  private _onDataChanged() {
    if (this.tree && this._data) {
      if (this._skipInsertArray) {
        this._skipInsertArray = false;
        return;
      }
      this.renderCoordinator?.reset();
      this.flatRenderedIds = new Set();
      this.flatRenderQueue = [];
      this.currentBatchSize = 0;
      this._insertResult = this.tree.insertArray(this._data);
      this._seedSelectedPathsFromTree();
    }
  }

  // ── Internal: tree changed (from LTree.onChange) ────────────────────

  private _onTreeChanged() {
    this._updateProgressiveRendering();
    this._scheduleNotify();
  }

  /** Pre-populate `_highlightedPaths` from any nodes whose `isSelected` was set
   *  at insert time (via `isSelectedMember` or `getIsSelectedCallback`). Runs
   *  after every `insertArray` so consumers reading `getSelectedPaths()`
   *  immediately reflect server-side initial selection.
   *  Mirrors svelte-treeview rc07's post-insert seeding walk. */
  private _seedSelectedPathsFromTree(): void {
    if (!this.tree) return;
    if (!this.tree.isSelectedMember && !this.tree.getIsSelectedCallback) return;
    // Walk every node — collapsed branches still need their selected flag
    // reflected in selectedPaths so the checkbox state is correct when the
    // user later expands them.
    const visit = (node: LTreeNode<T>) => {
      if (node.isSelected) this._selectedPaths.add(node.path);
      for (const child of Object.values(node.children)) visit(child);
    };
    const root = this.tree.root;
    if (root?.children) {
      for (const child of Object.values(root.children)) visit(child);
    }
  }

  // ── Internal: progressive flat rendering ────────────────────────────

  private _updateProgressiveRendering() {
    if (!this._useFlatRendering || !this._progressiveRender || !this.tree?.visibleFlatNodes)
      return;
    // Virtual scroll already limits rendered nodes to the visible window —
    // skip progressive rendering to avoid background batches firing _scheduleNotify
    if (this._virtualScroll) return;

    const tracker = this.tree.changeTracker;
    if (tracker === this.lastFlatNodesTracker) return;
    this.lastFlatNodesTracker = tracker;

    const allNodes = this.tree.visibleFlatNodes;
    const currentIds = new Set(allNodes.map((n) => String(n.id)));

    const renderedSnapshot = new Set(this.flatRenderedIds);
    const queueSnapshot = new Set(this.flatRenderQueue);

    const newIds: string[] = [];
    for (const node of allNodes) {
      const id = String(node.id);
      if (!renderedSnapshot.has(id) && !queueSnapshot.has(id)) {
        newIds.push(id);
      }
    }

    const removedIds: string[] = [];
    for (const id of renderedSnapshot) {
      if (!currentIds.has(id)) {
        removedIds.push(id);
      }
    }

    if (removedIds.length > 0) {
      const newRendered = new Set(renderedSnapshot);
      for (const id of removedIds) {
        newRendered.delete(id);
      }
      this.flatRenderedIds = newRendered;
    }

    if (newIds.length > 0) {
      const alreadyHasManyNodes = renderedSnapshot.size > 1000;
      const addingFewNodes = newIds.length < 200;

      if (alreadyHasManyNodes && addingFewNodes) {
        this.flatRenderedIds = new Set([...this.flatRenderedIds, ...newIds]);
      } else {
        this.currentBatchSize = this._initialBatchSize;
        const immediateBatch = newIds.slice(0, this.currentBatchSize);
        const remaining = newIds.slice(this.currentBatchSize);

        if (immediateBatch.length > 0) {
          this.flatRenderedIds = new Set([...this.flatRenderedIds, ...immediateBatch]);
        }

        this.currentBatchSize = Math.min(this.currentBatchSize * 2, this._maxBatchSize);

        if (remaining.length > 0) {
          this.flatRenderQueue = [...remaining];
          this.scheduleFlatRenderBatch();
        }
      }
    }
  }

  scheduleFlatRenderBatch() {
    if (this.flatRenderAnimationFrame) return;

    this.flatRenderAnimationFrame = requestAnimationFrame(() => {
      this.flatRenderAnimationFrame = null;
      if (this.flatRenderQueue.length === 0) return;

      const batchSize = this.currentBatchSize || this._initialBatchSize;
      const batch = this.flatRenderQueue.slice(0, batchSize);
      const remaining = this.flatRenderQueue.slice(batchSize);

      this.flatRenderedIds = new Set([...this.flatRenderedIds, ...batch]);
      this.flatRenderQueue = remaining;
      this.currentBatchSize = Math.min(batchSize * 2, this._maxBatchSize);

      if (remaining.length > 0) {
        this.scheduleFlatRenderBatch();
      }

      this._scheduleNotify();
    });
  }

  // ── Internal: nodeConfig ────────────────────────────────────────────

  private _updateNodeConfig() {
    this._nodeConfig = {
      clickBehavior: this._clickBehavior,
      expandIconClass: this._expandIconClass,
      collapseIconClass: this._collapseIconClass,
      leafIconClass: this._leafIconClass,
      toggleIconMode: this._toggleIconMode,
      highlightedNodeClass: this._highlightedNodeClass,
      focusedNodeClass: this._focusedNodeClass,
      dragOverNodeClass: this._dragOverNodeClass,
      dragDropMode: this._dragDropMode,
      dropZoneMode: this._dropZoneMode,
      dropZoneLayout: this._dropZoneLayout,
      dropZoneStart: this._dropZoneStart,
      dropZoneMaxWidth: this._dropZoneMaxWidth,
      allowCopy: this._allowCopy,
      iconMember: this._iconMember,
      showCheckboxes: this._showCheckboxes
    };
    this.emit('config-change', this._nodeConfig);
  }

  // ── Internal: context menu listeners ────────────────────────────────

  private _updateContextMenuListeners() {
    // Clean up previous
    this._contextMenuCleanup?.();
    this._contextMenuCleanup = null;

    if (!this._contextMenuVisible) return;

    const handleGlobalClick = (event: MouseEvent) => {
      if (this._isDebugMenuActive) return;
      // When the click originates inside a Shadow DOM, `event.target` is
      // retargeted to the shadow host by the time the document listener
      // fires, so `.closest('.wtv__context-menu')` won't find the menu even
      // if the actual click landed on it. Walk the composed path instead so
      // the check sees the real chain through the shadow boundary.
      const path = event.composedPath();
      const insideMenu = path.some(
        (n) => n instanceof Element && n.classList?.contains('wtv__context-menu')
      );
      if (!insideMenu) {
        this.closeContextMenu();
      }
    };

    const handleGlobalScroll = () => {
      if (this._isDebugMenuActive) return;
      this.closeContextMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeContextMenu();
      }
    };

    // Defer to avoid catching the same event that opened the menu
    requestAnimationFrame(() => {
      document.addEventListener('click', handleGlobalClick);
      document.addEventListener('contextmenu', handleGlobalClick);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleGlobalScroll, true);
      document.addEventListener('scroll', handleGlobalScroll, true);
      window.addEventListener('wheel', handleGlobalScroll, { passive: true });
    });

    this._contextMenuCleanup = () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('contextmenu', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleGlobalScroll, true);
      document.removeEventListener('scroll', handleGlobalScroll, true);
      window.removeEventListener('wheel', handleGlobalScroll);
    };
  }

  // ── Internal: debug context menu ────────────────────────────────────

  private _updateDebugContextMenu() {
    if (
      this._shouldDisplayContextMenuInDebugMode &&
      (this._hasContextMenuRenderer || this.contextMenuCallbackCb) &&
      this.tree?.tree &&
      this.tree.tree.length > 0
    ) {
      const targetNode =
        this.tree.tree.length > 1 ? this.tree.tree[1] : this.tree.tree[0];
      if (targetNode && this.containerElement) {
        const treeRect = this.containerElement.getBoundingClientRect();
        this._contextMenuNode = targetNode;
        this._contextMenuX = treeRect.left + 200;
        this._contextMenuY = treeRect.top + 100;
        this._contextMenuVisible = true;
        this._isDebugMenuActive = true;
        this._updateContextMenuListeners();
        this._scheduleNotify();
      }
    } else if (!this._shouldDisplayContextMenuInDebugMode && this._isDebugMenuActive) {
      this._contextMenuVisible = false;
      this._contextMenuNode = null;
      this._isDebugMenuActive = false;
      this._updateContextMenuListeners();
      this._scheduleNotify();
    }
  }

  // ── Internal event handlers ─────────────────────────────────────────

  private _onNodeClicked(node: LTreeNode<T>, modifiers?: SelectionModifiers) {
    if (this._contextMenuVisible) {
      this.closeContextMenu();
    }

    this._applyHighlight(node.path, modifiers);

    uiLogger.debug(`Node clicked: ${node.path}`, {
      newPath: node.path,
      id: node.id,
      ctrl: modifiers?.ctrl,
      shift: modifiers?.shift,
      highlightedCount: this._highlightedPaths.size
    });

    this.onNodeClickedCb?.(node);
  }

  private _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
    uiLogger.debug(`Right-click on node: ${node.path}`, {
      hasContextMenuRenderer: this._hasContextMenuRenderer,
      hasContextMenuCallback: !!this.contextMenuCallbackCb,
    });
    if (!this._hasContextMenuRenderer && !this.contextMenuCallbackCb) {
      return;
    }

    uiLogger.debug(`Context menu opened: ${node.path}`);
    event.preventDefault();
    this.openContextMenu(node, event.clientX, event.clientY);
  }

  // ── Drag and drop internals ─────────────────────────────────────────

  private isDropAllowedByMode(draggedNodeTreeId: string | undefined): boolean {
    if (this._dragDropMode === 'none') return false;
    const isSameTree = draggedNodeTreeId === this._treeId;
    if (this._dragDropMode === 'cross' && isSameTree) return false;
    return true;
  }

  private calculateDropPosition(
    event: DragEvent | MouseEvent,
    element: Element
  ): DropPosition {
    const rect = element.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'child';
  }

  private _onNodeDragStartInternal(node: LTreeNode<T>, event: DragEvent) {
    dragLogger.debug(`Drag started: ${node.path}`, {
      ctrlKey: event.ctrlKey,
      allowCopy: this._allowCopy,
      treeId: this._treeId
    });
    this._draggedNode = node;
    this._isDragInProgress = true;
    this.onNodeDragStartCb?.(node, event);

    // OS-convention highlight sync: grabbing a node that isn't part of the
    // current highlight set replaces the highlight with just that node.
    // Mirrors Windows Explorer / macOS Finder — without it the prior
    // highlight stays visible while the drag silently carries only the
    // grabbed node, making it impossible to tell what's actually moving.
    // Skipped when the node is already in the set (multi-drag) or when
    // the node is unselectable.
    // Deferred to rAF rather than running synchronously: a sync mutation
    // of the source row before the browser commits the drag image causes
    // the renderer's keyed update to drop the dragged element and the
    // drag silently aborts. rAF runs after the drag is committed.
    if (node.isSelectable && !this._highlightedPaths.has(node.path)) {
      requestAnimationFrame(() => {
        // Esc-cancel can fire dragend before this rAF runs.
        if (!this._isDragInProgress) return;
        // Snapshot the prior highlight so _onNodeDragEnd can restore it if
        // the drag is Esc-cancelled. Without this, the user is left with
        // the dragged node selected even though they cancelled the operation.
        this._preDragHighlightSnapshot = new Set(this._highlightedPaths);
        this._clearHighlightFlags();
        node.isHighlighted = true;
        node._rev++;
        this._highlightedPaths = new Set([node.path]);
        this._lastHighlightedPath = node.path;
        this._focusedNode = node;
        this._emitHighlightChange();
        this._mirrorHighlightToSelected();
        this.tree.refresh();
        this._scheduleNotify();
      });
    }

    this._scheduleNotify();
  }

  /** Pick out the "top-level highlighted" subset of `highlightedPaths`:
   *  every path whose nearest highlighted ancestor is NOT in the set.
   *  Descendants whose ancestor is also highlighted are absorbed — they
   *  ride along inside the ancestor's subtree during multi-drag. */
  private _getTopLevelHighlightedPaths(): string[] {
    const paths = this._highlightedPaths;
    if (paths.size === 0) return [];
    const sep = this._treePathSeparator;
    const result: string[] = [];
    for (const p of paths) {
      let cursor = p;
      let absorbed = false;
      while (cursor.includes(sep)) {
        cursor = cursor.substring(0, cursor.lastIndexOf(sep));
        if (paths.has(cursor)) {
          absorbed = true;
          break;
        }
      }
      if (!absorbed) result.push(p);
    }
    return result;
  }

  _onNodeDragEnd = (event: DragEvent) => {
    const dropEffect = event.dataTransfer?.dropEffect;
    dragLogger.debug('Drag ended', {
      dropEffect,
      operation: this._currentDropOperation
    });
    // Esc-cancel / drop-on-invalid-target: restore the pre-drag highlight so
    // the dragged node doesn't end up "stuck" selected. Mirrors svelte-treeview.
    if (dropEffect === 'none' && this._preDragHighlightSnapshot) {
      const prior = this._preDragHighlightSnapshot;
      this._clearHighlightFlags();
      this._highlightedPaths = new Set(prior);
      for (const path of prior) {
        const n = this.tree?.getNodeByPath(path);
        if (n) {
          n.isHighlighted = true;
          n._rev++;
        }
      }
      // When the snapshot was empty, focus also belonged to nobody — clear it.
      if (prior.size === 0) this._focusedNode = null;
      this._emitHighlightChange();
      this._mirrorHighlightToSelected();
      this.tree.refresh();
    }
    this._preDragHighlightSnapshot = null;
    this._resetDragState();
  };

  private _resetDragState(): void {
    dragLogger.debug('_resetDragState');
    this._isDragInProgress = false;
    this._draggedNode = null;
    this._hoveredNodeForDrop = null;
    this._activeDropPosition = null;
    this._isDropPlaceholderActive = false;
    this._currentDropOperation = 'move';
    this._scheduleNotify();
  }

  private async _handleDrop(
    dropNode: LTreeNode<T> | null,
    draggedNodeRef: LTreeNode<T>,
    position: DropPosition,
    event: DragEvent | TouchEvent
  ): Promise<boolean> {
    let operation: DropOperation = 'move';
    const isDragEvent = event instanceof DragEvent;
    const ctrlKey = isDragEvent ? event.ctrlKey : false;

    if (this._allowCopy && isDragEvent && ctrlKey) {
      operation = 'copy';
    }

    dragLogger.info(`Drop: ${draggedNodeRef.path} -> ${dropNode?.path ?? 'empty tree'}`, {
      position,
      operation,
      isCrossTree: draggedNodeRef.treeId !== this._treeId
    });

    if (this.beforeDropCallbackCb) {
      const result = await this.beforeDropCallbackCb(
        dropNode, draggedNodeRef, position, event, operation
      );
      if (result === false) return false;
      if (result && typeof result === 'object') {
        if ('position' in result && result.position) position = result.position;
        if ('operation' in result && result.operation) operation = result.operation;
      }
    }

    const isSameTreeDrag = draggedNodeRef.treeId === this._treeId;

    // Multi-drag: when the dragged node is in a multi-highlight set, move
    // every top-level highlighted subtree. First node uses the requested
    // position; subsequent nodes chain `'after'` the previous so the whole
    // set lands as siblings in source order. Mirrors svelte-treeview rc09.
    const isMultiDrag =
      isSameTreeDrag &&
      operation === 'move' &&
      dropNode &&
      this._autoHandleMove &&
      this._highlightedPaths.has(draggedNodeRef.path) &&
      this._highlightedPaths.size > 1;

    if (isMultiDrag) {
      const topLevelPaths = this._getTopLevelHighlightedPaths()
        .filter((p) => p !== dropNode!.path);
      dragLogger.info(`Multi-drag: moving ${topLevelPaths.length} top-level subtree(s)`, {
        topLevelPaths,
        totalHighlighted: this._highlightedPaths.size,
        dropTarget: dropNode!.path,
        position
      });
      let allOk = true;
      let prevMovedNode: LTreeNode<T> | null = null;
      for (let i = 0; i < topLevelPaths.length; i++) {
        const sourcePath = topLevelPaths[i];
        const targetPath = i === 0 ? dropNode!.path : prevMovedNode!.path;
        // Chain: first move uses the requested position, subsequent moves
        // land 'after' the previously moved node so the whole set arrives
        // in source order.
        const pos: DropPosition = i === 0 ? position : 'after';
        const sourceNode = this.tree?.getNodeByPath(sourcePath);
        const r = this.moveNode(sourcePath, targetPath, pos);
        if (!r.success) {
          allOk = false;
        } else if (sourceNode) {
          // moveNode mutates the LTreeNode in place — its .path now reflects
          // the new location, so we can use it as the next chain target.
          prevMovedNode = sourceNode;
        }
      }
      this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
      return allOk;
    }

    if (isSameTreeDrag && operation === 'move' && dropNode) {
      if (this._autoHandleMove) {
        const result = this.moveNode(draggedNodeRef.path, dropNode.path, position);
        this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
        return result.success;
      }
      // autoHandleMove=false: don't mutate the tree, just notify the consumer
      this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
      return true;
    }

    if (isSameTreeDrag && operation === 'copy' && dropNode && this._autoHandleCopy) {
      const targetParentPath =
        position === 'child' ? dropNode.path : dropNode.parentPath || '';
      const siblingPath = position !== 'child' ? dropNode.path : undefined;
      const copyPosition = position !== 'child' ? position : undefined;

      const result = this.tree.copyNodeWithDescendants(
        draggedNodeRef,
        targetParentPath,
        (data) => ({
          ...data,
          [this.tree.idMember || 'id']: `${(data as any)[this.tree.idMember || 'id']}_copy_${Date.now()}`
        }),
        siblingPath,
        copyPosition
      );
      this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
      return result.success;
    }

    this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
    return true;
  }

  private _onNodeDragOverInternal(node: LTreeNode<T>, event: DragEvent) {
    let effectiveDraggedNode = this._draggedNode;
    let isCrossTreeDrag = false;
    if (
      !effectiveDraggedNode &&
      event.dataTransfer?.types.includes('application/svelte-treeview')
    ) {
      isCrossTreeDrag = true;
      try {
        const data = event.dataTransfer.getData('application/svelte-treeview');
        if (data) effectiveDraggedNode = JSON.parse(data);
      } catch { /* getData might fail during dragover */ }
      this._isDragInProgress = true;
    }

    const dropAllowed = isCrossTreeDrag
      ? this._dragDropMode === 'both' || this._dragDropMode === 'cross'
      : this.isDropAllowedByMode(effectiveDraggedNode?.treeId);

    if (!dropAllowed) {
      this._hoveredNodeForDrop = null;
      return;
    }

    const isValidDrop = effectiveDraggedNode
      ? isCrossTreeDrag || effectiveDraggedNode.path !== node.path
      : this._isDragInProgress;

    if (isValidDrop) {
      event.preventDefault();
      this._hoveredNodeForDrop = node;
      const nodeElement = (event.target as Element).closest('.wtv__node-content');
      if (nodeElement) {
        this._activeDropPosition = this.calculateDropPosition(event, nodeElement);
      }
      this._currentDropOperation = this._allowCopy && event.ctrlKey ? 'copy' : 'move';
      this.onNodeDragOverCb?.(node, event);

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = this._currentDropOperation;
      }
      this._scheduleNotify();
    }
  }

  private _onNodeDragLeaveInternal(_node: LTreeNode<T>, _event: DragEvent) {
    // Don't clear hoveredNodeForDrop — let dragover on other nodes handle it
  }

  private _onNodeDropInternal(node: LTreeNode<T>, event: DragEvent) {
    event.preventDefault();

    let isCrossTreeDrag = false;
    if (!this._draggedNode) {
      const data = event.dataTransfer?.getData('application/svelte-treeview');
      if (data) {
        this._draggedNode = JSON.parse(data);
        isCrossTreeDrag = this._draggedNode?.treeId !== this._treeId;
      }
    }

    const dropAllowed = isCrossTreeDrag
      ? this._dragDropMode === 'both' || this._dragDropMode === 'cross'
      : this.isDropAllowedByMode(this._draggedNode?.treeId);

    if (!dropAllowed) {
      this._onNodeDragEnd(event);
      return;
    }

    if (this._draggedNode && (isCrossTreeDrag || this._draggedNode !== node)) {
      const position = this._activeDropPosition || 'child';
      this._handleDrop(node, this._draggedNode, position, event);
    }

    this._onNodeDragEnd(event);
  }

  private _onZoneDrop(node: LTreeNode<T>, position: DropPosition, event: DragEvent) {
    event.preventDefault();

    let isCrossTreeDrag = false;
    if (!this._draggedNode) {
      const data = event.dataTransfer?.getData('application/svelte-treeview');
      if (data) {
        this._draggedNode = JSON.parse(data);
        isCrossTreeDrag = this._draggedNode?.treeId !== this._treeId;
      }
    }

    if (!this._draggedNode) {
      this._onNodeDragEnd(event);
      return;
    }

    const dropAllowed = isCrossTreeDrag
      ? this._dragDropMode === 'both' || this._dragDropMode === 'cross'
      : this.isDropAllowedByMode(this._draggedNode?.treeId);

    if (!dropAllowed) {
      this._onNodeDragEnd(event);
      return;
    }

    if (isCrossTreeDrag || this._draggedNode !== node) {
      this._handleDrop(node, this._draggedNode, position, event);
    }

    this._onNodeDragEnd(event);
  }

  // ── Touch drag handlers ─────────────────────────────────────────────

  private _onTouchStart(node: LTreeNode<any>, event: TouchEvent) {
    if (!this.getNodeIsDraggable(node)) return;

    const touch = event.touches[0];
    this.touchDragState = {
      node,
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: false,
      ghostElement: null,
      currentDropTarget: null
    };

    this._addDocumentTouchListeners();

    this.touchTimer = setTimeout(() => {
      this.touchDragState.isDragging = true;
      this._draggedNode = node;
      this._isDragInProgress = true;
      dragLogger.debug(`Touch drag started: ${node.path}`);
      this.createGhostElement(node, touch.clientX, touch.clientY);
      try { navigator.vibrate?.(50); } catch { /* blocked by browser policy */ }
      this._scheduleNotify();
    }, 300);
  }

  private _onTouchMove(_node: LTreeNode<any>, _event: TouchEvent) {
    // Handled by _docTouchMove
  }

  private _onTouchEnd(_node: LTreeNode<any>, _event: TouchEvent) {
    // Handled by _docTouchEnd
  }

  // ── Document-level touch listeners ──────────────────────────────────

  private _boundDocTouchMove: ((e: TouchEvent) => void) | null = null;
  private _boundDocTouchEnd: ((e: TouchEvent) => void) | null = null;

  private _addDocumentTouchListeners() {
    this._removeDocumentTouchListeners();
    this._boundDocTouchMove = (e: TouchEvent) => this._docTouchMove(e);
    this._boundDocTouchEnd = (e: TouchEvent) => this._docTouchEnd(e);
    document.addEventListener('touchmove', this._boundDocTouchMove, { passive: false });
    document.addEventListener('touchend', this._boundDocTouchEnd);
    document.addEventListener('touchcancel', this._boundDocTouchEnd);
  }

  private _removeDocumentTouchListeners() {
    if (this._boundDocTouchMove) {
      document.removeEventListener('touchmove', this._boundDocTouchMove);
      this._boundDocTouchMove = null;
    }
    if (this._boundDocTouchEnd) {
      document.removeEventListener('touchend', this._boundDocTouchEnd);
      document.removeEventListener('touchcancel', this._boundDocTouchEnd);
      this._boundDocTouchEnd = null;
    }
  }

  private _docTouchMove(event: TouchEvent) {
    if (!this.touchDragState.node) return;

    const touch = event.touches[0];

    if (!this.touchDragState.isDragging) {
      const dx = Math.abs(touch.clientX - this.touchDragState.startX);
      const dy = Math.abs(touch.clientY - this.touchDragState.startY);
      if (dx > 10 || dy > 10) {
        if (this.touchTimer) clearTimeout(this.touchTimer);
        this._resetTouchState();
      }
      return;
    }

    event.preventDefault();

    if (this.touchDragState.ghostElement) {
      this.touchDragState.ghostElement.style.left = `${touch.clientX}px`;
      this.touchDragState.ghostElement.style.top = `${touch.clientY}px`;
    }

    if (this.touchDragState.ghostElement) {
      this.touchDragState.ghostElement.style.pointerEvents = 'none';
    }
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    if (this.touchDragState.ghostElement) {
      this.touchDragState.ghostElement.style.pointerEvents = '';
    }

    this.updateDropTarget(elementUnderTouch);
  }

  private _docTouchEnd(event: TouchEvent) {
    if (this.touchTimer) clearTimeout(this.touchTimer);

    if (this.touchDragState.isDragging && this._draggedNode) {
      const touch = event.changedTouches[0];

      if (this.touchDragState.ghostElement) {
        this.touchDragState.ghostElement.style.display = 'none';
      }

      const dropElement = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropNode = this.findNodeFromElement(dropElement);

      const emptyTarget = dropElement?.closest('.wtv__empty-state, .wtv__empty-zone');
      const rootDropZone = dropElement?.closest('.wtv__root-drop-zone');
      if ((emptyTarget || rootDropZone) && !dropNode) {
        dragLogger.debug(`Touch drag ended: ${this._draggedNode.path} -> empty tree`);
        this._handleDrop(null, this._draggedNode, 'child', event);
      } else if (dropNode && dropNode !== this._draggedNode && dropNode.isDropAllowed) {
        dragLogger.debug(`Touch drag ended: ${this._draggedNode.path} -> ${dropNode.path}`);
        this._handleDrop(dropNode, this._draggedNode, 'child', event);
      } else {
        dragLogger.debug(`Touch drag cancelled: ${this._draggedNode.path}`);
      }

      this.removeGhostElement();
      this.clearDropTargetHighlight();
    }

    this._resetTouchState();
  }

  private _resetTouchState() {
    this._removeDocumentTouchListeners();
    this.touchDragState = {
      node: null, startX: 0, startY: 0,
      isDragging: false, ghostElement: null, currentDropTarget: null
    };
    this._draggedNode = null;
    this._isDragInProgress = false;
    this._isDropPlaceholderActive = false;
    this._scheduleNotify();
  }

  private createGhostElement(node: LTreeNode<any>, x: number, y: number) {
    this.removeGhostElement();
    document.querySelectorAll('.wtv__touch-ghost').forEach(el => el.remove());

    const ghost = document.createElement('div');
    ghost.className = 'wtv__touch-ghost';
    ghost.textContent = this.tree.getNodeDisplayValue(node);
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    document.body.appendChild(ghost);
    this.touchDragState.ghostElement = ghost;
  }

  private removeGhostElement() {
    if (this.touchDragState.ghostElement) {
      this.touchDragState.ghostElement.remove();
      this.touchDragState.ghostElement = null;
    }
  }

  private findNodeFromElement(element: Element | null): LTreeNode<any> | null {
    if (!element) return null;
    const nodeElement = element.closest('.wtv__node');
    if (!nodeElement) return null;
    const path = nodeElement.getAttribute('data-tree-path');
    if (!path) return null;
    return this.tree.getNodeByPath(path);
  }

  private updateDropTarget(element: Element | null) {
    const newTarget = this.findNodeFromElement(element);

    if (this.touchDragState.currentDropTarget && this.touchDragState.currentDropTarget !== newTarget) {
      const prevElement = document.querySelector(
        `[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .wtv__node-content`
      );
      prevElement?.classList.remove(this._dragOverNodeClass || 'wtv__node-content--dragover-highlight');
    }

    const emptyTarget = element?.closest('.wtv__empty-state, .wtv__empty-zone');
    if (emptyTarget && !newTarget) {
      this._isDropPlaceholderActive = true;
      this.touchDragState.currentDropTarget = null;
      this._scheduleNotify();
      return;
    } else {
      this._isDropPlaceholderActive = false;
    }

    if (newTarget && newTarget !== this._draggedNode && newTarget.isDropAllowed) {
      const targetElement = document.querySelector(
        `[data-tree-path="${newTarget.path}"] .wtv__node-content`
      );
      targetElement?.classList.add(this._dragOverNodeClass || 'wtv__node-content--dragover-highlight');
      this.touchDragState.currentDropTarget = newTarget;
    } else {
      this.touchDragState.currentDropTarget = null;
    }
  }

  private clearDropTargetHighlight() {
    if (this.touchDragState.currentDropTarget) {
      const element = document.querySelector(
        `[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .wtv__node-content`
      );
      element?.classList.remove(this._dragOverNodeClass || 'wtv__node-content--dragover-highlight');
    }
  }

  // ── Empty tree drop handlers ────────────────────────────────────────

  handleEmptyTreeDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes('application/svelte-treeview')) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    // Only notify if state actually changed
    if (!this._isDragInProgress || !this._isDropPlaceholderActive) {
      console.log('[Controller] handleEmptyTreeDragOver — activating', { treeId: this._treeId });
      this._isDragInProgress = true;
      this._isDropPlaceholderActive = true;
      this._scheduleNotify();
    }
  };

  handleEmptyTreeDragLeave = (event: DragEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    const outside = x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom;
    console.log('[Controller] handleEmptyTreeDragLeave', { treeId: this._treeId, outside, x, y, rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } });
    if (outside) {
      this._isDragInProgress = false;
      this._isDropPlaceholderActive = false;
      this._scheduleNotify();
    }
  };

  handleEmptyTreeDrop = (event: DragEvent) => {
    event.preventDefault();
    this._isDragInProgress = false;
    this._isDropPlaceholderActive = false;

    const draggedNodeData = event.dataTransfer?.getData('application/svelte-treeview');
    if (draggedNodeData) {
      const droppedNode = JSON.parse(draggedNodeData);
      this._handleDrop(null, droppedNode, 'child', event);
    }
    this._onNodeDragEnd(event);
  };

  handleEmptyTreeTouchEnd = (event: TouchEvent) => {
    if (this._draggedNode && this._isDropPlaceholderActive) {
      this._handleDrop(null, this._draggedNode, 'child', event);
      this._isDropPlaceholderActive = false;
    }
  };

  // ── Tree-level drag handlers ────────────────────────────────────────

  handleTreeDragEnter = (event: DragEvent) => {
    console.log('[Controller] handleTreeDragEnter', { treeId: this._treeId, nodeCount: this.flatNodesToRender.length, hasMime: event.dataTransfer?.types.includes('application/svelte-treeview') });
    if (event.dataTransfer?.types.includes('application/svelte-treeview')) {
      this._isDragInProgress = true;
      // For empty trees, also activate drop placeholder immediately
      // so renderEmpty shows the drop zone instead of recreating the empty state
      if (this.flatNodesToRender.length === 0) {
        this._isDropPlaceholderActive = true;
      }
      this._scheduleNotify();
    }
  };

  handleTreeDragLeave = (event: DragEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    const outside = x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom;
    console.log('[Controller] handleTreeDragLeave', { treeId: this._treeId, outside, x, y, rect: { top: rect.top, bottom: rect.bottom } });
    if (outside) {
      if (this._draggedNode?.treeId !== this._treeId) {
        this._isDragInProgress = false;
        this._isDropPlaceholderActive = false;
        this._hoveredNodeForDrop = null;
        this._activeDropPosition = null;
        this._scheduleNotify();
      }
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  private generateTreeId(): string {
    return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const overflowY = style.overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        parent.scrollHeight > parent.clientHeight
      ) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }
}
