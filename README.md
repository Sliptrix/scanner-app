# Lab Barcode Builder & Transfer System

A comprehensive laboratory management system for barcode generation, container transfers, recipe management, and tissue culture operations with Microsoft 365 authentication and ML-enhanced recommendations.

## 🚀 Current Status: Production Ready

**Version:** 2.4  
**Branch:** feature/production-enhancements-2026-02

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **🔐 Microsoft 365 SSO** | Secure Azure AD authentication with auto-logout |
| **🏷️ Barcode Generation** | Code128 and QR code generation with batch printing |
| **📦 Container Management** | Track containers with detailed lineage information |
| **🔄 Transfer System** | Container-to-container transfers with tissue splitting |
| **📊 Recipe Management** | Create and manage tissue culture media recipes |
| **📈 Dashboard Analytics** | Visual insights with charts and activity heatmaps |
| **☁️ Cloud Sync** | SharePoint/OneDrive workbook integration |
| **📧 Email Automation** | Automatic intake form emailing with PDF attachments |
| **🖨️ Zebra Printing** | Direct ZPL printing to network Zebra printers |

---

## 📋 Prerequisites

| Requirement | Minimum Version |
|-------------|-----------------|
| Node.js | 18.x |
| Python | 3.8+ |
| Browser | Chrome 90+, Firefox 88+, Safari 14+ |

**Required Accounts:**
- Microsoft 365 / Azure AD tenant
- Azure AD admin access (for app registration)

---

## 🚀 Quick Start

### Development Setup

```bash
# Clone repository
git clone <repo-url>
cd scanner-app

# Install dependencies
npm install
cd backend && npm install && cd ..

# Copy configuration templates
cp config/auth-config.template.js config/auth-config.js
cp config/cloud-hq-config.template.js config/cloud-hq-config.js

# Edit config files with your Azure AD credentials
# See docs/AZURE_AD_SETUP.md for details

# Start both servers
./start-servers.sh
```

Open http://localhost:8000 in your browser.

### Alternative Start Methods

```bash
# Frontend only (Python)
python3 server.py

# Frontend only (Node)
npm start

# Backend only
cd backend && npm start
```

---

## 📁 Project Structure

```
scanner-app/
├── index.html                    # Main application
├── server.py                     # Python dev server
├── start-servers.sh              # Combined server startup
├── package.json                  # Frontend dependencies
│
├── config/                       # Configuration files
│   ├── auth-config.template.js   # Azure AD config template
│   └── cloud-hq-config.template.js # Cloud sync config template
│
├── backend/                      # Node.js backend
│   ├── server.js                 # Express API server
│   └── package.json              # Backend dependencies
│
├── src/
│   ├── js/
│   │   ├── main.js              # Application entry point
│   │   ├── modules/
│   │   │   ├── auth/            # Authentication (MSAL)
│   │   │   ├── barcode/         # Barcode generation
│   │   │   ├── cloud/           # OneDrive/SharePoint sync
│   │   │   ├── dashboard/       # Analytics & charts
│   │   │   ├── email/           # Email service
│   │   │   ├── intake/          # Intake form handling
│   │   │   ├── inventory/       # Inventory management
│   │   │   ├── lineage/         # Container lineage tracking
│   │   │   ├── recipe/          # Recipe management
│   │   │   └── transfer/        # Container transfers
│   │   └── utils/               # Utility functions
│   └── styles/                  # CSS stylesheets
│
├── tests/                       # Test suites
│   ├── smoke-test.js            # Basic functionality tests
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
│
└── docs/                        # Documentation
    ├── AZURE_AD_SETUP.md        # Azure configuration
    ├── CLOUD_HQ_INTEGRATION.md  # SharePoint sync guide
    └── ...
```

---

## ⚙️ Configuration

### Azure AD Authentication

1. Register app in Azure Portal (see [docs/AZURE_AD_SETUP.md](docs/AZURE_AD_SETUP.md))
2. Create `config/auth-config.js`:

```javascript
window.MSAL_CONFIG = {
    clientId: 'your-client-id',
    authority: 'https://login.microsoftonline.com/your-tenant-id',
    redirectUri: window.location.origin
};
```

### Cloud Sync (Optional)

Create `config/cloud-hq-config.js` for SharePoint workbook integration:

```javascript
window.CLOUD_HQ_CONFIG = {
    shareUrl: 'your-sharepoint-workbook-url',
    sync: { readOnlyMode: true }
};
```

### Environment Variables

Create `backend/.env`:

```bash
PORT=3001
NODE_ENV=production
ZEBRA_PRINTER_IP=192.168.1.100    # Optional
ZEBRA_PRINTER_PORT=9100           # Optional
```

---

## 🔒 Security Features

- **Mandatory Authentication**: All features require Microsoft 365 sign-in
- **OAuth 2.0**: Industry-standard authentication via Azure AD
- **Session Management**: 30-minute inactivity auto-logout
- **Read-Only Cloud Sync**: Blocks accidental writes to production workbooks
- **No Credential Storage**: All authentication via Microsoft

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:smoke          # Basic functionality
npm run test:unit           # Unit tests
npm run test:phase5         # Analytics tests
```

### Manual Testing

1. Start servers: `./start-servers.sh`
2. Open http://localhost:8000
3. Sign in with Microsoft 365
4. Test barcode generation, transfers, and exports

---

## 🚀 Production Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete deployment instructions.

### Quick Deployment Checklist

1. Configure Azure AD app for production domain
2. Set up HTTPS (required for auth)
3. Create production config files
4. Deploy backend with PM2
5. Deploy frontend to web server
6. Complete [PRE_FLIGHT_CHECKLIST.md](PRE_FLIGHT_CHECKLIST.md)

```bash
# Backend (PM2)
cd backend
pm2 start server.js --name scanner-backend

# Verify
curl https://your-domain.com/health
```

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/email/send` | POST | Send email with PDF attachment |
| `/api/qrcodes` | POST | Generate QR code |
| `/api/qrcodes/:code` | GET | Lookup QR code |
| `/api/print/zpl` | POST | Print to Zebra printer |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide |
| [PRE_FLIGHT_CHECKLIST.md](PRE_FLIGHT_CHECKLIST.md) | Go-live checklist |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Testing instructions |
| [docs/AZURE_AD_SETUP.md](docs/AZURE_AD_SETUP.md) | Azure AD configuration |
| [docs/CLOUD_HQ_INTEGRATION.md](docs/CLOUD_HQ_INTEGRATION.md) | SharePoint sync setup |
| [docs/EMAIL_AUTH_FEATURE.md](docs/EMAIL_AUTH_FEATURE.md) | Email feature details |

---

## 🔄 Recent Updates

### v2.4 (February 2026)
- Dashboard analytics with interactive charts
- Enhanced barcode builder with batch generation
- Activity heatmaps and trend analysis
- Recipe versioning system
- Cloud connection status indicator

### v2.3 (February 2026)
- Configurable Cloud HQ connection
- Recipe-container usage tracking
- Enhanced security with read-only mode

### v2.2 (February 2026)
- Comprehensive lineage tracking
- Audit trail system
- Transfer history and reports

See [CHANGELOG.md](CHANGELOG.md) for complete history.

---

## 🆘 Troubleshooting

### Authentication Issues
- Verify Azure AD Client ID and Tenant ID
- Check redirect URI matches exactly
- Ensure admin consent granted

### Backend Not Starting
```bash
# Check Node version (need 18+)
node --version

# Check for port conflicts
lsof -i :3001

# Check dependencies
cd backend && npm ci
```

### Cloud Sync Issues
- Verify SharePoint URL is accessible
- Check user has read access to workbook
- Ensure Files.Read.All permission granted

---

## 📞 Support

1. Check browser console for errors
2. Verify backend health: `curl http://localhost:3001/health`
3. Review [Troubleshooting](#-troubleshooting) section
4. Check [docs/](docs/) for feature-specific guides

---

## 📄 License

MIT License

---

*Last Updated: February 2026*
