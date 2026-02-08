# Cloud Write Operations Audit

**⚠️ CRITICAL: The cloud HQ workbook is PRODUCTION DATA - READ-ONLY ACCESS ONLY**

## Write Operations in OneDriveSync.js

| Method | Operation | Status |
|--------|-----------|--------|
| `uploadFile()` | Full workbook overwrite (PUT) | ✅ BLOCKED by `allowFullWorkbookOverwrite=false` |
| `appendNewInventoryRowsToCloud()` | Append rows via POST | ✅ BLOCKED by `readOnlyMode=true` |
| `updateRowByContainerId()` | PATCH individual rows | ✅ BLOCKED by `readOnlyMode=true` |
| `appendStrainReferenceRow()` | POST strain reference | ✅ BLOCKED by `readOnlyMode=true` |
| `appendRecipeToCloud()` | POST/PATCH recipes | ✅ BLOCKED by `readOnlyMode=true` |
| `appendBatchToCloud()` | POST/PATCH batches | ✅ BLOCKED by `readOnlyMode=true` |
| `updateRecipeRow()` | PATCH recipe row | ✅ BLOCKED by `readOnlyMode=true` |
| `updateBatchRow()` | PATCH batch row | ✅ BLOCKED by `readOnlyMode=true` |

## Safety Guards (ALL ENABLED BY DEFAULT)

1. **`allowFullWorkbookOverwrite`** (line 29): Defaults to `false`, blocks `uploadFile()`
2. **`readOnlyMode`** (line 33): Defaults to `true`, blocks ALL other write operations

## How to Enable Writes (FOR LOCAL EXPORT ONLY)

To enable writes for local export operations ONLY (never against cloud):

```javascript
// ⚠️ ONLY for local file exports, NEVER for cloud workbooks
OneDriveSync.readOnlyMode = false;
```

## Testing Guidelines

- ✅ READ from cloud Excel for parsing tests
- ❌ NEVER execute write operations against cloud
- ✅ Use local test files (e.g., `barcode test.xlsx`)
- ✅ Use mock data for write operation tests

---
*Last updated: 2026-02-07 - All write operations now blocked by default*
