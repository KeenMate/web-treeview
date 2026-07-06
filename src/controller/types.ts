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
import type { PasteResult, ClipboardEntry, ClipboardOperation } from '../clipboard';
import type { Index, SearchOptions } from 'flexsearch';

// ─── Selection ──────────────────────────────────────────────────────────

export interface SelectionModifiers {
  ctrl: boolean;
  shift: boolean;
}

export type RangeSelectionMode = 'visual' | 'logical';

/** Gesture mode for highlightNode(): replace = plain click, toggle = Ctrl+click, range = Shift+click. */
export type HighlightMode = 'replace' | 'toggle' | 'range';

/** Options shared by every imperative selection/highlight/focus mutator. */
export interface TreeMutationOptions {
  /** Update state without firing the change callbacks (e.g. when restoring
   *  state from URL params or other external sources). */
  silent?: boolean;
}

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
  /** Data-driven per-row class hook. Applied to `.wtv__node`. */
  nodeClass?: ((node: LTreeNode<any>) => string | null | undefined) | undefined;
  /** Data-driven per-row class hook. Applied to `.wtv__node-content`. */
  nodeContentClass?: ((node: LTreeNode<any>) => string | null | undefined) | undefined;
}

// ─── Node reference & event/transform context types ───────────────────────
// Ported from svelte-treeview rc13. Every on* event and every clipboard/drag
// callback receives ONE context object built around the shared NodeRef shape,
// so a consumer never has to re-resolve a node's parent/siblings by hand.

/**
 * A pointer to one node plus the relational context the tree already knows about
 * it: its live `parent` node and `siblings` (the children of that parent, which
 * includes the node itself). Shared shape across the clipboard callbacks (as
 * `NodeTransformContext`'s `source`/`target`) and the on* event contexts.
 *
 * `path` is always present. `node`/`parent`/`siblings` are live when the node is
 * reachable in this tree and null/[] when it isn't (cross-tree source, or a node
 * removed by a cut).
 */
export interface NodeRef<T> {
  path: string;
  node: LTreeNode<T> | null;
  parent: LTreeNode<T> | null;
  /** Children of `parent` (includes `node` itself); top-level nodes when `parent` is null. */
  siblings: LTreeNode<T>[];
}

/**
 * Context for onNodeClick / onNodeDoubleClick. It IS a NodeRef: the clicked node
 * plus its live parent/siblings.
 */
export type NodeEventContext<T> = NodeRef<T>;

/**
 * Context for onNodeDragStart / onNodeDragOver. A NodeRef (for dragStart the node
 * that started the drag; for dragOver the node currently hovered) plus the raw
 * DragEvent and `dragged` — the FULL top-level set in flight. A drag is
 * single-origin at the DOM level, so the event fires once; `dragged` is the whole
 * multi-selection (or just the one node for a single drag) so a handler doesn't
 * have to read `controller.getHighlightedPaths()` itself.
 */
export interface NodeDragContext<T> extends NodeRef<T> {
  event: DragEvent;
  /** The full top-level set being dragged (multi-selection; a single-item array otherwise). */
  dragged: NodeRef<T>[];
}

/**
 * Context for onNodeDrop, symmetric with NodeTransformContext: `source` is the
 * dragged (lead) node with its parent/siblings, `target` is the drop node (null
 * when dropped into empty space or the tree root), `position`/`operation`
 * describe how it landed, `event` is the original DOM event.
 *
 * `dragged` is the full top-level dragged set (`source` is its lead node); a drop
 * fires once even for a multi-drag, so this is how you see the whole set.
 * `dropped` is the resulting placed nodes AFTER an auto-handled op (move: the
 * moved nodes at their new home; copy: the fresh copies) — null when the library
 * did NOT place them (a cross-tree drop, or shouldAutoHandleMove/Copy=false),
 * because then the consumer owns insertion.
 */
export interface NodeDropContext<T> {
  source: NodeRef<T>;
  target: NodeRef<T> | null;
  /** The full top-level dragged set (includes `source`). */
  dragged: NodeRef<T>[];
  /** The placed nodes after an auto-handled move/copy; null when the library didn't place them. */
  dropped: NodeRef<T>[] | null;
  position: DropPosition;
  operation: DropOperation;
  event: DragEvent | TouchEvent;
}

/**
 * Context for the set-oriented clipboard/delete events (onCopy / onCut /
 * onDelete), mirroring the BeforeCopyContext/BeforeDeleteContext shape of their
 * before* twins. `nodes` are the resolved live nodes for `paths`; for
 * onCut/onDelete they are pre-removal snapshots captured before the nodes left
 * the tree (the tree no longer holds them by the time the event fires).
 */
export interface ClipboardEventContext<T> {
  /** Present for copy/cut; omitted for delete (which has no copy/cut operation). */
  operation?: ClipboardOperation;
  paths: string[];
  nodes: LTreeNode<T>[];
}

/**
 * Context for the selection-change events (onHighlightChange = UI multi-select
 * set; onSelectionChange = checkbox set). `paths` is the new set, `nodes` its
 * resolved live nodes.
 */
export interface SelectionChangeContext<T> {
  paths: Set<string>;
  nodes: LTreeNode<T>[];
}

/**
 * Context for the onTreeKeydown interceptor. A keydown is tree-level (no single
 * anchor node), so it carries BOTH selections plus the controller for imperative
 * actions. Return `true` to suppress the default + built-in shortcut handling.
 */
export interface TreeKeydownContext<T> {
  event: KeyboardEvent;
  focusedNode: LTreeNode<T> | null;
  highlightedNodes: LTreeNode<T>[];
  controller: import('./tree-controller').TreeController<T>;
}

/**
 * Context passed to BOTH copyNodeTransformationCallback and
 * pasteNodeTransformationCallback, one per node. `phase` says which callback is
 * running; `target` is null during the copy phase (no destination chosen yet)
 * and populated during paste. `source` is the origin side — always carries the
 * path; node/parent/siblings are live when reachable (same-tree) and null/[]
 * cross-tree or once a cut source has been removed.
 *
 * Symmetric by design: the same field means the same thing in both phases. Return
 * new data to derive ids/values/names; from pasteNodeTransformationCallback
 * return null to skip a node (skipping a root skips its whole subtree). Pure —
 * reads the pristine snapshot, never mutates it.
 */
export interface NodeTransformContext<T> {
  operation: ClipboardOperation;
  /** Which callback is running: 'copy' at snapshot time, 'paste' at insert time. */
  phase: 'copy' | 'paste';
  /** True for a top-level node, false for a descendant riding along inside it. */
  isRoot: boolean;
  /** Index of the root entry within this batch (descendants share their root's index). */
  index: number;
  /** How the pasted roots land relative to `target.node` — null during the copy
   *  phase. Mirrors the DropPosition vocabulary of onNodeDrop. */
  position: DropPosition | null;
  /** The origin side. `path` is always present; node/parent/siblings are live when
   *  the source is reachable (same-tree) and null/[] cross-tree or after a cut. */
  source: NodeRef<T>;
  /** The destination side, symmetric with `source` — null during the copy phase.
   *  `node` is the node you targeted (null when pasting at the tree root); its
   *  `siblings` are the neighbours. The roots' actual landing neighbours depend on
   *  `position`: for 'before'/'after' they ARE `target.siblings`; for 'child' they
   *  are `target.node`'s children (top-level nodes = `target.siblings` at root). */
  target: NodeRef<T> | null;
}

/**
 * Context for beforeCopyCallback / beforeCutCallback — batch policy, runs before
 * the snapshot is taken. Return a new path list to rewrite the set, false to
 * block, or nothing to proceed.
 */
export interface BeforeCopyContext<T> {
  operation: ClipboardOperation;
  /** The paths about to be copied/cut (the highlight set, or the explicit paths arg). */
  paths: string[];
  /** The resolved live nodes for those paths (missing paths are dropped). */
  nodes: LTreeNode<T>[];
}

/**
 * Context for beforeDeleteCallback — batch policy before the built-in Delete
 * removes nodes. Return a narrowed path list to delete only those, false to block
 * entirely, or nothing to proceed. Mirrors BeforeCopyContext's paths/nodes shape
 * (delete has no copy/cut operation).
 */
export interface BeforeDeleteContext<T> {
  /** The top-level paths about to be deleted. */
  paths: string[];
  /** The resolved live nodes for those paths. */
  nodes: LTreeNode<T>[];
}

/**
 * Context for beforePasteCallback — batch policy run once before the insert loop.
 * Return { targetPath?, position? } to redirect, false to block, or nothing to
 * proceed.
 */
export interface BeforePasteContext<T> {
  operation: ClipboardOperation;
  /** The destination side (proposed, pre-insert): `path` ('' = root, after the
   *  leaf-aware position redirect) and the node at that path (null at root). The
   *  hook may still redirect via its return value. */
  target: {
    path: string;
    node: LTreeNode<T> | null;
  };
  /** Immutable clipboard snapshots — NOT live tree nodes (sources may be
   *  cross-tree, or removed on a cut). */
  entries: readonly ClipboardEntry<T>[];
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
  /** Opt out of the built-in Ctrl/Cmd+C/X/V + Delete + Esc shortcuts. Default true. */
  shouldHandleKeyboardShortcuts?: boolean | null | undefined;
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
  /** When true (default), pasteNodes inserts into the tree. False = forward the
   *  cleaned entries to the consumer via PasteResult.entries without mutating. */
  shouldAutoHandlePaste?: boolean;

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
  /** Fires on changes to the checkbox / data-state selection set (selectedPaths). */
  onSelectionChange?: (ctx: SelectionChangeContext<T>) => void;
  /** Fires on changes to the highlight set (Ctrl/Shift+click, arrow keys). */
  onHighlightChange?: (ctx: SelectionChangeContext<T>) => void;

  // EVENTS (on* = fire-and-forget; each takes ONE context object)
  /** Fires on a plain node click. ctx = NodeRef of the clicked node. */
  onNodeClick?: (ctx: NodeEventContext<T>) => void;
  /** Fires on a detected node double-click (manual detection, all click behaviors). */
  onNodeDoubleClick?: (ctx: NodeEventContext<T>) => void;
  /** Clipboard interceptors — return `false` to block, a `string[]` to override the paths. */
  beforeCopyCallback?: (ctx: BeforeCopyContext<T>) => string[] | false | void;
  beforeCutCallback?: (ctx: BeforeCopyContext<T>) => string[] | false | void;
  /** Batch policy — return `false` to block the paste, or `{ targetPath?, position? }` to redirect. */
  beforePasteCallback?: (
    ctx: BeforePasteContext<T>
  ) => { targetPath?: string; position?: DropPosition } | false | void;
  /** Narrow (return path[]) or block (false) the built-in Delete set. */
  beforeDeleteCallback?: (ctx: BeforeDeleteContext<T>) => string[] | false | void;
  /** Post-operation clipboard events (symmetric with the controller's clipboard methods). */
  onCopy?: (ctx: ClipboardEventContext<T>) => void;
  onCut?: (ctx: ClipboardEventContext<T>) => void;
  onPaste?: (result: PasteResult<T>) => void;
  /** Fires after the built-in Delete (or deleteNodes()); nodes are pre-removal snapshots. */
  onDelete?: (ctx: ClipboardEventContext<T>) => void;
  /** Per-node transform at snapshot time (copy/cut) — clean/redact before the shared clipboard. */
  copyNodeTransformationCallback?: (data: T, ctx: NodeTransformContext<T>) => T;
  /** Per-node transform at insert time (paste) — derive ids/values; return null to skip a node. */
  pasteNodeTransformationCallback?: (data: T, ctx: NodeTransformContext<T>) => T | null;
  onNodeDragStart?: (ctx: NodeDragContext<T>) => void;
  onNodeDragOver?: (ctx: NodeDragContext<T>) => void;
  /** Intercept — modify/block a drop. Deliberately kept 5-arg positional (asymmetric drop pair). */
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
  onNodeDrop?: (ctx: NodeDropContext<T>) => void;
  /** Interceptor — return true to suppress default + built-in shortcuts. Runs first. */
  onTreeKeydown?: (ctx: TreeKeydownContext<T>) => boolean | void;
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

  // Data-driven per-row class hooks
  nodeClass?: (node: LTreeNode<T>) => string | null | undefined;
  nodeContentClass?: (node: LTreeNode<T>) => string | null | undefined;
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
