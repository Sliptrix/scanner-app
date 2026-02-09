# Configuration Files Reference

This document describes all configuration files in the Scanner App and their purposes.

---

## 📁 Configuration Directory Structure

```
scanner-app/
├── config/                          # Frontend configuration
│   ├── auth-config.template.js      # Azure AD template (committed)
│   ├── auth-config.js               # Azure AD config (gitignored)
│   ├── cloud-hq-config.template.js  # Cloud sync template (committed)
│   └── cloud-hq-config.js           # Cloud sync config (gitignored)
│
├── backend/
│   ├── .env                         # Backend environment (gitignored)
│   └── .gitignore                   # Backend ignore patterns
│
├── .gitignore                       # Root ignore patterns
└── package.json                     # Node.js configuration
```

---

## 🔐 auth-config.js

**Purpose:** Microsoft Azure AD authentication configuration.

**Location:** `config/auth-config.js` (create from template)

**Template:** `config/auth-config.template.js`

### Contents

```javascript
window.MSAL_CONFIG = {
    // Azure AD Application (client) ID
    // From: Azure Portal > App registrations > [Your App] > Overview
    clientId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    
    // Azure AD Authority URL (includes tenant ID)
    // Single-tenant: https://login.microsoftonline.com/{tenant-id}
    // Multi-tenant: https://login.microsoftonline.com/common
    authority: 'https://login.microsoftonline.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    
    // Redirect URI after authentication
    // Must match Azure AD app registration
    redirectUri: window.location.origin
};

// Optional: OneDrive/SharePoint sync basics (deprecated - use cloud-hq-config.js)
window.CLOUD_SYNC_CONFIG = {
    shareUrl: 'YOUR_SHAREPOINT_WORKBOOK_SHARE_URL_HERE',
    refreshIntervalMs: 300000
};
```

### Required Values

| Field | Source | Required |
|-------|--------|----------|
| `clientId` | Azure Portal > App registrations > Overview | Yes |
| `authority` | Azure Portal > App registrations > Overview (Directory ID) | Yes |
| `redirectUri` | Usually `window.location.origin` | Yes |

### Security Notes

- ⚠️ **Never commit this file** - Contains Azure AD credentials
- ✅ Add to `.gitignore`
- 🔒 Store real values in secure password manager

---

## ☁️ cloud-hq-config.js

**Purpose:** SharePoint/OneDrive workbook synchronization configuration.

**Location:** `config/cloud-hq-config.js` (create from template)

**Template:** `config/cloud-hq-config.template.js`

### Contents

```javascript
window.CLOUD_HQ_CONFIG = {
    // SharePoint sharing URL for the HQ Excel workbook
    shareUrl: 'https://company.sharepoint.com/...',
    
    // Auto-refresh interval (milliseconds)
    refreshIntervalMs: 300000,  // 5 minutes
    
    // Excel Table names in workbook
    tables: {
        activeInventory: 'tblActiveInventory',
        strainMapping: 'tblStrainMapping',
        recipes: 'tblRecipes',
        batches: 'tblMediaBatches'
    },
    
    // Sheet name mappings
    sheets: {
        activeInventory: 'Active_Inventory',
        refStrains: 'Ref_Strains',
        refOwners: 'Ref_Owners',
        refStages: 'Ref_Stages',
        refLocations: 'Ref_Locations',
        refMediaTypes: 'Ref_Media_Types'
    },
    
    // Column name mappings (for flexible column matching)
    columns: {
        activeInventory: {
            containerId: ['Container_ID', 'ContainerID'],
            strainName: ['Strain_Name', 'Strain'],
            // ... more mappings
        }
    },
    
    // Sync behavior
    sync: {
        readOnlyMode: true,       // IMPORTANT: Keep true!
        allowFullOverwrite: false,
        autoSyncOnAuth: true,
        maxRetries: 3,
        retryDelayMs: 5000
    },
    
    // UI element IDs
    ui: {
        statusElementId: 'cloud-sync-status',
        buttonElementId: 'cloud-sync-btn'
    }
};
```

### Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `readOnlyMode` | `true` | **Keep true** - Prevents accidental writes |
| `refreshIntervalMs` | `300000` | Sync every 5 minutes (0 = disable) |
| `autoSyncOnAuth` | `true` | Sync automatically after login |
| `maxRetries` | `3` | Retry count for failed syncs |

### How to Get SharePoint URL

1. Open Excel workbook in SharePoint/OneDrive
2. Click **Share** button
3. Select **Copy link** > "People with existing access"
4. Paste the full URL into `shareUrl`

### Security Notes

- ⚠️ **Never commit this file** - Contains SharePoint URLs
- ✅ Add to `.gitignore`
- 🔒 Keep `readOnlyMode: true` to prevent data loss

---

## 🖥️ backend/.env

**Purpose:** Backend server environment variables.

**Location:** `backend/.env` (create manually)

### Contents

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Zebra Label Printer (optional)
ZEBRA_PRINTER_IP=192.168.1.100
ZEBRA_PRINTER_PORT=9100

# CORS Origins (comma-separated, for production)
CORS_ORIGINS=https://scanner.example.com,https://app.example.com

# QR Code API (if using external service)
QR_API_KEY=your-api-key-here
```

### Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment (`development` or `production`) |
| `ZEBRA_PRINTER_IP` | - | Network IP of Zebra printer |
| `ZEBRA_PRINTER_PORT` | `9100` | Zebra printer port (usually 9100) |
| `CORS_ORIGINS` | - | Allowed CORS origins (comma-separated) |

### Security Notes

- ⚠️ **Never commit this file**
- ✅ Listed in `backend/.gitignore`
- 🔒 Contains printer network info and API keys

---

## 📦 package.json

**Purpose:** Node.js project configuration for frontend.

**Location:** `package.json` (committed)

### Key Sections

```json
{
  "name": "lab-scanner-system",
  "version": "1.0.0",
  "scripts": {
    "start": "python3 -m http.server 8000 --directory public",
    "test": "npm run test:unit && npm run test:phase5 && npm run test:smoke",
    "test:smoke": "node tests/smoke-test.js"
  },
  "dependencies": {
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "http-server": "^14.1.1",
    "jsdom": "^26.1.0"
  }
}
```

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `npm start` | Start development server |
| `test` | `npm test` | Run all tests |
| `test:smoke` | `npm run test:smoke` | Run smoke tests only |

---

## 📦 backend/package.json

**Purpose:** Node.js project configuration for backend.

**Location:** `backend/package.json` (committed)

### Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web server framework |
| `cors` | Cross-origin resource sharing |
| `multer` | File upload handling |
| `@microsoft/microsoft-graph-client` | Microsoft Graph API client |
| `qrcode` | QR code generation |
| `isomorphic-fetch` | Fetch API polyfill |

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `npm start` | Start backend server |
| `dev` | `npm run dev` | Start with nodemon (auto-restart) |

---

## 🚫 .gitignore

**Purpose:** Specifies files to exclude from version control.

### Key Patterns

```gitignore
# Dependencies
node_modules/
backend/node_modules/

# Environment files
.env
backend/.env

# Configuration (SECURITY)
config/auth-config.js
config/cloud-hq-config.js

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Python
venv/
__pycache__/
*.pyc
```

### What's Protected

| Pattern | Reason |
|---------|--------|
| `config/auth-config.js` | Contains Azure AD credentials |
| `config/cloud-hq-config.js` | Contains SharePoint URLs |
| `.env` | Contains environment variables |
| `node_modules/` | Generated, not needed in repo |

---

## 🔧 Configuration Setup Workflow

### Initial Setup (Development)

```bash
# 1. Clone repository
git clone <repo-url>
cd scanner-app

# 2. Create config files from templates
cp config/auth-config.template.js config/auth-config.js
cp config/cloud-hq-config.template.js config/cloud-hq-config.js

# 3. Edit configs with your values
code config/auth-config.js
code config/cloud-hq-config.js

# 4. Create backend .env
cat > backend/.env << EOF
PORT=3001
NODE_ENV=development
EOF

# 5. Install dependencies
npm install
cd backend && npm install && cd ..

# 6. Start servers
./start-servers.sh
```

### Production Setup

```bash
# 1. On production server, create configs with production values
# Use the same steps but with production URLs and IDs

# 2. Verify files are NOT in git
git status  # Should not show config files

# 3. Set production environment
echo "NODE_ENV=production" >> backend/.env
```

---

## ❓ FAQ

### Q: Why are config files gitignored?
**A:** They contain sensitive information (Azure AD credentials, SharePoint URLs, API keys). Each environment should have its own config files.

### Q: How do I share config with team members?
**A:** Share values through a secure channel (password manager, encrypted file, secure messaging). Never commit to git.

### Q: Can I use environment variables instead?
**A:** The backend uses `.env` for environment variables. The frontend uses JavaScript config files because it runs in the browser and can't access server environment variables.

### Q: What if I accidentally committed a config file?
**A:**
1. Remove from git: `git rm --cached config/auth-config.js`
2. Add to `.gitignore`
3. Rotate/regenerate any exposed credentials in Azure AD
4. Force push if necessary

---

*Last Updated: February 2026*
