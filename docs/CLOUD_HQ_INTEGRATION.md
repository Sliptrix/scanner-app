# Cloud HQ Integration Guide

This guide explains how the Scanner App integrates with the Cloud HQ Excel workbook hosted on SharePoint/OneDrive.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration](#configuration)
4. [Data Flow](#data-flow)
5. [Authentication](#authentication)
6. [Sheet/Table Reference](#sheet-table-reference)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

---

## Overview

The Scanner App uses a **cloud-first, read-mostly** architecture where:

- **HQ Excel Workbook** is the **source of truth** for reference data (strains, owners, stages, etc.)
- **App reads** data from the workbook to populate dropdowns and validate entries
- **App writes** are **blocked by default** (`readOnlyMode: true`) to protect production data
- **Local storage** provides offline capability and caches cloud data

### Key Modules

| Module | File | Purpose |
|--------|------|---------|
| `OneDriveSync` | `src/js/modules/cloud/oneDriveSync.js` | Cloud sync operations |
| `AuthManager` | `src/js/modules/auth/authManager.js` | Microsoft 365 authentication |
| `DataUtils` | `src/js/utils/dataUtils.js` | Data processing and localStorage |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SharePoint/OneDrive                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Enhanced_Plant_Inventory_System.xlsx                │  │
│  │  ┌─────────────────┬──────────────────┬───────────────┐  │  │
│  │  │ Active_Inventory│   Ref_Strains    │  Ref_Owners   │  │  │
│  │  │   (Table)       │     (Table)      │   (Table)     │  │  │
│  │  └─────────────────┴──────────────────┴───────────────┘  │  │
│  │  ┌─────────────────┬──────────────────┬───────────────┐  │  │
│  │  │  Ref_Stages     │  Ref_Locations   │Ref_Media_Types│  │  │
│  │  │    (Table)      │     (Table)      │   (Table)     │  │  │
│  │  └─────────────────┴──────────────────┴───────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Microsoft Graph API
                                 │ (Files.Read.All scope)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Scanner App                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ AuthManager │────│OneDriveSync │────│ appState / StateManager│
│  │   (MSAL)    │    │  (Graph)    │    │   (Runtime State)     │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                            │                      │              │
│                            ▼                      ▼              │
│                     ┌─────────────┐        ┌───────────┐        │
│                     │ localStorage│◄──────►│ DataUtils │        │
│                     │  (Cache)    │        └───────────┘        │
│                     └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Step 1: Create Configuration File

Copy the template and customize:

```bash
cp config/cloud-hq-config.template.js config/cloud-hq-config.js
```

### Step 2: Get SharePoint URL

1. Open your HQ Excel file in SharePoint/OneDrive
2. Click **Share** → **Copy link** → **People with existing access**
3. Paste the full URL in your config:

```javascript
window.CLOUD_HQ_CONFIG = {
    shareUrl: 'https://yourtenant-my.sharepoint.com/:x:/r/personal/...',
    // ... rest of config
};
```

### Step 3: Map Your Sheet/Table Names

Update the `tables` and `sheets` sections to match your workbook:

```javascript
tables: {
    activeInventory: 'tblActiveInventory',  // Your Excel Table name
    strainMapping: 'tblStrainMapping',
    recipes: 'tblRecipes',
    batches: 'tblMediaBatches'
},
sheets: {
    activeInventory: 'Active_Inventory',    // Your sheet name
    refStrains: 'Ref_Strains',
    refOwners: 'Ref_Owners',
    // ...
}
```

### Step 4: Map Your Column Names

If your columns have different names, update the `columns` section:

```javascript
columns: {
    activeInventory: {
        containerId: ['Container_ID', 'ContainerID'],  // Alternatives tried in order
        strainName: ['Strain_Name', 'Strain', 'Variety'],
        // ...
    }
}
```

### Step 5: Include Configuration in HTML

Add **before** main.js:

```html
<script src="config/auth-config.js"></script>
<script src="config/cloud-hq-config.js"></script>
<script src="src/js/main.js"></script>
```

---

## Data Flow

### Read Operations (✅ Enabled)

| Operation | Method | Data Retrieved |
|-----------|--------|----------------|
| Sync strain-owner mapping | `manualSync()` | Strain → Owner lookups |
| Load reference sheets | `parseReferenceSheets()` | Strains, Owners, Stages, Locations, Media Types |
| Load active inventory | `syncActiveInventoryToApp()` | Container records from Active_Inventory |
| Find container row | `findContainerRow()` | Excel row number for deep-linking |

### Write Operations (⛔ Blocked by Default)

All write operations are blocked by `readOnlyMode: true`:

| Operation | Method | Status |
|-----------|--------|--------|
| Append inventory rows | `appendNewInventoryRowsToCloud()` | ⛔ Blocked |
| Update container | `updateRowByContainerId()` | ⛔ Blocked |
| Sync recipe | `appendRecipeToCloud()` | ⛔ Blocked |
| Sync batch | `appendBatchToCloud()` | ⛔ Blocked |
| Full overwrite | `uploadFile()` | ⛔ Blocked |

---

## Authentication

### Required Scopes

```javascript
scopes: ['User.Read', 'Mail.Send', 'Files.Read.All', 'Sites.Read.All']
```

### Azure AD Setup

See `docs/AZURE_AD_SETUP.md` for detailed instructions on:
- Creating an Azure AD App Registration
- Configuring redirect URIs
- Granting admin consent for scopes

### Auth Configuration

```javascript
// config/auth-config.js
window.MSAL_CONFIG = {
    clientId: 'your-azure-app-client-id',
    authority: 'https://login.microsoftonline.com/your-tenant-id',
    redirectUri: window.location.origin
};
```

---

## Sheet/Table Reference

### Expected Workbook Structure

The HQ workbook should have these sheets (names are configurable):

#### `Active_Inventory` (Required)

| Column | Type | Description |
|--------|------|-------------|
| Container_ID | Number | 6-digit container identifier |
| Strain_ID | Number | Reference to Ref_Strains |
| Strain_Name | Text | Human-readable strain name |
| Owner | Text | Owner code (e.g., "LW", "JR") |
| Stage | Text | Propagation stage |
| Location | Text | Physical location |
| Media | Text | Media type code |
| Quantity | Number | Tissue count |
| DateCreated | Date | Creation date |
| Status | Text | Active/Inactive |
| QRContainerID | URL | QR code destination URL |

#### `Ref_Strains` (Reference)

| Column | Type | Description |
|--------|------|-------------|
| Strain_ID | Number | Unique identifier |
| Strain_Name | Text | Full strain name |
| ABR | Text | Abbreviation/code |
| Owner_Code | Text | Comma-separated owner codes |

#### `Ref_Owners` (Reference)

| Column | Type | Description |
|--------|------|-------------|
| Owner_ID | Text | Owner code (e.g., "LW") |
| Owner_Name | Text | Full name |

#### `Ref_Stages` (Reference)

| Column | Type | Description |
|--------|------|-------------|
| Stage_ID | Number/Text | Stage code |
| Stage_Name | Text | Full stage name |

#### `Ref_Locations` (Reference)

| Column | Type | Description |
|--------|------|-------------|
| Location_Name | Text | Location name |

#### `Ref_Media_Types` (Reference)

| Column | Type | Description |
|--------|------|-------------|
| Media_ID | Text | Media type code |
| Media_Name | Text | Full media type name |

---

## Troubleshooting

### Common Issues

#### "No shareUrl configured"
- Check that `cloud-hq-config.js` is loaded before `main.js`
- Verify the `shareUrl` value is set correctly

#### "Failed to resolve share URL: 403"
- User doesn't have access to the SharePoint file
- Check SharePoint permissions
- Verify the sharing URL is correct

#### "Sheet not found"
- Sheet names are case-sensitive in some operations
- Check your `sheets` configuration matches exactly

#### "Silent token acquisition failed"
- User session expired
- Click the sync button to re-authenticate
- Check browser console for MSAL errors

#### Stale data after sync
- Clear localStorage: `localStorage.clear()`
- Trigger manual sync via the UI button
- Check browser network tab for successful API responses

### Debug Mode

Enable verbose logging:

```javascript
// In browser console
localStorage.setItem('DEBUG_CLOUD_SYNC', 'true');
location.reload();
```

---

## Security Considerations

### Read-Only Mode (Default)

The app ships with `readOnlyMode: true` which:
- Blocks ALL write operations to the cloud workbook
- Protects production data from accidental corruption
- Only allows read operations via Microsoft Graph API

### When to Disable Read-Only Mode

**⚠️ CAUTION: Only disable for controlled scenarios:**
- Local development with test workbooks
- Export operations to separate files
- Never disable for production HQ workbooks

```javascript
// ⚠️ DANGEROUS - Only for testing
OneDriveSync.readOnlyMode = false;
```

### Token Security

- Access tokens are stored in `sessionStorage` (cleared on browser close)
- Tokens expire and require re-authentication
- Use inactivity timeout to auto-logout (default: 30 minutes)

### Audit Trail

Consider implementing:
- Server-side logging of all sync operations
- Timestamp tracking of last sync per user
- Change detection before/after sync

---

## Sync Status UI

The app displays sync status in the UI:

| Status | Icon | Meaning |
|--------|------|---------|
| Connected | 🟢 | Successfully authenticated and synced |
| Syncing | ⏳ | Sync operation in progress |
| Error | 🔴 | Last sync failed (click for details) |
| Offline | ⚪ | Not connected (using cached data) |

**Last Sync Timestamp**: Displayed in the header when available.

---

## Recipe & Media Integration

### Recipe Cloud Sync (When Enabled)

If writes are enabled, recipes can sync to the cloud:

```javascript
// Columns expected in tblRecipes
Recipe_ID, Recipe_Name, Media_Type, Volume, 
Basal_Salt_Type, Basal_Salt_Amount,
Gelling_Agent_Type, Gelling_Agent_Amount,
Pre_Autoclave, Post_Autoclave,
Target_pH, Created_Date, Created_By, Notes
```

### Media Batch Cloud Sync (When Enabled)

```javascript
// Columns expected in tblMediaBatches  
Batch_ID, Recipe_ID, Recipe_Name, Media_Type, Volume,
Prepared_By, Prep_Date, Expiry_Date, Total_Containers,
Available_Containers, Status, Completed_Steps, Notes
```

---

## API Reference

### OneDriveSync Methods

```javascript
// Initialize (called by main.js)
OneDriveSync.init(AuthManager, options);

// Manual sync (reads from cloud)
await OneDriveSync.manualSync();

// Sync active inventory
await OneDriveSync.syncActiveInventoryToApp();

// Get sync status
OneDriveSync.getStatus();
// Returns: { lastSync, lastError, isRunning, fromCloud }

// Start/stop auto-refresh
OneDriveSync.startAutoRefresh();
OneDriveSync.stopAutoRefresh();
```

---

*Last Updated: 2026-02-07*
