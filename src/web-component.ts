import { WebTreeView } from './treeview';
import type { TreeViewConfig, ScrollToPathOptions } from './types';
import type { LTreeNode } from './ltree/ltree-node';
import type { DropPosition } from './ltree/ltree-node';
import type { Ltree, ContextMenuItem, ContextMenuEntry, DragDropMode, DropOperation } from './ltree/types';
import type { TreeViewRenderer, RendererConfig } from './renderer/types';
import type { RangeSelectionMode, HighlightMode, TreeMutationOptions, NodeTransformContext } from './controller/types';
import type { PasteResult } from './clipboard';
import type { TreeController } from './controller/tree-controller';
import { initLogger } from './logger';
import styles from './css/main.css?inline';

// SSR compatibility: provide stub HTMLElement if not in browser
const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

// Type declarations for build-time constants
declare const __VERSION__: string;

// Instance tracking for global API
const instances = new Set<WebTreeViewElement>();

// ── ATTRIBUTE_TABLE ───────────────────────────────────────────────────────
//
// Single source of truth for the HTML-attribute ⇄ JS-config wiring. Each
// entry declares how to read one attribute, what private field shadows it
// (JS property takes precedence over the attribute), how to parse the raw
// string, and which TreeViewConfig key to write into.
//
// `observedAttributes` derives from this list. `buildConfig()` iterates this
// list. Adding a new attribute is now one entry here — not three spots that
// drift out of sync.
//
// HTML attribute names stay in kebab-case (`show-checkboxes`, `allow-copy`,
// `accordion-expand`, etc.) — short and readable. The JS config keys follow
// the BlissFramework naming convention (`shouldShowCheckboxes`,
// `isCopyAllowed`, `isAccordionExpand`, etc.).

type AttrParse =
  | { kind: 'string'; default?: string; allowEmpty?: boolean }
  | { kind: 'number'; parser?: 'int' | 'float'; alwaysSet?: boolean }
  | { kind: 'boolean'; alwaysSet?: boolean }
  | { kind: 'enum'; values: readonly string[]; setNullOnInvalid?: boolean };

interface AttrSpec {
  attr: string;
  configKey: string;
  field?: string; // private field on the element (e.g. '_idMember')
  parse: AttrParse;
}

const ATTRIBUTE_TABLE: readonly AttrSpec[] = [
  // ── Tree identification ─────────────────────────────────────────────
  { attr: 'tree-id', configKey: 'treeId', field: '_treeId', parse: { kind: 'string' } },

  // ── Member mappings: required (with defaults) ───────────────────────
  { attr: 'id-member',            configKey: 'idMember',            field: '_idMember',            parse: { kind: 'string', default: 'id' } },
  { attr: 'path-member',          configKey: 'pathMember',          field: '_pathMember',          parse: { kind: 'string', default: 'path' } },
  { attr: 'display-value-member', configKey: 'displayValueMember',  field: '_displayValueMember',  parse: { kind: 'string', default: 'displayValue' } },

  // ── Member mappings: optional ───────────────────────────────────────
  { attr: 'parent-path-member',          configKey: 'parentPathMember',          field: '_parentPathMember',          parse: { kind: 'string' } },
  { attr: 'level-member',                configKey: 'levelMember',               field: '_levelMember',               parse: { kind: 'string' } },
  { attr: 'is-expanded-member',          configKey: 'isExpandedMember',          field: '_isExpandedMember',          parse: { kind: 'string' } },
  { attr: 'is-selected-member',          configKey: 'isSelectedMember',          field: '_isSelectedMember',          parse: { kind: 'string' } },
  { attr: 'is-draggable-member',         configKey: 'isDraggableMember',         field: '_isDraggableMember',         parse: { kind: 'string' } },
  { attr: 'is-drop-allowed-member',      configKey: 'isDropAllowedMember',       field: '_isDropAllowedMember',       parse: { kind: 'string' } },
  { attr: 'has-children-member',         configKey: 'hasChildrenMember',         field: '_hasChildrenMember',         parse: { kind: 'string' } },
  { attr: 'search-value-member',         configKey: 'searchValueMember',         field: '_searchValueMember',         parse: { kind: 'string' } },
  { attr: 'is-selectable-member',        configKey: 'isSelectableMember',        field: '_isSelectableMember',        parse: { kind: 'string' } },
  { attr: 'is-collapsible-member',       configKey: 'isCollapsibleMember',       field: '_isCollapsibleMember',       parse: { kind: 'string' } },
  { attr: 'order-member',                configKey: 'orderMember',               field: '_orderMember',               parse: { kind: 'string' } },
  { attr: 'allowed-drop-positions-member', configKey: 'allowedDropPositionsMember', field: '_allowedDropPositionsMember', parse: { kind: 'string' } },
  { attr: 'icon-member',                 configKey: 'iconMember',                field: '_iconMember',                parse: { kind: 'string' } },

  // ── Behavior ────────────────────────────────────────────────────────
  { attr: 'expand-level',         configKey: 'expandLevel',        field: '_expandLevel',  parse: { kind: 'number', parser: 'int' } },
  { attr: 'tree-path-separator',  configKey: 'treePathSeparator',                          parse: { kind: 'string', allowEmpty: true } },
  { attr: 'click-behavior',       configKey: 'clickBehavior',      field: '_clickBehavior', parse: { kind: 'enum', values: ['select', 'expand', 'expand-and-focus'] } },
  { attr: 'accordion-expand',     configKey: 'isAccordionExpand',                          parse: { kind: 'boolean' } },
  { attr: 'is-sorted',            configKey: 'isSorted',           field: '_isSorted',     parse: { kind: 'boolean' } },

  // ── Search / indexer ───────────────────────────────────────────────
  { attr: 'should-use-internal-search-index', configKey: 'shouldUseInternalSearchIndex', field: '_shouldUseInternalSearchIndex', parse: { kind: 'boolean' } },
  { attr: 'indexer-batch-size',   configKey: 'indexerBatchSize',  field: '_indexerBatchSize', parse: { kind: 'number', parser: 'int' } },
  { attr: 'indexer-timeout',      configKey: 'indexerTimeout',    field: '_indexerTimeout',   parse: { kind: 'number', parser: 'int' } },
  { attr: 'search-text',          configKey: 'searchText',                                    parse: { kind: 'string', allowEmpty: true } },

  // ── Theme / visual classes ─────────────────────────────────────────
  { attr: 'theme',                configKey: 'theme',                                       parse: { kind: 'enum', values: ['dark', 'light'], setNullOnInvalid: true } },
  { attr: 'body-class',           configKey: 'bodyClass',                                   parse: { kind: 'string' } },
  { attr: 'highlighted-node-class', configKey: 'highlightedNodeClass',                      parse: { kind: 'string' } },
  { attr: 'focused-node-class',   configKey: 'focusedNodeClass',                            parse: { kind: 'string' } },
  { attr: 'drag-over-node-class', configKey: 'dragOverNodeClass',                           parse: { kind: 'string' } },
  { attr: 'expand-icon-class',    configKey: 'expandIconClass',                             parse: { kind: 'string' } },
  { attr: 'collapse-icon-class',  configKey: 'collapseIconClass',                           parse: { kind: 'string' } },
  { attr: 'leaf-icon-class',      configKey: 'leafIconClass',                               parse: { kind: 'string' } },
  { attr: 'toggle-icon-mode',     configKey: 'toggleIconMode',     field: '_toggleIconMode', parse: { kind: 'enum', values: ['rotate', 'swap'] } },
  { attr: 'scroll-highlight-class', configKey: 'scrollHighlightClass',                       parse: { kind: 'string' } },
  { attr: 'scroll-highlight-timeout', configKey: 'scrollHighlightTimeout',                   parse: { kind: 'number', parser: 'int', alwaysSet: true } },

  // ── Per-node icons ─────────────────────────────────────────────────
  { attr: 'align-node-icons',     configKey: 'shouldAlignNodeIcons', field: '_shouldAlignNodeIcons', parse: { kind: 'boolean' } },

  // ── Context menu ───────────────────────────────────────────────────
  { attr: 'context-menu-x-offset', configKey: 'contextMenuXOffset', field: '_contextMenuXOffset', parse: { kind: 'number', parser: 'int' } },
  { attr: 'context-menu-y-offset', configKey: 'contextMenuYOffset', field: '_contextMenuYOffset', parse: { kind: 'number', parser: 'int' } },

  // ── Debug / Loading ─────────────────────────────────────────────────
  { attr: 'should-display-debug-information', configKey: 'shouldDisplayDebugInformation', field: '_shouldDisplayDebugInformation', parse: { kind: 'boolean' } },
  { attr: 'is-loading',           configKey: 'isLoading',          field: '_isLoading',    parse: { kind: 'boolean' } },

  // ── Drag and drop ──────────────────────────────────────────────────
  { attr: 'drag-drop-mode',       configKey: 'dragDropMode',       field: '_dragDropMode',  parse: { kind: 'string' } },
  { attr: 'drop-zone-mode',       configKey: 'dropZoneMode',       field: '_dropZoneMode',  parse: { kind: 'enum', values: ['floating', 'glow'] } },
  { attr: 'drop-zone-layout',     configKey: 'dropZoneLayout',     field: '_dropZoneLayout', parse: { kind: 'enum', values: ['around', 'above', 'below', 'wave', 'wave2'] } },
  { attr: 'drop-zone-start',      configKey: 'dropZoneStart',      field: '_dropZoneStart',  parse: { kind: 'number', parser: 'int' } },
  { attr: 'drop-zone-max-width',  configKey: 'dropZoneMaxWidth',   field: '_dropZoneMaxWidth', parse: { kind: 'number', parser: 'int' } },
  { attr: 'allow-copy',           configKey: 'isCopyAllowed',      field: '_isCopyAllowed',  parse: { kind: 'boolean' } },
  { attr: 'auto-handle-copy',     configKey: 'shouldAutoHandleCopy', field: '_shouldAutoHandleCopy', parse: { kind: 'boolean' } },
  { attr: 'auto-handle-paste',    configKey: 'shouldAutoHandlePaste', field: '_shouldAutoHandlePaste', parse: { kind: 'boolean' } },
  { attr: 'handle-keyboard-shortcuts', configKey: 'shouldHandleKeyboardShortcuts', field: '_shouldHandleKeyboardShortcuts', parse: { kind: 'boolean' } },

  // ── Rendering ──────────────────────────────────────────────────────
  { attr: 'no-data-text',         configKey: 'noDataText',          field: '_noDataText',      parse: { kind: 'string' } },
  { attr: 'show-drop-placeholder-when-empty', configKey: 'shouldShowDropPlaceholderWhenEmpty', field: '_shouldShowDropPlaceholderWhenEmpty', parse: { kind: 'boolean' } },
  { attr: 'use-flat-rendering',   configKey: 'isFlatRenderingEnabled',                       parse: { kind: 'boolean' } },
  { attr: 'flat-indent-size',     configKey: 'flatIndentSize',                               parse: { kind: 'string' } },
  { attr: 'progressive-render',   configKey: 'isProgressiveRender',                          parse: { kind: 'boolean' } },
  { attr: 'initial-batch-size',   configKey: 'initialBatchSize',                             parse: { kind: 'number', parser: 'int', alwaysSet: true } },
  { attr: 'max-batch-size',       configKey: 'maxBatchSize',                                 parse: { kind: 'number', parser: 'int', alwaysSet: true } },

  // ── Virtual scroll ─────────────────────────────────────────────────
  { attr: 'virtual-scroll',       configKey: 'isVirtualScrollEnabled', field: '_isVirtualScrollEnabled', parse: { kind: 'boolean' } },
  { attr: 'virtual-row-height',   configKey: 'virtualRowHeight',    field: '_virtualRowHeight',  parse: { kind: 'number', parser: 'float' } },
  { attr: 'virtual-overscan',     configKey: 'virtualOverscan',     field: '_virtualOverscan',   parse: { kind: 'number', parser: 'int' } },
  { attr: 'virtual-container-height', configKey: 'virtualContainerHeight', field: '_virtualContainerHeight', parse: { kind: 'string' } },

  // ── Selection model ────────────────────────────────────────────────
  { attr: 'range-selection-mode', configKey: 'rangeSelectionMode', field: '_rangeSelectionMode', parse: { kind: 'enum', values: ['visual', 'logical'] } },
  { attr: 'selection-mode',       configKey: 'selectionMode',                                  parse: { kind: 'enum', values: ['single', 'multi'] } },
  { attr: 'show-checkboxes',      configKey: 'shouldShowCheckboxes',                           parse: { kind: 'boolean', alwaysSet: true } },
  { attr: 'checkbox-mode',        configKey: 'checkboxMode',                                   parse: { kind: 'enum', values: ['independent', 'cascade'] } },
  { attr: 'click-toggles-checkbox', configKey: 'shouldClickToggleCheckbox',                    parse: { kind: 'boolean' } },
];

// JS-only callback fields that don't have an HTML attribute counterpart.
// buildConfig() copies each one to the matching config key when set.
const JS_CALLBACK_FIELDS: readonly { field: string; configKey: string }[] = [
  { field: '_iconCallback',                 configKey: 'iconCallback' },
  { field: '_nodeClass',                    configKey: 'nodeClass' },
  { field: '_nodeContentClass',             configKey: 'nodeContentClass' },
  { field: '_onNodeDoubleClick',            configKey: 'onNodeDoubleClick' },
  { field: '_beforeCopyCallback',           configKey: 'beforeCopyCallback' },
  { field: '_beforeCutCallback',            configKey: 'beforeCutCallback' },
  { field: '_beforePasteCallback',          configKey: 'beforePasteCallback' },
  { field: '_beforeDeleteCallback',         configKey: 'beforeDeleteCallback' },
  { field: '_copyNodeTransformationCallback', configKey: 'copyNodeTransformationCallback' },
  { field: '_pasteNodeTransformationCallback', configKey: 'pasteNodeTransformationCallback' },
  { field: '_onCopy',                       configKey: 'onCopy' },
  { field: '_onCut',                        configKey: 'onCut' },
  { field: '_onPaste',                      configKey: 'onPaste' },
  { field: '_onDelete',                     configKey: 'onDelete' },
  { field: '_onTreeKeydown',                configKey: 'onTreeKeydown' },
  { field: '_getDisplayValueCallback',      configKey: 'getDisplayValueCallback' },
  { field: '_getSearchValueCallback',       configKey: 'getSearchValueCallback' },
  { field: '_getIsDraggableCallback',       configKey: 'getIsDraggableCallback' },
  { field: '_getIsCollapsibleCallback',     configKey: 'getIsCollapsibleCallback' },
  { field: '_getAllowedDropPositionsCallback', configKey: 'getAllowedDropPositionsCallback' },
  { field: '_sortCallback',                 configKey: 'sortCallback' },
  { field: '_contextMenuCallback',          configKey: 'contextMenuCallback' },
  { field: '_indexingCompleteCallback',     configKey: 'indexingCompleteCallback' },
  { field: '_renderNodeCallback',           configKey: 'renderNodeCallback' },
  { field: '_renderEmptyStateCallback',     configKey: 'renderEmptyStateCallback' },
  { field: '_renderEmptyZoneCallback',      configKey: 'renderEmptyZoneCallback' },
  { field: '_renderLoadingCallback',        configKey: 'renderLoadingCallback' },
  { field: '_renderHeaderCallback',         configKey: 'renderHeaderCallback' },
  { field: '_renderFooterCallback',         configKey: 'renderFooterCallback' },
  { field: '_renderContextMenuCallback',    configKey: 'renderContextMenuCallback' },
  { field: '_renderContextMenuItemCallback', configKey: 'renderContextMenuItemCallback' },
  { field: '_onSelectionChange',            configKey: 'onSelectionChange' },
  { field: '_onHighlightChange',            configKey: 'onHighlightChange' },
  { field: '_onNodeClick',                  configKey: 'onNodeClick' },
  { field: '_onNodeDragStart',              configKey: 'onNodeDragStart' },
  { field: '_onNodeDragOver',               configKey: 'onNodeDragOver' },
  { field: '_beforeDropCallback',           configKey: 'beforeDropCallback' },
  { field: '_onNodeDrop',                   configKey: 'onNodeDrop' },
  { field: '_renderStartCallback',          configKey: 'renderStartCallback' },
  { field: '_renderProgressCallback',       configKey: 'renderProgressCallback' },
  { field: '_renderCompleteCallback',       configKey: 'renderCompleteCallback' },
  // JS-only flag (no attribute) — set via property setter.
  { field: '_shouldDisplayContextMenuInDebugMode', configKey: 'shouldDisplayContextMenuInDebugMode' },
];

function readAttrValue(
  el: HTMLElement,
  spec: AttrSpec
): { assigned: boolean; value: unknown } {
  const fieldVal = spec.field ? (el as any)[spec.field] : undefined;
  const attrVal = el.getAttribute(spec.attr);

  switch (spec.parse.kind) {
    case 'string': {
      const v = fieldVal ?? attrVal ?? spec.parse.default;
      if (v == null) return { assigned: false, value: undefined };
      if (!spec.parse.allowEmpty && v === '') return { assigned: false, value: undefined };
      return { assigned: true, value: v };
    }
    case 'number': {
      const parseFn = spec.parse.parser === 'float' ? parseFloat : (s: string) => parseInt(s, 10);
      const num = fieldVal ?? (attrVal !== null ? parseFn(attrVal) : undefined);
      if (num === undefined || Number.isNaN(num)) {
        return spec.parse.alwaysSet && attrVal !== null
          ? { assigned: true, value: NaN }
          : { assigned: false, value: undefined };
      }
      return { assigned: true, value: num };
    }
    case 'boolean': {
      if (spec.parse.alwaysSet) {
        return { assigned: true, value: attrVal !== null && attrVal !== 'false' };
      }
      if (fieldVal !== undefined) return { assigned: true, value: fieldVal };
      if (attrVal !== null) return { assigned: true, value: attrVal !== 'false' };
      return { assigned: false, value: undefined };
    }
    case 'enum': {
      const v = fieldVal ?? attrVal;
      if (typeof v === 'string' && spec.parse.values.includes(v)) {
        return { assigned: true, value: v };
      }
      if (spec.parse.setNullOnInvalid) return { assigned: true, value: null };
      return { assigned: false, value: undefined };
    }
  }
}

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
  private _clickBehavior?: import('./controller/types').ClickBehavior;
  private _isSorted?: boolean;
  private _isLoading?: boolean;
  private _shouldDisplayDebugInformation?: boolean;
  private _shouldDisplayContextMenuInDebugMode?: boolean;

  // Search/indexer config
  private _shouldUseInternalSearchIndex?: boolean;
  private _indexerBatchSize?: number;
  private _indexerTimeout?: number;

  // Virtual scroll
  private _isVirtualScrollEnabled?: boolean;
  private _virtualRowHeight?: number;
  private _virtualOverscan?: number;
  private _virtualContainerHeight?: string;

  // Visual config
  private _toggleIconMode?: 'rotate' | 'swap';

  // Per-node icons
  private _iconMember?: string;
  private _iconCallback?: (node: LTreeNode<T>) => string | null;
  private _shouldAlignNodeIcons?: boolean;

  // DnD config
  private _dragDropMode?: DragDropMode;
  private _dropZoneMode?: 'floating' | 'glow';
  private _dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
  private _dropZoneStart?: number | string;
  private _dropZoneMaxWidth?: number;
  private _isCopyAllowed?: boolean;
  private _shouldAutoHandleCopy?: boolean;
  private _shouldAutoHandlePaste?: boolean;
  private _shouldHandleKeyboardShortcuts?: boolean;
  private _noDataText?: string;
  private _shouldShowDropPlaceholderWhenEmpty?: boolean;
  private _contextMenuXOffset?: number;
  private _contextMenuYOffset?: number;

  // Multi-select
  private _rangeSelectionMode?: RangeSelectionMode;
  private _onSelectionChange?: TreeViewConfig<T>['onSelectionChange'];
  private _onHighlightChange?: TreeViewConfig<T>['onHighlightChange'];

  // Callback properties
  private _getDisplayValueCallback?: (node: LTreeNode<T>) => string;
  private _getSearchValueCallback?: (node: LTreeNode<T>) => string;
  private _getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
  private _getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
  private _getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
  private _sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
  private _contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuEntry[];
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

  // Data-driven per-row class hooks
  private _nodeClass?: (node: LTreeNode<T>) => string | null | undefined;
  private _nodeContentClass?: (node: LTreeNode<T>) => string | null | undefined;

  // Event callbacks (ctx-object signatures — rc07 parity)
  private _onNodeClick?: TreeViewConfig<T>['onNodeClick'];
  private _onNodeDoubleClick?: TreeViewConfig<T>['onNodeDoubleClick'];
  private _beforeCopyCallback?: TreeViewConfig<T>['beforeCopyCallback'];
  private _beforeCutCallback?: TreeViewConfig<T>['beforeCutCallback'];
  private _beforePasteCallback?: TreeViewConfig<T>['beforePasteCallback'];
  private _beforeDeleteCallback?: TreeViewConfig<T>['beforeDeleteCallback'];
  private _copyNodeTransformationCallback?: TreeViewConfig<T>['copyNodeTransformationCallback'];
  private _pasteNodeTransformationCallback?: TreeViewConfig<T>['pasteNodeTransformationCallback'];
  private _onCopy?: TreeViewConfig<T>['onCopy'];
  private _onCut?: TreeViewConfig<T>['onCut'];
  private _onPaste?: TreeViewConfig<T>['onPaste'];
  private _onDelete?: TreeViewConfig<T>['onDelete'];
  private _onNodeDragStart?: TreeViewConfig<T>['onNodeDragStart'];
  private _onNodeDragOver?: TreeViewConfig<T>['onNodeDragOver'];
  private _beforeDropCallback?: TreeViewConfig<T>['beforeDropCallback'];
  private _onNodeDrop?: TreeViewConfig<T>['onNodeDrop'];
  private _onTreeKeydown?: TreeViewConfig<T>['onTreeKeydown'];

  // Render callbacks
  private _renderStartCallback?: () => void;
  private _renderProgressCallback?: (stats: any) => void;
  private _renderCompleteCallback?: (stats: any) => void;

  static get observedAttributes() {
    return ATTRIBUTE_TABLE.map((spec) => spec.attr);
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

  get clickBehavior(): import('./controller/types').ClickBehavior | undefined { return this._clickBehavior; }
  set clickBehavior(value: import('./controller/types').ClickBehavior | undefined) { this._clickBehavior = value; this._scheduleUpdate(); }

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

  get shouldAlignNodeIcons(): boolean | undefined { return this._shouldAlignNodeIcons; }
  set shouldAlignNodeIcons(value: boolean | undefined) { this._shouldAlignNodeIcons = value; this._scheduleUpdate(); }

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

  get isCopyAllowed(): boolean | undefined { return this._isCopyAllowed; }
  set isCopyAllowed(value: boolean | undefined) { this._isCopyAllowed = value; this._scheduleUpdate(); }

  get shouldAutoHandleCopy(): boolean | undefined { return this._shouldAutoHandleCopy; }
  set shouldAutoHandleCopy(value: boolean | undefined) { this._shouldAutoHandleCopy = value; this._scheduleUpdate(); }

  get shouldAutoHandlePaste(): boolean | undefined { return this._shouldAutoHandlePaste; }
  set shouldAutoHandlePaste(value: boolean | undefined) { this._shouldAutoHandlePaste = value; this._scheduleUpdate(); }

  get shouldHandleKeyboardShortcuts(): boolean | undefined { return this._shouldHandleKeyboardShortcuts; }
  set shouldHandleKeyboardShortcuts(value: boolean | undefined) { this._shouldHandleKeyboardShortcuts = value; this._scheduleUpdate(); }

  get noDataText(): string | undefined { return this._noDataText; }
  set noDataText(value: string | undefined) { this._noDataText = value; this._scheduleUpdate(); }

  get shouldShowDropPlaceholderWhenEmpty(): boolean | undefined { return this._shouldShowDropPlaceholderWhenEmpty; }
  set shouldShowDropPlaceholderWhenEmpty(value: boolean | undefined) { this._shouldShowDropPlaceholderWhenEmpty = value; this._scheduleUpdate(); }

  get contextMenuXOffset(): number | undefined { return this._contextMenuXOffset; }
  set contextMenuXOffset(value: number | undefined) { this._contextMenuXOffset = value; this._scheduleUpdate(); }

  get contextMenuYOffset(): number | undefined { return this._contextMenuYOffset; }
  set contextMenuYOffset(value: number | undefined) { this._contextMenuYOffset = value; this._scheduleUpdate(); }

  // Multi-select properties
  get rangeSelectionMode(): RangeSelectionMode | undefined { return this._rangeSelectionMode; }
  set rangeSelectionMode(value: RangeSelectionMode | undefined) { this._rangeSelectionMode = value; this._scheduleUpdate(); }

  get onSelectionChange(): TreeViewConfig<T>['onSelectionChange'] { return this._onSelectionChange; }
  set onSelectionChange(value: TreeViewConfig<T>['onSelectionChange']) {
    this._onSelectionChange = value;
    this._scheduleUpdate();
  }

  get onHighlightChange(): TreeViewConfig<T>['onHighlightChange'] { return this._onHighlightChange; }
  set onHighlightChange(value: TreeViewConfig<T>['onHighlightChange']) {
    this._onHighlightChange = value;
    this._scheduleUpdate();
  }

  // Virtual scroll properties
  get isVirtualScrollEnabled(): boolean | undefined { return this._isVirtualScrollEnabled; }
  set isVirtualScrollEnabled(value: boolean | undefined) { this._isVirtualScrollEnabled = value; this._scheduleUpdate(); }

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
  set contextMenuCallback(value: ((node: LTreeNode<T>, close: () => void) => ContextMenuEntry[]) | undefined) {
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
  get renderStartCallback() { return this._renderStartCallback; }
  set renderStartCallback(value: (() => void) | undefined) { this._renderStartCallback = value; }

  get renderProgressCallback() { return this._renderProgressCallback; }
  set renderProgressCallback(value: ((stats: any) => void) | undefined) { this._renderProgressCallback = value; }

  get renderCompleteCallback() { return this._renderCompleteCallback; }
  set renderCompleteCallback(value: ((stats: any) => void) | undefined) { this._renderCompleteCallback = value; }

  // Data-driven per-row class hooks
  get nodeClass() { return this._nodeClass; }
  set nodeClass(value: ((node: LTreeNode<T>) => string | null | undefined) | undefined) {
    this._nodeClass = value;
    this._scheduleUpdate();
  }

  get nodeContentClass() { return this._nodeContentClass; }
  set nodeContentClass(value: ((node: LTreeNode<T>) => string | null | undefined) | undefined) {
    this._nodeContentClass = value;
    this._scheduleUpdate();
  }

  // Event callbacks (ctx-object signatures — rc07 parity)
  get onNodeClick() { return this._onNodeClick; }
  set onNodeClick(value: TreeViewConfig<T>['onNodeClick']) {
    this._onNodeClick = value;
  }

  get onNodeDoubleClick() { return this._onNodeDoubleClick; }
  set onNodeDoubleClick(value: TreeViewConfig<T>['onNodeDoubleClick']) {
    this._onNodeDoubleClick = value;
  }

  get beforeCopyCallback() { return this._beforeCopyCallback; }
  set beforeCopyCallback(value: TreeViewConfig<T>['beforeCopyCallback']) {
    this._beforeCopyCallback = value;
  }

  get beforeCutCallback() { return this._beforeCutCallback; }
  set beforeCutCallback(value: TreeViewConfig<T>['beforeCutCallback']) {
    this._beforeCutCallback = value;
  }

  get beforePasteCallback() { return this._beforePasteCallback; }
  set beforePasteCallback(value: TreeViewConfig<T>['beforePasteCallback']) {
    this._beforePasteCallback = value;
  }

  get beforeDeleteCallback() { return this._beforeDeleteCallback; }
  set beforeDeleteCallback(value: TreeViewConfig<T>['beforeDeleteCallback']) {
    this._beforeDeleteCallback = value;
  }

  get copyNodeTransformationCallback() { return this._copyNodeTransformationCallback; }
  set copyNodeTransformationCallback(value: TreeViewConfig<T>['copyNodeTransformationCallback']) {
    this._copyNodeTransformationCallback = value;
  }

  get pasteNodeTransformationCallback() { return this._pasteNodeTransformationCallback; }
  set pasteNodeTransformationCallback(value: TreeViewConfig<T>['pasteNodeTransformationCallback']) {
    this._pasteNodeTransformationCallback = value;
  }

  get onCopy() { return this._onCopy; }
  set onCopy(value: TreeViewConfig<T>['onCopy']) {
    this._onCopy = value;
  }

  get onCut() { return this._onCut; }
  set onCut(value: TreeViewConfig<T>['onCut']) {
    this._onCut = value;
  }

  get onPaste() { return this._onPaste; }
  set onPaste(value: TreeViewConfig<T>['onPaste']) {
    this._onPaste = value;
  }

  get onDelete() { return this._onDelete; }
  set onDelete(value: TreeViewConfig<T>['onDelete']) {
    this._onDelete = value;
  }

  get onNodeDragStart() { return this._onNodeDragStart; }
  set onNodeDragStart(value: TreeViewConfig<T>['onNodeDragStart']) {
    this._onNodeDragStart = value;
  }

  get onNodeDragOver() { return this._onNodeDragOver; }
  set onNodeDragOver(value: TreeViewConfig<T>['onNodeDragOver']) {
    this._onNodeDragOver = value;
  }

  get beforeDropCallback() { return this._beforeDropCallback; }
  set beforeDropCallback(value: TreeViewConfig<T>['beforeDropCallback'] | undefined) {
    this._beforeDropCallback = value;
  }

  get onNodeDrop() { return this._onNodeDrop; }
  set onNodeDrop(value: TreeViewConfig<T>['onNodeDrop']) {
    this._onNodeDrop = value;
  }

  get onTreeKeydown() { return this._onTreeKeydown; }
  set onTreeKeydown(value: TreeViewConfig<T>['onTreeKeydown']) {
    this._onTreeKeydown = value;
  }

  // ── Public methods (proxy to engine) ───────────────────────────────

  expandAll(
    nodePath?: string | string[] | null,
    options?: { exclusive?: boolean; noEmit?: boolean }
  ): void {
    this.treeview?.expandAll(nodePath, options);
  }

  collapseAll(
    nodePath?: string | string[] | null,
    options?: { noEmit?: boolean }
  ): void {
    this.treeview?.collapseAll(nodePath, options);
  }

  expandNodes(
    nodePath: string | string[],
    options?: { exclusive?: boolean; noEmit?: boolean }
  ): void {
    this.treeview?.expandNodes(nodePath, options);
  }

  collapseNodes(
    nodePath: string | string[],
    options?: { noEmit?: boolean }
  ): void {
    this.treeview?.collapseNodes(nodePath, options);
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
    position?: 'before' | 'after'
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

  // ── Bulk operations ───────────────────────────────────────────────

  insertBranch(parentPath: string, data: T[]): { success: boolean; count: number; error?: string } {
    return this.treeview?.insertBranch(parentPath, data) ?? { success: false, count: 0, error: 'Not initialized' };
  }

  replaceBranch(parentPath: string, data: T[]): { success: boolean; removed: number; added: number; error?: string } {
    return this.treeview?.replaceBranch(parentPath, data) ?? { success: false, removed: 0, added: 0, error: 'Not initialized' };
  }

  deleteBranch(path: string, keepParent?: boolean): { success: boolean; count: number; error?: string } {
    return this.treeview?.deleteBranch(path, keepParent) ?? { success: false, count: 0, error: 'Not initialized' };
  }

  // ── Highlight (focus + multi-select) ──────────────────────────────

  highlightNode(
    path: string,
    mode: HighlightMode = 'replace',
    options?: TreeMutationOptions
  ): void {
    this.treeview?.highlightNode(path, mode, options);
  }

  highlightNodes(paths: string[], options?: TreeMutationOptions): void {
    this.treeview?.highlightNodes(paths, options);
  }

  setHighlightedPaths(paths: string[], options?: TreeMutationOptions): void {
    this.treeview?.setHighlightedPaths(paths, options);
  }

  highlightAll(options?: TreeMutationOptions): void {
    this.treeview?.highlightAll(options);
  }

  clearHighlight(paths?: string[], options?: TreeMutationOptions): void {
    this.treeview?.clearHighlight(paths, options);
  }

  getHighlightedNodes(): LTreeNode<T>[] {
    return this.treeview?.getHighlightedNodes() ?? [];
  }

  getHighlightedPaths(): Set<string> {
    return this.treeview?.getHighlightedPaths() ?? new Set();
  }

  isNodeHighlighted(path: string): boolean {
    return this.treeview?.isNodeHighlighted(path) ?? false;
  }

  // ── Selection (checkbox data state) ──────────────────────────────

  selectNode(path: string, options?: TreeMutationOptions): void {
    this.treeview?.selectNode(path, options);
  }

  selectNodes(paths: string[], options?: TreeMutationOptions): void {
    this.treeview?.selectNodes(paths, options);
  }

  setSelectedPaths(paths: string[], options?: TreeMutationOptions): void {
    this.treeview?.setSelectedPaths(paths, options);
  }

  selectAll(options?: TreeMutationOptions): void {
    this.treeview?.selectAll(options);
  }

  deselectNode(path: string, options?: TreeMutationOptions): void {
    this.treeview?.deselectNode(path, options);
  }

  clearSelection(paths?: string[], options?: TreeMutationOptions): void {
    this.treeview?.clearSelection(paths, options);
  }

  getSelectedNodes(): LTreeNode<T>[] {
    return this.treeview?.getSelectedNodes() ?? [];
  }

  getSelectedPaths(): Set<string> {
    return this.treeview?.getSelectedPaths() ?? new Set();
  }

  isNodeSelected(path: string): boolean {
    return this.treeview?.isNodeSelected(path) ?? false;
  }

  // ── Focus (single cursor) ────────────────────────────────────────

  focusNode(path: string, options?: TreeMutationOptions): void {
    this.treeview?.focusNode(path, options);
  }

  clearFocus(options?: TreeMutationOptions): void {
    this.treeview?.clearFocus(options);
  }

  // ── Expand toggle (honors isAccordionExpand) ────────────────────────

  toggleNodeExpanded(path: string): void {
    this.treeview?.toggleNodeExpanded(path);
  }

  // ── Insert diagnostics ────────────────────────────────────────────

  /** Result of the most recent insertArray (successful / failed / failedDetails). */
  getInsertResult() {
    return this.treeview?.getInsertResult();
  }

  // ── Navigation ────────────────────────────────────────────────────

  navTo(path: string): void { this.treeview?.navTo(path); }
  navNext(): void { this.treeview?.navNext(); }
  navPrev(): void { this.treeview?.navPrev(); }
  navNextSibling(): void { this.treeview?.navNextSibling(); }
  navPrevSibling(): void { this.treeview?.navPrevSibling(); }
  navInto(): void { this.treeview?.navInto(); }
  navOut(): void { this.treeview?.navOut(); }
  navBackOut(): void { this.treeview?.navBackOut(); }
  navToggle(): void { this.treeview?.navToggle(); }
  navFirst(): void { this.treeview?.navFirst(); }
  navLast(): void { this.treeview?.navLast(); }

  // ── Clipboard ─────────────────────────────────────────────────────

  copyNodes(paths?: string[]): void {
    this.treeview?.copyNodes(paths);
  }

  cutNodes(paths?: string[]): void {
    this.treeview?.cutNodes(paths);
  }

  pasteNodes(
    targetPath: string,
    transformData?: ((data: T, ctx: NodeTransformContext<T>) => T | null) | null,
    position?: DropPosition
  ): PasteResult<T> {
    return this.treeview?.pasteNodes(targetPath, transformData, position) ?? { success: false, count: 0, skipped: 0, error: 'Not initialized' };
  }

  cancelCut(): void {
    this.treeview?.cancelCut();
  }

  deleteNodes(paths?: string[]): { removed: number; blocked: number } {
    return this.treeview?.deleteNodes(paths) ?? { removed: 0, blocked: 0 };
  }

  hasClipboardContent(): boolean {
    return this.treeview?.hasClipboardContent() ?? false;
  }

  getClipboardOperation(): 'copy' | 'cut' | null {
    return this.treeview?.getClipboardOperation() ?? null;
  }

  // ── Private methods ────────────────────────────────────────────────

  private render(): void {
    this.containerElement = document.createElement('div');
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

    // Every on* callback is wrapped so it ALSO dispatches a DOM CustomEvent whose
    // `detail` IS the ctx object the callback received (rc07 ctx-object parity).

    const userOnNodeClick = config.onNodeClick;
    config.onNodeClick = (ctx) => {
      userOnNodeClick?.(ctx);
      this.dispatchEvent(new CustomEvent('node-clicked', { bubbles: true, composed: true, detail: ctx }));
    };

    const userOnNodeDoubleClick = config.onNodeDoubleClick;
    config.onNodeDoubleClick = (ctx) => {
      userOnNodeDoubleClick?.(ctx);
      this.dispatchEvent(new CustomEvent('node-double-click', { bubbles: true, composed: true, detail: ctx }));
    };

    // Clipboard / delete events
    const userOnCopy = config.onCopy;
    config.onCopy = (ctx) => {
      userOnCopy?.(ctx);
      this.dispatchEvent(new CustomEvent('copy', { bubbles: true, composed: true, detail: ctx }));
    };

    const userOnCut = config.onCut;
    config.onCut = (ctx) => {
      userOnCut?.(ctx);
      this.dispatchEvent(new CustomEvent('cut', { bubbles: true, composed: true, detail: ctx }));
    };

    const userOnPaste = config.onPaste;
    config.onPaste = (result) => {
      userOnPaste?.(result);
      this.dispatchEvent(new CustomEvent('paste', { bubbles: true, composed: true, detail: { result } }));
    };

    const userOnDelete = config.onDelete;
    config.onDelete = (ctx) => {
      userOnDelete?.(ctx);
      this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true, detail: ctx }));
    };

    // Drag / drop events
    const userOnNodeDragStart = config.onNodeDragStart;
    config.onNodeDragStart = (ctx) => {
      userOnNodeDragStart?.(ctx);
      this.dispatchEvent(new CustomEvent('node-drag-start', { bubbles: true, composed: true, detail: ctx }));
    };

    const userOnNodeDragOver = config.onNodeDragOver;
    config.onNodeDragOver = (ctx) => {
      userOnNodeDragOver?.(ctx);
      this.dispatchEvent(new CustomEvent('node-drag-over', { bubbles: true, composed: true, detail: ctx }));
    };

    const userOnNodeDrop = config.onNodeDrop;
    config.onNodeDrop = (ctx) => {
      userOnNodeDrop?.(ctx);
      this.dispatchEvent(new CustomEvent('node-drop', { bubbles: true, composed: true, detail: ctx }));
    };

    // Wire highlight-change / selection-change through the controller's
    // callbacks (not state-change snapshot diff), so the `silent: true`
    // option on highlightNode / clearHighlight / clearSelection suppresses the
    // DOM event the same way it suppresses the user callback.
    const userOnHighlightChange = config.onHighlightChange;
    config.onHighlightChange = (ctx) => {
      userOnHighlightChange?.(ctx);
      this.dispatchEvent(new CustomEvent('highlight-change', { bubbles: true, composed: true, detail: ctx }));
    };

    const userOnSelectionChange = config.onSelectionChange;
    config.onSelectionChange = (ctx) => {
      userOnSelectionChange?.(ctx);
      this.dispatchEvent(new CustomEvent('selection-change', { bubbles: true, composed: true, detail: ctx }));
    };

    this.treeview = new WebTreeView<T>(this.containerElement, config, this._renderer);

    const ctrl = this.treeview.getController();

    // State-change still drives the bulk `tree-changed` event and the
    // `focused-node-changed` event (which has no silent option yet).
    let prevFocusedPath: string | null = null;
    ctrl.on('state-change', (snapshot) => {
      this.dispatchEvent(new CustomEvent('tree-changed', {
        bubbles: true,
        composed: true
      }));

      const currentPath = snapshot.focusedNode?.path ?? null;
      if (currentPath !== prevFocusedPath) {
        prevFocusedPath = currentPath;
        this.dispatchEvent(new CustomEvent('focused-node-changed', {
          bubbles: true,
          composed: true,
          detail: { focusedNode: snapshot.focusedNode ?? null }
        }));
      }
    });
  }

  private buildConfig(): Partial<TreeViewConfig<T>> {
    const config: Record<string, unknown> = {};

    // `data` is a JS-only property (too large for an HTML attribute).
    if (this._data) config.data = this._data;

    // Walk ATTRIBUTE_TABLE — the single source of truth for the
    // HTML-attribute ⇄ JS-config wiring. Each entry encodes the parser,
    // the private-field shadow, and the target config key.
    for (const spec of ATTRIBUTE_TABLE) {
      const { assigned, value } = readAttrValue(this, spec);
      if (assigned) config[spec.configKey] = value;
    }

    // JS-only callback fields with no HTML attribute. Just copy each set
    // field onto the matching config key.
    for (const { field, configKey } of JS_CALLBACK_FIELDS) {
      const v = (this as any)[field];
      if (v !== undefined) config[configKey] = v;
    }

    return config as Partial<TreeViewConfig<T>>;
  }
}

// Auto-register
if (typeof customElements !== 'undefined' && !customElements.get('web-treeview')) {
  customElements.define('web-treeview', WebTreeViewElement);
}
