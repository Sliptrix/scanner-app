# Phase 4: Recipe & Media Tracking with Cloud HQ Integration

## Overview

Phase 4 enhances the Scanner App's recipe and media tracking capabilities while establishing proper integration with the Cloud HQ Excel workbook.

## Key Principles

### 🔒 Read-Only Cloud Access (Default)

**CRITICAL**: The Cloud HQ workbook is production data. All write operations are **blocked by default**.

```javascript
// In OneDriveSync.js
readOnlyMode: true  // Default - blocks ALL writes
```

## New Features

### 1. Configurable Cloud HQ Connection

**Before**: SharePoint URL was hardcoded in `main.js`

**After**: Configuration loaded from `config/cloud-hq-config.js`

```javascript
// config/cloud-hq-config.js
window.CLOUD_HQ_CONFIG = {
    shareUrl: 'https://yourtenant.sharepoint.com/...',
    refreshIntervalMs: 300000,
    tables: {
        activeInventory: 'tblActiveInventory',
        strainMapping: 'tblStrainMapping',
        recipes: 'tblRecipes',
        batches: 'tblMediaBatches'
    },
    // ... more configuration
};
```

### 2. Connection Status Indicator

A new visual indicator in the header shows cloud connection status:

| Icon | State | Meaning |
|------|-------|---------|
| 🟢 | Connected | Successfully synced with cloud |
| 🔄 | Syncing | Sync operation in progress |
| 🔴 | Error | Last sync failed |
| 🟡 | Ready | Authenticated but not synced |
| ⚪ | Offline | Not connected |

**Click the indicator** to trigger a manual sync.

### 3. Recipe Versioning System

New `RecipeVersioning` module (`src/js/modules/recipe/recipeVersioning.js`):

```javascript
// Create a version when recipe is modified
RecipeVersioning.createVersion(recipe, previousVersion);

// Get version history
const history = RecipeVersioning.getVersionHistory(recipeId);

// Revert to a previous version
RecipeVersioning.revertToVersion(recipeId, versionNumber);

// Compare two versions
const diff = RecipeVersioning.compareVersions(recipeId, v1, v2);
```

### 4. Recipe-Container Usage Tracking

Link recipes to the containers that used them:

```javascript
// Track when a container uses a recipe
RecipeVersioning.trackContainerUsage(recipeId, containerId, {
    batchId: 'MB-20260207-ABCD',
    stage: 'Initiation',
    strain: 'Blue Dream',
    owner: 'LW'
});

// Get all containers that used a recipe
const containers = RecipeVersioning.getContainersByRecipe(recipeId);

// Find which recipe a container used
const recipeInfo = RecipeVersioning.getRecipeForContainer(containerId);

// Get usage statistics
const stats = RecipeVersioning.getRecipeUsageStats(recipeId);
// Returns: { totalContainers, firstUsed, lastUsed, uniqueStrains, byStage }
```

### 5. Enhanced Media Batch Tracking

Existing `MediaBatchManager` capabilities:

- **Batch lifecycle**: IN_PREP → READY → IN_USE → DEPLETED/EXPIRED
- **Container tracking**: Total, available, used counts
- **Expiration monitoring**: Automatic expiry detection
- **Preparation steps**: Track completion of each prep step

```javascript
// Create a batch from a recipe
const batch = MediaBatchManager.createBatch(recipeId, {
    containerCount: 50,
    preparedBy: 'Lab Tech',
    expiryDays: 30
});

// Complete preparation steps
MediaBatchManager.completeStep(batchId, 'autoclave', 'Autoclaved at 121°C');

// Use containers from a batch
MediaBatchManager.useContainers(batchId, 5);

// Get expiring batches
const expiring = MediaBatchManager.getExpiringBatches(7); // Next 7 days
```

## Data Flow

### Reading from Cloud HQ

```
Cloud HQ Workbook
       │
       ▼ (Microsoft Graph API - Files.Read.All)
OneDriveSync.manualSync()
       │
       ├──► parseReferenceSheets()  → appState.strainsTable
       │                            → appState.ownersTable
       │                            → appState.stagesTable
       │                            → appState.locationsTable
       │                            → appState.mediaTypesTable
       │
       └──► syncActiveInventoryToApp() → StateManager.inventory
```

### Writing to Cloud (Blocked by Default)

```javascript
// These operations are blocked when readOnlyMode: true
OneDriveSync.appendNewInventoryRowsToCloud();  // ❌ Blocked
OneDriveSync.appendRecipeToCloud();            // ❌ Blocked
OneDriveSync.appendBatchToCloud();             // ❌ Blocked
```

## Configuration Files

### 1. `config/cloud-hq-config.template.js`

Template for cloud configuration. Copy to `cloud-hq-config.js` and customize.

### 2. `config/auth-config.template.js`

Template for MSAL authentication. Copy to `auth-config.js` and add Azure AD credentials.

## Setup Checklist

1. ☐ Copy `config/cloud-hq-config.template.js` → `config/cloud-hq-config.js`
2. ☐ Update `shareUrl` with your SharePoint workbook URL
3. ☐ Verify table names match your Excel Tables
4. ☐ Verify sheet names match your workbook structure
5. ☐ Copy `config/auth-config.template.js` → `config/auth-config.js`
6. ☐ Add Azure AD client ID and tenant ID
7. ☐ Add both config files to `.gitignore`
8. ☐ Include config scripts in HTML before `main.js`

## Files Modified/Created

### New Files
- `config/cloud-hq-config.template.js` - Cloud configuration template
- `src/js/modules/recipe/recipeVersioning.js` - Recipe versioning module
- `docs/CLOUD_HQ_INTEGRATION.md` - Detailed integration guide
- `docs/PHASE4_RECIPE_MEDIA_TRACKING.md` - This document

### Modified Files
- `src/js/main.js` - Uses configurable cloud settings
- `src/js/modules/cloud/oneDriveSync.js` - Enhanced status indicator updates
- `src/styles/dashboard.css` - Connection indicator styles
- `index.html` - Added connection status indicator

## API Reference

### OneDriveSync (Cloud Integration)

| Method | Description | Status |
|--------|-------------|--------|
| `init(authManager, options)` | Initialize with configuration | ✅ Active |
| `manualSync()` | Trigger manual sync | ✅ Active |
| `syncActiveInventoryToApp()` | Load inventory from cloud | ✅ Active |
| `getStatus()` | Get sync status | ✅ Active |
| `updateConnectionIndicator()` | Update UI indicator | ✅ Active |
| `appendRecipeToCloud()` | Sync recipe to cloud | ⛔ Blocked |
| `appendBatchToCloud()` | Sync batch to cloud | ⛔ Blocked |

### RecipeVersioning (New)

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize module |
| `createVersion(recipe, prev)` | Create version entry |
| `getVersionHistory(recipeId)` | Get version history |
| `getVersion(recipeId, version)` | Get specific version |
| `compareVersions(id, v1, v2)` | Compare two versions |
| `revertToVersion(id, version)` | Revert to version |
| `trackContainerUsage(recipeId, containerId, details)` | Track usage |
| `getContainersByRecipe(recipeId)` | Get containers using recipe |
| `getRecipeForContainer(containerId)` | Get recipe for container |
| `getRecipeUsageStats(recipeId)` | Get usage statistics |

### MediaBatchManager (Existing)

| Method | Description |
|--------|-------------|
| `createBatch(recipeId, options)` | Create new batch |
| `getBatch(batchId)` | Get batch by ID |
| `updateBatch(batchId, updates)` | Update batch |
| `completeStep(batchId, stepId)` | Complete prep step |
| `markReady(batchId)` | Mark batch ready |
| `useContainers(batchId, count)` | Consume containers |
| `getAvailableBatches(mediaType)` | Get available batches |
| `getExpiringBatches(days)` | Get expiring batches |
| `getBatchStats()` | Get statistics |

## Testing

### Test Cloud Connection

```javascript
// In browser console
OneDriveSync.getStatus();
// Should return: { lastSync, lastError, isRunning, fromCloud }
```

### Test Recipe Versioning

```javascript
// Create test recipe
const recipe = { id: 'test', name: 'Test', mediaType: 'Initiation', volume: '1L' };
RecipeVersioning.createVersion(recipe, null);
RecipeVersioning.getVersionHistory('test');
```

### Test Container Tracking

```javascript
// Track usage
RecipeVersioning.trackContainerUsage('recipe123', '000001', {
    stage: 'Initiation',
    strain: 'Blue Dream'
});

// Query usage
RecipeVersioning.getContainersByRecipe('recipe123');
RecipeVersioning.getRecipeForContainer('000001');
```

## Security Notes

1. **Never set `readOnlyMode: false`** against production workbooks
2. Keep configuration files out of version control
3. Use environment-specific config files for different deployments
4. Monitor Azure AD app consent and scopes

---

*Phase 4 Complete - 2026-02-07*
