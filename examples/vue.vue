<template>
  <div class="vue-tree-example">
    <h1>🌲 Vue + Svelte TreeView Web Component</h1>
    
    <div class="controls-section">
      <h2>Controls</h2>
      <div class="controls">
        <input
          v-model="searchText"
          type="text"
          placeholder="Search nodes..."
          class="search-input"
          @input="updateSearch"
        />
        <button @click="expandAll" class="btn btn-primary">Expand All</button>
        <button @click="collapseAll" class="btn btn-secondary">Collapse All</button>
        <button @click="addNode" class="btn btn-success">Add Node</button>
        <button @click="removeSelected" class="btn btn-danger" :disabled="!selectedNode">
          Remove Selected
        </button>
      </div>
      <div v-if="selectedNode" class="selected-info">
        Selected: {{ selectedNode.data?.name }} ({{ selectedNode.path }})
      </div>
    </div>

    <div class="main-content">
      <div class="tree-section">
        <h2>Organization Chart</h2>
        <div class="tree-container">
          <svelte-tree-view
            ref="treeRef"
            id-member="id"
            path-member="path"
            :expand-level="2"
            :search-text="searchText"
            @node-clicked="handleNodeClicked"
            @selected-node-changed="handleSelectedChanged"
            @search-text-changed="handleSearchChanged"
          >
            <!-- Custom node template using Vue slot syntax -->
            <template #node-template="{ node }">
              <div class="custom-node">
                <span class="role-icon">
                  {{ node.data.role === 'ceo' ? '👑' :
                     node.data.role === 'manager' ? '👔' :
                     node.data.role === 'developer' ? '💻' :
                     node.data.role === 'designer' ? '🎨' : '👤' }}
                </span>
                <div class="node-info">
                  <div class="name">{{ node.data.name }}</div>
                  <div class="title">{{ node.data.title }}</div>
                  <div class="department" v-if="node.data.department">
                    {{ node.data.department }}
                  </div>
                </div>
              </div>
            </template>
            
            <template #tree-header>
              <div class="tree-header">
                <h3>🏢 Company Organization</h3>
                <p>Interactive organizational chart with {{ treeData.length }} employees</p>
              </div>
            </template>
          </svelte-tree-view>
        </div>
      </div>

      <div class="sidebar">
        <div class="event-log-section">
          <h2>Event Log</h2>
          <div class="event-log">
            <div
              v-for="event in eventLog"
              :key="event.id"
              class="event-item"
            >
              <span class="timestamp">{{ event.timestamp }}</span>
              <span class="event-type">{{ event.type }}</span>
              <span class="event-data">{{ event.data }}</span>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <h2>Statistics</h2>
          <div class="stats">
            <div class="stat-item">
              <span class="label">Total Employees:</span>
              <span class="value">{{ treeData.length }}</span>
            </div>
            <div class="stat-item">
              <span class="label">Search Results:</span>
              <span class="value">{{ filteredCount }}</span>
            </div>
            <div class="stat-item">
              <span class="label">Selected:</span>
              <span class="value">{{ selectedNode?.data?.name || 'None' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import '../dist/web-treeview.js'

// Types
interface Employee {
  id: string
  path: string
  name: string
  title: string
  department?: string
  role: 'ceo' | 'manager' | 'developer' | 'designer' | 'analyst' | 'intern'
  email?: string
}

interface EventLogItem {
  id: string
  timestamp: string
  type: string
  data: string
}

// Reactive data
const treeRef = ref<any>(null)
const searchText = ref('')
const selectedNode = ref<any>(null)
const eventLog = ref<EventLogItem[]>([])
const filteredCount = ref(0)

// Sample organizational data
const treeData = ref<Employee[]>([
  {
    id: '1',
    path: '1',
    name: 'Sarah Johnson',
    title: 'Chief Executive Officer',
    department: 'Executive',
    role: 'ceo',
    email: 'sarah.johnson@company.com'
  },
  {
    id: '2',
    path: '1.1',
    name: 'Michael Chen',
    title: 'VP of Engineering',
    department: 'Engineering',
    role: 'manager',
    email: 'michael.chen@company.com'
  },
  {
    id: '3',
    path: '1.1.1',
    name: 'Emily Rodriguez',
    title: 'Senior Frontend Developer',
    department: 'Engineering',
    role: 'developer',
    email: 'emily.rodriguez@company.com'
  },
  {
    id: '4',
    path: '1.1.2',
    name: 'David Kim',
    title: 'Senior Backend Developer',
    department: 'Engineering',
    role: 'developer',
    email: 'david.kim@company.com'
  },
  {
    id: '5',
    path: '1.1.3',
    name: 'Lisa Wang',
    title: 'DevOps Engineer',
    department: 'Engineering',
    role: 'developer',
    email: 'lisa.wang@company.com'
  },
  {
    id: '6',
    path: '1.2',
    name: 'Alex Thompson',
    title: 'VP of Design',
    department: 'Design',
    role: 'manager',
    email: 'alex.thompson@company.com'
  },
  {
    id: '7',
    path: '1.2.1',
    name: 'Maria Garcia',
    title: 'Senior UX Designer',
    department: 'Design',
    role: 'designer',
    email: 'maria.garcia@company.com'
  },
  {
    id: '8',
    path: '1.2.2',
    name: 'James Wilson',
    title: 'UI Designer',
    department: 'Design',
    role: 'designer',
    email: 'james.wilson@company.com'
  },
  {
    id: '9',
    path: '1.3',
    name: 'Jennifer Lee',
    title: 'VP of Product',
    department: 'Product',
    role: 'manager',
    email: 'jennifer.lee@company.com'
  },
  {
    id: '10',
    path: '1.3.1',
    name: 'Robert Brown',
    title: 'Product Analyst',
    department: 'Product',
    role: 'analyst',
    email: 'robert.brown@company.com'
  },
  {
    id: '11',
    path: '1.3.2',
    name: 'Anna Smith',
    title: 'Junior Product Manager',
    department: 'Product',
    role: 'intern',
    email: 'anna.smith@company.com'
  }
])

// Methods
const logEvent = (type: string, data: any) => {
  const event: EventLogItem = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleTimeString(),
    type,
    data: JSON.stringify(data, null, 2)
  }
  eventLog.value = [event, ...eventLog.value.slice(0, 19)] // Keep last 20 events
}

const updateSearch = () => {
  if (treeRef.value) {
    treeRef.value.searchText = searchText.value
  }
}

const handleNodeClicked = (event: CustomEvent) => {
  logEvent('node-clicked', {
    name: event.detail.node.data.name,
    title: event.detail.node.data.title
  })
}

const handleSelectedChanged = (event: CustomEvent) => {
  selectedNode.value = event.detail.selectedNode
  logEvent('selection-changed', {
    selected: event.detail.selectedNode?.data?.name || null
  })
}

const handleSearchChanged = (event: CustomEvent) => {
  logEvent('search-changed', {
    searchText: event.detail.searchText
  })
}

const expandAll = () => {
  treeRef.value?.expandAll()
  logEvent('action', 'Expanded all nodes')
}

const collapseAll = () => {
  treeRef.value?.collapseAll()
  logEvent('action', 'Collapsed all nodes')
}

const addNode = () => {
  const newEmployee: Employee = {
    id: Date.now().toString(),
    path: '1.4',
    name: `New Employee ${Date.now()}`,
    title: 'Intern',
    department: 'General',
    role: 'intern'
  }
  
  treeData.value.push(newEmployee)
  
  if (treeRef.value) {
    treeRef.value.data = [...treeData.value]
  }
  
  logEvent('action', `Added employee: ${newEmployee.name}`)
}

const removeSelected = () => {
  if (!selectedNode.value) return
  
  const selectedPath = selectedNode.value.path
  const employeeName = selectedNode.value.data.name
  
  // Remove the selected node and all its children
  treeData.value = treeData.value.filter(emp => 
    !emp.path.startsWith(selectedPath)
  )
  
  if (treeRef.value) {
    treeRef.value.data = [...treeData.value]
  }
  
  selectedNode.value = null
  logEvent('action', `Removed employee: ${employeeName}`)
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  
  if (treeRef.value) {
    // Set initial data
    treeRef.value.data = treeData.value
    
    // Log initial load
    logEvent('system', 'TreeView component initialized')
  }
})
</script>

<style scoped>
.vue-tree-example {
  font-family: Arial, sans-serif;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.controls-section {
  margin-bottom: 30px;
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 200px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007acc;
  color: white;
}

.btn-primary:hover {
  background-color: #005a9e;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover {
  background-color: #218838;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selected-info {
  padding: 8px 12px;
  background-color: #e3f2fd;
  border-radius: 4px;
  color: #1565c0;
  font-weight: 500;
}

.main-content {
  display: flex;
  gap: 20px;
}

.tree-section {
  flex: 1;
}

.tree-container {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  height: 500px;
  overflow: auto;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tree-header {
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 6px;
  margin-bottom: 15px;
  text-align: center;
}

.tree-header h3 {
  margin: 0 0 8px 0;
}

.tree-header p {
  margin: 0;
  opacity: 0.9;
}

.custom-node {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.role-icon {
  font-size: 20px;
  min-width: 24px;
}

.node-info .name {
  font-weight: 600;
  color: #2c3e50;
}

.node-info .title {
  font-size: 0.9em;
  color: #7f8c8d;
  margin-top: 2px;
}

.node-info .department {
  font-size: 0.8em;
  color: #95a5a6;
  font-style: italic;
}

.sidebar {
  width: 320px;
}

.event-log-section, .stats-section {
  margin-bottom: 20px;
}

.event-log {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 10px;
  height: 250px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.event-item {
  display: block;
  margin-bottom: 8px;
  padding: 4px;
  border-left: 3px solid #007acc;
  background: white;
  border-radius: 3px;
}

.timestamp {
  color: #6c757d;
  margin-right: 8px;
}

.event-type {
  font-weight: bold;
  color: #007acc;
  margin-right: 8px;
}

.event-data {
  color: #495057;
}

.stats {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-item .label {
  font-weight: 500;
  color: #495057;
}

.stat-item .value {
  font-weight: bold;
  color: #007acc;
}

h1, h2 {
  color: #2c3e50;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
}
</style>