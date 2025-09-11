import type { LTreeNode } from "@keenmate/svelte-treeview";
import {createRawSnippet} from "svelte"

export type TemplateFunction<T> = (node: LTreeNode<T>) => string;
export type HeaderFooterTemplate = () => string;

export interface TemplateSlots<T> {
  nodeTemplate?: TemplateFunction<T>;
  treeHeader?: HeaderFooterTemplate;
  treeFooter?: HeaderFooterTemplate;
  noDataFound?: HeaderFooterTemplate;
  contextMenu?: TemplateFunction<T>;
}

export class TemplateSystem<T> {
  private templates: TemplateSlots<T> = {};
  private host: HTMLElement;

  constructor(host: HTMLElement) {
    this.host = host;
    this.parseSlotTemplates();
  }

  private parseSlotTemplates(): void {
    // Parse template elements from slots
    const templates = this.host.querySelectorAll("template[slot]");

    templates.forEach((template) => {
      const slotName = template.getAttribute("slot");
      if (!slotName) return;

      const content = template.innerHTML.trim();
      console.log(
        "🚀 ~ TemplateSystem ~ parseSlotTemplates ~ slotName, content:",
        slotName,
        content
      );

      switch (slotName) {
        case "node-template":
          this.templates.nodeTemplate = this.createNodeTemplate(content);
          break;
        case "tree-header":
          this.templates.treeHeader = () => content;
          break;
        case "tree-footer":
          this.templates.treeFooter = () => content;
          break;
        case "no-data-found":
          this.templates.noDataFound = () => content;
          break;
        case "context-menu":
          this.templates.contextMenu = this.createNodeTemplate(content);
          break;
      }
    });
  }

  private createNodeTemplate(templateString: string): TemplateFunction<T> {
    return (node: LTreeNode<T>) => {
      return this.interpolateTemplate(templateString, node);
    };
  }

  private interpolateTemplate(template: string, node: LTreeNode<T>): string {
    // Simple template interpolation supporting:
    // ${node.property} - direct node property access
    // ${node.data.property} - data property access
    // ${displayValue} - computed display value

    const displayValue = this.getDisplayValue(node);

    const finalTemplate = template.replace(
      /\$\{([^}]+)\}/g,
      (match, expression) => {
        try {
          // Clean the expression
          const expr = expression.trim();

          // Handle special cases
          if (expr === "displayValue") {
            return String(displayValue);
          }

          // Handle node property access
          if (expr.startsWith("node.")) {
            const path = expr.substring(5); // Remove 'node.'
            return String(this.getNestedProperty(node, path));
          }

          // Handle data property shortcuts (assume node.data.property)
          if (!expr.includes(".")) {
            return String(this.getNestedProperty(node.data, expr));
          }

          // Fallback - try to resolve the full expression
          return String(this.getNestedProperty({ node, displayValue }, expr));
        } catch (error) {
          console.warn(
            `Template interpolation failed for expression: ${expression}`,
            error
          );
          return match; // Return original if interpolation fails
        }
      }
    );

    console.log(
      "🚀 ~ TemplateSystem ~ interpolateTemplate ~ finalTemplate:",
      template,
      finalTemplate
    );
    return finalTemplate;
  }

  private getNestedProperty(obj: any, path: string): any {
    if (!obj || !path) return "";

    return path.split(".").reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : "";
    }, obj);
  }

  private getDisplayValue(node: LTreeNode<T>): string {
    // This would typically use the same logic as the Tree component
    // For now, provide a reasonable default
    if (node.data && typeof node.data === "object") {
      const data = node.data as any;
      return (
        data.name ||
        data.title ||
        data.label ||
        node.pathSegment ||
        String(data)
      );
    }
    return node.pathSegment || "";
  }

  // Convert templates to Svelte snippets equivalent
  getSvelteSnippets() {
    const snippets: any = {};

		console.log("svelte snippets begin", this.templates)
    if (this.templates.nodeTemplate) {
			const component = this

      snippets.nodeTemplate = createRawSnippet((node: () => LTreeNode<T>) => ({
				render() {
					return component.templates.nodeTemplate!(node());
				}
			}))
    }

    if (this.templates.treeHeader) {
			const component = this

      snippets.treeHeader = createRawSnippet(() => ({
				render() {
					return component.templates.treeHeader!();
				}
			}))
    }

    if (this.templates.treeFooter) {
			const component = this

      snippets.treeFooter = createRawSnippet(() => ({
				render() {
					return component.templates.treeFooter!();
				}
			}))
    }

    if (this.templates.noDataFound) {
			const component = this

      snippets.noDataFound = createRawSnippet(() => ({
				render() {
					return component.templates.noDataFound!();
				}
			}))
    }

    if (this.templates.contextMenu) {
			const component = this

      snippets.contextMenu = createRawSnippet((node: () => LTreeNode<T>) => ({
				render() {
					return component.templates.contextMenu!(node());
				}
			}))
    }

    return snippets;
  }

  // Alternative: Set templates programmatically
  setNodeTemplate(template: TemplateFunction<T>): void {
    console.log("🚀 ~ TemplateSystem ~ setNodeTemplate ~ template:", template);
    this.templates.nodeTemplate = template;
  }

  setTreeHeader(template: HeaderFooterTemplate): void {
    this.templates.treeHeader = template;
  }

  setTreeFooter(template: HeaderFooterTemplate): void {
    this.templates.treeFooter = template;
  }

  setNoDataFoundTemplate(template: HeaderFooterTemplate): void {
    this.templates.noDataFound = template;
  }

  setContextMenuTemplate(template: TemplateFunction<T>): void {
    this.templates.contextMenu = template;
  }

  // Refresh templates from DOM
  refresh(): void {
    this.templates = {};
    this.parseSlotTemplates();
  }

  // Check if any custom templates are defined
  hasCustomTemplates(): boolean {
    return Object.keys(this.templates).length > 0;
  }

  // Get all template functions
  getTemplates(): TemplateSlots<T> {
    return { ...this.templates };
  }
}
