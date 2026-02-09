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

    // Basic metrics (tissue culture lab-specific)
    function updateBasicMetrics() {
        const inventory = window.appState?.inventory || [];
        
        // Get analytics for trend calculation
        const analytics = window.AnalyticsEngine ? 
            AnalyticsEngine.getAnalytics({ dateRange: currentDateRange }) : null;

        // 1. Active Cultures (total active containers)
        const activeCultures = inventory.filter(item => 
            !item.status || item.status === 'Active' || item.status === 'Complete'
        ).length;

        // 2. Survival Rate (% of containers that are Active or Complete vs total)
        const totalContainers = inventory.length;
        const surviving = inventory.filter(item => 
            !item.status || item.status === 'Active' || item.status === 'Complete'
        ).length;
        const survivalRate = totalContainers > 0 ? 
            (surviving / totalContainers) * 100 : 0;

        // 3. Multiplication Rate (avg tissues per transfer)
        const avgSplitRatio = calculateMultiplicationRate(inventory);

        // 4. Containers Needing Transfer (older than 21 days in same stage)
        const containersNeedingTransfer = calculateContainersNeedingTransfer(inventory);

        // Update DOM with proper formatting and trends
        updateMetricCard('activeCultures', activeCultures, '', null);
        updateMetricCard('contaminationRate', contaminationRate, '%', null, 1);
        updateMetricCard('multiplicationRate', avgSplitRatio, '', null, 1);
        updateMetricCard('containersNeedingTransfer', containersNeedingTransfer, '', null);
        
        // Update contamination rate color coding
        updateContaminationRateColor(contaminationRate);
    }

    // Enhanced analytics display (tissue culture lab-specific)
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

        // Render new tissue culture lab charts
        renderStagePipeline(analytics);
        renderStrainPerformance(analytics);
        renderWeeklyThroughput(analytics);
        renderMediaConsumption(analytics);
        renderOwnerWorkload(analytics);

        // Keep lineage stats (useful)
        renderLineageStats(analytics);
    }

    // Render enhanced stat cards with trends
    function renderEnhancedStats(analytics) {
        const container = document.getElementById('enhancedStatsContainer');
        if (!container) return;

        // Clear container if no analytics data
        if (!analytics) {
            container.innerHTML = '';
            return;
        }

        // Safely access nested analytics data with defaults
        const containers = analytics?.containers || { total: 0, tissueCount: 0 };
        const transfers = analytics?.transfers || { total: 0, avgSplitRatio: 0 };
        const trends = analytics?.trends || {};

        const stats = [
            {
                label: 'Total Containers',
                value: containers.total || 0,
                trend: trends.containers,
                icon: '📦',
                color: '#10b981'
            },
            {
                label: 'Total Tissues',
                value: containers.tissueCount || 0,
                icon: '🌱',
                color: '#3b82f6'
            },
            {
                label: 'Active Transfers',
                value: transfers.total || 0,
                trend: trends.transfers,
                icon: '🔄',
                color: '#8b5cf6'
            },
            {
                label: 'Success Rate',
                value: containers.total > 0 ? 
                    (((containers.total - (containers.discarded || 0)) / containers.total) * 100).toFixed(1) + '%' : 
                    '—',
                icon: '✅',
                color: '#059669'
            }
        ];

        // Use ChartRenderer if available, otherwise create simple cards
        if (window.ChartRenderer && ChartRenderer.renderStatCards) {
            ChartRenderer.renderStatCards(container, stats, { columns: 4 });
        } else {
            // Fallback to simple HTML if ChartRenderer not available
            container.innerHTML = stats.map(stat => `
                <div class="stat-card" style="background: ${stat.color}20; border-left: 4px solid ${stat.color}; padding: 16px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.5rem;">${stat.icon}</span>
                        <div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #0f172a;">${stat.value}</div>
                            <div style="font-size: 0.8rem; color: #64748b; font-weight: 600; text-transform: uppercase;">${stat.label}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // 1. Stage Pipeline (professional visual flow)
    function renderStagePipeline(analytics) {
        const container = document.getElementById('stagePipelineChart');
        if (!container) return;

        const stages = analytics?.containers?.byStage || {};
        
        // Define standard tissue culture stages in order
        const stageOrder = ['Mother', 'Initiation', 'Multiplication', 'Rooting', 'Hardening'];
        const stageLabels = stageOrder.filter(stage => stages[stage] || stages[stage] === 0);
        
        let html = `
            <div class="chart-container stage-pipeline-container">
                <div class="chart-title">Production Stage Pipeline</div>
                <div class="stage-pipeline-flow">
        `;
        
        stageLabels.forEach((stage, index) => {
            const count = stages[stage] || 0;
            html += `
                <div class="stage-pipeline-step">
                    <div class="pipeline-stage-count">${count}</div>
                    <div class="pipeline-stage-name">${stage}</div>
                </div>
            `;
            
            if (index < stageLabels.length - 1) {
                html += '<div class="stage-pipeline-arrow">→</div>';
            }
        });
        
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    // 2. Strain Performance (containers per strain, colored by stage)
    function renderStrainPerformance(analytics) {
        const container = document.getElementById('strainPerformanceChart');
        if (!container) return;

        const strains = analytics?.containers?.byStrain || {};
        const labels = Object.keys(strains).slice(0, 10); // Top 10 strains
        const values = labels.map(strain => strains[strain]);

        if (labels.length === 0) {
            container.innerHTML = `
                <div class="chart-container">
                    <div class="chart-title">Strain Performance</div>
                    <div class="chart-body" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #94a3b8; flex-direction: column; gap: 12px;">
                        <span style="font-size: 2.5rem;">🧬</span>
                        <span>No strain data available</span>
                    </div>
                </div>
            `;
            return;
        }

        ChartRenderer.renderBarChart(container, { labels, values }, {
            title: 'Top Strains by Container Count',
            horizontal: false,
            showValues: true,
            maxBars: 10
        });
    }

    // 3. Weekly Throughput (containers created vs transferred vs discarded)
    function renderWeeklyThroughput(analytics) {
        const container = document.getElementById('weeklyThroughputChart');
        if (!container) return;

        const transfers = analytics?.transfers || {};
        const weekly = transfers.weeklyTransfers || {};
        
        // Get last 8 weeks
        const weeks = Object.keys(weekly).slice(-8);
        
        if (weeks.length === 0) {
            container.innerHTML = `
                <div class="chart-container">
                    <div class="chart-title">Weekly Throughput</div>
                    <div class="chart-body" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #94a3b8; flex-direction: column; gap: 12px;">
                        <span style="font-size: 2.5rem;">📈</span>
                        <span>No transfer data available</span>
                    </div>
                </div>
            `;
            return;
        }

        const labels = weeks.map(week => `Week ${week.split('-')[1] || week}`);
        const values = weeks.map(week => weekly[week] || 0);

        ChartRenderer.renderLineChart(container, { labels, values }, {
            title: 'Weekly Throughput',
            showArea: true,
            showDots: true,
            color: '#10b981'
        });
    }

    // 4. Media Consumption (batches used vs available, burn rate)
    function renderMediaConsumption(analytics) {
        const container = document.getElementById('mediaConsumptionChart');
        if (!container) return;

        const batches = analytics?.mediaBatches || {};
        
        if (!batches.available || Object.keys(batches).length === 0) {
            container.innerHTML = `
                <div class="chart-container">
                    <div class="chart-title">Media Batch Status</div>
                    <div class="chart-body" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #94a3b8; flex-direction: column; gap: 12px;">
                        <span style="font-size: 2.5rem;">💧</span>
                        <span>No media batch data available</span>
                    </div>
                </div>
            `;
            return;
        }
        
        const totalBatches = (batches.ready || 0) + (batches.inUse || 0) + 
                           (batches.depleted || 0) + (batches.expired || 0);
        
        if (totalBatches === 0) {
            container.innerHTML = `
                <div class="chart-container">
                    <div class="chart-title">Media Batch Status</div>
                    <div class="chart-body" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #64748b; flex-direction: column; gap: 12px;">
                        <span style="font-size: 2.5rem;">💧</span>
                        <span>No media batches found</span>
                    </div>
                </div>
            `;
            return;
        }
        
        ChartRenderer.renderBarChart(container, {
            labels: ['Ready', 'In Use', 'Depleted', 'Expired'],
            values: [batches.ready || 0, batches.inUse || 0, batches.depleted || 0, batches.expired || 0],
            colors: ['#10b981', '#3b82f6', '#64748b', '#ef4444']
        }, {
            title: 'Media Batch Status',
            horizontal: true
        });

        // Show expiring soon warning (keep this functionality)
        const warningEl = document.getElementById('expiringBatchesWarning');
        if (warningEl) {
            if (batches.expiringSoon > 0) {
                warningEl.innerHTML = `
                    <div class="warning-banner">
                        ⚠️ <strong>${batches.expiringSoon}</strong> batches expiring within 7 days
                        <button onclick="DashboardManager.showExpiringBatches()">View Details</button>
                    </div>
                `;
                warningEl.style.display = 'block';
            } else {
                warningEl.style.display = 'none';
            }
        }
    }

    // 5. Owner Workload (containers per owner/technician)
    function renderOwnerWorkload(analytics) {
        const container = document.getElementById('ownerWorkloadChart');
        if (!container) return;

        const owners = analytics?.containers?.byOwner || {};
        const labels = Object.keys(owners);
        const values = Object.values(owners);

        if (labels.length === 0) {
            container.innerHTML = `
                <div class="chart-container">
                    <div class="chart-title">Technician Workload Distribution</div>
                    <div class="chart-body" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #94a3b8; flex-direction: column; gap: 12px;">
                        <span style="font-size: 2.5rem;">👥</span>
                        <span>No ownership data available</span>
                    </div>
                </div>
            `;
            return;
        }

        ChartRenderer.renderBarChart(container, { labels, values }, {
            title: 'Technician Workload Distribution',
            horizontal: true,
            showValues: true
        });
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
        let actionItems = [];

        // Check for containers needing transfer (older than 21 days)
        const containersNeedingTransfer = calculateContainersNeedingTransfer(inventory);
        if (containersNeedingTransfer > 0) {
            actionItems.push(`${containersNeedingTransfer} culture${containersNeedingTransfer > 1 ? 's' : ''} ready for transfer`);
        }

        // Check for high contamination rate
        const totalContainers = inventory.length;
        const contaminated = inventory.filter(item => 
            item.status === 'Discarded' || item.status === 'Contaminated'
        ).length;
        const contaminationRate = totalContainers > 0 ? (contaminated / totalContainers) * 100 : 0;
        
        if (contaminationRate > 10) {
            actionItems.push('contamination rate above 10%');
        }

        // Check expiring batches
        if (window.MediaBatchManager) {
            const expiring = MediaBatchManager.getExpiringBatches(7);
            if (expiring.length > 0) {
                actionItems.push(`${expiring.length} media batch${expiring.length > 1 ? 'es' : ''} expiring soon`);
            }
        }

        // Create status message
        let statusMessage;
        if (actionItems.length === 0) {
            statusMessage = 'All systems optimal. Lab operations running smoothly.';
        } else if (actionItems.length === 1) {
            statusMessage = `Action required: ${actionItems[0]}.`;
        } else {
            statusMessage = `Multiple items require attention: ${actionItems.join(', ')}.`;
        }

        // Update hero text
        const heroMessage = document.querySelector('.hero-message');
        if (heroMessage) {
            const activeCultures = inventory.filter(item => 
                !item.status || item.status === 'Active' || item.status === 'Complete'
            ).length;
            
            heroMessage.innerHTML = `
                <strong>${activeCultures}</strong> active cultures in production. 
                <span class="highlight-text">${statusMessage}</span>
            `;
        }

        // Update hero title to be more professional
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            heroTitle.textContent = 'LoneWolf Biotech Tissue Culture Laboratory';
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

    // Helper: Calculate multiplication rate (avg tissues per transfer)
    function calculateMultiplicationRate(inventory) {
        const transferHistory = window.appState?.transferHistory || [];
        
        if (transferHistory.length === 0) {
            // Fallback: estimate from current tissue counts
            const tissuesPerContainer = inventory
                .filter(item => item.tissueCount && parseInt(item.tissueCount) > 0)
                .map(item => parseInt(item.tissueCount));
            
            if (tissuesPerContainer.length === 0) return 1.0;
            
            const total = tissuesPerContainer.reduce((sum, count) => sum + count, 0);
            return total / tissuesPerContainer.length;
        }

        // Use actual transfer data to calculate split ratios
        const splitRatios = transferHistory
            .filter(transfer => transfer.outputs && transfer.outputs.length > 0)
            .map(transfer => transfer.outputs.length);

        if (splitRatios.length === 0) return 1.0;
        
        const totalRatio = splitRatios.reduce((sum, ratio) => sum + ratio, 0);
        return totalRatio / splitRatios.length;
    }

    // Helper: Calculate containers needing transfer (older than 21 days in same stage)
    function calculateContainersNeedingTransfer(inventory) {
        const now = new Date();
        const twentyOneDaysAgo = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000));
        
        return inventory.filter(item => {
            // Only count active containers
            if (item.status && item.status !== 'Active' && item.status !== 'Complete') {
                return false;
            }

            // Check if container is older than 21 days
            const itemDate = new Date(item.timestamp || item.date);
            if (isNaN(itemDate.getTime())) return false;
            
            return itemDate < twentyOneDaysAgo;
        }).length;
    }

    // Helper: Update metric card with proper formatting and trends
    function updateMetricCard(metricId, value, suffix = '', trend = null, decimals = 0) {
        const valueEl = document.getElementById(metricId);
        const trendEl = document.getElementById(metricId + 'Trend');
        
        if (valueEl) {
            if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
                valueEl.textContent = '—';
            } else {
                const formattedValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
                valueEl.textContent = formattedValue + suffix;
            }
        }
        
        if (trendEl && trend !== null) {
            updateTrendIndicator(trendEl, trend);
        }
    }

    // Helper: Update trend indicator
    function updateTrendIndicator(element, trend) {
        if (!element || !trend) {
            element.textContent = '—';
            element.className = 'metric-trend neutral';
            return;
        }

        const { direction, value } = trend;
        const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
        const displayValue = value ? Math.abs(value).toFixed(1) + '%' : '';
        
        element.textContent = arrow + ' ' + displayValue;
        element.className = `metric-trend ${direction}`;
    }

    // Helper: Update contamination rate color coding
    function updateContaminationRateColor(rate) {
        const card = document.getElementById('contaminationCard');
        if (!card) return;

        // Remove existing contamination classes
        card.classList.remove('contamination-good', 'contamination-warning', 'contamination-danger');
        
        if (rate < 5) {
            card.classList.add('contamination-good');
        } else if (rate <= 10) {
            card.classList.add('contamination-warning');
        } else {
            card.classList.add('contamination-danger');
        }
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
