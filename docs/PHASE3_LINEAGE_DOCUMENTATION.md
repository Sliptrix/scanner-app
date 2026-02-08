# Phase 3: Data Tracking & Lineage Enhancements

## Overview

Phase 3 introduces comprehensive lineage tracking and audit trail capabilities to the LoneWolf Biotech Lab Tracker. This enables full traceability of container relationships and complete change history for laboratory compliance.

## New Modules

### 1. LineageService (`src/js/modules/lineage/lineageService.js`)

The core service for tracking parent-child relationships between containers.

#### Key Features:
- **Node Management**: Add and retrieve lineage nodes for containers
- **Relationship Tracking**: Parent-child relationships with generation depth
- **Ancestor/Descendant Queries**: Get full ancestry or all derived containers
- **Transfer Recording**: Automatically track splits and transfers
- **Validation & Repair**: Check for and fix circular references, orphans
- **Statistics**: Generation breakdown, node counts, tree depth

#### API Reference:

```javascript
// Initialize (called automatically on app startup)
LineageService.initialize();

// Add a new node
LineageService.addNode('containerId', {
    parent: 'parentId',  // optional
    strain: 'Strain Name',
    owner: 'Owner Code',
    createdAt: new Date().toISOString()
});

// Record a transfer/split
LineageService.recordTransfer('sourceId', ['dest1', 'dest2'], {
    strain: 'Strain Name',
    consumed: true,
    transferType: 'split'
});

// Query lineage
LineageService.getNode('containerId');           // Get single node
LineageService.getGeneration('containerId');     // Get generation number
LineageService.getAncestors('containerId');      // Get ancestor nodes
LineageService.getDescendants('containerId');    // Get all descendants
LineageService.getFullLineage('containerId');    // Complete lineage info
LineageService.getLineagePath('containerId');    // "100 → 101 → 102"

// Validation
LineageService.validateLineage();    // Check for issues
LineageService.repairLineage();      // Fix issues
LineageService.findOrphans();        // Find missing parent refs
LineageService.findIsolatedNodes();  // Find disconnected nodes

// Statistics
LineageService.getStats();           // Get lineage statistics
LineageService.exportLineage();      // Export as JSON
```

### 2. AuditService (`src/js/modules/lineage/auditService.js`)

Complete audit trail for all container operations.

#### Key Features:
- **Event Logging**: All operations logged with timestamps
- **User Attribution**: Tracks who performed each action
- **Change Tracking**: Records previous and new values
- **History Retrieval**: Query by container, date, user, or event type
- **Export**: CSV and JSON export capabilities

#### Event Types:

| Event | Description |
|-------|-------------|
| `CONTAINER_CREATED` | New container created |
| `CONTAINER_UPDATED` | Container data modified |
| `CONTAINER_TRANSFERRED` | Single container transfer |
| `CONTAINER_SPLIT` | Container split into multiple |
| `CONTAINER_DISCARDED` | Tissues discarded |
| `CONTAINER_DELETED` | Container removed |
| `LOCATION_CHANGED` | Location updated |
| `STAGE_CHANGED` | Stage updated |
| `MEDIA_CHANGED` | Media type updated |
| `COUNT_ADJUSTED` | Tissue count changed |
| `QR_ASSIGNED` | QR code linked to container |

#### API Reference:

```javascript
// Initialize (called automatically)
AuditService.initialize();

// Log events
AuditService.logContainerCreated('containerId', { strain, owner, ... });
AuditService.logContainerUpdated('containerId', previousValues, newValues);
AuditService.logTransfer('sourceId', ['destIds'], options);
AuditService.logDiscard('containerId', count, reason);

// Query history
AuditService.getContainerHistory('containerId');  // All events for container
AuditService.getContainerTimeline('containerId'); // Formatted timeline
AuditService.getRecentEvents(50);                 // Last N events
AuditService.getEventsByDateRange(start, end);    // Events in date range

// Statistics & Export
AuditService.getStats();       // Event statistics
AuditService.exportLog();      // Export as JSON
AuditService.exportAsCSV();    // Export as CSV
```

### 3. LineageUI (`src/js/modules/lineage/lineageUI.js`)

UI components for visualizing lineage data.

#### Key Features:
- **Lineage Badges**: Color-coded badges showing generation (G0, G1, G2+)
- **Lineage Modal**: Full-screen view with tree, timeline, and path tabs
- **Click Navigation**: Click through from parent to child
- **Lineage Filter**: Filter inventory by lineage relationships

#### API Reference:

```javascript
// Initialize (called automatically)
LineageUI.initialize();

// Create badges for containers
const badgeHTML = LineageUI.createBadge('containerId');
const tableDisplay = LineageUI.createTableLineageDisplay(inventoryItem);

// Show modals
LineageUI.showLineageModal('containerId');  // Full lineage view
LineageUI.closeLineageModal();

// Filtering
LineageUI.showDescendants('containerId');   // Show all descendants
LineageUI.showLineageFilterModal();          // Open filter dialog
LineageUI.applyLineageFilter();              // Apply current filter
```

### 4. LineageReports (`src/js/modules/lineage/lineageReports.js`)

Reporting and analytics for lineage data.

#### Key Features:
- **Full Reports**: Comprehensive lineage reports with statistics
- **Container Export**: Individual container lineage export
- **Transfer Analysis**: Patterns by time, day, user
- **Orphan Reports**: Detection of data integrity issues
- **Multi-format Export**: JSON, CSV, Excel

#### API Reference:

```javascript
// Generate reports
LineageReports.generateFullReport();                    // Complete system report
LineageReports.generateContainerLineageExport('id');    // Single container
LineageReports.generateOrphanReport();                  // Orphan detection
LineageReports.analyzeTransferPatterns();               // Usage analytics

// Export
LineageReports.downloadJSONReport();   // Download JSON
LineageReports.downloadCSV();          // Download CSV
LineageReports.downloadExcel();        // Download Excel workbook
LineageReports.downloadAuditLog();     // Download audit log

// UI
LineageReports.showReportsModal();     // Open reports modal
```

## UI Integration

### Inventory Table

The lineage column in the inventory table now shows:
- Generation badge (G0, G1, G2+) with color coding
- Click-to-view functionality opening lineage modal
- Parent container reference for transferred containers

### Reference Data Section

New "Lineage & Audit Tracking" panel with:
- Lineage Reports button
- Rebuild Lineage button
- Export buttons (Excel, CSV, Audit Log)
- Live statistics display

### Lineage Filter

In inventory search, new "🔗 Lineage" filter button allows:
- Filter by descendants of a container
- Filter by ancestors
- Filter by full lineage tree
- Filter by direct children
- Filter by siblings

## Data Storage

Both services persist data to localStorage:
- `lwb_lineage_data` - Lineage nodes and relationships
- `lwb_audit_log` - Audit trail entries

Data is automatically loaded on page load and saved after each operation.

## Best Practices

### When to Rebuild Lineage

- After bulk imports
- After data restoration from backup
- If lineage badges show incorrect data
- After manual inventory modifications

### Audit Log Management

- Export audit logs periodically for compliance
- Audit log is limited to 10,000 entries (oldest removed first)
- Consider clearing old entries if storage becomes limited

### Lineage Validation

Run validation periodically to:
- Detect circular references
- Find orphaned containers
- Identify missing parent relationships

Use repair functionality to automatically fix issues.

## Testing

Run the test suite:
```javascript
// In browser console
LineageTrackingTests.runAllTests();

// Cleanup after testing
LineageTrackingTests.cleanup();
```

## Troubleshooting

### Lineage Badges Not Showing
1. Check if LineageService is initialized: `console.log(window.LineageService)`
2. Rebuild from inventory: `LineageService.rebuildFromInventory()`
3. Check for JavaScript errors in console

### Audit Events Not Logging
1. Check if AuditService is initialized: `console.log(window.AuditService)`
2. Verify user is authenticated for user attribution
3. Check localStorage quota

### Export Failures
1. Ensure XLSX library is loaded for Excel export
2. Check browser download permissions
3. Try smaller date ranges for large exports
