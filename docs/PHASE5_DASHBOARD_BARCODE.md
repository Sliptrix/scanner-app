# Phase 5: Dashboard Analytics & Barcode Builder

## Overview

Phase 5 introduces comprehensive dashboard analytics with visualizations and an enhanced barcode builder with batch generation and print queue capabilities.

## Dashboard Analytics

### Analytics Engine (`src/js/modules/dashboard/analyticsEngine.js`)

The analytics engine provides comprehensive data analysis:

```javascript
// Get all analytics for default date range (last 30 days)
const analytics = AnalyticsEngine.getAnalytics();

// Get analytics for custom date range
const analytics = AnalyticsEngine.getAnalytics({
    dateRange: { start: '2026-01-01', end: '2026-01-31' },
    forceRefresh: true
});

// Get date range presets
const presets = AnalyticsEngine.getDateRangePresets();
// Returns: [{ label: 'Today', start: '...', end: '...' }, ...]

// Export analytics
const json = AnalyticsEngine.exportAnalytics();
const csv = AnalyticsEngine.exportAnalyticsCSV('containers');

// Invalidate cache when data changes
AnalyticsEngine.invalidateCache();
```

### Analytics Data Structure

```javascript
{
    timestamp: '2026-02-07T...',
    dateRange: { start: '...', end: '...', label: 'Last 30 Days' },
    
    containers: {
        total: 150,
        filtered: 145,
        tissueCount: 523,
        byStatus: { active: 120, consumed: 20, discarded: 5, unknown: 0 },
        byStage: { Mother: 10, T1: 50, T2: 30, Rooting: 15, ... },
        byLocation: { 'Lab A': 80, 'Lab B': 70 },
        byOwner: { 'JD': 50, 'AB': 40, ... },
        byStrain: { 'Strain 1': 30, 'Strain 2': 25, ... }
    },
    
    transfers: {
        total: 45,
        dailyTransfers: { '2026-02-01': 3, '2026-02-02': 5, ... },
        weeklyTransfers: { '2026-W05': 12, '2026-W06': 18, ... },
        byType: { single: 20, split: 25 },
        totalTissuesTransferred: 234,
        totalTissuesDiscarded: 12,
        totalContainersCreated: 78,
        avgTissuesPerTransfer: 5.2,
        avgSplitRatio: 2.8
    },
    
    recipes: {
        totalRecipes: 12,
        recipeUsage: { 'MS Basic': 45, 'WPM': 30, ... },
        topRecipes: [{ name: 'MS Basic', count: 45 }, ...],
        unusedRecipes: 2
    },
    
    mediaBatches: {
        available: true,
        total: 25,
        inPrep: 3,
        ready: 8,
        inUse: 10,
        depleted: 3,
        expired: 1,
        expiringSoon: 2,
        containerUtilization: 75
    },
    
    lineage: {
        available: true,
        totalNodes: 150,
        maxGeneration: 4,
        avgDepth: 1.8,
        avgSplitRatio: 2.5,
        rootNodes: 25,
        orphanCount: 0
    },
    
    activityHeatmap: {
        heatmap: [[0, 0, 1, 5, ...], ...], // 7x24 array
        dayLabels: ['Sun', 'Mon', ...],
        busiestDay: 'Wed',
        busiestHour: '10 AM',
        maxCount: 12
    },
    
    trends: {
        containers: { percent: 15, direction: 'up' },
        transfers: { percent: 8, direction: 'up' },
        comparisonPeriod: '30 days'
    }
}
```

### Chart Renderer (`src/js/modules/dashboard/chartRenderer.js`)

CSS-based chart rendering without external dependencies:

```javascript
// Bar chart
ChartRenderer.renderBarChart('containerId', {
    labels: ['A', 'B', 'C'],
    values: [10, 20, 15],
    colors: ['#10b981', '#3b82f6', '#f59e0b'] // optional
}, {
    title: 'My Chart',
    horizontal: true,
    showValues: true,
    maxBars: 10,
    onClick: (label, value, index) => { /* handle click */ }
});

// Pie/Donut chart
ChartRenderer.renderPieChart('containerId', {
    labels: ['Stage 1', 'Stage 2'],
    values: [30, 70]
}, {
    title: 'Distribution',
    donut: true,
    centerText: '100',
    centerLabel: 'Total',
    showLegend: true,
    onClick: (label, value, index) => { /* filter by stage */ }
});

// Line chart
ChartRenderer.renderLineChart('containerId', {
    labels: ['Jan', 'Feb', 'Mar'],
    values: [10, 25, 18]
}, {
    title: 'Trend',
    showArea: true,
    showDots: true,
    color: '#10b981'
});

// Activity heatmap
ChartRenderer.renderHeatmap('containerId', {
    heatmap: analytics.activityHeatmap.heatmap,
    dayLabels: analytics.activityHeatmap.dayLabels
}, {
    title: 'Activity Heatmap'
});

// Stat cards with trends
ChartRenderer.renderStatCards('containerId', [
    { label: 'Total', value: 150, trend: { percent: 15, direction: 'up' }, icon: '📦' },
    { label: 'Active', value: 120, icon: '🌱', color: '#10b981' }
], { columns: 4 });
```

## Barcode Builder

### Barcode Builder UI (`src/js/modules/barcode/barcodeBuilderUI.js`)

Enhanced barcode generation with batch capabilities:

```javascript
// Show the barcode builder modal
BarcodeBuilderUI.showModal();

// Close the modal
BarcodeBuilderUI.closeModal();

// The modal provides:
// - Three generation modes: Single, Batch, Reprint
// - Container input with validation
// - Label template selection
// - Barcode format selection (QR / Code128)
// - Live preview
// - Add to queue / Print directly
```

### Container Input Formats

The builder accepts multiple input formats:

```
// Single container
"123"

// Range (generates 100, 101, 102, 103, 104, 105)
"100-105"

// List (comma-separated)
"100, 101, 102"
```

### Label Templates

| Template | Size | Barcode | Text |
|----------|------|---------|------|
| Standard | 2" × 1" | QR | Yes |
| Small | 1.5" × 0.5" | QR | Yes |
| Large | 3" × 1.5" | QR | Yes |
| QR Only | 1" × 1" | QR | No |
| Code128 | 2.5" × 1" | Code128 | Yes |

### Print Queue

Labels can be queued for batch printing:

```javascript
// Queue is stored in localStorage
// Key: 'barcode_print_queue'

// Queue item structure:
{
    id: 'unique_id',
    containerId: 100,
    container: { /* full container data */ },
    template: 'standard',
    format: 'qr',
    addedAt: '2026-02-07T...'
}
```

### Print History

All print operations are logged:

```javascript
// History is stored in localStorage
// Key: 'barcode_print_history'

// History entry structure:
{
    id: 1234567890,
    timestamp: '2026-02-07T...',
    containerCount: 5,
    containerIds: [100, 101, 102, 103, 104]
}
```

## Dashboard Enhancements

### Quick Actions

The dashboard includes quick action buttons:

- **New Intake** - Jump to intake form
- **New Container** - Open container initiator
- **Transfer** - Go to transfer mode
- **Print Labels** - Open barcode builder
- **Export Data** - Export inventory to Excel
- **Full Report** - Show complete analytics report

### Click-Through Filtering

Charts support click-to-filter:

- Click a pie chart segment → Filter inventory by that stage
- Click a bar chart row → Filter inventory by that category

### Date Range Selector

Located in the dashboard header:

- **Presets**: Today, 7/30/90 days, This Month, Last Month, This Year, All Time
- **Refresh button**: Force refresh analytics
- All charts update when date range changes

### Expiring Batches Warning

If media batches are expiring within 7 days:

- Warning banner appears in dashboard
- "View Details" button shows list of expiring batches

### Lineage Statistics Panel

Shows lineage health:

- Max Generation depth
- Average lineage depth
- Average split ratio
- Root container count
- Orphan detection with repair button

## CSS Classes

Key CSS classes for customization:

```css
/* Charts */
.chart-container
.chart-title
.bar-chart, .pie-chart, .line-chart, .heatmap-chart
.bar-row, .bar-fill, .bar-value
.pie-circle, .pie-hole, .pie-legend

/* Stats */
.stat-cards-grid
.stat-card
.stat-trend, .trend-up, .trend-down, .trend-flat

/* Builder */
.barcode-builder-modal
.builder-tabs, .tab-btn
.builder-grid
.mode-selector, .radio-card
.preview-container
.queue-list, .history-list

/* Utilities */
.analytics-grid
.quick-actions-grid
.warning-banner
```

## Testing

Run Phase 5 tests:

```bash
npm run test:phase5
```

Tests cover:
- Analytics engine calculations
- Date range handling
- Container input parsing
- Print queue/history storage
- Trend calculations
- Export functionality
