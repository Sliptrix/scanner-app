/**
 * LONE WOLF BIOTECH - LINEAGE SERVICE
 * Phase 3: Enhanced Data Tracking & Lineage System
 * 
 * Provides comprehensive lineage tracking for containers including:
 * - Parent-child relationship tracking
 * - Generation depth (how many generations from original)
 * - Full lineage tree traversal (ancestors and descendants)
 * - Lineage validation and repair
 * - Orphan detection
 */

window.LineageService = (function() {
    'use strict';

    // Storage key for lineage data
    const STORAGE_KEY = 'lwb_lineage_data';

    // Lineage data store
    const lineageStore = {
        // Map: containerId -> { parent, children[], generation, createdAt, metadata }
        nodes: {},
        // Last updated timestamp
        lastUpdated: null
    };

    // Initialize - load from localStorage
    function initialize() {
        loadFromStorage();
        console.log('LineageService: Initialized with', Object.keys(lineageStore.nodes).length, 'nodes');
        
        // Listen for inventory changes to rebuild lineage
        window.addEventListener('inventoryUpdated', handleInventoryUpdate);
        
        // Initial build from existing inventory
        rebuildFromInventory();
    }

    /**
     * Load lineage data from localStorage
     */
    function loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                lineageStore.nodes = parsed.nodes || {};
                lineageStore.lastUpdated = parsed.lastUpdated;
                return true;
            }
        } catch (error) {
            console.error('LineageService: Failed to load from storage:', error);
        }
        return false;
    }

    /**
     * Save lineage data to localStorage
     */
    function saveToStorage() {
        try {
            lineageStore.lastUpdated = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lineageStore));
        } catch (error) {
            console.error('LineageService: Failed to save to storage:', error);
        }
    }

    /**
     * Rebuild lineage from current inventory
     */
    function rebuildFromInventory() {
        const inventory = StateManager.getState('inventory') || [];
        
        // Build nodes from inventory
        inventory.forEach(item => {
            const containerId = String(item.containerId);
            
            if (!lineageStore.nodes[containerId]) {
                lineageStore.nodes[containerId] = {
                    id: containerId,
                    parent: null,
                    children: [],
                    generation: 0,
                    createdAt: item.date || item.timestamp || new Date().toISOString(),
                    strain: item.strain,
                    owner: item.owner,
                    status: item.status || 'Active'
                };
            }
            
            // Update parent relationship from transfer data
            if (item.transferSource) {
                const parentId = String(item.transferSource);
                lineageStore.nodes[containerId].parent = parentId;
                
                // Ensure parent node exists
                if (!lineageStore.nodes[parentId]) {
                    lineageStore.nodes[parentId] = {
                        id: parentId,
                        parent: null,
                        children: [],
                        generation: 0,
                        createdAt: null,
                        strain: item.strain,
                        owner: item.owner,
                        status: 'Consumed'
                    };
                }
                
                // Add child to parent if not already present
                if (!lineageStore.nodes[parentId].children.includes(containerId)) {
                    lineageStore.nodes[parentId].children.push(containerId);
                }
            }
        });
        
        // Calculate generations for all nodes
        recalculateGenerations();
        
        saveToStorage();
        console.log('LineageService: Rebuilt from inventory,', Object.keys(lineageStore.nodes).length, 'nodes');
    }

    /**
     * Recalculate generation depth for all nodes
     */
    function recalculateGenerations() {
        // Find roots (nodes with no parent)
        const roots = Object.values(lineageStore.nodes).filter(node => !node.parent);
        
        // BFS to assign generations
        const visited = new Set();
        const queue = roots.map(root => ({ id: root.id, generation: 0 }));
        
        while (queue.length > 0) {
            const { id, generation } = queue.shift();
            
            if (visited.has(id)) continue;
            visited.add(id);
            
            const node = lineageStore.nodes[id];
            if (node) {
                node.generation = generation;
                
                // Add children to queue
                node.children.forEach(childId => {
                    if (!visited.has(childId)) {
                        queue.push({ id: childId, generation: generation + 1 });
                    }
                });
            }
        }
    }

    /**
     * Handle inventory update events
     */
    function handleInventoryUpdate(event) {
        const { item, action } = event.detail || {};
        
        if (action === 'add' && item) {
            addNode(item.containerId || item.asset_id, {
                parent: item.transferSource ? String(item.transferSource) : null,
                strain: item.strain || item.strain_name,
                owner: item.owner || item.owner_code,
                createdAt: item.date || item.date_created || new Date().toISOString()
            });
        } else if (action === 'delete' && item) {
            // Don't delete node, just mark as deleted
            const node = lineageStore.nodes[String(item.containerId || item.asset_id)];
            if (node) {
                node.status = 'Deleted';
                saveToStorage();
            }
        }
    }

    /**
     * Add a new node to the lineage tree
     * @param {string} containerId - Container ID
     * @param {Object} options - Node options (parent, metadata)
     */
    function addNode(containerId, options = {}) {
        const id = String(containerId);
        const parentId = options.parent ? String(options.parent) : null;
        
        // Create or update node
        lineageStore.nodes[id] = {
            id: id,
            parent: parentId,
            children: lineageStore.nodes[id]?.children || [],
            generation: 0,
            createdAt: options.createdAt || new Date().toISOString(),
            strain: options.strain,
            owner: options.owner,
            status: options.status || 'Active',
            metadata: options.metadata || {}
        };
        
        // Update parent's children list
        if (parentId && lineageStore.nodes[parentId]) {
            if (!lineageStore.nodes[parentId].children.includes(id)) {
                lineageStore.nodes[parentId].children.push(id);
            }
        }
        
        // Recalculate generation
        if (parentId && lineageStore.nodes[parentId]) {
            lineageStore.nodes[id].generation = lineageStore.nodes[parentId].generation + 1;
        }
        
        saveToStorage();
        return lineageStore.nodes[id];
    }

    /**
     * Record a transfer/split operation
     * @param {string} sourceId - Source container ID
     * @param {Array} destinationIds - Array of destination container IDs
     * @param {Object} options - Transfer options
     */
    function recordTransfer(sourceId, destinationIds, options = {}) {
        const srcId = String(sourceId);
        
        // Ensure source node exists
        if (!lineageStore.nodes[srcId]) {
            addNode(srcId, {
                strain: options.strain,
                owner: options.owner
            });
        }
        
        // Mark source as consumed if this is a full transfer
        if (options.consumed) {
            lineageStore.nodes[srcId].status = 'Consumed';
            lineageStore.nodes[srcId].consumedAt = new Date().toISOString();
        }
        
        // Add destination nodes
        destinationIds.forEach(destId => {
            addNode(String(destId), {
                parent: srcId,
                strain: options.strain || lineageStore.nodes[srcId].strain,
                owner: options.owner || lineageStore.nodes[srcId].owner,
                createdAt: new Date().toISOString(),
                metadata: {
                    transferType: options.transferType || 'split',
                    tissueCount: options.tissueCount
                }
            });
        });
        
        // Emit event for UI updates
        window.dispatchEvent(new CustomEvent('lineageUpdated', {
            detail: { sourceId: srcId, destinationIds }
        }));
        
        return getNode(srcId);
    }

    /**
     * Get a node by ID
     */
    function getNode(containerId) {
        return lineageStore.nodes[String(containerId)] || null;
    }

    /**
     * Get generation depth for a container
     */
    function getGeneration(containerId) {
        const node = getNode(containerId);
        return node ? node.generation : 0;
    }

    /**
     * Get all ancestors of a container (path to root)
     * @param {string} containerId - Container ID
     * @returns {Array} Array of ancestor nodes from immediate parent to root
     */
    function getAncestors(containerId) {
        const ancestors = [];
        let current = getNode(containerId);
        
        // Prevent infinite loops
        const visited = new Set();
        
        while (current && current.parent && !visited.has(current.id)) {
            visited.add(current.id);
            const parent = getNode(current.parent);
            if (parent) {
                ancestors.push(parent);
                current = parent;
            } else {
                break;
            }
        }
        
        return ancestors;
    }

    /**
     * Get all descendants of a container (full tree below)
     * @param {string} containerId - Container ID
     * @returns {Array} Array of descendant nodes (breadth-first order)
     */
    function getDescendants(containerId) {
        const descendants = [];
        const queue = [String(containerId)];
        const visited = new Set();
        
        // Skip the starting node itself
        visited.add(String(containerId));
        
        while (queue.length > 0) {
            const id = queue.shift();
            const node = getNode(id);
            
            if (node && node.children) {
                node.children.forEach(childId => {
                    if (!visited.has(childId)) {
                        visited.add(childId);
                        const child = getNode(childId);
                        if (child) {
                            descendants.push(child);
                            queue.push(childId);
                        }
                    }
                });
            }
        }
        
        return descendants;
    }

    /**
     * Get full lineage tree for a container
     * @param {string} containerId - Container ID
     * @returns {Object} Full tree with ancestors and descendants
     */
    function getFullLineage(containerId) {
        const node = getNode(containerId);
        if (!node) return null;
        
        return {
            current: node,
            ancestors: getAncestors(containerId),
            descendants: getDescendants(containerId),
            rootId: getRootAncestor(containerId),
            totalDescendants: getDescendants(containerId).length,
            generation: node.generation
        };
    }

    /**
     * Get the root ancestor (original container)
     */
    function getRootAncestor(containerId) {
        const ancestors = getAncestors(containerId);
        if (ancestors.length > 0) {
            return ancestors[ancestors.length - 1].id;
        }
        return containerId;
    }

    /**
     * Check if container has children
     */
    function hasChildren(containerId) {
        const node = getNode(containerId);
        return node && node.children && node.children.length > 0;
    }

    /**
     * Get direct children of a container
     */
    function getChildren(containerId) {
        const node = getNode(containerId);
        if (!node || !node.children) return [];
        
        return node.children
            .map(childId => getNode(childId))
            .filter(child => child !== null);
    }

    /**
     * Get parent of a container
     */
    function getParent(containerId) {
        const node = getNode(containerId);
        if (!node || !node.parent) return null;
        return getNode(node.parent);
    }

    /**
     * Find orphan containers (no parent and not a root, or parent doesn't exist)
     * @returns {Array} Array of orphan container IDs
     */
    function findOrphans() {
        const orphans = [];
        
        Object.values(lineageStore.nodes).forEach(node => {
            if (node.parent) {
                // Has a parent reference but parent doesn't exist
                if (!lineageStore.nodes[node.parent]) {
                    orphans.push({
                        id: node.id,
                        missingParent: node.parent,
                        reason: 'Missing parent node'
                    });
                }
            }
        });
        
        return orphans;
    }

    /**
     * Find containers with no descendants and no parent (isolated nodes)
     * @returns {Array} Array of isolated container IDs
     */
    function findIsolatedNodes() {
        return Object.values(lineageStore.nodes)
            .filter(node => 
                !node.parent && 
                (!node.children || node.children.length === 0) &&
                node.status === 'Active'
            )
            .map(node => node.id);
    }

    /**
     * Validate lineage consistency (check for circular references)
     * @returns {Object} Validation result with issues found
     */
    function validateLineage() {
        const issues = [];
        
        Object.values(lineageStore.nodes).forEach(node => {
            // Check for circular references
            const visited = new Set();
            let current = node;
            
            while (current && current.parent) {
                if (visited.has(current.id)) {
                    issues.push({
                        type: 'circular',
                        nodeId: node.id,
                        message: `Circular reference detected at ${current.id}`
                    });
                    break;
                }
                visited.add(current.id);
                current = getNode(current.parent);
            }
            
            // Check for missing children
            if (node.children) {
                node.children.forEach(childId => {
                    if (!lineageStore.nodes[childId]) {
                        issues.push({
                            type: 'missingChild',
                            nodeId: node.id,
                            missingId: childId,
                            message: `Child ${childId} referenced but does not exist`
                        });
                    }
                });
            }
        });
        
        return {
            valid: issues.length === 0,
            issueCount: issues.length,
            issues: issues
        };
    }

    /**
     * Repair lineage issues
     * @returns {Object} Repair report
     */
    function repairLineage() {
        const report = {
            orphansFixed: 0,
            circularBroken: 0,
            missingChildrenRemoved: 0
        };
        
        const validation = validateLineage();
        
        validation.issues.forEach(issue => {
            if (issue.type === 'circular') {
                // Break circular reference by removing parent
                const node = getNode(issue.nodeId);
                if (node) {
                    node.parent = null;
                    report.circularBroken++;
                }
            } else if (issue.type === 'missingChild') {
                // Remove reference to missing child
                const node = getNode(issue.nodeId);
                if (node && node.children) {
                    node.children = node.children.filter(id => lineageStore.nodes[id]);
                    report.missingChildrenRemoved++;
                }
            }
        });
        
        // Recalculate generations after repairs
        recalculateGenerations();
        saveToStorage();
        
        return report;
    }

    /**
     * Get lineage statistics
     * @returns {Object} Lineage statistics
     */
    function getStats() {
        const nodes = Object.values(lineageStore.nodes);
        const generations = nodes.map(n => n.generation);
        const maxGeneration = Math.max(...generations, 0);
        
        const byGeneration = {};
        nodes.forEach(node => {
            byGeneration[node.generation] = (byGeneration[node.generation] || 0) + 1;
        });
        
        return {
            totalNodes: nodes.length,
            activeNodes: nodes.filter(n => n.status === 'Active').length,
            consumedNodes: nodes.filter(n => n.status === 'Consumed').length,
            rootNodes: nodes.filter(n => !n.parent).length,
            leafNodes: nodes.filter(n => !n.children || n.children.length === 0).length,
            maxGeneration: maxGeneration,
            byGeneration: byGeneration,
            lastUpdated: lineageStore.lastUpdated
        };
    }

    /**
     * Export lineage tree as JSON
     */
    function exportLineage() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            nodes: lineageStore.nodes,
            stats: getStats()
        };
    }

    /**
     * Import lineage data
     */
    function importLineage(data) {
        if (data && data.nodes) {
            lineageStore.nodes = { ...lineageStore.nodes, ...data.nodes };
            recalculateGenerations();
            saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * Get lineage path as formatted string
     * @param {string} containerId - Container ID
     * @returns {string} Formatted lineage path (e.g., "100 → 101 → 102")
     */
    function getLineagePath(containerId) {
        const ancestors = getAncestors(containerId);
        const path = ancestors.reverse().map(a => a.id);
        path.push(containerId);
        return path.join(' → ');
    }

    /**
     * Build a visual tree structure for a container
     * @param {string} containerId - Container ID
     * @param {number} maxDepth - Maximum depth to traverse (default: 5)
     * @returns {Object} Tree structure for rendering
     */
    function buildVisualTree(containerId, maxDepth = 5) {
        function buildNode(id, depth) {
            if (depth > maxDepth) return null;
            
            const node = getNode(id);
            if (!node) return null;
            
            return {
                id: node.id,
                generation: node.generation,
                strain: node.strain,
                status: node.status,
                childCount: node.children ? node.children.length : 0,
                children: (node.children || [])
                    .map(childId => buildNode(childId, depth + 1))
                    .filter(child => child !== null)
            };
        }
        
        // Start from root ancestor
        const rootId = getRootAncestor(containerId);
        return buildNode(rootId, 0);
    }

    // Public API
    return {
        initialize,
        
        // Node operations
        addNode,
        getNode,
        
        // Transfer tracking
        recordTransfer,
        
        // Lineage queries
        getGeneration,
        getAncestors,
        getDescendants,
        getFullLineage,
        getRootAncestor,
        getParent,
        getChildren,
        hasChildren,
        getLineagePath,
        buildVisualTree,
        
        // Validation & repair
        findOrphans,
        findIsolatedNodes,
        validateLineage,
        repairLineage,
        
        // Stats & export
        getStats,
        exportLineage,
        importLineage,
        
        // Utility
        rebuildFromInventory,
        saveToStorage
    };

})();
