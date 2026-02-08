/**
 * Authentication Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to auth-config.js
 * 2. Replace the placeholder values with your Azure AD app registration details
 * 3. Include auth-config.js BEFORE main.js in your HTML:
 *    <script src="config/auth-config.js"></script>
 *    <script src="src/js/main.js"></script>
 * 
 * SECURITY NOTE:
 * - auth-config.js should be added to .gitignore
 * - Never commit real credentials to version control
 * - For production, these values should come from environment variables or a secure config service
 */

window.MSAL_CONFIG = {
    // Azure AD Application (client) ID
    // Found in: Azure Portal > App registrations > [Your App] > Overview
    clientId: 'YOUR_CLIENT_ID_HERE',
    
    // Azure AD Authority URL (includes tenant ID)
    // For single-tenant apps: https://login.microsoftonline.com/{tenant-id}
    // For multi-tenant apps: https://login.microsoftonline.com/common
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE',
    
    // Redirect URI after authentication
    // Must match one of the redirect URIs configured in Azure AD
    // Leave as window.location.origin for most cases
    redirectUri: window.location.origin
};

// Optional: Configure OneDrive/SharePoint workbook URL
window.CLOUD_SYNC_CONFIG = {
    // SharePoint sharing URL for the HQ workbook
    shareUrl: 'YOUR_SHAREPOINT_WORKBOOK_SHARE_URL_HERE',
    
    // Refresh interval in milliseconds (default: 5 minutes)
    refreshIntervalMs: 300000,
    
    // Excel table names (must match actual table names in workbook)
    inventoryTableName: 'tblActiveInventory',
    strainMappingTableName: 'tblStrainMapping',
    recipeTableName: 'tblRecipes',
    batchTableName: 'tblMediaBatches'
};
