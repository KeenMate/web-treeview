import React, { useEffect, useRef, useState } from 'react';
import '../dist/web-treeview.js';
import type { SvelteTreeView } from '../dist/web-treeview.js';

// TypeScript declaration for the web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'svelte-tree-view': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'id-member'?: string;
        'path-member'?: string;
        'expand-level'?: number;
        'search-text'?: string;
        ref?: React.Ref<SvelteTreeView>;
      };
    }
  }
}

interface TreeNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  size?: string;
}

const sampleData: TreeNode[] = [
  {
    id: '1',
    path: '1',
    name: 'src',
    type: 'folder',
  },
  {
    id: '2',
    path: '1.1',
    name: 'components',
    type: 'folder',
  },
  {
    id: '3',
    path: '1.1.1',
    name: 'TreeView.tsx',
    type: 'file',
    size: '12.3KB',
  },
  {
    id: '4',
    path: '1.1.2',
    name: 'Button.tsx',
    type: 'file',
    size: '2.1KB',
  },
  {
    id: '5',
    path: '1.2',
    name: 'hooks',
    type: 'folder',
  },
  {
    id: '6',
    path: '1.2.1',
    name: 'useTreeState.ts',
    type: 'file',
    size: '3.4KB',
  },
  {
    id: '7',
    path: '1.3',
    name: 'App.tsx',
    type: 'file',
    size: '5.7KB',
  },
  {
    id: '8',
    path: '2',
    name: 'public',
    type: 'folder',
  },
  {
    id: '9',
    path: '2.1',
    name: 'index.html',
    type: 'file',
    size: '1.2KB',
  },
];

export const ReactTreeViewExample: React.FC = () => {
  const treeRef = useRef<SvelteTreeView>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    // Set initial data
    tree.data = sampleData;

    // Set up event listeners
    const handleNodeClicked = (e: CustomEvent) => {
      const nodeName = e.detail.node.data.name;
      setSelectedNode(nodeName);
      addEvent(`Node clicked: ${nodeName}`);
    };

    const handleSearchChanged = (e: CustomEvent) => {
      addEvent(`Search changed: ${e.detail.searchText}`);
    };

    tree.addEventListener('node-clicked', handleNodeClicked);
    tree.addEventListener('search-text-changed', handleSearchChanged);

    // Cleanup
    return () => {
      tree?.removeEventListener('node-clicked', handleNodeClicked);
      tree?.removeEventListener('search-text-changed', handleSearchChanged);
    };
  }, []);

  const addEvent = (event: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [...prev.slice(-9), `[${timestamp}] ${event}`]);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    if (treeRef.current) {
      treeRef.current.searchText = value;
    }
  };

  const expandAll = () => {
    treeRef.current?.expandAll();
    addEvent('Expanded all nodes');
  };

  const collapseAll = () => {
    treeRef.current?.collapseAll();
    addEvent('Collapsed all nodes');
  };

  const addNewNode = () => {
    if (!treeRef.current) return;
    
    const newNode: TreeNode = {
      id: Date.now().toString(),
      path: '1.4',
      name: `NewComponent${Date.now()}.tsx`,
      type: 'file',
      size: '0.8KB',
    };

    treeRef.current.data = [...sampleData, newNode];
    addEvent(`Added new node: ${newNode.name}`);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <h1>🌲 React + Svelte TreeView Web Component</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Controls</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchText}
            onChange={handleSearchChange}
            style={{ 
              padding: '8px 12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              minWidth: '200px'
            }}
          />
          <button 
            onClick={expandAll}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Expand All
          </button>
          <button 
            onClick={collapseAll}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Collapse All
          </button>
          <button 
            onClick={addNewNode}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add File
          </button>
        </div>
        {selectedNode && (
          <div style={{ 
            padding: '8px 12px',
            backgroundColor: '#e3f2fd',
            borderRadius: '4px',
            color: '#1565c0'
          }}>
            Selected: {selectedNode}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h2>File Explorer</h2>
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '10px',
            height: '400px',
            overflow: 'auto'
          }}>
            <svelte-tree-view
              ref={treeRef}
              id-member="id"
              path-member="path"
              expand-level={2}
              search-text={searchText}
            />
          </div>
        </div>

        <div style={{ width: '300px' }}>
          <h2>Event Log</h2>
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '4px',
            padding: '10px',
            height: '400px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {events.map((event, index) => (
              <div key={index}>{event}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReactTreeViewExample;