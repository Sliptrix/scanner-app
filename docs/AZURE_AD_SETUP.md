# Azure AD Setup Guide

This guide walks you through setting up Microsoft 365 authentication for the Scanner app using Azure Active Directory.

## Prerequisites

- Access to Azure Portal (https://portal.azure.com)
- Admin access to LoneWolf Biotech Azure AD tenant
- Microsoft 365 accounts for users who will access the app

## Step 1: Register Application in Azure AD

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with your admin account

2. **Open Azure Active Directory**
   - In the left menu, click "Azure Active Directory"
   - Or search for "Azure Active Directory" in the top search bar

3. **Register New Application**
   - Click "App registrations" in the left menu
   - Click "+ New registration" at the top
   
4. **Fill in Application Details**
   - **Name**: `LoneWolf Scanner App` (or your preferred name)
   - **Supported account types**: Select "Accounts in this organizational directory only (Single tenant)"
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URL: `http://localhost:8000` (for development)
   - Click "Register"

## Step 2: Configure API Permissions

1. **Navigate to API Permissions**
   - In your newly created app, click "API permissions" in the left menu

2. **Add Microsoft Graph Permissions**
   - Click "+ Add a permission"
   - Select "Microsoft Graph"
   - Select "Delegated permissions"
   - Add the following permissions:
     - `User.Read` (should already be added by default)
     - `Mail.Send` (allows sending emails on behalf of the user)
   - Click "Add permissions"

3. **Grant Admin Consent** (Important!)
   - Click "Grant admin consent for [Your Organization]"
   - Confirm by clicking "Yes"
   - Wait for the status to show "Granted" with a green checkmark

## Step 3: Get Application Credentials

1. **Get Client ID**
   - In the app overview page, copy the "Application (client) ID"
   - Example: `12345678-1234-1234-1234-123456789012`

2. **Get Tenant ID**
   - Also on the overview page, copy the "Directory (tenant) ID"
   - Example: `87654321-4321-4321-4321-210987654321`

3. **Save These Values**
   - You'll need both IDs to configure the frontend application

## Step 4: Add Production Redirect URIs (When Deploying)

When you deploy to production, you'll need to add production URLs:

1. Go to "Authentication" in your app registration
2. Under "Single-page application", click "+ Add URI"
3. Add your production URLs:
   - Example: `https://scanner.lonewolfgenetics.com`
   - Example: `https://app.lonewolfgenetics.com`
4. Click "Save"

## Step 5: Configure the Scanner App

1. **Open the auth configuration file**:
   ```
   src/js/modules/auth/authManager.js
   ```

2. **Replace the placeholder values**:
   ```javascript
   msalConfig: {
       auth: {
           clientId: 'YOUR_CLIENT_ID_HERE',  // Paste your Application (client) ID
           authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE',  // Paste your tenant ID
           redirectUri: window.location.origin
       },
       // ... rest of config
   }
   ```

3. **Example**:
   ```javascript
   msalConfig: {
       auth: {
           clientId: '12345678-1234-1234-1234-123456789012',
           authority: 'https://login.microsoftonline.com/87654321-4321-4321-4321-210987654321',
           redirectUri: window.location.origin
       },
       cache: {
           cacheLocation: 'sessionStorage',
           storeAuthStateInCookie: false
       }
   }
   ```

## Step 6: Test Authentication

1. **Start the backend server**:
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Start the frontend server** (in another terminal):
   ```bash
   python server.py
   ```

3. **Open the app**:
   - Navigate to http://localhost:8000
   - Click the "Sign In" button in the header
   - You should be redirected to Microsoft login
   - Sign in with your Microsoft 365 account
   - Approve the permissions if prompted
   - You should be redirected back to the app

## Troubleshooting

### Common Issues

1. **"AADSTS700016: Application not found"**
   - Double-check your Client ID is correct
   - Ensure the app registration exists in Azure AD

2. **"AADSTS50011: Reply URL mismatch"**
   - Verify the redirect URI in Azure AD matches your app URL exactly
   - For local development, use `http://localhost:8000`
   - Don't forget to add `http://` or `https://`

3. **"User consent required" or "Need admin approval"**
   - Go back to Azure AD > API Permissions
   - Click "Grant admin consent"
   - This is required for Mail.Send permission

4. **"Mail.Send permission denied"**
   - Verify admin consent was granted
   - Check that Mail.Send is listed in API permissions
   - User may need to sign out and sign in again

5. **MSAL Library Not Found**
   - Ensure `<script src="https://alcdn.msauth.net/browser/2.32.2/js/msal-browser.min.js"></script>` is in index.html
   - Check browser console for script loading errors

## Security Best Practices

1. **Never commit credentials to git**
   - Keep Client ID and Tenant ID in environment variables for production
   - Use a `.env` file (add to `.gitignore`)

2. **Restrict app permissions**
   - Only grant necessary permissions
   - Review permissions regularly

3. **Use specific redirect URIs**
   - Don't use wildcards
   - List specific URLs for production

4. **Monitor app usage**
   - Use Azure AD sign-in logs to monitor authentication
   - Set up alerts for suspicious activity

## API Permissions Summary

| Permission | Type | Purpose |
|------------|------|---------|
| User.Read | Delegated | Read user profile information |
| Mail.Send | Delegated | Send emails on behalf of signed-in user |

## Additional Resources

- [Microsoft Authentication Library (MSAL) Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Review Azure AD sign-in logs
3. Verify all configuration values are correct
4. Ensure backend server is running on port 3001
