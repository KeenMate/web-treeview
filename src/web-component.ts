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
  private _isLoading?: boolean;
  private _shouldDisplayDebugInformation?: boolean;
  private _shouldDisplayContextMenuInDebugMode?: boolean;

  // Search/indexer config
  private _shouldUseInternalSearchIndex?: boolean;
  private _indexerBatchSize?: number;
  private _indexerTimeout?: number;

  // Virtual scroll
  private _virtualScroll?: boolean;
  private _virtualRowHeight?: number;
  private _virtualOverscan?: number;
  private _virtualContainerHeight?: string;

  // Visual config
  private _toggleIconMode?: 'rotate' | 'swap';

  // Per-node icons
  private _iconMember?: string;
  private _iconCallback?: (node: LTreeNode<T>) => string | null;
  private _alignNodeIcons?: boolean;

  // DnD config
  private _dragDropMode?: DragDropMode;
  private _dropZoneMode?: 'floating' | 'glow';
  private _dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  private _dropZoneStart?: number | string;
  private _dropZoneMaxWidth?: number;
  private _allowCopy?: boolean;
  private _autoHandleCopy?: boolean;
  private _contextMenuXOffset?: number;
  private _contextMenuYOffset?: number;

  // Callback properties
  private _getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  private _getSearchValueCallback?: (node: LTreeNode<T>) => string;
  private _getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  private _getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  private _getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  private _sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  private _contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[];
  private _indexingCompleteCallback?: () => void;

  // Custom styles
  private _customStylesCallback?: () => string;
  private _customStyleSheet?: HTMLStyleElement;
  private _customStyleLinks?: HTMLLinkElement[];
  private _customDocLinks?: HTMLLinkElement[];

  // Render callbacks
  private _renderNodeCallback?: (node: LTreeNode<T>, container: HTMLElement) => void;
  private _renderEmptyStateCallback?: (container: HTMLElement) => void;
  private _renderEmptyZoneCallback?: (container: HTMLElement) => void;
  private _renderLoadingCallback?: (container: HTMLElement) => void;
  private _renderHeaderCallback?: (container: HTMLElement) => void;
  private _renderFooterCallback?: (container: HTMLElement) => void;
  private _renderContextMenuCallback?: (node: LTreeNode<T>, close: () => void, container: HTMLElement) => void;
  private _renderContextMenuItemCallback?: (item: ContextMenuItem, node: LTreeNode<T>, container: HTMLElement) => void;

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
      'expand-icon-class', 'collapse-icon-class', 'leaf-icon-class', 'toggle-icon-mode',
      'scroll-highlight-timeout', 'scroll-highlight-class',

      // Bindable
      'search-text',

      // Context menu
      'context-menu-x-offset', 'context-menu-y-offset',

      // Debug / Loading
      'should-display-debug-information', 'is-loading',

      // DnD
      'drag-drop-mode', 'drop-zone-mode', 'drop-zone-layout',
      'drop-zone-start', 'drop-zone-max-width', 'allow-copy', 'auto-handle-copy',

      // Rendering
      'use-flat-rendering', 'flat-indent-size',
      'progressive-render', 'initial-batch-size', 'max-batch-size',

      // Virtual scroll
      'virtual-scroll', 'virtual-row-height', 'virtual-overscan', 'virtual-container-height',

      // Per-node icons
      'icon-member', 'align-node-icons',
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

  get isLoading(): boolean | undefined { return this._isLoading; }
  set isLoading(value: boolean | undefined) { this._isLoading = value; this._scheduleUpdate(); }

  get shouldDisplayDebugInformation(): boolean | undefined { return this._shouldDisplayDebugInformation; }
  set shouldDisplayDebugInformation(value: boolean | undefined) { this._shouldDisplayDebugInformation = value; this._scheduleUpdate(); }

  get shouldDisplayContextMenuInDebugMode(): boolean | undefined { return this._shouldDisplayContextMenuInDebugMode; }
  set shouldDisplayContextMenuInDebugMode(value: boolean | undefined) { this._shouldDisplayContextMenuInDebugMode = value; this._scheduleUpdate(); }

  get shouldUseInternalSearchIndex(): boolean | undefined { return this._shouldUseInternalSearchIndex; }
  set shouldUseInternalSearchIndex(value: boolean | undefined) { this._shouldUseInternalSearchIndex = value; }

  get indexerBatchSize(): number | undefined { return this._indexerBatchSize; }
  set indexerBatchSize(value: number | undefined) { this._indexerBatchSize = value; }

  get indexerTimeout(): number | undefined { return this._indexerTimeout; }
  set indexerTimeout(value: number | undefined) { this._indexerTimeout = value; }

  // Visual properties
  get toggleIconMode(): 'rotate' | 'swap' | undefined { return this._toggleIconMode; }
  set toggleIconMode(value: 'rotate' | 'swap' | undefined) { this._toggleIconMode = value; this._scheduleUpdate(); }

  // Per-node icon properties
  get iconMember(): string | undefined { return this._iconMember; }
  set iconMember(value: string | undefined) { this._iconMember = value; this._scheduleUpdate(); }

  get iconCallback(): ((node: LTreeNode<T>) => string | null) | undefined { return this._iconCallback; }
  set iconCallback(value: ((node: LTreeNode<T>) => string | null) | undefined) { this._iconCallback = value; this._scheduleUpdate(); }

  get alignNodeIcons(): boolean | undefined { return this._alignNodeIcons; }
  set alignNodeIcons(value: boolean | undefined) { this._alignNodeIcons = value; this._scheduleUpdate(); }

  // DnD properties
  get dragDropMode(): DragDropMode | undefined { return this._dragDropMode; }
  set dragDropMode(value: DragDropMode | undefined) { this._dragDropMode = value; this._scheduleUpdate(); }

  get dropZoneMode(): 'floating' | 'glow' | undefined { return this._dropZoneMode; }
  set dropZoneMode(value: 'floating' | 'glow' | undefined) { this._dropZoneMode = value; this._scheduleUpdate(); }

  get dropZoneLayout(): 'around' | 'above' | 'below' | 'wave' | 'wave2' | undefined { return this._dropZoneLayout; }
  set dropZoneLayout(value: 'around' | 'above' | 'below' | 'wave' | 'wave2' | undefined) { this._dropZoneLayout = value; this._scheduleUpdate(); }

  get dropZoneStart(): number | string | undefined { return this._dropZoneStart; }
  set dropZoneStart(value: number | string | undefined) { this._dropZoneStart = value; this._scheduleUpdate(); }

  get dropZoneMaxWidth(): number | undefined { return this._dropZoneMaxWidth; }
  set dropZoneMaxWidth(value: number | undefined) { this._dropZoneMaxWidth = value; this._scheduleUpdate(); }

  get allowCopy(): boolean | undefined { return this._allowCopy; }
  set allowCopy(value: boolean | undefined) { this._allowCopy = value; this._scheduleUpdate(); }

  get autoHandleCopy(): boolean | undefined { return this._autoHandleCopy; }
  set autoHandleCopy(value: boolean | undefined) { this._autoHandleCopy = value; this._scheduleUpdate(); }

  get contextMenuXOffset(): number | undefined { return this._contextMenuXOffset; }
  set contextMenuXOffset(value: number | undefined) { this._contextMenuXOffset = value; this._scheduleUpdate(); }

  get contextMenuYOffset(): number | undefined { return this._contextMenuYOffset; }
  set contextMenuYOffset(value: number | undefined) { this._contextMenuYOffset = value; this._scheduleUpdate(); }

  // Virtual scroll properties
  get virtualScroll(): boolean | undefined { return this._virtualScroll; }
  set virtualScroll(value: boolean | undefined) { this._virtualScroll = value; this._scheduleUpdate(); }

  get virtualRowHeight(): number | undefined { return this._virtualRowHeight; }
  set virtualRowHeight(value: number | undefined) { this._virtualRowHeight = value; this._scheduleUpdate(); }

  get virtualOverscan(): number | undefined { return this._virtualOverscan; }
  set virtualOverscan(value: number | undefined) { this._virtualOverscan = value; this._scheduleUpdate(); }

  get virtualContainerHeight(): string | undefined { return this._virtualContainerHeight; }
  set virtualContainerHeight(value: string | undefined) { this._virtualContainerHeight = value; this._scheduleUpdate(); }

  // Custom styles injection
  get customStylesCallback(): (() => string) | undefined { return this._customStylesCallback; }
  set customStylesCallback(value: (() => string) | undefined) {
    this._customStylesCallback = value;
    this._applyCustomStyles();
  }

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
    if (this.treeview) this.treeview.update({ contextMenuCallback: value } as any);
  }

  get indexingCompleteCallback() { return this._indexingCompleteCallback; }
  set indexingCompleteCallback(value: (() => void) | undefined) {
    this._indexingCompleteCallback = value;
  }

  // Render callbacks
  get renderNodeCallback() { return this._renderNodeCallback; }
  set renderNodeCallback(value: ((node: LTreeNode<T>, container: HTMLElement) => void) | undefined) {
    this._renderNodeCallback = value;
    if (this.treeview) this.treeview.update({ renderNodeCallback: value } as any);
  }

  get renderEmptyStateCallback() { return this._renderEmptyStateCallback; }
  set renderEmptyStateCallback(value: ((container: HTMLElement) => void) | undefined) {
    this._renderEmptyStateCallback = value;
    if (this.treeview) this.treeview.update({ renderEmptyStateCallback: value } as any);
  }

  get renderEmptyZoneCallback() { return this._renderEmptyZoneCallback; }
  set renderEmptyZoneCallback(value: ((container: HTMLElement) => void) | undefined) {
    this._renderEmptyZoneCallback = value;
    if (this.treeview) this.treeview.update({ renderEmptyZoneCallback: value } as any);
  }

  get renderLoadingCallback() { return this._renderLoadingCallback; }
  set renderLoadingCallback(value: ((container: HTMLElement) => void) | undefined) {
    this._renderLoadingCallback = value;
    if (this.treeview) this.treeview.update({ renderLoadingCallback: value } as any);
  }

  get renderHeaderCallback() { return this._renderHeaderCallback; }
  set renderHeaderCallback(value: ((container: HTMLElement) => void) | undefined) {
    this._renderHeaderCallback = value;
    if (this.treeview) this.treeview.update({ renderHeaderCallback: value } as any);
  }

  get renderFooterCallback() { return this._renderFooterCallback; }
  set renderFooterCallback(value: ((container: HTMLElement) => void) | undefined) {
    this._renderFooterCallback = value;
    if (this.treeview) this.treeview.update({ renderFooterCallback: value } as any);
  }

  get renderContextMenuCallback() { return this._renderContextMenuCallback; }
  set renderContextMenuCallback(value: ((node: LTreeNode<T>, close: () => void, container: HTMLElement) => void) | undefined) {
    this._renderContextMenuCallback = value;
    if (this.treeview) this.treeview.update({ renderContextMenuCallback: value } as any);
  }

  get renderContextMenuItemCallback() { return this._renderContextMenuItemCallback; }
  set renderContextMenuItemCallback(value: ((item: ContextMenuItem, node: LTreeNode<T>, container: HTMLElement) => void) | undefined) {
    this._renderContextMenuItemCallback = value;
    if (this.treeview) this.treeview.update({ renderContextMenuItemCallback: value } as any);
  }

  // Render callbacks
  get onRenderStart() { return this._onRenderStart; }
  set onRenderStart(value: (() => void) | undefined) { this._onRenderStart = value; }

  get onRenderProgress() { return this._onRenderProgress; }
  set onRenderProgress(value: ((stats: any) => void) | undefined) { this._onRenderProgress = value; }

  get onRenderComplete() { return this._onRenderComplete; }
  set onRenderComplete(value: ((stats: any) => void) | undefined) { this._onRenderComplete = value; }

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

  getExpandedPaths(): string[] {
    return this.treeview?.getExpandedPaths() ?? [];
  }

  setExpandedPaths(paths: string[]): void {
    this.treeview?.setExpandedPaths(paths);
  }

  getVisibleFlatNodes(): LTreeNode<T>[] {
    return this.treeview?.getVisibleFlatNodes() ?? [];
  }

  getNodeByPath(path: string): LTreeNode<T> | null {
    return this.treeview?.getNodeByPath(path) ?? null;
  }

  getAllData(): T[] {
    return this.treeview?.getAllData() ?? [];
  }

  moveNode(sourcePath: string, targetPath: string, position: DropPosition): any {
    return this.treeview?.moveNode(sourcePath, targetPath, position);
  }

  removeNode(path: string, includeDescendants?: boolean): any {
    return this.treeview?.removeNode(path, includeDescendants);
  }

  addNode(parentPath: string, nodeData: T, pathSegment?: string): any {
    return this.treeview?.addNode(parentPath, nodeData, pathSegment);
  }

  updateNode(path: string, dataUpdates: Partial<T>): any {
    return this.treeview?.updateNode(path, dataUpdates);
  }

  copyNodeWithDescendants(
    sourceNode: LTreeNode<T>,
    targetParentPath: string,
    dataTransform: (data: T) => T,
    siblingPath?: string,
    position?: 'above' | 'below'
  ): any {
    return this.treeview?.copyNodeWithDescendants(sourceNode, targetParentPath, dataTransform, siblingPath, position);
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
    this._applyCustomStyles();
  }

  private _applyCustomStyles(): void {
    // Remove previous custom elements
    if (this._customStyleSheet) {
      this._customStyleSheet.remove();
      this._customStyleSheet = undefined;
    }
    if (this._customStyleLinks) {
      for (const link of this._customStyleLinks) link.remove();
      this._customStyleLinks = undefined;
    }
    if (this._customDocLinks) {
      for (const link of this._customDocLinks) link.remove();
      this._customDocLinks = undefined;
    }

    if (this._customStylesCallback) {
      const css = this._customStylesCallback();
      if (css) {
        // Extract @import url(...) rules and inject as <link> elements
        // (@import in dynamically-set <style>.textContent is ignored by CSS parser)
        const importRegex = /@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)\s*;?/g;
        let remaining = css;
        let match: RegExpExecArray | null;
        const links: HTMLLinkElement[] = [];

        while ((match = importRegex.exec(css)) !== null) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = match[1];
          link.className = 'tv-custom-styles';
          this.shadow.appendChild(link);
          links.push(link);
          remaining = remaining.replace(match[0], '');
        }

        if (links.length > 0) {
          this._customStyleLinks = links;

          // Also inject into document <head> for @font-face registration
          // (Shadow DOM @font-face doesn't always register fonts globally)
          const docLinks: HTMLLinkElement[] = [];
          for (const shadowLink of links) {
            const href = shadowLink.href;
            // Skip if already present in document
            if (!document.querySelector(`link[href="${href}"]`)) {
              const docLink = document.createElement('link');
              docLink.rel = 'stylesheet';
              docLink.href = href;
              docLink.setAttribute('data-tv-injected', '');
              document.head.appendChild(docLink);
              docLinks.push(docLink);
            }
          }
          if (docLinks.length > 0) {
            this._customDocLinks = docLinks;
          }
        }

        // Inject remaining CSS (non-@import rules) as <style>
        remaining = remaining.trim();
        if (remaining) {
          this._customStyleSheet = document.createElement('style');
          this._customStyleSheet.className = 'tv-custom-styles';
          this._customStyleSheet.textContent = remaining;
          this.shadow.appendChild(this._customStyleSheet);
        }
      }
    }
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

    // Wrap user's onNodeClicked to also dispatch DOM event
    const userOnNodeClicked = config.onNodeClicked;
    config.onNodeClicked = (node) => {
      userOnNodeClicked?.(node);
      this.dispatchEvent(new CustomEvent('node-clicked', {
        bubbles: true,
        composed: true,
        detail: { node }
      }));
    };

    // Wrap user's onNodeDrop to also dispatch DOM event
    const userOnNodeDrop = config.onNodeDrop;
    config.onNodeDrop = (dropNode, draggedNode, position, event, operation) => {
      userOnNodeDrop?.(dropNode, draggedNode, position, event, operation);
      this.dispatchEvent(new CustomEvent('node-drop', {
        bubbles: true,
        composed: true,
        detail: { node: dropNode, draggedNode, position, event, operation }
      }));
    };

    this.treeview = new WebTreeView<T>(this.containerElement, config, this._renderer);

    // Dispatch tree-changed and selected-node-changed from controller state changes
    let prevSelectedPath: string | null = null;
    const controller = this.treeview.getController();
    controller.on('state-change', (snapshot) => {
      this.dispatchEvent(new CustomEvent('tree-changed', {
        bubbles: true,
        composed: true
      }));

      const currentPath = snapshot.selectedNode?.path ?? null;
      if (currentPath !== prevSelectedPath) {
        prevSelectedPath = currentPath;
        this.dispatchEvent(new CustomEvent('selected-node-changed', {
          bubbles: true,
          composed: true,
          detail: { selectedNode: snapshot.selectedNode ?? null }
        }));
      }
    });
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

    const toggleIconMode = this._toggleIconMode ?? this.getAttribute('toggle-icon-mode');
    if (toggleIconMode === 'rotate' || toggleIconMode === 'swap') config.toggleIconMode = toggleIconMode;

    // Per-node icons
    const iconMember = this._iconMember ?? this.getAttribute('icon-member');
    if (iconMember) config.iconMember = iconMember;

    if (this._iconCallback) config.iconCallback = this._iconCallback;

    const alignNodeIcons = this._alignNodeIcons ?? (this.getAttribute('align-node-icons') !== null ? this.getAttribute('align-node-icons') !== 'false' : undefined);
    if (alignNodeIcons !== undefined) config.alignNodeIcons = alignNodeIcons;

    const scrollHighlightTimeout = this.getAttribute('scroll-highlight-timeout');
    if (scrollHighlightTimeout !== null) config.scrollHighlightTimeout = parseInt(scrollHighlightTimeout, 10);

    const scrollHighlightClass = this.getAttribute('scroll-highlight-class');
    if (scrollHighlightClass) config.scrollHighlightClass = scrollHighlightClass;

    // Context menu offsets (JS property takes precedence over HTML attribute)
    const ctxXOff = this._contextMenuXOffset ?? (this.getAttribute('context-menu-x-offset') !== null ? parseInt(this.getAttribute('context-menu-x-offset')!, 10) : undefined);
    if (ctxXOff !== undefined) config.contextMenuXOffset = ctxXOff;

    const ctxYOff = this._contextMenuYOffset ?? (this.getAttribute('context-menu-y-offset') !== null ? parseInt(this.getAttribute('context-menu-y-offset')!, 10) : undefined);
    if (ctxYOff !== undefined) config.contextMenuYOffset = ctxYOff;

    // Debug
    const debugInfo = this._shouldDisplayDebugInformation ?? (this.getAttribute('should-display-debug-information') !== null ? this.getAttribute('should-display-debug-information') !== 'false' : undefined);
    if (debugInfo !== undefined) config.shouldDisplayDebugInformation = debugInfo;

    const debugCtxMenu = this._shouldDisplayContextMenuInDebugMode;
    if (debugCtxMenu !== undefined) config.shouldDisplayContextMenuInDebugMode = debugCtxMenu;

    // Loading
    const isLoading = this._isLoading ?? (this.getAttribute('is-loading') !== null ? this.getAttribute('is-loading') !== 'false' : undefined);
    if (isLoading !== undefined) config.isLoading = isLoading;

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

    // Virtual scroll
    const virtualScroll = this._virtualScroll ?? (this.getAttribute('virtual-scroll') !== null ? this.getAttribute('virtual-scroll') !== 'false' : undefined);
    if (virtualScroll !== undefined) config.virtualScroll = virtualScroll;

    const virtualRowHeight = this._virtualRowHeight ?? (this.getAttribute('virtual-row-height') ? parseFloat(this.getAttribute('virtual-row-height')!) : undefined);
    if (virtualRowHeight !== undefined) config.virtualRowHeight = virtualRowHeight;

    const virtualOverscan = this._virtualOverscan ?? (this.getAttribute('virtual-overscan') ? parseInt(this.getAttribute('virtual-overscan')!, 10) : undefined);
    if (virtualOverscan !== undefined) config.virtualOverscan = virtualOverscan;

    const virtualContainerHeight = this._virtualContainerHeight ?? this.getAttribute('virtual-container-height');
    if (virtualContainerHeight) config.virtualContainerHeight = virtualContainerHeight;

    // Callbacks
    if (this._getDisplayValueCallback) config.getDisplayValueCallback = this._getDisplayValueCallback;
    if (this._getSearchValueCallback) config.getSearchValueCallback = this._getSearchValueCallback;
    if (this._getIsDraggableCallback) config.getIsDraggableCallback = this._getIsDraggableCallback;
    if (this._getIsCollapsibleCallback) config.getIsCollapsibleCallback = this._getIsCollapsibleCallback;
    if (this._getAllowedDropPositionsCallback) config.getAllowedDropPositionsCallback = this._getAllowedDropPositionsCallback;
    if (this._sortCallback) config.sortCallback = this._sortCallback;
    if (this._contextMenuCallback) config.contextMenuCallback = this._contextMenuCallback;
    if (this._indexingCompleteCallback) config.indexingCompleteCallback = this._indexingCompleteCallback;

    // Render callbacks
    if (this._renderNodeCallback) config.renderNodeCallback = this._renderNodeCallback;
    if (this._renderEmptyStateCallback) config.renderEmptyStateCallback = this._renderEmptyStateCallback;
    if (this._renderEmptyZoneCallback) config.renderEmptyZoneCallback = this._renderEmptyZoneCallback;
    if (this._renderLoadingCallback) config.renderLoadingCallback = this._renderLoadingCallback;
    if (this._renderHeaderCallback) config.renderHeaderCallback = this._renderHeaderCallback;
    if (this._renderFooterCallback) config.renderFooterCallback = this._renderFooterCallback;
    if (this._renderContextMenuCallback) config.renderContextMenuCallback = this._renderContextMenuCallback;
    if (this._renderContextMenuItemCallback) config.renderContextMenuItemCallback = this._renderContextMenuItemCallback;

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
