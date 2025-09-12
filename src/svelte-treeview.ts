import { mount, unmount } from "svelte";

import { Tree } from "@keenmate/svelte-treeview";
// Import web component styles (includes TreeView SCSS)
import webComponentStyles from "./styles/web-component.scss?inline";
import type { LTreeNode } from "@keenmate/svelte-treeview";
import type {
  TreeEventMap,
  TreeWebComponentMethods,
  TreeWebComponentProps,
  ScrollToPathOptions,
} from "./types.js";
import type { SearchOptions } from "flexsearch";
import {
  TemplateSystem,
  type NodeTemplateFunction,
  type HeaderFooterTemplate,
} from "./template-system.js";

const OBSERVED_ATTRIBUTES = [
  "data",
  "id-member",
  "path-member",
  "parent-path-member",
  "level-member",
  "is-expanded-member",
  "is-selected-member",
  "is-draggable-member",
  "is-drop-allowed-member",
  "has-children-member",
  "display-value-member",
  "search-value-member",
  "expand-level",
  "tree-path-separator",
  "should-toggle-on-node-click",
  "should-use-internal-search-index",
  "indexer-batch-size",
  "indexer-timeout",
  "should-display-debug-information",
  "is-sorted",
  "body-class",
  "selected-node-class",
  "drag-over-node-class",
  "expand-icon-class",
  "collapse-icon-class",
  "leaf-icon-class",
  "scroll-highlight-timeout",
  "scroll-highlight-class",
  "search-text",
] as const;

export class SvelteTreeView<T = any>
  extends HTMLElement
  implements TreeWebComponentMethods<T>
{
  private svelteComponent: any = null;
  private svelteProps: any = null;
  private mountPoint: HTMLElement | null = null;
  private templateSystem: TemplateSystem<T> | null = null;
  private _props: Partial<TreeWebComponentProps<T>> = {};
  private _data: T[] = [];
  private _selectedNode: LTreeNode<T> | null = null;
  private _searchText: string = "";

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static get observedAttributes(): string[] {
    return OBSERVED_ATTRIBUTES as unknown as string[];
  }

  connectedCallback(): void {
    this.templateSystem = new TemplateSystem<T>(this);
    this.render();
  }

  disconnectedCallback(): void {
    this.unmountSvelteComponent();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (oldValue === newValue) return;

    const propName = this.camelCase(name);
    const parsedValue = this.parseAttributeValue(name, newValue);

    this._props[propName as keyof TreeWebComponentProps<T>] = parsedValue;

    if (this.svelteComponent) {
      this.updateSvelteComponent();
    }
  }

  // Property getters and setters
  get data(): T[] {
    return this._data;
  }

  set data(value: T[]) {
    if (value !== this._data) {
      this._data = value;
      this._props.data = value;
      this.updateSvelteComponent();
      this.dispatchEvent(
        new CustomEvent("data-changed", { detail: { data: value } })
      );
    }
  }

  get idMember(): string {
    return this._props.idMember || "";
  }

  set idMember(value: string) {
    this._props.idMember = value;
    this.setAttribute("id-member", value);
    this.updateSvelteComponent();
  }

  get pathMember(): string {
    return this._props.pathMember || "";
  }

  set pathMember(value: string) {
    this._props.pathMember = value;
    this.setAttribute("path-member", value);
    this.updateSvelteComponent();
  }

  get selectedNode(): LTreeNode<T> | null {
    return this._selectedNode;
  }

  set selectedNode(value: LTreeNode<T> | null) {
    if (value !== this._selectedNode) {
      this._selectedNode = value;
      this._props.selectedNode = value;
      this.updateSvelteComponent();
      this.dispatchEvent(
        new CustomEvent("selected-node-changed", {
          detail: { selectedNode: value },
        })
      );
    }
  }

  get searchText(): string {
    return this._searchText;
  }

  set searchText(value: string) {
    if (value !== this._searchText) {
      this._searchText = value;
      this._props.searchText = value;
      this.setAttribute("search-text", value);
      this.svelteComponent.filterNodes(this.searchText)

      // this.updateSvelteComponent();
      this.dispatchEvent(
        new CustomEvent("search-text-changed", {
          detail: { searchText: value },
        })
      );
    }
  }

  // Public methods - proxy to Svelte component
  async expandNodes(nodePath: string): Promise<void> {
    if (this.svelteComponent && this.svelteComponent.expandNodes) {
      return this.svelteComponent.expandNodes(nodePath);
    }
  }

  async collapseNodes(nodePath: string): Promise<void> {
    if (this.svelteComponent && this.svelteComponent.collapseNodes) {
      return this.svelteComponent.collapseNodes(nodePath);
    }
  }

  expandAll(nodePath?: string | null): void {
    if (this.svelteComponent && this.svelteComponent.expandAll) {
      this.svelteComponent.expandAll(nodePath);
    }
  }

  collapseAll(nodePath?: string | null): void {
    if (this.svelteComponent && this.svelteComponent.collapseAll) {
      this.svelteComponent.collapseAll(nodePath);
    }
  }

  filterNodes(searchText: string, searchOptions?: SearchOptions): void {
    if (this.svelteComponent && this.svelteComponent.filterNodes) {
      this.svelteComponent.filterNodes(searchText, searchOptions);
    }
  }

  searchNodes(
    searchText: string | null,
    searchOptions?: SearchOptions
  ): LTreeNode<T>[] {
    if (this.svelteComponent && this.svelteComponent.searchNodes) {
      return this.svelteComponent.searchNodes(searchText, searchOptions);
    }
    return [];
  }

  async scrollToPath(
    path: string,
    options?: ScrollToPathOptions
  ): Promise<boolean> {
    if (!this.svelteComponent || !this.shadowRoot) {
      return false;
    }

    // Create a shadow DOM-aware wrapper for scrollToPath
    return this.scrollToPathShadowDOMWrapper(path, options);
  }

  private async scrollToPathShadowDOMWrapper(
    path: string,
    options?: ScrollToPathOptions
  ): Promise<boolean> {
    try {
      // Store original document.getElementById
      const originalGetElementById = document.getElementById.bind(document);

      // Create a shadow DOM-aware getElementById replacement
      const shadowAwareGetElementById = (id: string): HTMLElement | null => {
        // First try the shadow root
        const shadowElement = this.shadowRoot?.getElementById(id);
        if (shadowElement) {
          return shadowElement;
        }

        // Try querySelector in shadow root for more complex selectors
        const queriedElement = this.shadowRoot?.querySelector(`#${id}`);
        if (queriedElement) {
          return queriedElement as HTMLElement;
        }

        // Fallback to original document search
        return originalGetElementById(id);
      };

      // Temporarily replace document.getElementById
      (document as any).getElementById = shadowAwareGetElementById;

      // Call the original scrollToPath method
      const result = await this.svelteComponent.scrollToPath(path, options);

      // Restore original document.getElementById
      (document as any).getElementById = originalGetElementById;

      return result;
    } catch (error) {
      console.error("Error in scrollToPath wrapper:", error);
      return false;
    }
  }

  // Set callback functions
  setDisplayValueCallback(callback: (node: LTreeNode<T>) => string): void {
    this._props.getDisplayValueCallback = callback;
    this.updateSvelteComponent();
  }

  setSearchValueCallback(callback: (node: LTreeNode<T>) => string): void {
    this._props.getSearchValueCallback = callback;
    this.updateSvelteComponent();
  }

  setSortCallback(callback: (items: LTreeNode<T>[]) => LTreeNode<T>[]): void {
    this._props.sortCallback = callback;
    this.updateSvelteComponent();
  }

  // Event handler setters
  onNodeClicked(handler: (node: LTreeNode<T>) => void): void {
    this._props.onNodeClicked = handler;
    this.updateSvelteComponent();
  }

  onNodeDragStart(
    handler: (node: LTreeNode<T>, event: DragEvent) => void
  ): void {
    this._props.onNodeDragStart = handler;
    this.updateSvelteComponent();
  }

  onNodeDragOver(
    handler: (node: LTreeNode<T>, event: DragEvent) => void
  ): void {
    this._props.onNodeDragOver = handler;
    this.updateSvelteComponent();
  }

  onNodeDrop(
    handler: (
      node: LTreeNode<T>,
      draggedNode: LTreeNode<T>,
      event: DragEvent
    ) => void
  ): void {
    this._props.onNodeDrop = handler;
    this.updateSvelteComponent();
  }

  // Template methods
  setNodeTemplate(template: NodeTemplateFunction<T>): void {
    this.templateSystem?.setContextMenuTemplate(template);
    this.updateSvelteComponent();

    this.templateSystem?.setNodeTemplate(template);
  }

  setTreeHeader(template: HeaderFooterTemplate): void {
    this.templateSystem?.setTreeHeader(template);
    this.updateSvelteComponent();
  }

  setTreeFooter(template: HeaderFooterTemplate): void {
    this.templateSystem?.setTreeFooter(template);
    this.updateSvelteComponent();
  }

  setNoDataFoundTemplate(template: HeaderFooterTemplate): void {
    this.templateSystem?.setNoDataFoundTemplate(template);
    this.updateSvelteComponent();
  }

  setContextMenuTemplate(template: NodeTemplateFunction<T>): void {
    this.templateSystem?.setContextMenuTemplate(template);
    this.updateSvelteComponent();
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: inherit;
        }
        
        #svelte-mount {
          width: 100%;
          height: 100%;
        }
        
        /* Web component styles (includes TreeView styles) */
        ${webComponentStyles}
      </style>
      <div id="svelte-mount"></div>
    `;

    this.mountPoint = this.shadowRoot.querySelector("#svelte-mount");
    this.mountSvelteComponent();
  }

  private mountSvelteComponent(): void {
    if (!this.mountPoint) return;

    this.parseInitialAttributes();

    // Get template snippets from template system
    const templateSnippets = this.templateSystem?.getSvelteSnippets() || {};

    // Create reactive props object for Svelte 5
    this.svelteProps = {
      ...this._props,
      data: this._data,
      searchText: this._searchText,
      ...templateSnippets,
      onNodeClicked: (node: LTreeNode<T>) => {
        this.selectedNode = node;
        console.log("selectedNode", this.selectedNode);
        if (this._props.onNodeClicked) {
          this._props.onNodeClicked(node);
        }
        this.dispatchEvent(
          new CustomEvent("node-clicked", {
            detail: { node },
            bubbles: true,
            composed: true,
          })
        );
      },
      onNodeDragStart: (node: LTreeNode<T>, event: DragEvent) => {
        if (this._props.onNodeDragStart) {
          this._props.onNodeDragStart(node, event);
        }
        this.dispatchEvent(
          new CustomEvent("node-drag-start", {
            detail: { node, event },
            bubbles: true,
            composed: true,
          })
        );
      },
      onNodeDragOver: (node: LTreeNode<T>, event: DragEvent) => {
        if (this._props.onNodeDragOver) {
          this._props.onNodeDragOver(node, event);
        }
        this.dispatchEvent(
          new CustomEvent("node-drag-over", {
            detail: { node, event },
            bubbles: true,
            composed: true,
          })
        );
      },
      onNodeDrop: (
        node: LTreeNode<T>,
        draggedNode: LTreeNode<T>,
        event: DragEvent
      ) => {
        if (this._props.onNodeDrop) {
          this._props.onNodeDrop(node, draggedNode, event);
        }
        this.dispatchEvent(
          new CustomEvent("node-drop", {
            detail: { node, draggedNode, event },
            bubbles: true,
            composed: true,
          })
        );
      },
    };

    this.svelteComponent = mount(Tree, {
      target: this.mountPoint,
      props: this.svelteProps,
    });
  }

  private unmountSvelteComponent(): void {
    if (this.svelteComponent) {
      unmount(this.svelteComponent);
      this.svelteComponent = null;
      this.svelteProps = null;
    }
  }

  private updateSvelteComponent(): void {
    if (this.svelteComponent && this.svelteProps) {
      // Update props directly for Svelte 5
      const finalObject = {
        ...this._props,
        data: this._data,
        searchText: this._searchText,
      };
      Object.assign(this.svelteProps, finalObject);
    }
  }

  private parseInitialAttributes(): void {
    for (const attr of OBSERVED_ATTRIBUTES) {
      const value = this.getAttribute(attr);
      if (value !== null) {
        const propName = this.camelCase(attr);
        this._props[propName as keyof TreeWebComponentProps<T>] =
          this.parseAttributeValue(attr, value);
      }
    }
  }

  private parseAttributeValue(attrName: string, value: string | null): any {
    if (value === null) return null;

    // Handle special data attribute
    if (attrName === "data") {
      try {
        const parsed = JSON.parse(value);
        this._data = parsed;
        return parsed;
      } catch {
        console.warn("Invalid JSON in data attribute");
        return [];
      }
    }

    // Handle boolean attributes
    if (
      [
        "should-toggle-on-node-click",
        "should-use-internal-search-index",
        "should-display-debug-information",
        "is-sorted",
      ].includes(attrName)
    ) {
      return value === "true" || value === "";
    }

    // Handle number attributes
    if (
      [
        "expand-level",
        "indexer-batch-size",
        "indexer-timeout",
        "scroll-highlight-timeout",
      ].includes(attrName)
    ) {
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    }

    return value;
  }

  private camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }

  // Type-safe event listener methods
  addEventListener<K extends keyof TreeEventMap<T>>(
    type: K,
    listener: (this: SvelteTreeView<T>, ev: TreeEventMap<T>[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof TreeEventMap<T>>(
    type: K,
    listener: (this: SvelteTreeView<T>, ev: TreeEventMap<T>[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener, options);
  }
}
