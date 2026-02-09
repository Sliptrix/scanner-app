# 🚀 Scanner App Production Deployment Guide

This guide provides complete instructions for deploying the Lab Barcode Builder & Transfer System to production.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure AD Configuration](#azure-ad-configuration)
3. [Environment Configuration](#environment-configuration)
4. [HTTPS Setup](#https-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Cloud HQ Integration](#cloud-hq-integration)
8. [Pre-Flight Checklist](#pre-flight-checklist)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## 📦 Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| Python | 3.8+ | 3.11+ |
| RAM | 1 GB | 2 GB |
| Storage | 500 MB | 1 GB |

### Required Accounts & Access

- [ ] **Azure AD Admin Access** - To register and configure the application
- [ ] **Microsoft 365 Tenant** - For user authentication
- [ ] **SharePoint/OneDrive** - For cloud workbook sync (optional)
- [ ] **SSL Certificate** - For HTTPS (required for production)
- [ ] **Domain Name** - For production deployment

### Browser Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## 🔐 Azure AD Configuration

### Step 1: Register Application

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Click **+ New registration**
4. Configure:
   - **Name**: `LoneWolf Scanner App`
   - **Supported account types**: Single tenant (your organization only)
   - **Redirect URI**: Select `Single-page application (SPA)`
     - Development: `http://localhost:8000`
     - Production: `https://your-domain.com`

### Step 2: Configure API Permissions

Add these **delegated permissions** under Microsoft Graph:

| Permission | Type | Purpose |
|------------|------|---------|
| `User.Read` | Delegated | Read user profile |
| `Mail.Send` | Delegated | Send emails via Graph API |
| `Files.Read.All` | Delegated | Read SharePoint/OneDrive files (for cloud sync) |

> ⚠️ **Important**: Click **Grant admin consent** after adding permissions

### Step 3: Save Credentials

Copy these values from the app Overview page:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 4: Add Production Redirect URIs

In **Authentication** settings, add all production URLs:
```
https://scanner.yourdomain.com
https://app.yourdomain.com
```

---

## ⚙️ Environment Configuration

### Config File Setup

Create configuration files from templates:

```bash
# Copy templates
cp config/auth-config.template.js config/auth-config.js
cp config/cloud-hq-config.template.js config/cloud-hq-config.js
```

### auth-config.js

```javascript
window.MSAL_CONFIG = {
    clientId: 'YOUR_CLIENT_ID_HERE',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE',
    redirectUri: window.location.origin
};
```

### cloud-hq-config.js (Optional - for SharePoint sync)

```javascript
window.CLOUD_HQ_CONFIG = {
    shareUrl: 'YOUR_SHAREPOINT_WORKBOOK_URL',
    refreshIntervalMs: 300000,  // 5 minutes
    tables: {
        activeInventory: 'tblActiveInventory',
        strainMapping: 'tblStrainMapping',
        recipes: 'tblRecipes',
        batches: 'tblMediaBatches'
    },
    sync: {
        readOnlyMode: true,  // IMPORTANT: Keep true for safety
        autoSyncOnAuth: true
    }
};
```

### Backend Environment Variables

Create `backend/.env`:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Zebra Printer (optional)
ZEBRA_PRINTER_IP=192.168.1.100
ZEBRA_PRINTER_PORT=9100

# CORS Origins (comma-separated)
CORS_ORIGINS=https://scanner.yourdomain.com,https://app.yourdomain.com
```

---

## 🔒 HTTPS Setup

> ⚠️ **HTTPS is required for production**. Microsoft authentication will not work over plain HTTP in production.

### Option A: Nginx Reverse Proxy (Recommended)

```nginx
server {
    listen 443 ssl http2;
    server_name scanner.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/scanner.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scanner.yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/scanner-app;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name scanner.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Option B: Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d scanner.yourdomain.com

# Auto-renewal (add to crontab)
0 0 * * * certbot renew --quiet
```

### Option C: Azure App Service

If deploying to Azure App Service, HTTPS is included:
1. Enable **HTTPS Only** in TLS/SSL settings
2. Add custom domain and certificate if using custom domain

---

## 🖥️ Backend Deployment

### Install Dependencies

```bash
cd backend
npm ci --production
```

### Process Manager (PM2 Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start backend with PM2
pm2 start server.js --name scanner-backend

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### PM2 Ecosystem File (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'scanner-backend',
    script: 'server.js',
    cwd: '/var/www/scanner-app/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### Docker Deployment (Alternative)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

```bash
docker build -t scanner-backend ./backend
docker run -d -p 3001:3001 --name scanner-backend scanner-backend
```

---

## 🌐 Frontend Deployment

### Option A: Static File Hosting

Copy frontend files to web server:

```bash
# Files needed for production
/var/www/scanner-app/
├── index.html
├── config/
│   ├── auth-config.js
│   └── cloud-hq-config.js
├── src/
│   ├── js/
│   └── styles/
└── public/
    └── assets/
```

### Option B: Python Simple Server (Development Only)

```bash
python3 server.py
```

### Option C: Node.js Static Server

```bash
npx serve -s . -l 8000
```

### Build Verification

```bash
# Verify all required files exist
ls -la index.html
ls -la config/auth-config.js
ls -la src/js/main.js
ls -la src/js/modules/auth/authManager.js
```

---

## ☁️ Cloud HQ Integration

### SharePoint Workbook Setup

1. Create or identify the HQ Excel workbook in SharePoint
2. Ensure these sheets/tables exist:
   - `Active_Inventory` / `tblActiveInventory`
   - `Ref_Strains`, `Ref_Owners`, `Ref_Stages`, etc.
3. Get the sharing URL:
   - Open workbook in SharePoint
   - Click **Share** → **Copy link**
   - Use the full URL in config

### Required Table Structure

**tblActiveInventory columns:**
- Container_ID, Raw_ID, Batch_ID
- Strain_ID, Strain_Name, Owner
- Stage, Location, Media, Quantity
- DateCreated, Status, Notes

### Permissions Check

Users need at least **Read** access to the SharePoint workbook for sync to work.

---

## ✅ Pre-Flight Checklist

### Configuration
- [ ] `config/auth-config.js` created with correct Azure AD credentials
- [ ] `config/cloud-hq-config.js` created (if using cloud sync)
- [ ] `backend/.env` configured with correct values
- [ ] Azure AD redirect URIs include production URL

### Security
- [ ] HTTPS enabled and working
- [ ] SSL certificate valid and not expiring soon
- [ ] Config files excluded from git (check `.gitignore`)
- [ ] Admin consent granted in Azure AD
- [ ] `readOnlyMode: true` in cloud config

### Backend
- [ ] Node.js 18+ installed
- [ ] `npm ci` completed successfully
- [ ] Backend starts without errors
- [ ] Health endpoint responds: `curl https://your-domain.com/health`
- [ ] PM2 or process manager configured for auto-restart

### Frontend
- [ ] All static files accessible
- [ ] index.html loads without console errors
- [ ] Login button visible and clickable
- [ ] Authentication flow completes successfully

### Integration
- [ ] Email sending works (test with real email)
- [ ] QR code generation works
- [ ] Cloud sync connects (if configured)
- [ ] Inactivity timeout triggers after 30 minutes

### Browser Testing
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Safari (Mac)
- [ ] Tested in Edge

---

## 🔧 Troubleshooting

### Authentication Issues

**Error: "AADSTS700016: Application not found"**
- Verify Client ID is correct
- Ensure app exists in Azure AD

**Error: "AADSTS50011: Reply URL mismatch"**
- Add exact production URL to Azure AD redirect URIs
- Check for trailing slashes

**Error: "AADSTS65001: User consent required"**
- Grant admin consent in Azure AD portal
- User may need to sign out and back in

### Backend Issues

**Backend won't start**
```bash
# Check Node.js version
node --version  # Should be 18+

# Check for missing dependencies
cd backend && npm ci

# Check port availability
lsof -i :3001
```

**Email sending fails**
- Verify `Mail.Send` permission is granted
- Check access token is valid
- Verify recipient email is valid

### Frontend Issues

**Blank page after login**
```javascript
// Check browser console for errors
// Common causes:
// - Missing auth-config.js
// - Incorrect Client ID
// - CORS issues
```

**Cloud sync not working**
- Check SharePoint URL is correct
- Verify user has access to workbook
- Check `Files.Read.All` permission

### Network Issues

**CORS errors**
```bash
# Verify backend CORS configuration
# Add production domains to CORS_ORIGINS in .env
```

**Mixed content warnings**
- Ensure both frontend and backend use HTTPS
- Check for hardcoded HTTP URLs

---

## 🔄 Maintenance

### Regular Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| SSL Certificate Renewal | Monthly check | Auto-renew with certbot |
| Dependency Updates | Monthly | `npm audit` and update |
| Log Review | Weekly | Check for errors |
| Backup Verification | Weekly | Test restore procedures |
| Azure AD Review | Quarterly | Review permissions and users |

### Monitoring Endpoints

```bash
# Health check
curl https://your-domain.com/health

# Expected response
{"status":"ok","message":"Scanner backend is running"}
```

### Log Locations

```bash
# PM2 logs
pm2 logs scanner-backend

# Nginx logs
/var/log/nginx/access.log
/var/log/nginx/error.log
```

### Backup Procedures

```bash
# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz config/

# Backup is important before updates
git stash
git pull origin main
git stash pop
```

---

## 📚 Related Documentation

- [Azure AD Setup Guide](docs/AZURE_AD_SETUP.md)
- [Cloud HQ Integration](docs/CLOUD_HQ_INTEGRATION.md)
- [Email Feature Documentation](docs/EMAIL_AUTH_FEATURE.md)
- [Inactivity Timeout](docs/INACTIVITY_TIMEOUT.md)
- [Testing Guide](TESTING_GUIDE.md)

---

## 🆘 Support

For deployment issues:
1. Check browser console for JavaScript errors
2. Check backend logs: `pm2 logs scanner-backend`
3. Verify Azure AD configuration
4. Test health endpoint: `curl https://your-domain.com/health`
5. Review this troubleshooting guide

---

*Last Updated: February 2026*
