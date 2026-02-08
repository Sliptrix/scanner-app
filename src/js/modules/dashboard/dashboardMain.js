// Dashboard Module - Main (Enhanced Phase 5)
// Handles dashboard metrics, analytics, visualizations, and overview display

const DashboardManager = (function() {
    'use strict';

    // Private state
    let refreshInterval = null;
    let currentDateRange = null;
    let activeFilters = {};

    // Initialize dashboard
    function initialize() {
        console.log('Initializing Dashboard Module (Phase 5 Enhanced)...');

        // Set default date range
        if (window.AnalyticsEngine) {
            currentDateRange = AnalyticsEngine.getDefaultDateRange();
        }

        // Set up auto-refresh for dashboard metrics
        setupAutoRefresh();

        // Set up date range selector
        setupDateRangeSelector();

        // Initial load
        updateDashboard();

        // Update user profile in sidebar
        updateUserProfile();

        // Listen for data changes
        window.addEventListener('inventoryUpdated', () => updateDashboard());
        window.addEventListener('lineageUpdated', () => updateDashboard());

        console.log('Dashboard Module initialized successfully');
    }

    // Update all dashboard content
    function updateDashboard() {
        updateBasicMetrics();
        updateEnhancedAnalytics();
        updateRecentIntake();
        updateHeroBanner();
        updateQuickActions();
    }

    // Basic metrics (existing functionality)
    function updateBasicMetrics() {
        const inventory = window.appState?.inventory || [];

        // Calculate Active Plants (total active containers)
        const activePlants = inventory.filter(item => 
            !item.status || item.status === 'Active' || item.status === 'Complete'
        ).length;

        // Calculate Unique Strains
        const uniqueStrains = new Set(inventory.map(item => item.strain).filter(Boolean)).size;

        // Calculate Media Batches
        let mediaBatches = 0;
        if (window.MediaBatchManager) {
            const stats = MediaBatchManager.getBatchStats();
            mediaBatches = stats.ready + stats.inUse;
        } else {
            mediaBatches = new Set(inventory.map(item => item.media).filter(Boolean)).size;
        }

        // Calculate Efficiency (based on non-discarded containers)
        const totalContainers = inventory.length;
        const discarded = inventory.filter(item => item.status === 'Discarded').length;
        const efficiency = totalContainers > 0 ? 
            Math.round(((totalContainers - discarded) / totalContainers) * 100) : 100;

        // Update DOM with animation
        animateValue('activePlants', activePlants);
        animateValue('uniqueStrains', uniqueStrains);
        animateValue('mediaBatches', mediaBatches);
        
        const efficiencyEl = document.getElementById('efficiency');
        if (efficiencyEl) efficiencyEl.textContent = `${efficiency}%`;
    }

    // Enhanced analytics display
    function updateEnhancedAnalytics() {
        if (!window.AnalyticsEngine || !window.ChartRenderer) {
            console.log('Analytics modules not loaded, skipping enhanced analytics');
            return;
        }

        const analytics = AnalyticsEngine.getAnalytics({ 
            dateRange: currentDateRange,
            forceRefresh: true 
        });

        // Render enhanced stat cards
        renderEnhancedStats(analytics);

        // Render stage distribution chart
        renderStageChart(analytics);

        // Render transfer timeline
        renderTransferTimeline(analytics);

        // Render activity heatmap
        renderActivityHeatmap(analytics);

        // Render media batch status
        renderBatchStatus(analytics);

        // Render lineage stats
        renderLineageStats(analytics);
    }

    // Render enhanced stat cards with trends
    function renderEnhancedStats(analytics) {
        const container = document.getElementById('enhancedStatsContainer');
        if (!container) return;

        const stats = [
            {
                label: 'Total Containers',
                value: analytics.containers.total,
                trend: analytics.trends.containers,
                icon: '📦',
                color: '#10b981'
            },
            {
                label: 'Total Tissues',
                value: analytics.containers.tissueCount,
                icon: '🌱',
                color: '#3b82f6'
            },
            {
                label: 'Transfers',
                value: analytics.transfers.total,
                trend: analytics.trends.transfers,
                icon: '🔄',
                color: '#8b5cf6'
            },
            {
                label: 'Avg Split Ratio',
                value: analytics.transfers.avgSplitRatio.toFixed(1),
                icon: '📊',
                color: '#f59e0b'
            }
        ];

        ChartRenderer.renderStatCards(container, stats, { columns: 4 });
    }

    // Render stage distribution pie chart
    function renderStageChart(analytics) {
        const container = document.getElementById('stageDistributionChart');
        if (!container) return;

        const stages = analytics.containers.byStage;
        const labels = Object.keys(stages);
        const values = Object.values(stages);

        ChartRenderer.renderPieChart(container, { labels, values }, {
            title: 'Containers by Stage',
            donut: true,
            centerText: analytics.containers.filtered,
            centerLabel: 'Containers',
            onClick: (label) => filterInventoryByStage(label)
        });
    }

    // Render transfer timeline
    function renderTransferTimeline(analytics) {
        const container = document.getElementById('transferTimelineChart');
        if (!container) return;

        const daily = analytics.transfers.dailyTransfers;
        const labels = Object.keys(daily).slice(-14); // Last 14 days
        const values = labels.map(d => daily[d] || 0);

        ChartRenderer.renderLineChart(container, { labels, values }, {
            title: 'Transfer Activity (Last 14 Days)',
            showArea: true,
            showDots: true,
            color: '#10b981'
        });
    }

    // Render activity heatmap
    function renderActivityHeatmap(analytics) {
        const container = document.getElementById('activityHeatmapChart');
        if (!container) return;

        ChartRenderer.renderHeatmap(container, analytics.activityHeatmap, {
            title: 'Activity by Day/Hour',
            showHourLabels: true
        });
    }

    // Render media batch status
    function renderBatchStatus(analytics) {
        const container = document.getElementById('batchStatusChart');
        if (!container || !analytics.mediaBatches.available) return;

        const batches = analytics.mediaBatches;
        
        ChartRenderer.renderBarChart(container, {
            labels: ['In Prep', 'Ready', 'In Use', 'Depleted', 'Expired'],
            values: [batches.inPrep, batches.ready, batches.inUse, batches.depleted, batches.expired],
            colors: ['#f59e0b', '#10b981', '#3b82f6', '#64748b', '#ef4444']
        }, {
            title: 'Media Batch Status',
            horizontal: true
        });

        // Show expiring soon warning
        if (batches.expiringSoon > 0) {
            const warningEl = document.getElementById('expiringBatchesWarning');
            if (warningEl) {
                warningEl.innerHTML = `
                    <div class="warning-banner">
                        ⚠️ <strong>${batches.expiringSoon}</strong> batches expiring within 7 days
                        <button onclick="DashboardManager.showExpiringBatches()">View Details</button>
                    </div>
                `;
                warningEl.style.display = 'block';
            }
        }
    }

    // Render lineage statistics
    function renderLineageStats(analytics) {
        const container = document.getElementById('lineageStatsContainer');
        if (!container || !analytics.lineage.available) return;

        const lineage = analytics.lineage;

        container.innerHTML = `
            <div class="lineage-stats-grid">
                <div class="lineage-stat">
                    <div class="lineage-stat-value">${lineage.maxGeneration}</div>
                    <div class="lineage-stat-label">Max Generation</div>
                </div>
                <div class="lineage-stat">
                    <div class="lineage-stat-value">${lineage.avgDepth.toFixed(1)}</div>
                    <div class="lineage-stat-label">Avg Depth</div>
                </div>
                <div class="lineage-stat">
                    <div class="lineage-stat-value">${lineage.avgSplitRatio.toFixed(1)}</div>
                    <div class="lineage-stat-label">Avg Split Ratio</div>
                </div>
                <div class="lineage-stat">
                    <div class="lineage-stat-value">${lineage.rootNodes}</div>
                    <div class="lineage-stat-label">Root Containers</div>
                </div>
            </div>
            ${lineage.orphanCount > 0 ? `
                <div class="lineage-warning">
                    ⚠️ ${lineage.orphanCount} orphaned containers detected
                    <button onclick="LineageService.repairLineage(); DashboardManager.updateDashboard();">Repair</button>
                </div>
            ` : ''}
        `;
    }

    // Update Recent Intake table
    function updateRecentIntake() {
        const inventory = window.appState?.inventory || [];
        const tbody = document.getElementById('recentIntakeBody');

        if (!tbody) return;

        // Sort by date (newest first) and take top 5
        const recentItems = [...inventory]
            .sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp))
            .slice(0, 5);

        if (recentItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">
                        No intake data available. Add your first container to get started.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = recentItems.map(item => {
            const stageClass = getStageClass(item.stage);
            return `
                <tr class="clickable-row" onclick="DashboardManager.viewContainer('${item.containerId}')">
                    <td><strong>${item.containerId || 'N/A'}</strong></td>
                    <td>${item.strain || 'Unknown'}</td>
                    <td><span class="stage-badge ${stageClass}">${item.stage || 'N/A'}</span></td>
                    <td>${formatDate(item.date || item.timestamp)}</td>
                    <td><strong>${item.tissueCount || 1}</strong></td>
                </tr>
            `;
        }).join('');
    }

    // Update hero banner message
    function updateHeroBanner() {
        const inventory = window.appState?.inventory || [];
        let attentionCount = 0;
        let attentionMessage = '';

        // Check for items needing attention
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const oldContainers = inventory.filter(item => {
            const itemDate = new Date(item.date || item.timestamp);
            return itemDate < thirtyDaysAgo && (!item.status || item.status === 'Active');
        });

        attentionCount += oldContainers.length;

        // Check expiring batches
        if (window.MediaBatchManager) {
            const expiring = MediaBatchManager.getExpiringBatches(7);
            attentionCount += expiring.length;
        }

        // Update hero text
        const highlightText = document.querySelector('.highlight-text');
        if (highlightText) {
            if (attentionCount > 0) {
                highlightText.textContent = `${attentionCount} items`;
                highlightText.title = 'Items needing attention';
            } else {
                highlightText.textContent = '0 items';
            }
        }
    }

    // Update quick actions section
    function updateQuickActions() {
        const container = document.getElementById('quickActionsContainer');
        if (!container) return;

        const inventory = window.appState?.inventory || [];
        const hasInventory = inventory.length > 0;

        container.innerHTML = `
            <div class="quick-actions-grid">
                <button class="quick-action-btn" onclick="switchMode('intake')">
                    <span class="qa-icon">📥</span>
                    <span class="qa-label">New Intake</span>
                </button>
                <button class="quick-action-btn" onclick="switchMode('initiator')">
                    <span class="qa-icon">✨</span>
                    <span class="qa-label">New Container</span>
                </button>
                <button class="quick-action-btn" onclick="switchMode('transfer')" ${!hasInventory ? 'disabled' : ''}>
                    <span class="qa-icon">🔄</span>
                    <span class="qa-label">Transfer</span>
                </button>
                <button class="quick-action-btn" onclick="DashboardManager.showBarcodeBuilder()">
                    <span class="qa-icon">🏷️</span>
                    <span class="qa-label">Print Labels</span>
                </button>
                <button class="quick-action-btn" onclick="exportInventory()">
                    <span class="qa-icon">📊</span>
                    <span class="qa-label">Export Data</span>
                </button>
                <button class="quick-action-btn" onclick="DashboardManager.showAnalyticsReport()">
                    <span class="qa-icon">📈</span>
                    <span class="qa-label">Full Report</span>
                </button>
            </div>
        `;
    }

    // Setup date range selector
    function setupDateRangeSelector() {
        const container = document.getElementById('dateRangeSelector');
        if (!container || !window.AnalyticsEngine) return;

        const presets = AnalyticsEngine.getDateRangePresets();

        let html = `
            <div class="date-range-selector">
                <label>Date Range:</label>
                <select id="dateRangePreset" onchange="DashboardManager.setDateRange(this.value)">
                    ${presets.map(p => `
                        <option value='${JSON.stringify(p)}' 
                                ${p.label === currentDateRange?.label ? 'selected' : ''}>
                            ${p.label}
                        </option>
                    `).join('')}
                </select>
                <button class="btn-refresh" onclick="DashboardManager.updateDashboard()" title="Refresh">
                    🔄
                </button>
            </div>
        `;

        container.innerHTML = html;
    }

    // Set date range from selector
    function setDateRange(rangeJson) {
        try {
            currentDateRange = JSON.parse(rangeJson);
            if (window.AnalyticsEngine) {
                AnalyticsEngine.invalidateCache();
            }
            updateDashboard();
        } catch (e) {
            console.error('Invalid date range:', e);
        }
    }

    // Filter inventory view by stage
    function filterInventoryByStage(stage) {
        activeFilters.stage = stage;
        switchMode('inventory');
        
        // Apply filter after mode switch
        setTimeout(() => {
            if (window.InventoryTableManager) {
                InventoryTableManager.applyFilter('stage', stage);
            }
        }, 100);

        NotificationSystem?.info(`Showing containers in stage: ${stage}`);
    }

    // View container details
    function viewContainer(containerId) {
        switchMode('inventory');
        
        setTimeout(() => {
            if (window.InventoryTableManager) {
                InventoryTableManager.highlightContainer(containerId);
            }
        }, 100);
    }

    // Show expiring batches modal
    function showExpiringBatches() {
        if (!window.MediaBatchManager) return;

        const expiring = MediaBatchManager.getExpiringBatches(7);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>⚠️ Expiring Batches</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <table class="intake-table">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Recipe</th>
                                <th>Expires</th>
                                <th>Days Left</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expiring.map(b => `
                                <tr>
                                    <td>${b.id}</td>
                                    <td>${b.recipeName}</td>
                                    <td>${formatDate(b.expiryDate)}</td>
                                    <td class="${b.daysLeft <= 3 ? 'text-danger' : 'text-warning'}">
                                        ${b.daysLeft} days
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    // Show full analytics report
    function showAnalyticsReport() {
        if (!window.AnalyticsEngine) {
            NotificationSystem?.error('Analytics not available');
            return;
        }

        const analytics = AnalyticsEngine.getAnalytics({ forceRefresh: true });
        const reportJson = AnalyticsEngine.exportAnalytics();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>📈 Analytics Report</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="report-actions">
                        <button class="btn btn-primary" onclick="DashboardManager.downloadReport('json')">
                            Download JSON
                        </button>
                        <button class="btn btn-secondary" onclick="DashboardManager.downloadReport('csv')">
                            Download CSV
                        </button>
                    </div>
                    
                    <h3>Summary</h3>
                    <div class="report-summary">
                        <p><strong>Date Range:</strong> ${analytics.dateRange.label}</p>
                        <p><strong>Total Containers:</strong> ${analytics.containers.total}</p>
                        <p><strong>Active Containers:</strong> ${analytics.containers.byStatus.active}</p>
                        <p><strong>Total Transfers:</strong> ${analytics.transfers.total}</p>
                        <p><strong>Tissues Transferred:</strong> ${analytics.transfers.totalTissuesTransferred}</p>
                    </div>

                    <h3>Stage Distribution</h3>
                    <div id="reportStageChart"></div>

                    <h3>Owner Distribution</h3>
                    <div id="reportOwnerChart"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        // Render charts in modal
        setTimeout(() => {
            ChartRenderer?.renderBarChart('reportStageChart', {
                labels: Object.keys(analytics.containers.byStage),
                values: Object.values(analytics.containers.byStage)
            }, { horizontal: true });

            ChartRenderer?.renderBarChart('reportOwnerChart', {
                labels: Object.keys(analytics.containers.byOwner),
                values: Object.values(analytics.containers.byOwner)
            }, { horizontal: true });
        }, 100);
    }

    // Download analytics report
    function downloadReport(format) {
        if (!window.AnalyticsEngine) return;

        let content, filename, mimeType;

        if (format === 'json') {
            content = AnalyticsEngine.exportAnalytics();
            filename = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
            mimeType = 'application/json';
        } else {
            content = AnalyticsEngine.exportAnalyticsCSV('containers');
            content += '\n\n' + AnalyticsEngine.exportAnalyticsCSV('transfers');
            filename = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
            mimeType = 'text/csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        NotificationSystem?.success(`Report downloaded: ${filename}`);
    }

    // Show barcode builder
    function showBarcodeBuilder() {
        if (window.BarcodeBuilderUI) {
            BarcodeBuilderUI.showModal();
        } else {
            switchMode('initiator');
        }
    }

    // Update user profile in sidebar
    function updateUserProfile() {
        if (!window.AuthManager) return;

        const account = window.AuthManager.getAccount();
        if (!account) return;

        const userName = account.name || 'User';
        const userInitials = getUserInitials(userName);

        const avatar = document.querySelector('.user-avatar');
        if (avatar) avatar.textContent = userInitials;

        const nameEl = document.querySelector('.user-name');
        if (nameEl) nameEl.textContent = userName.split(' ')[0] || 'LoneWolf Bio';
    }

    // Helper: Get user initials
    function getUserInitials(name) {
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // Helper: Get stage badge class
    function getStageClass(stage) {
        const stageMap = {
            'Mother': 'stage-mother',
            'Initiation': 'stage-initiation',
            'Multiplication': 'stage-multiplication',
            'Rooting': 'stage-rooting',
            'T1': 'stage-t1',
            'T2': 'stage-t2',
            'T3': 'stage-t3'
        };
        return stageMap[stage] || '';
    }

    // Helper: Format date for display
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // Helper: Animate number changes
    function animateValue(elementId, endValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const start = parseInt(element.textContent) || 0;
        const duration = 500;
        
        if (start === endValue) {
            element.textContent = endValue;
            return;
        }

        const range = endValue - start;
        const increment = range / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= endValue) || (increment < 0 && current <= endValue)) {
                element.textContent = endValue;
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current);
            }
        }, 16);
    }

    // Setup auto-refresh
    function setupAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);

        refreshInterval = setInterval(() => {
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection && dashboardSection.classList.contains('active')) {
                updateDashboard();
            }
        }, 30000);
    }

    // Public API
    return {
        initialize,
        updateDashboard,
        updateMetrics: updateBasicMetrics,
        updateRecentIntake,
        setDateRange,
        filterInventoryByStage,
        viewContainer,
        showExpiringBatches,
        showAnalyticsReport,
        downloadReport,
        showBarcodeBuilder
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        DashboardManager.initialize();
    });
} else {
    DashboardManager.initialize();
}

// Export to global scope
window.DashboardManager = DashboardManager;
