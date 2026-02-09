/**
 * LONEWOLF BIOTECH - Dashboard Analytics Engine
 * Phase 5: Enhanced Analytics & Visualization
 * 
 * Provides comprehensive analytics calculations including:
 * - Container counts by status/stage/location
 * - Transfer activity trends (daily/weekly/monthly)
 * - Recipe usage statistics
 * - Media batch status overview
 * - Lineage statistics
 */

window.AnalyticsEngine = (function() {
    'use strict';

    // Cache for computed analytics (invalidated on data changes)
    let analyticsCache = {
        data: null,
        timestamp: null,
        validFor: 30000 // 30 seconds cache validity
    };

    /**
     * Get all analytics data
     * @param {Object} options - { dateRange: { start, end }, forceRefresh }
     */
    function getAnalytics(options = {}) {
        const now = Date.now();
        
        // Return cached data if valid and not forcing refresh
        if (!options.forceRefresh && analyticsCache.data && 
            (now - analyticsCache.timestamp) < analyticsCache.validFor) {
            return analyticsCache.data;
        }

        const dateRange = options.dateRange || getDefaultDateRange();
        
        const analytics = {
            timestamp: new Date().toISOString(),
            dateRange: dateRange,
            
            // Container metrics
            containers: getContainerAnalytics(dateRange),
            
            // Transfer activity
            transfers: getTransferAnalytics(dateRange),
            
            // Recipe usage
            recipes: getRecipeAnalytics(dateRange),
            
            // Media batches
            mediaBatches: getMediaBatchAnalytics(),
            
            // Lineage statistics
            lineage: getLineageAnalytics(),
            
            // Activity heatmap data
            activityHeatmap: getActivityHeatmap(dateRange),
            
            // Trend indicators
            trends: calculateTrends(dateRange)
        };

        // Cache the results
        analyticsCache.data = analytics;
        analyticsCache.timestamp = now;

        return analytics;
    }

    /**
     * Get default date range (last 30 days)
     */
    function getDefaultDateRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
            label: 'Last 30 Days'
        };
    }

    /**
     * Container analytics - counts by status, stage, location
     */
    function getContainerAnalytics(dateRange) {
        const inventory = window.appState?.inventory || [];
        const filteredInventory = filterByDateRange(inventory, dateRange);
        
        // Status breakdown
        const byStatus = {
            active: 0,
            complete: 0,
            consumed: 0,
            discarded: 0,
            unknown: 0
        };

        // Stage breakdown
        const byStage = {};
        
        // Location breakdown
        const byLocation = {};
        
        // Owner breakdown
        const byOwner = {};
        
        // Strain breakdown  
        const byStrain = {};

        filteredInventory.forEach(item => {
            // Status
            const status = (item.status || 'Active').toLowerCase();
            if (status === 'active' || status === 'complete') {
                byStatus.active++;
            } else if (status === 'consumed') {
                byStatus.consumed++;
            } else if (status === 'discarded') {
                byStatus.discarded++;
            } else {
                byStatus.unknown++;
            }

            // Stage
            const stage = item.stage || 'Unknown';
            byStage[stage] = (byStage[stage] || 0) + 1;

            // Location
            const location = item.location || 'Unassigned';
            byLocation[location] = (byLocation[location] || 0) + 1;

            // Owner
            const owner = item.owner || 'Unknown';
            byOwner[owner] = (byOwner[owner] || 0) + 1;

            // Strain
            const strain = item.strain || 'Unknown';
            byStrain[strain] = (byStrain[strain] || 0) + 1;
        });

        return {
            total: inventory.length,
            filtered: filteredInventory.length,
            byStatus,
            byStage: sortByCount(byStage),
            byLocation: sortByCount(byLocation),
            byOwner: sortByCount(byOwner),
            byStrain: sortByCount(byStrain),
            tissueCount: filteredInventory.reduce((sum, item) => 
                sum + (parseInt(item.tissueCount) || 1), 0
            )
        };
    }

    /**
     * Transfer analytics - activity trends
     */
    function getTransferAnalytics(dateRange) {
        const history = window.appState?.transferHistory || [];
        const filteredHistory = filterByDateRange(history, dateRange, 'timestamp');

        // Daily transfer counts
        const dailyTransfers = {};
        const weeklyTransfers = {};
        const monthlyTransfers = {};

        // Transfer types
        const byType = {
            single: 0,
            split: 0
        };

        // Total tissues transferred
        let totalTissuesTransferred = 0;
        let totalTissuesDiscarded = 0;
        let totalContainersCreated = 0;

        filteredHistory.forEach(transfer => {
            const date = new Date(transfer.timestamp);
            const dayKey = date.toISOString().split('T')[0];
            const weekKey = getWeekKey(date);
            const monthKey = date.toISOString().substring(0, 7);

            // Daily
            dailyTransfers[dayKey] = (dailyTransfers[dayKey] || 0) + 1;
            
            // Weekly
            weeklyTransfers[weekKey] = (weeklyTransfers[weekKey] || 0) + 1;
            
            // Monthly
            monthlyTransfers[monthKey] = (monthlyTransfers[monthKey] || 0) + 1;

            // Type
            if (transfer.type === 'split') {
                byType.split++;
            } else {
                byType.single++;
            }

            // Totals
            totalTissuesTransferred += transfer.samplesTransferred || 0;
            totalTissuesDiscarded += transfer.samplesDiscarded || 0;
            totalContainersCreated += (transfer.destinationContainers || []).length;
        });

        return {
            total: filteredHistory.length,
            dailyTransfers,
            weeklyTransfers,
            monthlyTransfers,
            byType,
            totalTissuesTransferred,
            totalTissuesDiscarded,
            totalContainersCreated,
            avgTissuesPerTransfer: filteredHistory.length > 0 ? 
                Math.round(totalTissuesTransferred / filteredHistory.length * 10) / 10 : 0,
            avgSplitRatio: byType.split > 0 ? 
                Math.round(totalContainersCreated / byType.split * 10) / 10 : 0
        };
    }

    /**
     * Recipe usage analytics
     */
    function getRecipeAnalytics(dateRange) {
        // Get recipes from storage
        const recipes = window.RecipeStorage ? 
            window.RecipeStorage.getAllRecipes() : [];
        
        // Get batch data
        const batches = window.MediaBatchManager ? 
            window.MediaBatchManager.getAllBatches() : [];

        // Recipe usage (based on containers using each recipe)
        const inventory = window.appState?.inventory || [];
        const recipeUsage = {};

        inventory.forEach(item => {
            const recipe = item.recipe || item.media || 'Unknown';
            recipeUsage[recipe] = (recipeUsage[recipe] || 0) + 1;
        });

        // Most popular recipes
        const sortedRecipes = Object.entries(recipeUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // Batches per recipe
        const batchesByRecipe = {};
        batches.forEach(batch => {
            const recipeName = batch.recipeName || 'Unknown';
            batchesByRecipe[recipeName] = (batchesByRecipe[recipeName] || 0) + 1;
        });

        return {
            totalRecipes: recipes.length,
            recipeUsage: sortByCount(recipeUsage),
            topRecipes: sortedRecipes.map(([name, count]) => ({ name, count })),
            batchesByRecipe,
            unusedRecipes: recipes.filter(r => !recipeUsage[r.name]).length
        };
    }

    /**
     * Media batch analytics
     */
    function getMediaBatchAnalytics() {
        if (!window.MediaBatchManager) {
            return { available: false };
        }

        const stats = window.MediaBatchManager.getBatchStats();
        const batches = window.MediaBatchManager.getAllBatches();
        const expiringSoon = window.MediaBatchManager.getExpiringBatches(7);

        // Batches by media type
        const byMediaType = {};
        batches.forEach(batch => {
            const type = batch.mediaType || 'Unknown';
            byMediaType[type] = (byMediaType[type] || 0) + 1;
        });

        // Calculate container utilization
        const totalContainers = batches.reduce((sum, b) => sum + (b.totalContainers || 0), 0);
        const usedContainers = batches.reduce((sum, b) => sum + (b.usedContainers || 0), 0);

        return {
            available: true,
            ...stats,
            byMediaType,
            expiringSoonList: expiringSoon.map(b => ({
                id: b.id,
                recipeName: b.recipeName,
                expiryDate: b.expiryDate,
                daysLeft: Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
            })),
            containerUtilization: totalContainers > 0 ? 
                Math.round(usedContainers / totalContainers * 100) : 0
        };
    }

    /**
     * Lineage statistics
     */
    function getLineageAnalytics() {
        if (!window.LineageService) {
            return { available: false };
        }

        const stats = window.LineageService.getStats();
        const validation = window.LineageService.validateLineage();
        
        // Calculate average lineage depth
        const inventory = window.appState?.inventory || [];
        let totalDepth = 0;
        let containersWithLineage = 0;

        inventory.forEach(item => {
            const node = window.LineageService.getNode(item.containerId);
            if (node) {
                totalDepth += node.generation || 0;
                containersWithLineage++;
            }
        });

        // Get split ratios from lineage
        let totalChildren = 0;
        let parentsWithChildren = 0;
        
        Object.values(window.LineageService.exportLineage().nodes || {}).forEach(node => {
            if (node.children && node.children.length > 0) {
                totalChildren += node.children.length;
                parentsWithChildren++;
            }
        });

        return {
            available: true,
            ...stats,
            isValid: validation.valid,
            issueCount: validation.issueCount,
            avgDepth: containersWithLineage > 0 ? 
                Math.round(totalDepth / containersWithLineage * 10) / 10 : 0,
            avgSplitRatio: parentsWithChildren > 0 ? 
                Math.round(totalChildren / parentsWithChildren * 10) / 10 : 0,
            orphanCount: window.LineageService.findOrphans().length,
            isolatedCount: window.LineageService.findIsolatedNodes().length
        };
    }

    /**
     * Activity heatmap data (by day of week and hour)
     */
    function getActivityHeatmap(dateRange) {
        const inventory = window.appState?.inventory || [];
        const history = window.appState?.transferHistory || [];
        
        // Combine creation and transfer timestamps
        const timestamps = [];
        
        inventory.forEach(item => {
            if (item.date || item.timestamp) {
                timestamps.push(new Date(item.date || item.timestamp));
            }
        });
        
        history.forEach(transfer => {
            if (transfer.timestamp) {
                timestamps.push(new Date(transfer.timestamp));
            }
        });

        // Filter by date range
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        const filteredTimestamps = timestamps.filter(ts => ts >= start && ts <= end);

        // Build heatmap: [dayOfWeek][hour] = count
        const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        filteredTimestamps.forEach(ts => {
            const day = ts.getDay();
            const hour = ts.getHours();
            heatmap[day][hour]++;
        });

        // Find busiest times
        let maxCount = 0;
        let busiestDay = 0;
        let busiestHour = 0;

        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                if (heatmap[d][h] > maxCount) {
                    maxCount = heatmap[d][h];
                    busiestDay = d;
                    busiestHour = h;
                }
            }
        }

        // Day totals
        const dayTotals = heatmap.map(day => day.reduce((sum, h) => sum + h, 0));

        return {
            heatmap,
            dayLabels,
            busiestDay: dayLabels[busiestDay],
            busiestHour: formatHour(busiestHour),
            maxCount,
            dayTotals,
            totalEvents: filteredTimestamps.length
        };
    }

    /**
     * Calculate trend indicators (vs previous period)
     */
    function calculateTrends(dateRange) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const daysInRange = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        // Previous period
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - daysInRange);

        const prevDateRange = {
            start: prevStart.toISOString().split('T')[0],
            end: prevEnd.toISOString().split('T')[0]
        };

        // Get counts for both periods
        const inventory = window.appState?.inventory || [];
        const history = window.appState?.transferHistory || [];

        const currentContainers = filterByDateRange(inventory, dateRange).length;
        const prevContainers = filterByDateRange(inventory, prevDateRange).length;

        const currentTransfers = filterByDateRange(history, dateRange, 'timestamp').length;
        const prevTransfers = filterByDateRange(history, prevDateRange, 'timestamp').length;

        return {
            containers: calculateTrendPercent(currentContainers, prevContainers),
            transfers: calculateTrendPercent(currentTransfers, prevTransfers),
            comparisonPeriod: `${daysInRange} days`
        };
    }

    /**
     * Calculate trend percentage
     */
    function calculateTrendPercent(current, previous) {
        if (previous === 0) {
            return current > 0 ? { percent: 100, direction: 'up' } : { percent: 0, direction: 'flat' };
        }
        
        const percent = Math.round(((current - previous) / previous) * 100);
        const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
        
        return { percent: Math.abs(percent), direction };
    }

    /**
     * Filter items by date range
     */
    function filterByDateRange(items, dateRange, dateField = 'date') {
        // Parse date strings as UTC to avoid timezone issues
        const startParts = dateRange.start.split('-');
        const start = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0));
        const endParts = dateRange.end.split('-');
        const end = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999));

        return items.filter(item => {
            const rawDate = item[dateField] || item.timestamp || item.createdAt;
            if (!rawDate) return false;
            const itemDate = new Date(rawDate);
            return !isNaN(itemDate.getTime()) && itemDate >= start && itemDate <= end;
        });
    }

    /**
     * Get week key (YYYY-Wnn format)
     */
    function getWeekKey(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    /**
     * Sort object by count values (descending)
     */
    function sortByCount(obj) {
        return Object.fromEntries(
            Object.entries(obj).sort((a, b) => b[1] - a[1])
        );
    }

    /**
     * Format hour for display
     */
    function formatHour(hour) {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
    }

    /**
     * Invalidate cache (call when data changes)
     */
    function invalidateCache() {
        analyticsCache.data = null;
        analyticsCache.timestamp = null;
    }

    /**
     * Get predefined date ranges
     */
    function getDateRangePresets() {
        const now = new Date();
        
        return [
            {
                label: 'Today',
                start: now.toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
            },
            {
                label: 'Last 7 Days',
                start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
            },
            {
                label: 'Last 30 Days',
                start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
            },
            {
                label: 'Last 90 Days',
                start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
            },
            {
                label: 'This Month',
                start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
            },
            {
                label: 'Last Month',
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0],
                end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
            },
            {
                label: 'This Year',
                start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
                end: now.toISOString().split('T')[0]
            },
            {
                label: 'All Time',
                start: '2020-01-01',
                end: now.toISOString().split('T')[0]
            }
        ];
    }

    /**
     * Export analytics as JSON
     */
    function exportAnalytics(options = {}) {
        const analytics = getAnalytics({ forceRefresh: true, ...options });
        return JSON.stringify(analytics, null, 2);
    }

    /**
     * Export analytics as CSV
     */
    function exportAnalyticsCSV(section = 'containers') {
        const analytics = getAnalytics({ forceRefresh: true });
        let csv = '';

        switch (section) {
            case 'containers':
                csv = 'Category,Name,Count\n';
                Object.entries(analytics.containers.byStage).forEach(([name, count]) => {
                    csv += `Stage,${name},${count}\n`;
                });
                Object.entries(analytics.containers.byOwner).forEach(([name, count]) => {
                    csv += `Owner,${name},${count}\n`;
                });
                break;
            
            case 'transfers':
                csv = 'Date,Count\n';
                Object.entries(analytics.transfers.dailyTransfers).forEach(([date, count]) => {
                    csv += `${date},${count}\n`;
                });
                break;
            
            case 'recipes':
                csv = 'Recipe,Usage Count\n';
                analytics.recipes.topRecipes.forEach(({ name, count }) => {
                    csv += `${name},${count}\n`;
                });
                break;
        }

        return csv;
    }

    // Public API
    return {
        getAnalytics,
        getDateRangePresets,
        invalidateCache,
        exportAnalytics,
        exportAnalyticsCSV,
        getDefaultDateRange
    };

})();

// Invalidate cache when data changes
window.addEventListener('inventoryUpdated', () => window.AnalyticsEngine?.invalidateCache());
window.addEventListener('lineageUpdated', () => window.AnalyticsEngine?.invalidateCache());
