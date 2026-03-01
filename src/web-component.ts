import { WebTreeView } from './treeview';
import type { TreeViewConfig, ScrollToPathOptions } from './types';
import type { LTreeNode } from './ltree/ltree-node';
import type { DropPosition } from './ltree/ltree-node';
import type { Ltree, ContextMenuItem, DragDropMode, DropOperation } from './ltree/types';
import type { TreeViewRenderer, RendererConfig } from './renderer/types';
import type { TreeController } from './controller/tree-controller';
import { initLogger } from './logger';
import styles from './css/main.css?inline';

// SSR compatibility: provide stub HTMLElement if not in browser
const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

// Type declarations for build-time constants
declare const __VERSION__: string;

// Instance tracking for global API
const instances = new Set<WebTreeViewElement>();

export function getAllInstances(): WebTreeViewElement[] {
  return Array.from(instances);
}

export class WebTreeViewElement<T = any> extends BaseElement {
  private treeview?: WebTreeView<T>;
  private containerElement?: HTMLDivElement;
  private shadow: ShadowRoot;

  // Properties for complex data (not attributes)
  private _data?: T[];
  private _renderer?: TreeViewRenderer<T>;

  // Batched update scheduling
  private _updatePending = false;

  // Tree identification
  private _treeId?: string;

  // Member properties
  private _idMember?: string;
  private _pathMember?: string;
  private _parentPathMember?: string;
  private _levelMember?: string;
  private _isExpandedMember?: string;
  private _isSelectedMember?: string;
  private _isDraggableMember?: string;
  private _isDropAllowedMember?: string;
  private _hasChildrenMember?: string;
  private _displayValueMember?: string;
  private _searchValueMember?: string;
  private _isSelectableMember?: string;
  private _isCollapsibleMember?: string;
  private _orderMember?: string;
  private _allowedDropPositionsMember?: string;

  // Behavior
  private _expandLevel?: number;
  private _shouldToggleOnNodeClick?: boolean;
  private _isSorted?: boolean;

  // Search/indexer config
  private _shouldUseInternalSearchIndex?: boolean;
  private _indexerBatchSize?: number;
  private _indexerTimeout?: number;

  // DnD config
  private _dragDropMode?: DragDropMode;
  private _dropZoneMode?: 'floating' | 'glow';
  private _dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  private _dropZoneStart?: number | string;
  private _dropZoneMaxWidth?: number;
  private _allowCopy?: boolean;
  private _autoHandleCopy?: boolean;

  // Callback properties
  private _getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  private _getSearchValueCallback?: (node: LTreeNode<T>) => string;
  private _getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  private _getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  private _getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  private _sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  private _contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[];
  private _indexingCompleteCallback?: () => void;

  // Template callbacks
  private _nodeTemplate?: (node: LTreeNode<T>, container: HTMLElement) => void;
  private _emptyTemplate?: (container: HTMLElement) => void;
  private _loadingTemplate?: (container: HTMLElement) => void;
  private _headerTemplate?: (container: HTMLElement) => void;
  private _footerTemplate?: (container: HTMLElement) => void;
  private _contextMenuTemplate?: (node: LTreeNode<T>, close: () => void, container: HTMLElement) => void;
  private _dropPlaceholderTemplate?: (container: HTMLElement) => void;

  // Event callbacks
  private _onNodeClicked?: (node: LTreeNode<T>) => void;
  private _onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
  private _onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
  private _beforeDropCallback?: TreeViewConfig<T>['beforeDropCallback'];
  private _onNodeDrop?: TreeViewConfig<T>['onNodeDrop'];

  // Render callbacks
  private _onRenderStart?: () => void;
  private _onRenderProgress?: (stats: any) => void;
  private _onRenderComplete?: (stats: any) => void;

  static get observedAttributes() {
    return [
      // Tree identification
      'tree-id',

      // Member mappings
      'id-member', 'path-member', 'parent-path-member', 'level-member',
      'is-expanded-member', 'is-selected-member', 'is-draggable-member',
      'is-drop-allowed-member', 'has-children-member',
      'display-value-member', 'search-value-member',
      'is-selectable-member', 'is-collapsible-member',
      'order-member', 'allowed-drop-positions-member',

      // Behavior
      'expand-level', 'tree-path-separator', 'should-toggle-on-node-click',
      'is-sorted', 'should-use-internal-search-index',
      'indexer-batch-size', 'indexer-timeout',

      // Visual / CSS classes
      'body-class', 'selected-node-class', 'drag-over-node-class',
      'expand-icon-class', 'collapse-icon-class', 'leaf-icon-class',
      'scroll-highlight-timeout', 'scroll-highlight-class',

      // Bindable
      'search-text',

      // Context menu
      'context-menu-x-offset', 'context-menu-y-offset',

      // Debug
      'should-display-debug-information',

      // DnD
      'drag-drop-mode', 'drop-zone-mode', 'drop-zone-layout',
      'drop-zone-start', 'drop-zone-max-width', 'allow-copy', 'auto-handle-copy',

      // Rendering
      'use-flat-rendering', 'flat-indent-size',
      'progressive-render', 'initial-batch-size', 'max-batch-size',
    ];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    // Inject styles immediately to prevent FOUC
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    this.shadow.appendChild(styleSheet);

    // Mark as ready after initialization
    requestAnimationFrame(() => {
      this.setAttribute('data-ready', '');
    });
  }

  connectedCallback() {
    instances.add(this);
    this.render();
    this.initializeTreeView();
  }

  disconnectedCallback() {
    instances.delete(this);
    if (this.treeview) {
      this.treeview.destroy();
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    if (!this.treeview) return;

    // Update via controller instead of destroy+reinitialize
    this.treeview.update(this.buildConfig());
  }

  // ── Property getters/setters ───────────────────────────────────────

  get data(): T[] | undefined {
    return this._data;
  }

  set data(value: T[] | undefined) {
    this._data = value;
    this._scheduleUpdate();
  }

  get renderer(): TreeViewRenderer<T> | undefined {
    return this._renderer;
  }

  set renderer(value: TreeViewRenderer<T> | undefined) {
    this._renderer = value;
    if (this.treeview && value) {
      this.treeview.setRenderer(value);
    }
  }

  get treeId(): string | undefined { return this._treeId; }
  set treeId(value: string | undefined) { this._treeId = value; this._scheduleUpdate(); }

  get idMember(): string | undefined { return this._idMember; }
  set idMember(value: string | undefined) { this._idMember = value; this._scheduleUpdate(); }

  get pathMember(): string | undefined { return this._pathMember; }
  set pathMember(value: string | undefined) { this._pathMember = value; this._scheduleUpdate(); }

  get parentPathMember(): string | undefined { return this._parentPathMember; }
  set parentPathMember(value: string | undefined) { this._parentPathMember = value; this._scheduleUpdate(); }

  get levelMember(): string | undefined { return this._levelMember; }
  set levelMember(value: string | undefined) { this._levelMember = value; this._scheduleUpdate(); }

  get isExpandedMember(): string | undefined { return this._isExpandedMember; }
  set isExpandedMember(value: string | undefined) { this._isExpandedMember = value; this._scheduleUpdate(); }

  get isSelectedMember(): string | undefined { return this._isSelectedMember; }
  set isSelectedMember(value: string | undefined) { this._isSelectedMember = value; this._scheduleUpdate(); }

  get isDraggableMember(): string | undefined { return this._isDraggableMember; }
  set isDraggableMember(value: string | undefined) { this._isDraggableMember = value; this._scheduleUpdate(); }

  get isDropAllowedMember(): string | undefined { return this._isDropAllowedMember; }
  set isDropAllowedMember(value: string | undefined) { this._isDropAllowedMember = value; this._scheduleUpdate(); }

  get hasChildrenMember(): string | undefined { return this._hasChildrenMember; }
  set hasChildrenMember(value: string | undefined) { this._hasChildrenMember = value; this._scheduleUpdate(); }

  get displayValueMember(): string | undefined { return this._displayValueMember; }
  set displayValueMember(value: string | undefined) { this._displayValueMember = value; this._scheduleUpdate(); }

  get searchValueMember(): string | undefined { return this._searchValueMember; }
  set searchValueMember(value: string | undefined) { this._searchValueMember = value; this._scheduleUpdate(); }

  get isSelectableMember(): string | undefined { return this._isSelectableMember; }
  set isSelectableMember(value: string | undefined) { this._isSelectableMember = value; this._scheduleUpdate(); }

  get isCollapsibleMember(): string | undefined { return this._isCollapsibleMember; }
  set isCollapsibleMember(value: string | undefined) { this._isCollapsibleMember = value; this._scheduleUpdate(); }

  get orderMember(): string | undefined { return this._orderMember; }
  set orderMember(value: string | undefined) { this._orderMember = value; this._scheduleUpdate(); }

  get allowedDropPositionsMember(): string | undefined { return this._allowedDropPositionsMember; }
  set allowedDropPositionsMember(value: string | undefined) { this._allowedDropPositionsMember = value; this._scheduleUpdate(); }

  get expandLevel(): number | undefined { return this._expandLevel; }
  set expandLevel(value: number | undefined) { this._expandLevel = value; this._scheduleUpdate(); }

  get shouldToggleOnNodeClick(): boolean | undefined { return this._shouldToggleOnNodeClick; }
  set shouldToggleOnNodeClick(value: boolean | undefined) { this._shouldToggleOnNodeClick = value; this._scheduleUpdate(); }

  get isSorted(): boolean | undefined { return this._isSorted; }
  set isSorted(value: boolean | undefined) { this._isSorted = value; this._scheduleUpdate(); }

  get shouldUseInternalSearchIndex(): boolean | undefined { return this._shouldUseInternalSearchIndex; }
  set shouldUseInternalSearchIndex(value: boolean | undefined) { this._shouldUseInternalSearchIndex = value; }

  get indexerBatchSize(): number | undefined { return this._indexerBatchSize; }
  set indexerBatchSize(value: number | undefined) { this._indexerBatchSize = value; }

  get indexerTimeout(): number | undefined { return this._indexerTimeout; }
  set indexerTimeout(value: number | undefined) { this._indexerTimeout = value; }

  // DnD properties
  get dragDropMode(): DragDropMode | undefined { return this._dragDropMode; }
  set dragDropMode(value: DragDropMode | undefined) { this._dragDropMode = value; }

  get dropZoneMode(): 'floating' | 'glow' | undefined { return this._dropZoneMode; }
  set dropZoneMode(value: 'floating' | 'glow' | undefined) { this._dropZoneMode = value; }

  get dropZoneLayout(): 'around' | 'above' | 'below' | 'wave' | 'wave2' | undefined { return this._dropZoneLayout; }
  set dropZoneLayout(value: 'around' | 'above' | 'below' | 'wave' | 'wave2' | undefined) { this._dropZoneLayout = value; }

  get allowCopy(): boolean | undefined { return this._allowCopy; }
  set allowCopy(value: boolean | undefined) { this._allowCopy = value; }

  get autoHandleCopy(): boolean | undefined { return this._autoHandleCopy; }
  set autoHandleCopy(value: boolean | undefined) { this._autoHandleCopy = value; }

  // Callback properties
  get getDisplayValueCallback() { return this._getDisplayValueCallback; }
  set getDisplayValueCallback(value: ((node: LTreeNode<T>) => string) | undefined) {
    this._getDisplayValueCallback = value;
  }

  get getSearchValueCallback() { return this._getSearchValueCallback; }
  set getSearchValueCallback(value: ((node: LTreeNode<T>) => string) | undefined) {
    this._getSearchValueCallback = value;
  }

  get getIsDraggableCallback() { return this._getIsDraggableCallback; }
  set getIsDraggableCallback(value: ((node: LTreeNode<T>) => boolean) | undefined) {
    this._getIsDraggableCallback = value;
  }

  get getIsCollapsibleCallback() { return this._getIsCollapsibleCallback; }
  set getIsCollapsibleCallback(value: ((node: LTreeNode<T>) => boolean) | undefined) {
    this._getIsCollapsibleCallback = value;
  }

  get getAllowedDropPositionsCallback() { return this._getAllowedDropPositionsCallback; }
  set getAllowedDropPositionsCallback(value: ((node: LTreeNode<T>) => DropPosition[] | null | undefined) | undefined) {
    this._getAllowedDropPositionsCallback = value;
  }

  get sortCallback() { return this._sortCallback; }
  set sortCallback(value: ((items: LTreeNode<T>[]) => LTreeNode<T>[]) | undefined) {
    this._sortCallback = value;
  }

  get contextMenuCallback() { return this._contextMenuCallback; }
  set contextMenuCallback(value: ((node: LTreeNode<T>, close: () => void) => ContextMenuItem[]) | undefined) {
    this._contextMenuCallback = value;
  }

  get indexingCompleteCallback() { return this._indexingCompleteCallback; }
  set indexingCompleteCallback(value: (() => void) | undefined) {
    this._indexingCompleteCallback = value;
  }

  // Template properties
  get nodeTemplate() { return this._nodeTemplate; }
  set nodeTemplate(value: ((node: LTreeNode<T>, container: HTMLElement) => void) | undefined) {
    this._nodeTemplate = value;
    if (this.treeview && value) {
      this.treeview.update({ nodeTemplate: value } as any);
    }
  }

  // Event callbacks
  get onNodeClicked() { return this._onNodeClicked; }
  set onNodeClicked(value: ((node: LTreeNode<T>) => void) | undefined) {
    this._onNodeClicked = value;
  }

  get onNodeDragStart() { return this._onNodeDragStart; }
  set onNodeDragStart(value: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined) {
    this._onNodeDragStart = value;
  }

  get onNodeDragOver() { return this._onNodeDragOver; }
  set onNodeDragOver(value: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined) {
    this._onNodeDragOver = value;
  }

  get beforeDropCallback() { return this._beforeDropCallback; }
  set beforeDropCallback(value: TreeViewConfig<T>['beforeDropCallback'] | undefined) {
    this._beforeDropCallback = value;
  }

  get onNodeDrop() { return this._onNodeDrop; }
  set onNodeDrop(value: TreeViewConfig<T>['onNodeDrop'] | undefined) {
    this._onNodeDrop = value;
  }

  // ── Public methods (proxy to engine) ───────────────────────────────

  expandAll(nodePath?: string | null): void {
    this.treeview?.expandAll(nodePath);
  }

  collapseAll(nodePath?: string | null): void {
    this.treeview?.collapseAll(nodePath);
  }

  expandNodes(nodePath: string): void {
    this.treeview?.expandNodes(nodePath);
  }

  collapseNodes(nodePath: string): void {
    this.treeview?.collapseNodes(nodePath);
  }

  filterNodes(searchText: string): void {
    this.treeview?.filterNodes(searchText);
  }

  searchNodes(searchText: string | null): LTreeNode<T>[] {
    return this.treeview?.searchNodes(searchText) ?? [];
  }

  scrollToPath(path: string, options?: ScrollToPathOptions): Promise<boolean> {
    return this.treeview?.scrollToPath(path, options) ?? Promise.resolve(false);
  }

  closeContextMenu(): void {
    this.treeview?.closeContextMenu();
  }

  update(props: Partial<TreeViewConfig<T>>): void {
    this.treeview?.update(props);
  }

  /** Access the underlying LTree for advanced programmatic usage */
  getTree(): Ltree<T> | undefined {
    return this.treeview?.getTree();
  }

  /** Access the TreeController directly */
  getController(): TreeController<T> | undefined {
    return this.treeview?.getController();
  }

  // ── Private methods ────────────────────────────────────────────────

  private render(): void {
    this.containerElement = document.createElement('div');
    this.containerElement.classList.add('web-treeview');
    this.shadow.appendChild(this.containerElement);
  }

  /**
   * Schedule a batched update via microtask.
   * Multiple property changes in the same synchronous block
   * are coalesced into a single update call.
   */
  private _scheduleUpdate(): void {
    if (!this.treeview || this._updatePending) return;
    this._updatePending = true;
    queueMicrotask(() => {
      this._updatePending = false;
      if (!this.treeview) return;
      const config = this.buildConfig();
      initLogger.debug('[WebTreeViewElement] batched update()', {
        idMember: config.idMember,
        pathMember: config.pathMember,
        displayValueMember: config.displayValueMember,
        dataLength: config.data?.length ?? 0
      });
      this.treeview.update(config);
    });
  }

  private initializeTreeView(): void {
    if (!this.containerElement) return;

    const config = this.buildConfig();
    initLogger.debug('[WebTreeViewElement] initializeTreeView', {
      idMember: config.idMember,
      pathMember: config.pathMember,
      displayValueMember: config.displayValueMember,
      dataLength: config.data?.length ?? 0
    });
    this.treeview = new WebTreeView<T>(this.containerElement, config, this._renderer);
  }

  private buildConfig(): Partial<TreeViewConfig<T>> {
    const config: Partial<TreeViewConfig<T>> = {};

    // Data
    if (this._data) config.data = this._data;

    // Member mappings from attributes or properties (defaults: property name without "Member" suffix)
    config.idMember = this._idMember ?? this.getAttribute('id-member') ?? 'id';
    config.pathMember = this._pathMember ?? this.getAttribute('path-member') ?? 'path';

    // Optional member mappings — only set when explicitly provided by user.
    // When left undefined, LTree auto-calculates these from the path structure.
    const parentPathMember = this._parentPathMember ?? this.getAttribute('parent-path-member');
    if (parentPathMember) config.parentPathMember = parentPathMember;

    const levelMember = this._levelMember ?? this.getAttribute('level-member');
    if (levelMember) config.levelMember = levelMember;

    const isExpandedMember = this._isExpandedMember ?? this.getAttribute('is-expanded-member');
    if (isExpandedMember) config.isExpandedMember = isExpandedMember;

    const isSelectedMember = this._isSelectedMember ?? this.getAttribute('is-selected-member');
    if (isSelectedMember) config.isSelectedMember = isSelectedMember;

    const isDraggableMember = this._isDraggableMember ?? this.getAttribute('is-draggable-member');
    if (isDraggableMember) config.isDraggableMember = isDraggableMember;

    const isDropAllowedMember = this._isDropAllowedMember ?? this.getAttribute('is-drop-allowed-member');
    if (isDropAllowedMember) config.isDropAllowedMember = isDropAllowedMember;

    const hasChildrenMember = this._hasChildrenMember ?? this.getAttribute('has-children-member');
    if (hasChildrenMember) config.hasChildrenMember = hasChildrenMember;

    config.displayValueMember = this._displayValueMember ?? this.getAttribute('display-value-member') ?? 'displayValue';

    const searchValueMember = this._searchValueMember ?? this.getAttribute('search-value-member');
    if (searchValueMember) config.searchValueMember = searchValueMember;

    const isSelectableMember = this._isSelectableMember ?? this.getAttribute('is-selectable-member');
    if (isSelectableMember) config.isSelectableMember = isSelectableMember;

    const isCollapsibleMember = this._isCollapsibleMember ?? this.getAttribute('is-collapsible-member');
    if (isCollapsibleMember) config.isCollapsibleMember = isCollapsibleMember;

    const orderMember = this._orderMember ?? this.getAttribute('order-member');
    if (orderMember) config.orderMember = orderMember;

    const allowedDropPositionsMember = this._allowedDropPositionsMember ?? this.getAttribute('allowed-drop-positions-member');
    if (allowedDropPositionsMember) config.allowedDropPositionsMember = allowedDropPositionsMember;

    // Tree identification
    const treeId = this._treeId ?? this.getAttribute('tree-id');
    if (treeId) config.treeId = treeId;

    // Behavior attributes
    const expandLevel = this._expandLevel ?? (this.getAttribute('expand-level') !== null ? parseInt(this.getAttribute('expand-level')!, 10) : undefined);
    if (expandLevel !== undefined) config.expandLevel = expandLevel;

    const treePathSeparator = this.getAttribute('tree-path-separator');
    if (treePathSeparator !== null) config.treePathSeparator = treePathSeparator;

    const shouldToggle = this._shouldToggleOnNodeClick ?? (this.getAttribute('should-toggle-on-node-click') !== null ? this.getAttribute('should-toggle-on-node-click') !== 'false' : undefined);
    if (shouldToggle !== undefined) config.shouldToggleOnNodeClick = shouldToggle;

    const isSorted = this._isSorted ?? (this.getAttribute('is-sorted') !== null ? this.getAttribute('is-sorted') !== 'false' : undefined);
    if (isSorted !== undefined) config.isSorted = isSorted;

    // Search/indexer
    const shouldUseSearch = this._shouldUseInternalSearchIndex ?? (this.getAttribute('should-use-internal-search-index') !== null ? this.getAttribute('should-use-internal-search-index') !== 'false' : undefined);
    if (shouldUseSearch !== undefined) config.shouldUseInternalSearchIndex = shouldUseSearch;

    const batchSize = this._indexerBatchSize ?? (this.getAttribute('indexer-batch-size') ? parseInt(this.getAttribute('indexer-batch-size')!, 10) : undefined);
    if (batchSize !== undefined) config.indexerBatchSize = batchSize;

    const timeout = this._indexerTimeout ?? (this.getAttribute('indexer-timeout') ? parseInt(this.getAttribute('indexer-timeout')!, 10) : undefined);
    if (timeout !== undefined) config.indexerTimeout = timeout;

    // Search
    const searchText = this.getAttribute('search-text');
    if (searchText !== null) config.searchText = searchText;

    // Visual classes
    const bodyClass = this.getAttribute('body-class');
    if (bodyClass) config.bodyClass = bodyClass;

    const selectedNodeClass = this.getAttribute('selected-node-class');
    if (selectedNodeClass) config.selectedNodeClass = selectedNodeClass;

    const dragOverNodeClass = this.getAttribute('drag-over-node-class');
    if (dragOverNodeClass) config.dragOverNodeClass = dragOverNodeClass;

    const expandIconClass = this.getAttribute('expand-icon-class');
    if (expandIconClass) config.expandIconClass = expandIconClass;

    const collapseIconClass = this.getAttribute('collapse-icon-class');
    if (collapseIconClass) config.collapseIconClass = collapseIconClass;

    const leafIconClass = this.getAttribute('leaf-icon-class');
    if (leafIconClass) config.leafIconClass = leafIconClass;

    const scrollHighlightTimeout = this.getAttribute('scroll-highlight-timeout');
    if (scrollHighlightTimeout !== null) config.scrollHighlightTimeout = parseInt(scrollHighlightTimeout, 10);

    const scrollHighlightClass = this.getAttribute('scroll-highlight-class');
    if (scrollHighlightClass) config.scrollHighlightClass = scrollHighlightClass;

    // Context menu
    const ctxXOff = this.getAttribute('context-menu-x-offset');
    if (ctxXOff !== null) config.contextMenuXOffset = parseInt(ctxXOff, 10);

    const ctxYOff = this.getAttribute('context-menu-y-offset');
    if (ctxYOff !== null) config.contextMenuYOffset = parseInt(ctxYOff, 10);

    // Debug
    const debugInfo = this.getAttribute('should-display-debug-information');
    if (debugInfo !== null) config.shouldDisplayDebugInformation = debugInfo !== 'false';

    // DnD attributes
    const dragDropMode = this._dragDropMode ?? this.getAttribute('drag-drop-mode') as DragDropMode;
    if (dragDropMode) config.dragDropMode = dragDropMode;

    const dropZoneMode = this._dropZoneMode ?? this.getAttribute('drop-zone-mode') as 'floating' | 'glow';
    if (dropZoneMode) config.dropZoneMode = dropZoneMode;

    const dropZoneLayout = this._dropZoneLayout ?? this.getAttribute('drop-zone-layout') as any;
    if (dropZoneLayout) config.dropZoneLayout = dropZoneLayout;

    const dropZoneStart = this._dropZoneStart ?? (this.getAttribute('drop-zone-start') ? parseInt(this.getAttribute('drop-zone-start')!, 10) : undefined);
    if (dropZoneStart !== undefined) config.dropZoneStart = dropZoneStart;

    const dropZoneMaxWidth = this._dropZoneMaxWidth ?? (this.getAttribute('drop-zone-max-width') ? parseInt(this.getAttribute('drop-zone-max-width')!, 10) : undefined);
    if (dropZoneMaxWidth !== undefined) config.dropZoneMaxWidth = dropZoneMaxWidth;

    const allowCopy = this._allowCopy ?? (this.getAttribute('allow-copy') !== null ? this.getAttribute('allow-copy') !== 'false' : undefined);
    if (allowCopy !== undefined) config.allowCopy = allowCopy;

    const autoHandleCopy = this._autoHandleCopy ?? (this.getAttribute('auto-handle-copy') !== null ? this.getAttribute('auto-handle-copy') !== 'false' : undefined);
    if (autoHandleCopy !== undefined) config.autoHandleCopy = autoHandleCopy;

    // Rendering config
    const useFlatRendering = this.getAttribute('use-flat-rendering');
    if (useFlatRendering !== null) config.useFlatRendering = useFlatRendering !== 'false';

    const flatIndentSize = this.getAttribute('flat-indent-size');
    if (flatIndentSize) config.flatIndentSize = flatIndentSize;

    const progressiveRender = this.getAttribute('progressive-render');
    if (progressiveRender !== null) config.progressiveRender = progressiveRender !== 'false';

    const initialBatchSize = this.getAttribute('initial-batch-size');
    if (initialBatchSize !== null) config.initialBatchSize = parseInt(initialBatchSize, 10);

    const maxBatchSize = this.getAttribute('max-batch-size');
    if (maxBatchSize !== null) config.maxBatchSize = parseInt(maxBatchSize, 10);

    // Callbacks
    if (this._getDisplayValueCallback) config.getDisplayValueCallback = this._getDisplayValueCallback;
    if (this._getSearchValueCallback) config.getSearchValueCallback = this._getSearchValueCallback;
    if (this._getIsDraggableCallback) config.getIsDraggableCallback = this._getIsDraggableCallback;
    if (this._getIsCollapsibleCallback) config.getIsCollapsibleCallback = this._getIsCollapsibleCallback;
    if (this._getAllowedDropPositionsCallback) config.getAllowedDropPositionsCallback = this._getAllowedDropPositionsCallback;
    if (this._sortCallback) config.sortCallback = this._sortCallback;
    if (this._contextMenuCallback) config.contextMenuCallback = this._contextMenuCallback;
    if (this._indexingCompleteCallback) config.indexingCompleteCallback = this._indexingCompleteCallback;

    // Templates
    if (this._nodeTemplate) config.nodeTemplate = this._nodeTemplate;
    if (this._emptyTemplate) config.emptyTemplate = this._emptyTemplate;
    if (this._loadingTemplate) config.loadingTemplate = this._loadingTemplate;
    if (this._headerTemplate) config.headerTemplate = this._headerTemplate;
    if (this._footerTemplate) config.footerTemplate = this._footerTemplate;
    if (this._contextMenuTemplate) config.contextMenuTemplate = this._contextMenuTemplate;
    if (this._dropPlaceholderTemplate) config.dropPlaceholderTemplate = this._dropPlaceholderTemplate;

    // Event handlers
    if (this._onNodeClicked) config.onNodeClicked = this._onNodeClicked;
    if (this._onNodeDragStart) config.onNodeDragStart = this._onNodeDragStart;
    if (this._onNodeDragOver) config.onNodeDragOver = this._onNodeDragOver;
    if (this._beforeDropCallback) config.beforeDropCallback = this._beforeDropCallback;
    if (this._onNodeDrop) config.onNodeDrop = this._onNodeDrop;

    // Render callbacks
    if (this._onRenderStart) config.onRenderStart = this._onRenderStart;
    if (this._onRenderProgress) config.onRenderProgress = this._onRenderProgress;
    if (this._onRenderComplete) config.onRenderComplete = this._onRenderComplete;

    return config;
  }
}

// Auto-register
if (typeof customElements !== 'undefined' && !customElements.get('web-treeview')) {
  customElements.define('web-treeview', WebTreeViewElement);
}
