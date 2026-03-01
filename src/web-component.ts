import { WebTreeView } from './treeview';
import type { TreeViewConfig, ScrollToPathOptions } from './types';
import type { LTreeNode } from './ltree/ltree-node';
import type { DropPosition } from './ltree/ltree-node';
import type { Ltree, ContextMenuItem } from './ltree/types';
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

  // Search/indexer config
  private _shouldUseInternalSearchIndex?: boolean;
  private _indexerBatchSize?: number;
  private _indexerTimeout?: number;

  // Callback properties
  private _getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  private _getSearchValueCallback?: (node: LTreeNode<T>) => string;
  private _getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  private _getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  private _getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  private _sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  private _contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[];
  private _indexingCompleteCallback?: () => void;

  // Event callbacks
  private _onNodeClicked?: (node: LTreeNode<T>) => void;
  private _onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
  private _onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
  private _onNodeDrop?: (node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;

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
      'should-display-debug-information'
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

    // Re-initialize on attribute change
    this.treeview.destroy();
    this.initializeTreeView();
  }

  // ── Property getters/setters ───────────────────────────────────────

  get data(): T[] | undefined {
    return this._data;
  }

  set data(value: T[] | undefined) {
    this._data = value;
    if (this.treeview && value) {
      this.treeview.update({ data: value });
    }
  }

  get idMember(): string | undefined { return this._idMember; }
  set idMember(value: string | undefined) { this._idMember = value; }

  get pathMember(): string | undefined { return this._pathMember; }
  set pathMember(value: string | undefined) { this._pathMember = value; }

  get parentPathMember(): string | undefined { return this._parentPathMember; }
  set parentPathMember(value: string | undefined) { this._parentPathMember = value; }

  get isSelectableMember(): string | undefined { return this._isSelectableMember; }
  set isSelectableMember(value: string | undefined) { this._isSelectableMember = value; }

  get isCollapsibleMember(): string | undefined { return this._isCollapsibleMember; }
  set isCollapsibleMember(value: string | undefined) { this._isCollapsibleMember = value; }

  get orderMember(): string | undefined { return this._orderMember; }
  set orderMember(value: string | undefined) { this._orderMember = value; }

  get allowedDropPositionsMember(): string | undefined { return this._allowedDropPositionsMember; }
  set allowedDropPositionsMember(value: string | undefined) { this._allowedDropPositionsMember = value; }

  get shouldUseInternalSearchIndex(): boolean | undefined { return this._shouldUseInternalSearchIndex; }
  set shouldUseInternalSearchIndex(value: boolean | undefined) { this._shouldUseInternalSearchIndex = value; }

  get indexerBatchSize(): number | undefined { return this._indexerBatchSize; }
  set indexerBatchSize(value: number | undefined) { this._indexerBatchSize = value; }

  get indexerTimeout(): number | undefined { return this._indexerTimeout; }
  set indexerTimeout(value: number | undefined) { this._indexerTimeout = value; }

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

  get onNodeDrop() { return this._onNodeDrop; }
  set onNodeDrop(value: ((node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void) | undefined) {
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

  // ── Private methods ────────────────────────────────────────────────

  private render(): void {
    this.containerElement = document.createElement('div');
    this.containerElement.classList.add('web-treeview');
    this.shadow.appendChild(this.containerElement);
  }

  private initializeTreeView(): void {
    if (!this.containerElement) return;

    const config = this.buildConfig();
    this.treeview = new WebTreeView<T>(this.containerElement, config);
  }

  private buildConfig(): Partial<TreeViewConfig<T>> {
    const config: Partial<TreeViewConfig<T>> = {};

    // Data
    if (this._data) config.data = this._data;

    // Member mappings from attributes or properties
    const idMember = this._idMember ?? this.getAttribute('id-member');
    if (idMember) config.idMember = idMember;

    const pathMember = this._pathMember ?? this.getAttribute('path-member');
    if (pathMember) config.pathMember = pathMember;

    const parentPathMember = this._parentPathMember ?? this.getAttribute('parent-path-member');
    if (parentPathMember) config.parentPathMember = parentPathMember;

    const levelMember = this.getAttribute('level-member');
    if (levelMember) config.levelMember = levelMember;

    const isExpandedMember = this.getAttribute('is-expanded-member');
    if (isExpandedMember) config.isExpandedMember = isExpandedMember;

    const isDraggableMember = this.getAttribute('is-draggable-member');
    if (isDraggableMember) config.isDraggableMember = isDraggableMember;

    const isDropAllowedMember = this.getAttribute('is-drop-allowed-member');
    if (isDropAllowedMember) config.isDropAllowedMember = isDropAllowedMember;

    const hasChildrenMember = this.getAttribute('has-children-member');
    if (hasChildrenMember) config.hasChildrenMember = hasChildrenMember;

    const displayValueMember = this.getAttribute('display-value-member');
    if (displayValueMember) config.displayValueMember = displayValueMember;

    const searchValueMember = this.getAttribute('search-value-member');
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
    const treeId = this.getAttribute('tree-id');
    if (treeId) config.treeId = treeId;

    // Behavior attributes
    const expandLevel = this.getAttribute('expand-level');
    if (expandLevel !== null) config.expandLevel = parseInt(expandLevel, 10);

    const treePathSeparator = this.getAttribute('tree-path-separator');
    if (treePathSeparator !== null) config.treePathSeparator = treePathSeparator;

    const shouldToggle = this.getAttribute('should-toggle-on-node-click');
    if (shouldToggle !== null) config.shouldToggleOnNodeClick = shouldToggle !== 'false';

    const isSorted = this.getAttribute('is-sorted');
    if (isSorted !== null) config.isSorted = isSorted !== 'false';

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

    // Debug
    const debugInfo = this.getAttribute('should-display-debug-information');
    if (debugInfo !== null) config.shouldDisplayDebugInformation = debugInfo !== 'false';

    // Callbacks
    if (this._getDisplayValueCallback) config.getDisplayValueCallback = this._getDisplayValueCallback;
    if (this._getSearchValueCallback) config.getSearchValueCallback = this._getSearchValueCallback;
    if (this._getIsDraggableCallback) config.getIsDraggableCallback = this._getIsDraggableCallback;
    if (this._getIsCollapsibleCallback) config.getIsCollapsibleCallback = this._getIsCollapsibleCallback;
    if (this._getAllowedDropPositionsCallback) config.getAllowedDropPositionsCallback = this._getAllowedDropPositionsCallback;
    if (this._sortCallback) config.sortCallback = this._sortCallback;
    if (this._contextMenuCallback) config.contextMenuCallback = this._contextMenuCallback;
    if (this._indexingCompleteCallback) config.indexingCompleteCallback = this._indexingCompleteCallback;

    // Event handlers
    if (this._onNodeClicked) config.onNodeClicked = this._onNodeClicked;
    if (this._onNodeDragStart) config.onNodeDragStart = this._onNodeDragStart;
    if (this._onNodeDragOver) config.onNodeDragOver = this._onNodeDragOver;
    if (this._onNodeDrop) config.onNodeDrop = this._onNodeDrop;

    return config;
  }
}

// Auto-register
if (typeof customElements !== 'undefined' && !customElements.get('web-treeview')) {
  customElements.define('web-treeview', WebTreeViewElement);
}
