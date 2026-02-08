/**
 * LONE WOLF BIOTECH - LINEAGE UI
 * Phase 3: Enhanced Data Tracking & Lineage System
 * 
 * UI components for lineage visualization including:
 * - Lineage tree/graph views
 * - Container badges (generation #, has children, etc.)
 * - Click-through navigation
 * - Lineage filters for inventory table
 * - Container history timeline
 */

window.LineageUI = (function() {
    'use strict';

    // CSS for lineage components
    const LINEAGE_CSS = `
        /* Lineage Badge Styles */
        .lineage-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .lineage-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .lineage-badge.generation-0 {
            background: #e8f5e9;
            color: #2e7d32;
        }
        
        .lineage-badge.generation-1 {
            background: #e3f2fd;
            color: #1565c0;
        }
        
        .lineage-badge.generation-2 {
            background: #fff3e0;
            color: #ef6c00;
        }
        
        .lineage-badge.generation-3plus {
            background: #fce4ec;
            color: #c62828;
        }
        
        .lineage-badge.has-children {
            border: 2px solid currentColor;
        }
        
        .lineage-badge.is-consumed {
            opacity: 0.6;
            text-decoration: line-through;
        }
        
        /* Lineage Tree Styles */
        .lineage-tree-container {
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            overflow-x: auto;
        }
        
        .lineage-tree {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .lineage-node {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .lineage-node-card {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            min-width: 150px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .lineage-node-card:hover {
            border-color: #3b82f6;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }
        
        .lineage-node-card.current {
            border-color: #10b981;
            background: #ecfdf5;
        }
        
        .lineage-node-card.consumed {
            opacity: 0.6;
            border-style: dashed;
        }
        
        .lineage-node-id {
            font-weight: 700;
            font-size: 1.1rem;
            color: #1f2937;
        }
        
        .lineage-node-meta {
            font-size: 0.8rem;
            color: #6b7280;
            margin-top: 4px;
        }
        
        .lineage-node-children {
            display: flex;
            gap: 16px;
            margin-top: 16px;
            position: relative;
        }
        
        .lineage-node-children::before {
            content: '';
            position: absolute;
            top: -16px;
            left: 50%;
            width: 2px;
            height: 16px;
            background: #cbd5e1;
        }
        
        .lineage-connector {
            position: relative;
        }
        
        .lineage-connector::before {
            content: '';
            position: absolute;
            top: -8px;
            left: 50%;
            width: 2px;
            height: 8px;
            background: #cbd5e1;
        }
        
        /* Timeline Styles */
        .container-timeline {
            position: relative;
            padding-left: 32px;
        }
        
        .container-timeline::before {
            content: '';
            position: absolute;
            left: 12px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e2e8f0;
        }
        
        .timeline-entry {
            position: relative;
            padding: 12px 16px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 12px;
        }
        
        .timeline-entry::before {
            content: '';
            position: absolute;
            left: -26px;
            top: 16px;
            width: 12px;
            height: 12px;
            background: #3b82f6;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 0 2px #e2e8f0;
        }
        
        .timeline-entry.type-created::before { background: #10b981; }
        .timeline-entry.type-split::before { background: #8b5cf6; }
        .timeline-entry.type-transferred::before { background: #f59e0b; }
        .timeline-entry.type-discarded::before { background: #ef4444; }
        .timeline-entry.type-location::before { background: #06b6d4; }
        
        .timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .timeline-type {
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .timeline-time {
            font-size: 0.8rem;
            color: #6b7280;
        }
        
        .timeline-message {
            font-size: 0.9rem;
            color: #374151;
        }
        
        .timeline-user {
            font-size: 0.8rem;
            color: #9ca3af;
            margin-top: 4px;
        }
        
        /* Lineage Modal */
        .lineage-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }
        
        .lineage-modal-content {
            background: white;
            border-radius: 16px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .lineage-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            position: sticky;
            top: 0;
            background: white;
            z-index: 1;
        }
        
        .lineage-modal-body {
            padding: 24px;
        }
        
        .lineage-modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
            padding: 4px;
        }
        
        .lineage-modal-close:hover {
            color: #1f2937;
        }
        
        /* Lineage Stats Cards */
        .lineage-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .lineage-stat-card {
            background: #f8fafc;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
        }
        
        .lineage-stat-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: #1f2937;
        }
        
        .lineage-stat-label {
            font-size: 0.8rem;
            color: #6b7280;
            margin-top: 4px;
        }
    `;

    /**
     * Initialize LineageUI
     */
    function initialize() {
        injectCSS();
        console.log('LineageUI: Initialized');
    }

    /**
     * Inject CSS styles
     */
    function injectCSS() {
        if (document.getElementById('lineage-ui-css')) return;
        
        const style = document.createElement('style');
        style.id = 'lineage-ui-css';
        style.textContent = LINEAGE_CSS;
        document.head.appendChild(style);
    }

    /**
     * Create a lineage badge for a container
     * @param {string} containerId - Container ID
     * @param {Object} options - Badge options
     * @returns {string} HTML string for badge
     */
    function createBadge(containerId, options = {}) {
        if (!window.LineageService) {
            return '<span class="lineage-badge generation-0">G0</span>';
        }
        
        const node = LineageService.getNode(containerId);
        if (!node) {
            return '<span class="lineage-badge generation-0">Original</span>';
        }
        
        const generation = node.generation || 0;
        const hasChildren = node.children && node.children.length > 0;
        const isConsumed = node.status === 'Consumed';
        
        let genClass = 'generation-0';
        if (generation === 1) genClass = 'generation-1';
        else if (generation === 2) genClass = 'generation-2';
        else if (generation >= 3) genClass = 'generation-3plus';
        
        const classes = [
            'lineage-badge',
            genClass,
            hasChildren ? 'has-children' : '',
            isConsumed ? 'is-consumed' : ''
        ].filter(c => c).join(' ');
        
        const icon = hasChildren ? '🔗' : (generation === 0 ? '🌱' : '📦');
        const label = generation === 0 ? 'Original' : `G${generation}`;
        const childInfo = hasChildren ? ` (${node.children.length} children)` : '';
        
        return `<span class="${classes}" onclick="LineageUI.showLineageModal('${containerId}')" title="Click to view lineage${childInfo}">
            ${icon} ${label}
        </span>`;
    }

    /**
     * Create enhanced lineage display for table row
     * @param {Object} item - Inventory item
     * @returns {string} HTML string
     */
    function createTableLineageDisplay(item) {
        const containerId = item.containerId;
        const badge = createBadge(containerId);
        
        let extra = '';
        if (item.transferSource) {
            extra = `<span style="font-size: 0.75rem; color: #6b7280; display: block; margin-top: 2px;">
                ← from ${UIUtils.sanitize(item.transferSource)}
            </span>`;
        }
        
        return badge + extra;
    }

    /**
     * Show lineage modal for a container
     * @param {string} containerId - Container ID
     */
    function showLineageModal(containerId) {
        // Close any existing modal
        closeLineageModal();
        
        if (!window.LineageService) {
            console.error('LineageService not available');
            return;
        }
        
        const lineage = LineageService.getFullLineage(containerId);
        if (!lineage) {
            NotificationSystem.error(`No lineage data found for container ${containerId}`);
            return;
        }
        
        const node = lineage.current;
        const inventory = StateManager.getState('inventory') || [];
        const containerData = inventory.find(i => String(i.containerId) === String(containerId));
        
        // Build modal content
        const modalHTML = `
            <div class="lineage-modal" id="lineageModal" onclick="if(event.target === this) LineageUI.closeLineageModal()">
                <div class="lineage-modal-content" style="min-width: 600px;">
                    <div class="lineage-modal-header">
                        <div>
                            <h2 style="margin: 0;">📊 Container ${containerId} Lineage</h2>
                            <p style="margin: 4px 0 0; color: #6b7280; font-size: 0.9rem;">
                                ${containerData?.strain || 'Unknown strain'} • ${containerData?.owner || 'Unknown owner'}
                            </p>
                        </div>
                        <button class="lineage-modal-close" onclick="LineageUI.closeLineageModal()">&times;</button>
                    </div>
                    <div class="lineage-modal-body">
                        <!-- Stats -->
                        <div class="lineage-stats-grid">
                            <div class="lineage-stat-card">
                                <div class="lineage-stat-value">${node.generation}</div>
                                <div class="lineage-stat-label">Generation</div>
                            </div>
                            <div class="lineage-stat-card">
                                <div class="lineage-stat-value">${lineage.ancestors.length}</div>
                                <div class="lineage-stat-label">Ancestors</div>
                            </div>
                            <div class="lineage-stat-card">
                                <div class="lineage-stat-value">${lineage.descendants.length}</div>
                                <div class="lineage-stat-label">Descendants</div>
                            </div>
                            <div class="lineage-stat-card">
                                <div class="lineage-stat-value">${node.children?.length || 0}</div>
                                <div class="lineage-stat-label">Direct Children</div>
                            </div>
                        </div>
                        
                        <!-- Tabs -->
                        <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                            <button class="lineage-tab active" data-tab="tree" onclick="LineageUI.switchTab('tree')">
                                🌳 Tree View
                            </button>
                            <button class="lineage-tab" data-tab="timeline" onclick="LineageUI.switchTab('timeline')">
                                📜 History
                            </button>
                            <button class="lineage-tab" data-tab="path" onclick="LineageUI.switchTab('path')">
                                🔗 Path
                            </button>
                        </div>
                        
                        <!-- Tree View -->
                        <div id="lineage-tab-tree" class="lineage-tab-content">
                            ${buildTreeView(containerId)}
                        </div>
                        
                        <!-- Timeline View -->
                        <div id="lineage-tab-timeline" class="lineage-tab-content" style="display: none;">
                            ${buildTimelineView(containerId)}
                        </div>
                        
                        <!-- Path View -->
                        <div id="lineage-tab-path" class="lineage-tab-content" style="display: none;">
                            ${buildPathView(containerId)}
                        </div>
                        
                        <!-- Actions -->
                        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
                            <button onclick="LineageUI.showDescendants('${containerId}')" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                🌱 Show All Descendants
                            </button>
                            <button onclick="LineageUI.exportLineageReport('${containerId}')" style="padding: 8px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                📊 Export Report
                            </button>
                            <button onclick="LineageUI.closeLineageModal()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Add tab button styles
        const tabStyle = document.createElement('style');
        tabStyle.textContent = `
            .lineage-tab {
                padding: 8px 16px;
                background: none;
                border: none;
                font-size: 0.9rem;
                cursor: pointer;
                color: #6b7280;
                border-bottom: 2px solid transparent;
                margin-bottom: -10px;
            }
            .lineage-tab:hover { color: #374151; }
            .lineage-tab.active {
                color: #3b82f6;
                border-bottom-color: #3b82f6;
            }
        `;
        document.head.appendChild(tabStyle);
    }

    /**
     * Close lineage modal
     */
    function closeLineageModal() {
        const modal = document.getElementById('lineageModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Switch tabs in modal
     */
    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.lineage-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Show/hide content
        document.querySelectorAll('.lineage-tab-content').forEach(content => {
            content.style.display = content.id === `lineage-tab-${tabName}` ? 'block' : 'none';
        });
    }

    /**
     * Build tree view HTML
     */
    function buildTreeView(containerId) {
        if (!window.LineageService) return '<p>LineageService not available</p>';
        
        const tree = LineageService.buildVisualTree(containerId, 3);
        if (!tree) return '<p>No lineage data available</p>';
        
        function renderNode(node, isCurrent = false) {
            const cardClass = [
                'lineage-node-card',
                node.id === containerId ? 'current' : '',
                node.status === 'Consumed' ? 'consumed' : ''
            ].filter(c => c).join(' ');
            
            const childrenHTML = node.children && node.children.length > 0
                ? `<div class="lineage-node-children">
                    ${node.children.map(child => `
                        <div class="lineage-connector">
                            ${renderNode(child)}
                        </div>
                    `).join('')}
                   </div>`
                : '';
            
            return `
                <div class="lineage-node">
                    <div class="${cardClass}" onclick="LineageUI.showLineageModal('${node.id}')">
                        <div class="lineage-node-id">${node.id}</div>
                        <div class="lineage-node-meta">
                            G${node.generation} ${node.strain ? `• ${node.strain}` : ''}
                            ${node.childCount > 0 ? `<br>👶 ${node.childCount} children` : ''}
                        </div>
                    </div>
                    ${childrenHTML}
                </div>
            `;
        }
        
        return `
            <div class="lineage-tree-container">
                <div class="lineage-tree">
                    ${renderNode(tree)}
                </div>
            </div>
        `;
    }

    /**
     * Build timeline view HTML
     */
    function buildTimelineView(containerId) {
        if (!window.AuditService) return '<p>AuditService not available</p>';
        
        const timeline = AuditService.getContainerTimeline(containerId);
        
        if (timeline.length === 0) {
            return '<p style="color: #6b7280; text-align: center; padding: 20px;">No history recorded for this container</p>';
        }
        
        const entriesHTML = timeline.map(entry => {
            const typeClass = entry.type.toLowerCase().replace(/_/g, '-').replace('container-', '');
            
            return `
                <div class="timeline-entry type-${typeClass}">
                    <div class="timeline-header">
                        <span class="timeline-type">${entry.icon} ${entry.typeLabel}</span>
                        <span class="timeline-time" title="${entry.formattedTime}">${entry.relativeTime}</span>
                    </div>
                    <div class="timeline-message">${entry.message}</div>
                    <div class="timeline-user">by ${entry.user}</div>
                    ${entry.changes ? buildChangesDisplay(entry.changes) : ''}
                </div>
            `;
        }).join('');
        
        return `<div class="container-timeline">${entriesHTML}</div>`;
    }

    /**
     * Build changes display for timeline
     */
    function buildChangesDisplay(changes) {
        const changeItems = Object.entries(changes).map(([key, value]) => {
            if (typeof value === 'object' && value.from !== undefined) {
                return `<span style="background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">
                    ${key}: ${value.from} → ${value.to}
                </span>`;
            }
            return '';
        }).filter(c => c).join(' ');
        
        return changeItems ? `<div style="margin-top: 8px;">${changeItems}</div>` : '';
    }

    /**
     * Build path view HTML
     */
    function buildPathView(containerId) {
        if (!window.LineageService) return '<p>LineageService not available</p>';
        
        const lineage = LineageService.getFullLineage(containerId);
        if (!lineage) return '<p>No lineage data</p>';
        
        // Build ancestor path
        const ancestors = lineage.ancestors.reverse();
        const pathNodes = [...ancestors, lineage.current];
        
        const pathHTML = pathNodes.map((node, idx) => {
            const isLast = idx === pathNodes.length - 1;
            const isCurrent = node.id === containerId;
            
            return `
                <div style="display: flex; align-items: center;">
                    <div style="
                        padding: 12px 20px;
                        background: ${isCurrent ? '#ecfdf5' : '#f8fafc'};
                        border: 2px solid ${isCurrent ? '#10b981' : '#e2e8f0'};
                        border-radius: 8px;
                        cursor: pointer;
                    " onclick="LineageUI.showLineageModal('${node.id}')">
                        <div style="font-weight: 700; color: ${isCurrent ? '#059669' : '#1f2937'};">
                            ${node.id}
                        </div>
                        <div style="font-size: 0.8rem; color: #6b7280;">
                            Generation ${node.generation}
                        </div>
                    </div>
                    ${!isLast ? '<span style="margin: 0 12px; font-size: 1.2rem; color: #9ca3af;">→</span>' : ''}
                </div>
            `;
        }).join('');
        
        return `
            <div style="padding: 16px;">
                <h4 style="margin: 0 0 16px; color: #374151;">Lineage Path (Root to Current)</h4>
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
                    ${pathHTML}
                </div>
                
                ${lineage.descendants.length > 0 ? `
                    <h4 style="margin: 24px 0 16px; color: #374151;">Descendants (${lineage.descendants.length})</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${lineage.descendants.slice(0, 20).map(desc => `
                            <span style="
                                padding: 4px 12px;
                                background: #eff6ff;
                                border: 1px solid #93c5fd;
                                border-radius: 16px;
                                font-size: 0.85rem;
                                cursor: pointer;
                            " onclick="LineageUI.showLineageModal('${desc.id}')">
                                ${desc.id} (G${desc.generation})
                            </span>
                        `).join('')}
                        ${lineage.descendants.length > 20 ? `<span style="color: #6b7280;">+${lineage.descendants.length - 20} more</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show all descendants in inventory filter
     */
    function showDescendants(containerId) {
        closeLineageModal();
        
        if (!window.LineageService) return;
        
        const descendants = LineageService.getDescendants(containerId);
        const descendantIds = descendants.map(d => d.id);
        descendantIds.push(containerId); // Include the source
        
        // Filter inventory to show only these containers
        const inventory = StateManager.getState('inventory') || [];
        const filtered = inventory.filter(item => 
            descendantIds.includes(String(item.containerId))
        );
        
        if (window.InventoryTableManager) {
            InventoryTableManager.buildTableFromData(filtered);
            
            // Update stats display
            const filteredCount = document.getElementById('filteredCount');
            const totalCount = document.getElementById('totalCount');
            if (filteredCount) filteredCount.textContent = filtered.length;
            if (totalCount) totalCount.textContent = inventory.length;
        }
        
        NotificationSystem.info(`Showing ${filtered.length} containers in lineage of ${containerId}`);
    }

    /**
     * Export lineage report for a container
     */
    function exportLineageReport(containerId) {
        if (!window.LineageService) return;
        
        const lineage = LineageService.getFullLineage(containerId);
        const timeline = window.AuditService ? AuditService.getContainerTimeline(containerId) : [];
        const inventory = StateManager.getState('inventory') || [];
        const containerData = inventory.find(i => String(i.containerId) === String(containerId));
        
        const report = {
            reportDate: new Date().toISOString(),
            containerId: containerId,
            containerData: containerData,
            lineage: lineage,
            path: LineageService.getLineagePath(containerId),
            timeline: timeline,
            stats: LineageService.getStats()
        };
        
        // Download as JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lineage-report-${containerId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        NotificationSystem.success(`Lineage report exported for container ${containerId}`);
    }

    /**
     * Add lineage filter button to inventory search
     */
    function addLineageFilterToInventory() {
        const searchContainer = document.getElementById('inventorySearchContainer');
        if (!searchContainer) return;
        
        const filtersDiv = searchContainer.querySelector('.quick-filters, [style*="flex-wrap: wrap"]');
        if (!filtersDiv) return;
        
        // Check if already added
        if (document.getElementById('lineageFilterBtn')) return;
        
        const lineageBtn = document.createElement('button');
        lineageBtn.id = 'lineageFilterBtn';
        lineageBtn.className = 'filter-btn';
        lineageBtn.innerHTML = '🔗 Lineage';
        lineageBtn.onclick = showLineageFilterModal;
        
        const clearBtn = filtersDiv.querySelector('[onclick*="clearFilter"]');
        if (clearBtn) {
            filtersDiv.insertBefore(lineageBtn, clearBtn);
        } else {
            filtersDiv.appendChild(lineageBtn);
        }
    }

    /**
     * Show lineage filter modal
     */
    function showLineageFilterModal() {
        const modalHTML = `
            <div class="lineage-modal" id="lineageFilterModal" onclick="if(event.target === this) this.remove()">
                <div class="lineage-modal-content" style="min-width: 400px; max-width: 500px;">
                    <div class="lineage-modal-header">
                        <h2 style="margin: 0;">🔗 Filter by Lineage</h2>
                        <button class="lineage-modal-close" onclick="this.closest('.lineage-modal').remove()">&times;</button>
                    </div>
                    <div class="lineage-modal-body">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Container ID:</label>
                            <input type="text" id="lineageFilterInput" placeholder="Enter container ID" 
                                   style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Filter Type:</label>
                            <select id="lineageFilterType" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                                <option value="descendants">Show all descendants</option>
                                <option value="ancestors">Show all ancestors</option>
                                <option value="both">Show full lineage tree</option>
                                <option value="children">Show direct children only</option>
                                <option value="siblings">Show siblings</option>
                            </select>
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="LineageUI.applyLineageFilter()" 
                                    style="flex: 1; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                Apply Filter
                            </button>
                            <button onclick="this.closest('.lineage-modal').remove()"
                                    style="padding: 12px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Focus input
        setTimeout(() => {
            document.getElementById('lineageFilterInput')?.focus();
        }, 100);
    }

    /**
     * Apply lineage filter to inventory
     */
    function applyLineageFilter() {
        const containerId = document.getElementById('lineageFilterInput')?.value?.trim();
        const filterType = document.getElementById('lineageFilterType')?.value;
        
        if (!containerId) {
            NotificationSystem.warning('Please enter a container ID');
            return;
        }
        
        if (!window.LineageService) {
            NotificationSystem.error('LineageService not available');
            return;
        }
        
        let containerIds = [];
        
        switch (filterType) {
            case 'descendants':
                containerIds = LineageService.getDescendants(containerId).map(d => d.id);
                containerIds.push(containerId);
                break;
            
            case 'ancestors':
                containerIds = LineageService.getAncestors(containerId).map(a => a.id);
                containerIds.push(containerId);
                break;
            
            case 'both':
                containerIds = [
                    ...LineageService.getAncestors(containerId).map(a => a.id),
                    containerId,
                    ...LineageService.getDescendants(containerId).map(d => d.id)
                ];
                break;
            
            case 'children':
                containerIds = LineageService.getChildren(containerId).map(c => c.id);
                containerIds.push(containerId);
                break;
            
            case 'siblings':
                const parent = LineageService.getParent(containerId);
                if (parent) {
                    containerIds = LineageService.getChildren(parent.id).map(c => c.id);
                } else {
                    containerIds = [containerId];
                }
                break;
        }
        
        // Close modal
        document.getElementById('lineageFilterModal')?.remove();
        
        // Apply filter
        const inventory = StateManager.getState('inventory') || [];
        const filtered = inventory.filter(item => 
            containerIds.includes(String(item.containerId))
        );
        
        if (window.InventoryTableManager) {
            InventoryTableManager.buildTableFromData(filtered);
            
            const filteredCount = document.getElementById('filteredCount');
            const totalCount = document.getElementById('totalCount');
            if (filteredCount) filteredCount.textContent = filtered.length;
            if (totalCount) totalCount.textContent = inventory.length;
        }
        
        NotificationSystem.info(`Showing ${filtered.length} containers matching lineage filter`);
    }

    // Public API
    return {
        initialize,
        createBadge,
        createTableLineageDisplay,
        showLineageModal,
        closeLineageModal,
        switchTab,
        showDescendants,
        exportLineageReport,
        addLineageFilterToInventory,
        showLineageFilterModal,
        applyLineageFilter
    };

})();
