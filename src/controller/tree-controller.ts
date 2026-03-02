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
import { type LTreeNode } from '../ltree/ltree-node';
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
  TreeControllerConfig,
  TreeControllerSnapshot,
  TreeControllerEvents
} from './types';
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
    shouldToggleOnNodeClick: true,
    expandIconClass: 'ltree-icon-expand',
    collapseIconClass: 'ltree-icon-collapse',
    leafIconClass: 'ltree-icon-leaf',
    selectedNodeClass: undefined,
    dragOverNodeClass: undefined,
    dragDropMode: 'none',
    dropZoneMode: 'glow',
    dropZoneLayout: 'around',
    dropZoneStart: 33,
    dropZoneMaxWidth: 120,
    allowCopy: false
  };

  get nodeConfig(): NodeConfig { return this._nodeConfig; }

  // ── State properties ────────────────────────────────────────────────
  private _treeId: string = '';
  private _treePathSeparator: string = '.';
  private _data: T[] = [];
  private _selectedNode: LTreeNode<T> | null | undefined = null;
  private _insertResult: InsertArrayResult<T> | null | undefined = null;
  private _searchText: string | null | undefined = undefined;
  private _isRendering: boolean = false;

  // Behaviour
  private _shouldDisplayDebugInformation: boolean = false;
  private _shouldDisplayContextMenuInDebugMode: boolean = false;
  private _isLoading: boolean = false;
  private _useFlatRendering: boolean = true;
  private _flatIndentSize: string = '1.5rem';
  private _progressiveRender: boolean = true;
  private _initialBatchSize: number = 20;
  private _maxBatchSize: number = 500;
  private _bodyClass: string | null | undefined = undefined;

  // Drag and drop
  private _dragDropMode: DragDropMode = 'none';
  private _allowCopy: boolean = false;
  private _autoHandleCopy: boolean = true;

  // Events / callbacks
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
  private _shouldToggleOnNodeClick: boolean = true;
  private _expandIconClass: string = 'ltree-icon-expand';
  private _collapseIconClass: string = 'ltree-icon-collapse';
  private _leafIconClass: string = 'ltree-icon-leaf';
  private _selectedNodeClass: string | null | undefined = undefined;
  private _dragOverNodeClass: string | null | undefined = undefined;
  private _dropZoneMode: 'floating' | 'glow' = 'glow';
  private _dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2' = 'around';
  private _dropZoneStart: number | string = 33;
  private _dropZoneMaxWidth: number = 120;
  private _scrollHighlightTimeout: number = 4000;
  private _scrollHighlightClass: string | null | undefined = 'ltree-scroll-highlight';
  private _contextMenuXOffset: number = 8;
  private _contextMenuYOffset: number = 0;
  private _hasContextMenuTemplate: boolean = false;

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

  get selectedNode() { return this._selectedNode; }
  set selectedNode(v: LTreeNode<T> | null | undefined) {
    this._selectedNode = v;
    this._scheduleNotify();
  }

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

  get shouldToggleOnNodeClick() { return this._shouldToggleOnNodeClick; }
  set shouldToggleOnNodeClick(v: boolean) { this._shouldToggleOnNodeClick = v; this._updateNodeConfig(); }

  get expandIconClass() { return this._expandIconClass; }
  set expandIconClass(v: string) { this._expandIconClass = v; this._updateNodeConfig(); }

  get collapseIconClass() { return this._collapseIconClass; }
  set collapseIconClass(v: string) { this._collapseIconClass = v; this._updateNodeConfig(); }

  get leafIconClass() { return this._leafIconClass; }
  set leafIconClass(v: string) { this._leafIconClass = v; this._updateNodeConfig(); }

  get selectedNodeClass() { return this._selectedNodeClass; }
  set selectedNodeClass(v: string | null | undefined) { this._selectedNodeClass = v; this._updateNodeConfig(); }

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

  get hasContextMenuTemplate() { return this._hasContextMenuTemplate; }
  set hasContextMenuTemplate(v: boolean) { this._hasContextMenuTemplate = v; }

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
    this._selectedNode = props.selectedNode ?? null;
    this._searchText = props.searchText;

    this._shouldDisplayDebugInformation = props.shouldDisplayDebugInformation ?? false;
    this._shouldDisplayContextMenuInDebugMode = props.shouldDisplayContextMenuInDebugMode ?? false;
    this._isLoading = props.isLoading ?? false;

    this._useFlatRendering = props.useFlatRendering ?? true;
    this._flatIndentSize = props.flatIndentSize ?? '1.5rem';
    this._progressiveRender = props.progressiveRender ?? true;
    this._initialBatchSize = props.initialBatchSize ?? 20;
    this._maxBatchSize = props.maxBatchSize ?? 500;
    this._bodyClass = props.bodyClass;

    this._dragDropMode = props.dragDropMode ?? 'none';
    this._allowCopy = props.allowCopy ?? false;
    this._autoHandleCopy = props.autoHandleCopy ?? true;

    this._virtualScroll = props.virtualScroll ?? false;
    this._virtualRowHeight = props.virtualRowHeight;
    this._virtualOverscan = props.virtualOverscan ?? 5;
    this._virtualContainerHeight = props.virtualContainerHeight;

    this._shouldToggleOnNodeClick = props.shouldToggleOnNodeClick ?? true;
    this._expandIconClass = props.expandIconClass ?? 'ltree-icon-expand';
    this._collapseIconClass = props.collapseIconClass ?? 'ltree-icon-collapse';
    this._leafIconClass = props.leafIconClass ?? 'ltree-icon-leaf';
    this._selectedNodeClass = props.selectedNodeClass;
    this._dragOverNodeClass = props.dragOverNodeClass;
    this._dropZoneMode = props.dropZoneMode ?? 'glow';
    this._dropZoneLayout = props.dropZoneLayout ?? 'around';
    this._dropZoneStart = props.dropZoneStart ?? 33;
    this._dropZoneMaxWidth = props.dropZoneMaxWidth ?? 120;
    this._scrollHighlightTimeout = props.scrollHighlightTimeout ?? 4000;
    this._scrollHighlightClass = props.scrollHighlightClass ?? 'ltree-scroll-highlight';
    this._contextMenuXOffset = props.contextMenuXOffset ?? 8;
    this._contextMenuYOffset = props.contextMenuYOffset ?? 0;
    this._hasContextMenuTemplate = props.hasContextMenuTemplate ?? false;

    // Store callbacks
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
      props.isSelectedMember,
      props.isDraggableMember,
      props.getIsDraggableCallback,
      props.isDropAllowedMember,
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
      onTouchDragEnd: this._onTouchEnd.bind(this)
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
    }

    // Apply initial search filter
    if (this._searchText) {
      this.tree.filterNodes(this._searchText as string);
    }
  }

  // ── Public API methods ──────────────────────────────────────────────

  expandNodes(nodePath: string) {
    this.tree.expandNodes(nodePath);
  }

  collapseNodes(nodePath: string) {
    this.tree.collapseNodes(nodePath);
  }

  expandAll(nodePath?: string | null | undefined) {
    this.tree?.expandAll(nodePath);
  }

  collapseAll(nodePath?: string | null | undefined) {
    this.tree?.collapseAll(nodePath);
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
    position: 'above' | 'below' | 'child'
  ): { success: boolean; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.moveNode(sourcePath, targetPath, position) || {
      success: false,
      error: 'Tree not initialized'
    };
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
    position?: 'above' | 'below'
  ): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string } {
    this._skipInsertArray = true;
    const result = this.tree?.copyNodeWithDescendants(
      sourceNode, targetParentPath, transformData, siblingPath, position
    ) || { success: false, count: 0, error: 'Tree not initialized' };
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

  /** Open the context menu at the given screen coordinates (offsets applied automatically). */
  openContextMenu(node: LTreeNode<T>, screenX: number, screenY: number) {
    this._contextMenuNode = node;
    this._contextMenuX = screenX + this._contextMenuXOffset;
    this._contextMenuY = screenY + this._contextMenuYOffset;
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
      idealPosition = 'above';
    } else {
      idealPosition = 'below';
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

    if (allowedPositions.includes('above') && allowedPositions.includes('below')) {
      return y < height / 2 ? 'above' : 'below';
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
        const scrollEl = (containerElement || this.containerElement)?.querySelector('.ltree-tree') as HTMLElement;
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
    const element = rootEl
      ? rootEl.querySelector(`#${CSS.escape(elementId)}`)
      : document.getElementById(elementId);
    const contentDiv = element?.querySelector('.ltree-node-content') as HTMLElement | null;

    if (!contentDiv) {
      console.warn(`[Tree ${this._treeId}] DOM element not found for node ID: ${elementId}`);
      perfEnd(`[${this._treeId}] scrollToPath`);
      return false;
    }

    if (containerScroll) {
      const container = this.findScrollableAncestor(contentDiv);
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
      updates.getIsCollapsibleCallback !== undefined ||
      updates.getAllowedDropPositionsCallback !== undefined ||
      updates.sortCallback !== undefined;

    if (updates.treeId !== undefined) this._treeId = updates.treeId || this._treeId;
    if (updates.treePathSeparator !== undefined)
      this.treePathSeparator = updates.treePathSeparator ?? '.';
    if (updates.selectedNode !== undefined) this._selectedNode = updates.selectedNode;
    if (updates.searchText !== undefined) this.searchText = updates.searchText;
    if (updates.shouldDisplayDebugInformation !== undefined)
      this._shouldDisplayDebugInformation = updates.shouldDisplayDebugInformation ?? false;
    if (updates.shouldDisplayContextMenuInDebugMode !== undefined)
      this._shouldDisplayContextMenuInDebugMode = updates.shouldDisplayContextMenuInDebugMode ?? false;
    if (updates.isLoading !== undefined) this._isLoading = updates.isLoading ?? false;
    if (updates.bodyClass !== undefined) this._bodyClass = updates.bodyClass;

    if (updates.shouldToggleOnNodeClick !== undefined)
      this._shouldToggleOnNodeClick = updates.shouldToggleOnNodeClick ?? true;
    if (updates.expandIconClass !== undefined)
      this._expandIconClass = updates.expandIconClass ?? 'ltree-icon-expand';
    if (updates.collapseIconClass !== undefined)
      this._collapseIconClass = updates.collapseIconClass ?? 'ltree-icon-collapse';
    if (updates.leafIconClass !== undefined)
      this._leafIconClass = updates.leafIconClass ?? 'ltree-icon-leaf';
    if (updates.selectedNodeClass !== undefined)
      this._selectedNodeClass = updates.selectedNodeClass;
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
    if (updates.dragDropMode !== undefined)
      this._dragDropMode = updates.dragDropMode ?? 'none';
    if (updates.scrollHighlightTimeout !== undefined)
      this._scrollHighlightTimeout = updates.scrollHighlightTimeout ?? 4000;
    if (updates.scrollHighlightClass !== undefined)
      this._scrollHighlightClass = updates.scrollHighlightClass ?? 'ltree-scroll-highlight';
    if (updates.contextMenuXOffset !== undefined)
      this._contextMenuXOffset = updates.contextMenuXOffset ?? 8;
    if (updates.contextMenuYOffset !== undefined)
      this._contextMenuYOffset = updates.contextMenuYOffset ?? 0;

    // Virtual scroll
    if (updates.virtualScroll !== undefined) this._virtualScroll = updates.virtualScroll ?? false;
    if (updates.virtualRowHeight !== undefined) this._virtualRowHeight = updates.virtualRowHeight;
    if (updates.virtualOverscan !== undefined) this._virtualOverscan = updates.virtualOverscan ?? 5;
    if (updates.virtualContainerHeight !== undefined) this._virtualContainerHeight = updates.virtualContainerHeight;

    // Callbacks
    if (updates.onNodeClicked !== undefined) this.onNodeClickedCb = updates.onNodeClicked;
    if (updates.onNodeDragStart !== undefined) this.onNodeDragStartCb = updates.onNodeDragStart;
    if (updates.onNodeDragOver !== undefined) this.onNodeDragOverCb = updates.onNodeDragOver;
    if (updates.beforeDropCallback !== undefined) this.beforeDropCallbackCb = updates.beforeDropCallback;
    if (updates.onNodeDrop !== undefined) this.onNodeDropCb = updates.onNodeDrop;
    if (updates.contextMenuCallback !== undefined) this.contextMenuCallbackCb = updates.contextMenuCallback;
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
        updates.isSelectedMember,
        updates.isDraggableMember ?? this.tree.isDraggableMember,
        updates.getIsDraggableCallback ?? this.tree.getIsDraggableCallback,
        updates.isDropAllowedMember ?? this.tree.isDropAllowedMember,
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
        const result = this.tree.insertArray(data);
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
      contextMenuNode: this._contextMenuNode,
      isDropPlaceholderActive: this._isDropPlaceholderActive,
      isLoading: this._isLoading,
      isRendering: this._isRendering,
      bodyClass: this._bodyClass,
      useFlatRendering: this._useFlatRendering,
      flatIndentSize: this._flatIndentSize,
      shouldDisplayDebugInformation: this._shouldDisplayDebugInformation,
      selectedNode: this._selectedNode,

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
      document.querySelectorAll('.ltree-touch-ghost').forEach(el => el.remove());
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
    }
  }

  // ── Internal: tree changed (from LTree.onChange) ────────────────────

  private _onTreeChanged() {
    this._updateProgressiveRendering();
    this._scheduleNotify();
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
      shouldToggleOnNodeClick: this._shouldToggleOnNodeClick,
      expandIconClass: this._expandIconClass,
      collapseIconClass: this._collapseIconClass,
      leafIconClass: this._leafIconClass,
      selectedNodeClass: this._selectedNodeClass,
      dragOverNodeClass: this._dragOverNodeClass,
      dragDropMode: this._dragDropMode,
      dropZoneMode: this._dropZoneMode,
      dropZoneLayout: this._dropZoneLayout,
      dropZoneStart: this._dropZoneStart,
      dropZoneMaxWidth: this._dropZoneMaxWidth,
      allowCopy: this._allowCopy
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
      const target = event.target as Element;
      if (!target.closest('.ltree-context-menu')) {
        this.closeContextMenu();
      }
    };

    const handleGlobalScroll = () => {
      this.closeContextMenu();
    };

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('scroll', handleGlobalScroll, true);
    document.addEventListener('scroll', handleGlobalScroll, true);
    window.addEventListener('wheel', handleGlobalScroll, { passive: true });

    this._contextMenuCleanup = () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('scroll', handleGlobalScroll, true);
      document.removeEventListener('scroll', handleGlobalScroll, true);
      window.removeEventListener('wheel', handleGlobalScroll);
    };
  }

  // ── Internal: debug context menu ────────────────────────────────────

  private _updateDebugContextMenu() {
    if (
      this._shouldDisplayContextMenuInDebugMode &&
      (this._hasContextMenuTemplate || this.contextMenuCallbackCb) &&
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

  private _onNodeClicked(node: LTreeNode<T>) {
    if (this._contextMenuVisible) {
      this.closeContextMenu();
    }

    if (this._selectedNode) {
      const previousNode = this.tree.getNodeByPath(this._selectedNode.path);
      if (previousNode) {
        previousNode.isSelected = false;
      } else {
        this._selectedNode = null;
      }
    }

    node.isSelected = true;
    this._selectedNode = node;

    uiLogger.debug(`Node selected: ${node.path}`, {
      newPath: node.path,
      id: node.id
    });

    this.onNodeClickedCb?.(node);
    this.tree.refresh();
    this._scheduleNotify();
  }

  private _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
    if (!this._hasContextMenuTemplate && !this.contextMenuCallbackCb) {
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
    if (y < height * 0.25) return 'above';
    if (y > height * 0.75) return 'below';
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
    this._scheduleNotify();
  }

  _onNodeDragEnd = (event: DragEvent) => {
    dragLogger.debug('Drag ended', {
      dropEffect: event.dataTransfer?.dropEffect,
      operation: this._currentDropOperation
    });
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
    if (isSameTreeDrag && operation === 'move' && dropNode) {
      const result = this.moveNode(draggedNodeRef.path, dropNode.path, position);
      this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
      return result.success;
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
      const nodeElement = (event.target as Element).closest('.ltree-node-content');
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

      const placeholder = dropElement?.closest('.ltree-empty-state');
      const rootDropZone = dropElement?.closest('.ltree-root-drop-zone');
      if ((placeholder || rootDropZone) && !dropNode) {
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
    document.querySelectorAll('.ltree-touch-ghost').forEach(el => el.remove());

    const ghost = document.createElement('div');
    ghost.className = 'ltree-touch-ghost';
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
    const nodeElement = element.closest('.ltree-node');
    if (!nodeElement) return null;
    const path = nodeElement.getAttribute('data-tree-path');
    if (!path) return null;
    return this.tree.getNodeByPath(path);
  }

  private updateDropTarget(element: Element | null) {
    const newTarget = this.findNodeFromElement(element);

    if (this.touchDragState.currentDropTarget && this.touchDragState.currentDropTarget !== newTarget) {
      const prevElement = document.querySelector(
        `[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .ltree-node-content`
      );
      prevElement?.classList.remove(this._dragOverNodeClass || 'ltree-dragover-highlight');
    }

    const placeholder = element?.closest('.ltree-empty-state');
    if (placeholder && !newTarget) {
      this._isDropPlaceholderActive = true;
      this.touchDragState.currentDropTarget = null;
      this._scheduleNotify();
      return;
    } else {
      this._isDropPlaceholderActive = false;
    }

    if (newTarget && newTarget !== this._draggedNode && newTarget.isDropAllowed) {
      const targetElement = document.querySelector(
        `[data-tree-path="${newTarget.path}"] .ltree-node-content`
      );
      targetElement?.classList.add(this._dragOverNodeClass || 'ltree-dragover-highlight');
      this.touchDragState.currentDropTarget = newTarget;
    } else {
      this.touchDragState.currentDropTarget = null;
    }
  }

  private clearDropTargetHighlight() {
    if (this.touchDragState.currentDropTarget) {
      const element = document.querySelector(
        `[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .ltree-node-content`
      );
      element?.classList.remove(this._dragOverNodeClass || 'ltree-dragover-highlight');
    }
  }

  // ── Empty tree drop handlers ────────────────────────────────────────

  handleEmptyTreeDragOver = (event: DragEvent) => {
    if (event.dataTransfer?.types.includes('application/svelte-treeview')) {
      event.preventDefault();
      this._isDropPlaceholderActive = true;
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this._scheduleNotify();
    }
  };

  handleEmptyTreeDragLeave = (event: DragEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      this._isDropPlaceholderActive = false;
      this._scheduleNotify();
    }
  };

  handleEmptyTreeDrop = (event: DragEvent) => {
    event.preventDefault();
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
    if (event.dataTransfer?.types.includes('application/svelte-treeview')) {
      this._isDragInProgress = true;
      this._scheduleNotify();
    }
  };

  handleTreeDragLeave = (event: DragEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      if (this._draggedNode?.treeId !== this._treeId) {
        this._isDragInProgress = false;
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
