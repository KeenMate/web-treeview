import { TreeController } from './controller/tree-controller';
import type { TreeControllerConfig } from './controller/types';
import type { TreeViewRenderer, RendererConfig } from './renderer/types';
import { DomRenderer } from './renderer/dom-renderer';
import type { LTreeNode } from './ltree/ltree-node';
import type { Ltree, DropPosition, TreeChange, ApplyChangesResult } from './ltree/types';
import type { SelectionModifiers } from './controller/types';
import type { PasteResult } from './clipboard';
import type { TreeViewConfig, ScrollToPathOptions } from './types';
import type { SearchOptions } from 'flexsearch';

/**
 * WebTreeView<T> — thin facade wrapping TreeController + TreeViewRenderer.
 * Can be used standalone or wrapped by WebTreeViewElement.
 */
export class WebTreeView<T = any> {
  private controller: TreeController<T>;
  private renderer: TreeViewRenderer<T>;
  private element: HTMLElement;

  constructor(
    element: HTMLElement,
    options: Partial<TreeViewConfig<T>> = {},
    renderer?: TreeViewRenderer<T>
  ) {
    this.element = element;

    // Map TreeViewConfig to TreeControllerConfig
    const controllerConfig = mapToControllerConfig(options);
    this.controller = new TreeController<T>(controllerConfig);

    // Use provided renderer or default DomRenderer
    this.renderer = renderer ?? new DomRenderer<T>();
    this.renderer.mount(element, this.controller, mapToRendererConfig(options));

    // Dispatch tree-changed events on the host element
    this.controller.on('state-change', () => {
      this.element.dispatchEvent(new CustomEvent('tree-changed', { bubbles: true }));
    });
  }

  // ── Public API (proxy to controller) ────────────────────────────────

  update(props: Partial<TreeViewConfig<T>>): void {
    const controllerConfig = mapToControllerConfig(props);
    // If context menu callbacks changed, update controller's awareness
    if ('renderContextMenuCallback' in props || 'contextMenuCallback' in props) {
      controllerConfig.hasContextMenuRenderer = !!(
        props.renderContextMenuCallback || props.contextMenuCallback ||
        this.controller.contextMenuCallbackCb
      );
    }
    this.controller.updateProps(controllerConfig);
    const rendererConfig = mapToRendererConfig(props);
    if (Object.keys(rendererConfig).length > 0) {
      this.renderer.updateConfig(rendererConfig);
    }
  }

  expandNodes(nodePath: string): void {
    this.controller.expandNodes(nodePath);
  }

  collapseNodes(nodePath: string): void {
    this.controller.collapseNodes(nodePath);
  }

  expandAll(nodePath?: string | null): void {
    this.controller.expandAll(nodePath);
  }

  collapseAll(nodePath?: string | null): void {
    this.controller.collapseAll(nodePath);
  }

  filterNodes(searchText: string, searchOptions?: SearchOptions): void {
    this.controller.filterNodes(searchText, searchOptions);
  }

  searchNodes(searchText: string | null, searchOptions?: SearchOptions): LTreeNode<T>[] {
    if (!searchText) return [];
    return this.controller.searchNodes(searchText, searchOptions);
  }

  scrollToPath(path: string, options?: ScrollToPathOptions): Promise<boolean> {
    return this.controller.scrollToPath(path, options);
  }

  closeContextMenu(): void {
    this.controller.closeContextMenu();
  }

  getVisibleFlatNodes(): LTreeNode<T>[] {
    return this.controller.flatNodesToRender;
  }

  getTreeNodes(): LTreeNode<T>[] {
    return this.controller.tree.tree;
  }

  getTree(): Ltree<T> {
    return this.controller.tree;
  }

  getController(): TreeController<T> {
    return this.controller;
  }

  getConfig(): Partial<TreeViewConfig<T>> {
    // Return snapshot of current config from controller
    return {};
  }

  // ── Tree mutation (proxy to controller) ─────────────────────────────

  moveNode(sourcePath: string, targetPath: string, position: DropPosition) {
    return this.controller.moveNode(sourcePath, targetPath, position);
  }

  removeNode(path: string, includeDescendants?: boolean) {
    return this.controller.removeNode(path, includeDescendants);
  }

  addNode(parentPath: string, nodeData: T, pathSegment?: string) {
    return this.controller.addNode(parentPath, nodeData, pathSegment);
  }

  updateNode(path: string, dataUpdates: Partial<T>) {
    return this.controller.updateNode(path, dataUpdates);
  }

  copyNodeWithDescendants(
    sourceNode: LTreeNode<T>,
    targetParentPath: string,
    dataTransform: (data: T) => T,
    siblingPath?: string,
    position?: 'above' | 'below'
  ) {
    return this.controller.copyNodeWithDescendants(sourceNode, targetParentPath, dataTransform, siblingPath, position);
  }

  applyChanges(changes: TreeChange<T>[]): ApplyChangesResult {
    return this.controller.applyChanges(changes);
  }

  insertBranch(parentPath: string, data: T[]): { success: boolean; count: number; error?: string } {
    return this.controller.insertBranch(parentPath, data);
  }

  replaceBranch(parentPath: string, data: T[]): { success: boolean; removed: number; added: number; error?: string } {
    return this.controller.replaceBranch(parentPath, data);
  }

  deleteBranch(path: string, keepParent?: boolean): { success: boolean; count: number; error?: string } {
    return this.controller.deleteBranch(path, keepParent);
  }

  getExpandedPaths(): string[] {
    return this.controller.getExpandedPaths();
  }

  setExpandedPaths(paths: string[]): void {
    this.controller.setExpandedPaths(paths);
  }

  getAllData(): T[] {
    return this.controller.getAllData();
  }

  getNodeByPath(path: string): LTreeNode<T> | null {
    return this.controller.getNodeByPath(path);
  }

  // ── Multi-select (proxy to controller) ──────────────────────────────

  selectNode(path: string, modifiers?: SelectionModifiers): void {
    this.controller.selectNode(path, modifiers);
  }

  selectNodes(paths: string[]): void {
    this.controller.selectNodes(paths);
  }

  deselectAll(): void {
    this.controller.deselectAll();
  }

  getSelectedNodes(): LTreeNode<T>[] {
    return this.controller.getSelectedNodes();
  }

  getSelectedPaths(): Set<string> {
    return this.controller.getSelectedPaths();
  }

  isNodeSelected(path: string): boolean {
    return this.controller.isNodeSelected(path);
  }

  selectAll(): void {
    this.controller.selectAll();
  }

  // ── Navigation (proxy to controller) ──────────────────────────────

  navTo(path: string): void { this.controller.navTo(path); }
  navNext(): void { this.controller.navNext(); }
  navPrev(): void { this.controller.navPrev(); }
  navNextSibling(): void { this.controller.navNextSibling(); }
  navPrevSibling(): void { this.controller.navPrevSibling(); }
  navInto(): void { this.controller.navInto(); }
  navOut(): void { this.controller.navOut(); }
  navBackOut(): void { this.controller.navBackOut(); }
  navToggle(): void { this.controller.navToggle(); }
  navFirst(): void { this.controller.navFirst(); }
  navLast(): void { this.controller.navLast(); }

  // ── Clipboard (proxy to controller) ───────────────────────────────

  copyNodes(paths?: string[]): void {
    this.controller.copyNodes(paths);
  }

  cutNodes(paths?: string[]): void {
    this.controller.cutNodes(paths);
  }

  pasteNodes(targetPath: string, transformData?: (data: T) => T, position?: 'above' | 'below' | 'child'): PasteResult<T> {
    return this.controller.pasteNodes(targetPath, transformData, position);
  }

  cancelCut(): void {
    this.controller.cancelCut();
  }

  hasClipboardContent(): boolean {
    return this.controller.hasClipboardContent();
  }

  getClipboardOperation(): 'copy' | 'cut' | null {
    return this.controller.getClipboardOperation();
  }

  // ── Renderer swap ───────────────────────────────────────────────────

  /** Swap renderer at runtime without losing tree state. */
  setRenderer(renderer: TreeViewRenderer<T>, config?: Partial<RendererConfig<T>>): void {
    this.renderer.destroy();
    this.renderer = renderer;
    this.renderer.mount(this.element, this.controller, config || {});
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  destroy(): void {
    this.renderer.destroy();
    this.controller.destroy();
  }
}

// ── Config mappers ────────────────────────────────────────────────────────

function mapToControllerConfig<T>(options: Partial<TreeViewConfig<T>>): TreeControllerConfig<T> {
  return {
    idMember: options.idMember || 'id',
    pathMember: options.pathMember || 'path',
    parentPathMember: options.parentPathMember,
    levelMember: options.levelMember,
    isExpandedMember: options.isExpandedMember,
    isSelectedMember: options.isSelectedMember ?? options.isSelectableMember,
    isDraggableMember: options.isDraggableMember,
    getIsDraggableCallback: options.getIsDraggableCallback,
    isDropAllowedMember: options.isDropAllowedMember,
    allowedDropPositionsMember: options.allowedDropPositionsMember,
    getAllowedDropPositionsCallback: options.getAllowedDropPositionsCallback,
    isCollapsibleMember: options.isCollapsibleMember,
    getIsCollapsibleCallback: options.getIsCollapsibleCallback,
    hasChildrenMember: options.hasChildrenMember,
    isSorted: options.isSorted,
    displayValueMember: options.displayValueMember,
    getDisplayValueCallback: options.getDisplayValueCallback,
    searchValueMember: options.searchValueMember,
    getSearchValueCallback: options.getSearchValueCallback,
    orderMember: options.orderMember,
    treeId: options.treeId,
    treePathSeparator: options.treePathSeparator,
    sortCallback: options.sortCallback,

    data: options.data || [],
    selectedNode: options.selectedNode,

    expandLevel: options.expandLevel,
    clickBehavior: options.clickBehavior,
    searchText: options.searchText,
    shouldUseInternalSearchIndex: options.shouldUseInternalSearchIndex,
    indexerBatchSize: options.indexerBatchSize,
    indexerTimeout: options.indexerTimeout,
    shouldDisplayDebugInformation: options.shouldDisplayDebugInformation ?? false,
    shouldDisplayContextMenuInDebugMode: options.shouldDisplayContextMenuInDebugMode ?? false,
    isLoading: options.isLoading ?? false,

    progressiveRender: options.progressiveRender ?? true,
    initialBatchSize: options.initialBatchSize,
    maxBatchSize: options.maxBatchSize,
    useFlatRendering: options.useFlatRendering ?? true,
    flatIndentSize: options.flatIndentSize,

    virtualScroll: options.virtualScroll ?? false,
    virtualRowHeight: options.virtualRowHeight ?? undefined,
    virtualOverscan: options.virtualOverscan ?? undefined,
    virtualContainerHeight: options.virtualContainerHeight ?? undefined,

    dragDropMode: options.dragDropMode,
    dropZoneMode: options.dropZoneMode,
    dropZoneLayout: options.dropZoneLayout,
    dropZoneStart: options.dropZoneStart,
    dropZoneMaxWidth: options.dropZoneMaxWidth,
    allowCopy: options.allowCopy,
    autoHandleCopy: options.autoHandleCopy,

    onNodeClicked: options.onNodeClicked,
    onNodeDragStart: options.onNodeDragStart,
    onNodeDragOver: options.onNodeDragOver,
    beforeDropCallback: options.beforeDropCallback,
    onNodeDrop: options.onNodeDrop,
    contextMenuCallback: options.contextMenuCallback,
    hasContextMenuRenderer: !!(options.contextMenuCallback || options.renderContextMenuCallback),

    bodyClass: options.bodyClass,
    selectedNodeClass: options.selectedNodeClass,
    dragOverNodeClass: options.dragOverNodeClass,
    expandIconClass: options.expandIconClass,
    collapseIconClass: options.collapseIconClass,
    leafIconClass: options.leafIconClass,
    toggleIconMode: options.toggleIconMode,
    scrollHighlightTimeout: options.scrollHighlightTimeout,
    scrollHighlightClass: options.scrollHighlightClass,
    contextMenuXOffset: options.contextMenuXOffset,
    contextMenuYOffset: options.contextMenuYOffset,
    iconMember: options.iconMember,
    iconCallback: options.iconCallback,
    alignNodeIcons: options.alignNodeIcons,

    onRenderStart: options.onRenderStart,
    onRenderProgress: options.onRenderProgress,
    onRenderComplete: options.onRenderComplete,

    rangeSelectionMode: options.rangeSelectionMode,
    onSelectionChange: options.onSelectionChange,
  } as TreeControllerConfig<T>;
}

function mapToRendererConfig<T>(options: Partial<TreeViewConfig<T>>): RendererConfig<T> {
  const cfg: RendererConfig<T> = {
    renderNodeCallback: options.renderNodeCallback,
    renderEmptyStateCallback: options.renderEmptyStateCallback,
    renderEmptyZoneCallback: options.renderEmptyZoneCallback,
    renderLoadingCallback: options.renderLoadingCallback,
    renderHeaderCallback: options.renderHeaderCallback,
    renderFooterCallback: options.renderFooterCallback,
    renderContextMenuCallback: options.renderContextMenuCallback,
    renderContextMenuItemCallback: options.renderContextMenuItemCallback,
  };
  if ('theme' in options) cfg.theme = options.theme ?? null;
  return cfg;
}
