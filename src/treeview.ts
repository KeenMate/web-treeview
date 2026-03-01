import { createLTree } from './ltree/ltree';
import type { Ltree } from './ltree/types';
import type { LTreeNode } from './ltree/ltree-node';
import type { TreeViewConfig, ScrollToPathOptions } from './types';

/**
 * Core treeview engine — wraps createLTree for web component usage.
 * Can be used standalone or wrapped by WebTreeViewElement.
 */
export class WebTreeView<T = any> {
  private tree: Ltree<T>;
  private element: HTMLElement;
  private config: Partial<TreeViewConfig<T>>;

  constructor(element: HTMLElement, options: Partial<TreeViewConfig<T>> = {}) {
    this.element = element;
    this.config = { ...options };

    this.tree = createLTree<T>(
      options.idMember!,
      options.pathMember!,
      options.parentPathMember,
      options.levelMember,
      options.hasChildrenMember,
      options.isExpandedMember,
      options.isSelectableMember,
      options.isDraggableMember,
      options.getIsDraggableCallback,
      options.isDropAllowedMember,
      options.allowedDropPositionsMember,
      options.displayValueMember,
      options.getDisplayValueCallback,
      options.searchValueMember,
      options.getSearchValueCallback,
      options.getAllowedDropPositionsCallback,
      options.isCollapsibleMember,
      options.getIsCollapsibleCallback,
      options.orderMember,
      options.treeId || undefined,
      options.treePathSeparator,
      options.expandLevel,
      options.shouldUseInternalSearchIndex,
      undefined, // initializeIndexCallback
      options.indexerBatchSize,
      options.indexerTimeout,
      {
        isSorted: options.isSorted ?? false,
        sortCallback: options.sortCallback,
        indexingCompleteCallback: options.indexingCompleteCallback,
        shouldDisplayDebugInformation: options.shouldDisplayDebugInformation ?? false,
      } as any
    );

    // Wire up change callback to dispatch events
    this.tree.onChange = () => this.onTreeChanged();

    // Insert initial data if provided
    if (options.data?.length) {
      this.tree.insertArray(options.data);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  update(props: Partial<TreeViewConfig<T>>): void {
    Object.assign(this.config, props);
    if (props.data) {
      this.tree.insertArray(props.data);
    }
  }

  expandNodes(nodePath: string): void {
    this.tree.expandNodes(nodePath);
  }

  collapseNodes(nodePath: string): void {
    this.tree.collapseNodes(nodePath);
  }

  expandAll(nodePath?: string | null): void {
    this.tree.expandAll(nodePath);
  }

  collapseAll(nodePath?: string | null): void {
    this.tree.collapseAll(nodePath);
  }

  filterNodes(searchText: string): void {
    this.tree.filterNodes(searchText);
  }

  searchNodes(searchText: string | null): LTreeNode<T>[] {
    if (!searchText) return [];
    return this.tree.searchNodes(searchText);
  }

  scrollToPath(path: string, options?: ScrollToPathOptions): Promise<boolean> {
    // TODO: implement DOM scroll when rendering is added
    return Promise.resolve(false);
  }

  closeContextMenu(): void {
    // TODO: implement context menu when rendering is added
  }

  // Access visible nodes for rendering
  getVisibleFlatNodes(): LTreeNode<T>[] {
    return this.tree.visibleFlatNodes;
  }

  // Access the tree roots
  getTreeNodes(): LTreeNode<T>[] {
    return this.tree.tree;
  }

  // Access the underlying LTree for advanced usage
  getTree(): Ltree<T> {
    return this.tree;
  }

  getConfig(): Partial<TreeViewConfig<T>> {
    return { ...this.config };
  }

  // Change notification
  private onTreeChanged(): void {
    this.element.dispatchEvent(new CustomEvent('tree-changed', { bubbles: true }));
  }

  destroy(): void {
    this.tree.onChange = null;
    this.element.innerHTML = '';
  }
}
