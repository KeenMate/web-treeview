/**
 * Default flat-mode DOM renderer implementing TreeViewRenderer<T>.
 *
 * - Event delegation: single click/dragover/drop listeners on body element
 * - Keyed reconciliation: Map<string, HTMLElement> keyed by node path
 * - Node element matches Node.svelte template structure
 * - Uses RenderCoordinator for progressive rendering
 */

import type { TreeViewRenderer, RendererConfig } from './types';
import type { TreeController } from '../controller/tree-controller';
import type { TreeControllerSnapshot, NodeConfig } from '../controller/types';
import type { LTreeNode } from '../ltree/ltree-node';
import type { DropPosition, ContextMenuItem } from '../ltree/types';

export class DomRenderer<T = any> implements TreeViewRenderer<T> {
  private container: HTMLElement | null = null;
  private controller: TreeController<T> | null = null;
  private config: RendererConfig<T> = {};

  // DOM elements
  private headerEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private footerEl: HTMLElement | null = null;
  private debugEl: HTMLElement | null = null;
  private contextMenuEl: HTMLElement | null = null;
  private loadingEl: HTMLElement | null = null;

  // Keyed node map
  private nodeElements = new Map<string, HTMLElement>();

  // Subscriptions
  private unsubState: (() => void) | null = null;
  private unsubConfig: (() => void) | null = null;

  // Last snapshot for diffing
  private lastSnapshot: TreeControllerSnapshot<T> | null = null;
  private lastNodeConfig: NodeConfig | null = null;

  mount(container: HTMLElement, controller: TreeController<T>, config: RendererConfig<T>): void {
    this.container = container;
    this.controller = controller;
    this.config = config;

    // Build skeleton
    this.container.innerHTML = '';
    this.container.classList.add('ltree-container');

    // Header
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'ltree-header';
    this.container.appendChild(this.headerEl);
    if (config.headerTemplate) {
      config.headerTemplate(this.headerEl);
    }

    // Debug info
    this.debugEl = document.createElement('div');
    this.debugEl.className = 'ltree-debug-info';
    this.debugEl.style.display = 'none';
    this.container.appendChild(this.debugEl);

    // Tree body
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'ltree-tree';
    this.container.appendChild(this.bodyEl);

    // Footer
    this.footerEl = document.createElement('div');
    this.footerEl.className = 'ltree-footer';
    this.container.appendChild(this.footerEl);
    if (config.footerTemplate) {
      config.footerTemplate(this.footerEl);
    }

    // Loading overlay
    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 'ltree-loading-overlay';
    this.loadingEl.style.display = 'none';
    this.loadingEl.innerHTML = '<div class="ltree-loading-spinner"></div>';
    this.container.appendChild(this.loadingEl);

    // Context menu
    this.contextMenuEl = document.createElement('div');
    this.contextMenuEl.className = 'ltree-context-menu';
    this.contextMenuEl.style.display = 'none';
    this.container.appendChild(this.contextMenuEl);

    // Set controller container for scrollToPath
    controller.containerElement = container;

    // Wire event delegation
    this._attachBodyListeners();

    // Subscribe to controller
    this.unsubState = controller.on('state-change', (snapshot) => this._onStateChange(snapshot));
    this.unsubConfig = controller.on('config-change', (nodeConfig) => this._onConfigChange(nodeConfig));

    // Initial render from current state
    this.lastNodeConfig = controller.nodeConfig;
    this._onStateChange(controller.getSnapshot());
  }

  updateConfig(config: Partial<RendererConfig<T>>): void {
    Object.assign(this.config, config);
    if (config.headerTemplate && this.headerEl) {
      this.headerEl.innerHTML = '';
      config.headerTemplate(this.headerEl);
    }
    if (config.footerTemplate && this.footerEl) {
      this.footerEl.innerHTML = '';
      config.footerTemplate(this.footerEl);
    }
    // Re-render nodes if nodeTemplate changed
    if (config.nodeTemplate && this.controller) {
      this._fullRender(this.controller.getSnapshot());
    }
  }

  destroy(): void {
    this.unsubState?.();
    this.unsubConfig?.();
    this.unsubState = null;
    this.unsubConfig = null;
    this._detachBodyListeners();
    this.nodeElements.clear();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.classList.remove('ltree-container');
    }
    this.container = null;
    this.controller = null;
    this.lastSnapshot = null;
  }

  // ── Event delegation ────────────────────────────────────────────────

  private _onBodyClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!this.controller) return;

    // Toggle icon click
    const toggleIcon = target.closest('.ltree-toggle-icon') as HTMLElement;
    if (toggleIcon) {
      const nodeEl = toggleIcon.closest('.ltree-node') as HTMLElement;
      const path = nodeEl?.getAttribute('data-tree-path');
      if (path) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          if (node.isExpanded) {
            this.controller.collapseNodes(path);
          } else {
            this.controller.expandNodes(path);
          }
          return;
        }
      }
    }

    // Node content click
    const contentEl = target.closest('.ltree-node-content') as HTMLElement;
    if (contentEl) {
      const nodeEl = contentEl.closest('.ltree-node') as HTMLElement;
      const path = nodeEl?.getAttribute('data-tree-path');
      if (path) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          // Toggle on node click if configured
          if (this.lastNodeConfig?.shouldToggleOnNodeClick && node.hasChildren) {
            if (node.isExpanded) {
              this.controller.collapseNodes(path);
            } else {
              this.controller.expandNodes(path);
            }
          }
          this.controller.nodeCallbacks.onNodeClicked(node);
        }
      }
    }
  };

  private _onBodyContextMenu = (event: MouseEvent) => {
    if (!this.controller) return;
    const target = event.target as HTMLElement;
    const contentEl = target.closest('.ltree-node-content') as HTMLElement;
    if (contentEl) {
      const nodeEl = contentEl.closest('.ltree-node') as HTMLElement;
      const path = nodeEl?.getAttribute('data-tree-path');
      if (path) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          this.controller.nodeCallbacks.onNodeRightClicked(node, event);
        }
      }
    }
  };

  private _onBodyDragStart = (event: DragEvent) => {
    if (!this.controller) return;
    const target = event.target as HTMLElement;
    const nodeEl = target.closest('.ltree-node') as HTMLElement;
    const path = nodeEl?.getAttribute('data-tree-path');
    if (path) {
      const node = this.controller.getNodeByPath(path);
      if (node) {
        this.controller.startDrag(node, event);
      }
    }
  };

  private _onBodyDragOver = (event: DragEvent) => {
    if (!this.controller) return;
    const target = event.target as HTMLElement;

    // Drop zone handling — allow drop and highlight active zone
    const zoneEl = target.closest('.ltree-drop-zone') as HTMLElement;
    if (zoneEl) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const parent = zoneEl.parentElement as HTMLElement;
      if (parent) {
        // Toggle active class on hovered zone
        for (const sibling of parent.querySelectorAll('.ltree-drop-zone')) {
          sibling.classList.toggle('ltree-drop-zone-active', sibling === zoneEl);
        }
        // Refresh position for scroll tracking
        const path = parent.getAttribute('data-tree-path');
        if (path) {
          const key = this._findKeyByPath(path);
          const hoveredEl = this.nodeElements.get(key);
          const row = hoveredEl?.querySelector('.ltree-node-row') as HTMLElement;
          if (row) {
            const rect = row.getBoundingClientRect();
            parent.style.top = `${rect.top}px`;
            parent.style.left = `${rect.left}px`;
            parent.style.width = `${rect.width}px`;
            parent.style.height = `${rect.height}px`;
          }
        }
      }
      return;
    }

    const contentEl = target.closest('.ltree-node-content') as HTMLElement;
    if (contentEl) {
      const nodeEl = contentEl.closest('.ltree-node') as HTMLElement;
      const path = nodeEl?.getAttribute('data-tree-path');
      if (path) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          this.controller.dragOver(node, event, contentEl);
        }
      }
    }

    // Empty tree or active drop placeholder dragover
    const emptyOrPlaceholder = target.closest('.ltree-empty-state, .ltree-drop-placeholder') as HTMLElement;
    if (emptyOrPlaceholder) {
      this.controller.handleEmptyTreeDragOver(event);
    }
  };

  private _onBodyDragLeave = (event: DragEvent) => {
    if (!this.controller) return;
    // Don't clear hover when cursor moves to a floating drop zone
    const related = event.relatedTarget as HTMLElement;
    if (related?.closest?.('.ltree-drop-zones')) return;
    const target = event.target as HTMLElement;
    const contentEl = target.closest('.ltree-node-content') as HTMLElement;
    if (contentEl) {
      const nodeEl = contentEl.closest('.ltree-node') as HTMLElement;
      const path = nodeEl?.getAttribute('data-tree-path');
      if (path) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          this.controller.dragLeave(node, event);
        }
      }
    }

    const emptyOrPlaceholder = target.closest('.ltree-empty-state, .ltree-drop-placeholder') as HTMLElement;
    if (emptyOrPlaceholder) {
      this.controller.handleEmptyTreeDragLeave(event);
    }
  };

  private _onBodyDrop = (event: DragEvent) => {
    if (!this.controller) return;
    const target = event.target as HTMLElement;

    // Check for drop zone (zones are appended to bodyEl, not inside .ltree-node)
    const zoneEl = target.closest('.ltree-drop-zone') as HTMLElement;
    if (zoneEl) {
      const zonesContainer = zoneEl.closest('.ltree-drop-zones') as HTMLElement;
      const path = zonesContainer?.getAttribute('data-tree-path');
      const position = zoneEl.getAttribute('data-drop-position') as DropPosition;
      if (path && position) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          this.controller.dropAt(node, position, event);
          return;
        }
      }
    }

    // Check for empty tree drop (matches both .ltree-empty-state and active .ltree-drop-placeholder)
    const emptyOrPlaceholder = target.closest('.ltree-empty-state, .ltree-drop-placeholder') as HTMLElement;
    if (emptyOrPlaceholder) {
      this.controller.handleEmptyTreeDrop(event);
      return;
    }

    // Regular node drop
    const contentEl = target.closest('.ltree-node-content') as HTMLElement;
    if (contentEl) {
      const nodeEl = contentEl.closest('.ltree-node') as HTMLElement;
      const path = nodeEl?.getAttribute('data-tree-path');
      if (path) {
        const node = this.controller.getNodeByPath(path);
        if (node) {
          this.controller.drop(node, event);
        }
      }
    }
  };

  private _onBodyDragEnter = (event: DragEvent) => {
    this.controller?.handleTreeDragEnter(event);
  };

  private _onBodyDragEnd = (event: DragEvent) => {
    this.controller?._onNodeDragEnd(event);
  };

  /** Catches dragend from OTHER trees (cross-tree) and Esc cancellations.
   *  dragend fires on the source element; when that element lives in a
   *  different shadow root the event never reaches our bodyEl. */
  private _onDocumentDragEnd = (event: DragEvent) => {
    this.controller?.cancelDrag();
  };

  private _onBodyTouchStart = (event: TouchEvent) => {
    if (!this.controller) return;
    const target = event.target as HTMLElement;
    const nodeEl = target.closest('.ltree-node') as HTMLElement;
    const path = nodeEl?.getAttribute('data-tree-path');
    if (path) {
      const node = this.controller.getNodeByPath(path);
      if (node) {
        this.controller.touchStart(node, event);
      }
    }
  };

  private _attachBodyListeners() {
    if (!this.bodyEl) return;
    this.bodyEl.addEventListener('click', this._onBodyClick);
    this.bodyEl.addEventListener('contextmenu', this._onBodyContextMenu);
    this.bodyEl.addEventListener('dragstart', this._onBodyDragStart);
    this.bodyEl.addEventListener('dragover', this._onBodyDragOver);
    this.bodyEl.addEventListener('dragleave', this._onBodyDragLeave);
    this.bodyEl.addEventListener('drop', this._onBodyDrop);
    this.bodyEl.addEventListener('dragenter', this._onBodyDragEnter);
    this.bodyEl.addEventListener('touchstart', this._onBodyTouchStart, { passive: true });
    // dragend fires on the SOURCE element after any drag ends (drop, cancel, cross-tree)
    this.bodyEl.addEventListener('dragend', this._onBodyDragEnd);
    // Cross-tree / Esc: dragend from other shadow roots won't reach our bodyEl
    document.addEventListener('dragend', this._onDocumentDragEnd);
  }

  private _detachBodyListeners() {
    if (!this.bodyEl) return;
    this.bodyEl.removeEventListener('click', this._onBodyClick);
    this.bodyEl.removeEventListener('contextmenu', this._onBodyContextMenu);
    this.bodyEl.removeEventListener('dragstart', this._onBodyDragStart);
    this.bodyEl.removeEventListener('dragover', this._onBodyDragOver);
    this.bodyEl.removeEventListener('dragleave', this._onBodyDragLeave);
    this.bodyEl.removeEventListener('drop', this._onBodyDrop);
    this.bodyEl.removeEventListener('dragenter', this._onBodyDragEnter);
    this.bodyEl.removeEventListener('touchstart', this._onBodyTouchStart);
    this.bodyEl.removeEventListener('dragend', this._onBodyDragEnd);
    document.removeEventListener('dragend', this._onDocumentDragEnd);
  }

  // ── State change handler ────────────────────────────────────────────

  private _onStateChange(snapshot: TreeControllerSnapshot<T>): void {
    if (!this.bodyEl || !this.controller) return;

    // Reconcile nodes
    this._reconcileNodes(snapshot);

    // Update drag CSS classes
    this._updateDragClasses(snapshot);

    // Update drop zones for floating mode
    this._updateDropZones(snapshot);

    // Context menu
    this._updateContextMenu(snapshot);

    // Loading overlay
    if (this.loadingEl) {
      this.loadingEl.style.display = snapshot.isLoading ? 'flex' : 'none';
    }

    // Debug info
    this._updateDebugInfo(snapshot);

    // Body class
    if (this.bodyEl) {
      if (this.lastSnapshot?.bodyClass) {
        this.bodyEl.classList.remove(this.lastSnapshot.bodyClass);
      }
      if (snapshot.bodyClass) {
        this.bodyEl.classList.add(snapshot.bodyClass);
      }
    }

    this.lastSnapshot = snapshot;
  }

  private _onConfigChange(nodeConfig: NodeConfig): void {
    this.lastNodeConfig = nodeConfig;
    // Re-render toggle icons if icon classes changed
    if (this.controller) {
      this._fullRender(this.controller.getSnapshot());
    }
  }

  // ── Node reconciliation ─────────────────────────────────────────────

  private _reconcileNodes(snapshot: TreeControllerSnapshot<T>): void {
    if (!this.bodyEl || !this.controller) return;

    const nodes = snapshot.flatNodesToRender;
    const newKeys = new Set<string>();

    // Handle empty tree
    if (nodes.length === 0) {
      this._renderEmpty(snapshot);
      return;
    }

    // Remove empty state if it exists
    const emptyState = this.bodyEl.querySelector('.ltree-empty-state');
    if (emptyState) emptyState.remove();
    const dropPlaceholder = this.bodyEl.querySelector('.ltree-drop-placeholder');
    if (dropPlaceholder) dropPlaceholder.remove();

    // Build/update nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const key = String(node.id || node.path);
      newKeys.add(key);

      let el = this.nodeElements.get(key);
      if (el) {
        // Always keep data-tree-path in sync (moveNode changes paths)
        const currentPath = el.getAttribute('data-tree-path');
        if (currentPath !== node.path) {
          el.setAttribute('data-tree-path', node.path);
          // Path changed — force full update regardless of _rev
          this._updateNodeElement(el, node, snapshot);
        } else {
          // Update existing node if _rev changed
          const existingRev = el.getAttribute('data-rev');
          if (existingRev !== String(node._rev)) {
            this._updateNodeElement(el, node, snapshot);
          }
        }
        // Update indent for flat mode
        if (snapshot.useFlatRendering) {
          el.style.marginLeft = `calc((${node.level} - 1) * ${snapshot.flatIndentSize})`;
        }
      } else {
        // Create new node
        el = this._createNodeElement(node, snapshot);
        this.nodeElements.set(key, el);
      }

      // Ensure correct order
      const currentChild = this.bodyEl.children[i];
      if (currentChild !== el) {
        this.bodyEl.insertBefore(el, currentChild || null);
      }
    }

    // Remove absent nodes
    for (const [key, el] of this.nodeElements) {
      if (!newKeys.has(key)) {
        el.remove();
        this.nodeElements.delete(key);
      }
    }
  }

  private _renderEmpty(snapshot: TreeControllerSnapshot<T>): void {
    if (!this.bodyEl) return;

    // Clear all node elements
    for (const [, el] of this.nodeElements) {
      el.remove();
    }
    this.nodeElements.clear();

    // Show drop placeholder or empty state
    if (snapshot.isDragInProgress && snapshot.isDropPlaceholderActive) {
      let placeholder = this.bodyEl.querySelector('.ltree-drop-placeholder');
      if (!placeholder) {
        const emptyState = this.bodyEl.querySelector('.ltree-empty-state');
        if (emptyState) emptyState.remove();

        placeholder = document.createElement('div');
        placeholder.className = 'ltree-drop-placeholder';
        if (this.config.dropPlaceholderTemplate) {
          this.config.dropPlaceholderTemplate(placeholder as HTMLElement);
        } else {
          const content = document.createElement('div');
          content.className = 'ltree-drop-placeholder-content';
          content.textContent = 'Drop here';
          placeholder.appendChild(content);
        }
        this.bodyEl.appendChild(placeholder);
      }
    } else {
      const placeholder = this.bodyEl.querySelector('.ltree-drop-placeholder');
      if (placeholder) placeholder.remove();

      let emptyState = this.bodyEl.querySelector('.ltree-empty-state');
      if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.className = 'ltree-empty-state';
        if (this.config.emptyTemplate) {
          this.config.emptyTemplate(emptyState as HTMLElement);
        } else {
          emptyState.textContent = 'No data';
        }
        this.bodyEl.appendChild(emptyState);
      }
    }
  }

  private _createNodeElement(node: LTreeNode<T>, snapshot: TreeControllerSnapshot<T>): HTMLElement {
    const el = document.createElement('div');
    el.className = 'ltree-node';
    el.setAttribute('data-tree-path', node.path);
    el.setAttribute('data-rev', String(node._rev));

    if (this.controller && node.id) {
      el.id = `${this.controller.treeId}-${node.id}`;
    }

    // Flat mode indent
    if (snapshot.useFlatRendering) {
      el.style.marginLeft = `calc((${node.level} - 1) * ${snapshot.flatIndentSize})`;
    }

    // Draggable — only when drag-drop is enabled
    if (this.controller?.dragDropMode !== 'none' && this.controller?.getNodeIsDraggable(node)) {
      el.setAttribute('draggable', 'true');
      el.classList.add('ltree-draggable');
    }

    // Node row
    const row = document.createElement('div');
    row.className = 'ltree-node-row';

    // Toggle icon
    const toggle = document.createElement('span');
    toggle.className = 'ltree-toggle-icon';

    const nodeConfig = this.lastNodeConfig;
    if (node.hasChildren) {
      if (node.isExpanded) {
        toggle.classList.add(nodeConfig?.collapseIconClass || 'ltree-icon-collapse');
        toggle.classList.add('expanded');
      } else {
        toggle.classList.add(nodeConfig?.expandIconClass || 'ltree-icon-expand');
      }
      toggle.classList.add('ltree-clickable');
    } else {
      toggle.classList.add(nodeConfig?.leafIconClass || 'ltree-icon-leaf');
    }

    row.appendChild(toggle);

    // Node content
    const content = document.createElement('div');
    content.className = 'ltree-node-content';

    if (nodeConfig?.shouldToggleOnNodeClick && node.hasChildren) {
      content.classList.add('ltree-clickable');
    }

    // Selected state
    if (node.isSelected && nodeConfig?.selectedNodeClass) {
      content.classList.add(nodeConfig.selectedNodeClass);
    }

    // Custom or default content
    if (this.config.nodeTemplate) {
      this.config.nodeTemplate(node, content);
    } else {
      const label = document.createElement('span');
      label.className = 'ltree-node-label';
      label.textContent = this.controller?.tree?.getNodeDisplayValue(node) || String(node.id);
      content.appendChild(label);
    }

    row.appendChild(content);
    el.appendChild(row);

    return el;
  }

  private _updateNodeElement(el: HTMLElement, node: LTreeNode<T>, snapshot: TreeControllerSnapshot<T>): void {
    el.setAttribute('data-rev', String(node._rev));
    el.setAttribute('data-tree-path', node.path);

    const nodeConfig = this.lastNodeConfig;

    // Update toggle icon
    const toggle = el.querySelector('.ltree-toggle-icon') as HTMLElement;
    if (toggle) {
      toggle.className = 'ltree-toggle-icon';
      if (node.hasChildren) {
        if (node.isExpanded) {
          toggle.classList.add(nodeConfig?.collapseIconClass || 'ltree-icon-collapse');
          toggle.classList.add('expanded');
        } else {
          toggle.classList.add(nodeConfig?.expandIconClass || 'ltree-icon-expand');
        }
        toggle.classList.add('ltree-clickable');
      } else {
        toggle.classList.add(nodeConfig?.leafIconClass || 'ltree-icon-leaf');
      }
    }

    // Update content
    const content = el.querySelector('.ltree-node-content') as HTMLElement;
    if (content) {
      // Reset classes
      content.className = 'ltree-node-content';
      if (nodeConfig?.shouldToggleOnNodeClick && node.hasChildren) {
        content.classList.add('ltree-clickable');
      }
      if (node.isSelected && nodeConfig?.selectedNodeClass) {
        content.classList.add(nodeConfig.selectedNodeClass);
      }

      // Re-render content if using template
      if (this.config.nodeTemplate) {
        content.innerHTML = '';
        this.config.nodeTemplate(node, content);
      } else {
        const label = content.querySelector('.ltree-node-label') as HTMLElement;
        if (label) {
          label.textContent = this.controller?.tree?.getNodeDisplayValue(node) || String(node.id);
        }
      }
    }

    // Update draggable — only when drag-drop is enabled
    if (this.controller?.dragDropMode !== 'none' && this.controller?.getNodeIsDraggable(node)) {
      el.setAttribute('draggable', 'true');
      el.classList.add('ltree-draggable');
    } else {
      el.removeAttribute('draggable');
      el.classList.remove('ltree-draggable');
    }
  }

  // ── Drag CSS classes ────────────────────────────────────────────────

  private _updateDragClasses(snapshot: TreeControllerSnapshot<T>): void {
    // Dragged node
    for (const [, el] of this.nodeElements) {
      const path = el.getAttribute('data-tree-path');
      const content = el.querySelector('.ltree-node-content') as HTMLElement;
      if (!content) continue;

      // Clear previous drag classes
      el.classList.remove('ltree-dragged');
      content.classList.remove('ltree-glow-above', 'ltree-glow-below', 'ltree-glow-child', 'ltree-drop-copy');

      // Dragged node style
      if (path === snapshot.draggedNodePath) {
        el.classList.add('ltree-dragged');
      }

      // Glow mode indicators on hovered node
      if (
        snapshot.isDragInProgress &&
        path === snapshot.hoveredNodeForDropPath &&
        snapshot.activeDropPosition &&
        this.lastNodeConfig?.dropZoneMode === 'glow'
      ) {
        content.classList.add(`ltree-glow-${snapshot.activeDropPosition}`);
        if (snapshot.currentDropOperation === 'copy') {
          content.classList.add('ltree-drop-copy');
        }
      }
    }
  }

  // ── Drop zones (floating mode) ─────────────────────────────────────

  private _updateDropZones(snapshot: TreeControllerSnapshot<T>): void {
    if (!this.bodyEl || !this.controller) return;

    const shouldShow =
      this.lastNodeConfig?.dropZoneMode === 'floating' &&
      snapshot.isDragInProgress &&
      !!snapshot.hoveredNodeForDropPath;

    const existing = this.bodyEl.querySelector('.ltree-drop-zones') as HTMLElement | null;
    const existingPath = existing?.getAttribute('data-tree-path') ?? null;

    // If zones already exist for the same hovered path, just update position — don't recreate
    if (shouldShow && existing && existingPath === snapshot.hoveredNodeForDropPath) {
      const key = this._findKeyByPath(snapshot.hoveredNodeForDropPath!);
      const hoveredEl = this.nodeElements.get(key);
      const row = hoveredEl?.querySelector('.ltree-node-row') as HTMLElement;
      if (row) {
        const rect = row.getBoundingClientRect();
        existing.style.top = `${rect.top}px`;
        existing.style.left = `${rect.left}px`;
        existing.style.width = `${rect.width}px`;
        existing.style.height = `${rect.height}px`;
      }
      return;
    }

    // Remove stale zones (different path or conditions no longer met)
    if (existing) existing.remove();

    if (!shouldShow) return;

    const hoveredEl = this.nodeElements.get(
      this._findKeyByPath(snapshot.hoveredNodeForDropPath!)
    );
    if (!hoveredEl) return;

    const node = this.controller.getNodeByPath(snapshot.hoveredNodeForDropPath!);
    if (!node) return;

    const row = hoveredEl.querySelector('.ltree-node-row') as HTMLElement;
    if (!row) return;

    const rect = row.getBoundingClientRect();

    const allowedPositions = this.controller.getNodeAllowedDropPositions(node);
    const layout = this.lastNodeConfig?.dropZoneLayout || 'around';
    const start = this.lastNodeConfig?.dropZoneStart ?? 33;
    const maxWidth = this.lastNodeConfig?.dropZoneMaxWidth ?? 120;

    const zones = document.createElement('div');
    zones.className = `ltree-drop-zones ltree-drop-zones-${layout}`;
    zones.setAttribute('data-tree-path', snapshot.hoveredNodeForDropPath!);
    zones.style.position = 'fixed';
    zones.style.top = `${rect.top}px`;
    zones.style.left = `${rect.left}px`;
    zones.style.width = `${rect.width}px`;
    zones.style.height = `${rect.height}px`;
    zones.style.zIndex = '10000';
    zones.style.setProperty('--drop-zone-start', typeof start === 'number' ? `${start}%` : start);
    zones.style.setProperty('--drop-zone-max-width', `${maxWidth}px`);

    const positions: DropPosition[] = allowedPositions || ['above', 'below', 'child'];
    for (const pos of positions) {
      const zone = document.createElement('div');
      zone.className = `ltree-drop-zone ltree-drop-${pos}`;
      zone.setAttribute('data-drop-position', pos);
      zone.textContent = pos.charAt(0).toUpperCase() + pos.slice(1);
      zones.appendChild(zone);
    }

    this.bodyEl.appendChild(zones);
  }

  // ── Context menu ────────────────────────────────────────────────────

  private _updateContextMenu(snapshot: TreeControllerSnapshot<T>): void {
    if (!this.contextMenuEl || !this.controller) return;

    if (!snapshot.contextMenuVisible || !snapshot.contextMenuNode) {
      this.contextMenuEl.style.display = 'none';
      return;
    }

    this.contextMenuEl.style.display = 'block';
    this.contextMenuEl.style.left = `${snapshot.contextMenuX}px`;
    this.contextMenuEl.style.top = `${snapshot.contextMenuY}px`;

    // Custom context menu template
    if (this.config.contextMenuTemplate) {
      this.contextMenuEl.innerHTML = '';
      this.config.contextMenuTemplate(
        snapshot.contextMenuNode,
        () => this.controller!.closeContextMenu(),
        this.contextMenuEl
      );
      return;
    }

    // Default: render items from contextMenuCallback
    const callbackRef = this.controller.contextMenuCallbackCb;
    if (callbackRef) {
      const items: ContextMenuItem[] = callbackRef(
        snapshot.contextMenuNode,
        () => this.controller!.closeContextMenu()
      );
      this._renderContextMenuItems(items);
    }
  }

  private _renderContextMenuItems(items: ContextMenuItem[]): void {
    if (!this.contextMenuEl) return;
    this.contextMenuEl.innerHTML = '';

    for (const item of items) {
      if (item.title === '---' || item.title === '-') {
        const divider = document.createElement('div');
        divider.className = 'ltree-context-menu-divider';
        this.contextMenuEl.appendChild(divider);
        continue;
      }

      const btn = document.createElement('button');
      btn.className = 'ltree-context-menu-item';
      if (item.isDisabled) btn.classList.add('ltree-context-menu-item-disabled');

      if (item.icon) {
        const icon = document.createElement('span');
        icon.className = 'ltree-context-menu-icon';
        icon.textContent = item.icon;
        btn.appendChild(icon);
      }

      const text = document.createTextNode(item.title);
      btn.appendChild(text);

      if (!item.isDisabled && item.callback) {
        btn.addEventListener('click', () => {
          item.callback?.();
          this.controller?.closeContextMenu();
        });
      }

      this.contextMenuEl.appendChild(btn);
    }
  }

  // ── Debug info ──────────────────────────────────────────────────────

  private _updateDebugInfo(snapshot: TreeControllerSnapshot<T>): void {
    if (!this.debugEl || !this.controller) return;

    if (!snapshot.shouldDisplayDebugInformation) {
      this.debugEl.style.display = 'none';
      return;
    }

    this.debugEl.style.display = 'block';
    const stats = this.controller.statistics;
    if (!stats) return;

    this.debugEl.innerHTML = `
      <details>
        <summary>Tree Debug Info</summary>
        <div class="ltree-debug-stats">
          <span>Nodes: ${stats.nodeCount}</span>
          <span>Visible: ${snapshot.flatNodesToRender.length}</span>
          <span>Max Level: ${stats.maxLevel}</span>
          <span>Flat: ${snapshot.useFlatRendering}</span>
          <span>Rendering: ${snapshot.isRendering}</span>
        </div>
      </details>
    `;
  }

  // ── Full render (for config changes) ────────────────────────────────

  private _fullRender(snapshot: TreeControllerSnapshot<T>): void {
    // Clear all node elements and re-create
    for (const [, el] of this.nodeElements) {
      el.remove();
    }
    this.nodeElements.clear();
    this._onStateChange(snapshot);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private _findKeyByPath(path: string): string {
    for (const [key, el] of this.nodeElements) {
      if (el.getAttribute('data-tree-path') === path) return key;
    }
    return '';
  }
}
