import type { LTreeNode } from '@keenmate/svelte-treeview';
import type { SearchOptions } from 'flexsearch';

export interface TreeEventMap<T> {
  'node-clicked': CustomEvent<{ node: LTreeNode<T> }>;
  'node-drag-start': CustomEvent<{ node: LTreeNode<T>; event: DragEvent }>;
  'node-drag-over': CustomEvent<{ node: LTreeNode<T>; event: DragEvent }>;
  'node-drop': CustomEvent<{ node: LTreeNode<T>; draggedNode: LTreeNode<T>; event: DragEvent }>;
  'data-changed': CustomEvent<{ data: T[] }>;
  'selected-node-changed': CustomEvent<{ selectedNode: LTreeNode<T> | null }>;
  'search-text-changed': CustomEvent<{ searchText: string }>;
}

export interface ScrollToPathOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}

export interface TreeWebComponentMethods<T> {
  expandNodes(nodePath: string): Promise<void>;
  collapseNodes(nodePath: string): Promise<void>;
  expandAll(nodePath?: string | null): void;
  collapseAll(nodePath?: string | null): void;
  filterNodes(searchText: string, searchOptions?: SearchOptions): void;
  searchNodes(searchText: string | null, searchOptions?: SearchOptions): LTreeNode<T>[];
  scrollToPath(path: string, options?: ScrollToPathOptions): Promise<boolean>;
}

export interface TreeWebComponentProps<T> {
  // Required
  data: T[];
  idMember: string;
  pathMember: string;
      
  // Optional mappings
  parentPathMember?: string | null;
  levelMember?: string | null;
  isExpandedMember?: string | null;
  isSelectedMember?: string | null;
  isDraggableMember?: string | null;
  isDropAllowedMember?: string | null;
  hasChildrenMember?: string | null;
  displayValueMember?: string | null;
  searchValueMember?: string | null;
  
  // Behavior
  expandLevel?: number | null;
  treePathSeparator?: string | null;
  shouldToggleOnNodeClick?: boolean | null;
  shouldUseInternalSearchIndex?: boolean | null;
  indexerBatchSize?: number | null;
  indexerTimeout?: number | null;
  shouldDisplayDebugInformation?: boolean;
  isSorted?: boolean | null;
  
  // Visual
  bodyClass?: string | null;
  selectedNodeClass?: string | null;
  dragOverNodeClass?: string | null;
  expandIconClass?: string | null;
  collapseIconClass?: string | null;
  leafIconClass?: string | null;
  scrollHighlightTimeout?: number | null;
  scrollHighlightClass?: string | null;
  
  // Bindable properties
  searchText?: string | null;
  selectedNode?: LTreeNode<T> | null;
  
  // Callbacks
  getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  getSearchValueCallback?: (node: LTreeNode<T>) => string;
  sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  
  // Event handlers
  onNodeClicked?: (node: LTreeNode<T>) => void;
  onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
  onNodeDrop?: (node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;
}