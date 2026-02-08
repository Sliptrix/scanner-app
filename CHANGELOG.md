# Changelog - Scanner App Updates

## Version 2.4 - Dashboard Analytics & Barcode Builder Enhancements (2026-02-07)

### 📊 Phase 5: Dashboard Analytics & Visualization

#### 1. Analytics Engine (`src/js/modules/dashboard/analyticsEngine.js`)
- **Container metrics**: Counts by status, stage, location, owner, strain
- **Transfer analytics**: Daily/weekly/monthly trends, tissues transferred/discarded
- **Recipe usage statistics**: Track which recipes are most used
- **Media batch overview**: Batch status counts, expiring batches warning
- **Lineage statistics**: Average depth, split ratios, orphan detection
- **Activity heatmap data**: Analyze busy days/times
- **Trend calculation**: Compare current vs previous period with % change
- **Date range presets**: Today, 7/30/90 days, this month, all time
- **Export functionality**: JSON and CSV export of analytics data
- **Cache management**: Smart caching with automatic invalidation

#### 2. Chart Renderer (`src/js/modules/dashboard/chartRenderer.js`)
- **Bar charts**: Horizontal/vertical with click-through to filtered views
- **Pie/Donut charts**: With legend and percentage display
- **Line charts**: With optional area fill and data points
- **Activity heatmap**: 7×24 grid showing busy periods
- **Stat cards**: With trend indicators (up/down/flat)
- **Sparklines**: Compact inline trends
- **Progress rings**: Circular progress indicators
- **No external dependencies**: Pure CSS/SVG implementation

#### 3. Enhanced Dashboard (`src/js/modules/dashboard/dashboardMain.js`)
- **Date range selector**: Filter all analytics by time period
- **Quick actions grid**: One-click access to common tasks
- **Enhanced stat cards**: Show trends vs previous period
- **Stage distribution chart**: Pie chart with click-to-filter
- **Transfer timeline**: Line chart showing activity trends
- **Media batch status**: Bar chart with expiring warnings
- **Activity heatmap**: Visual overview of busy times
- **Lineage statistics panel**: Depth, split ratio, orphan warnings
- **Click-through filtering**: Click any chart segment to filter inventory
- **Auto-refresh**: Dashboard updates every 30 seconds
- **Full analytics report**: Export complete analytics as report

### 🏷️ Phase 5: Barcode Builder Improvements

#### 4. Barcode Builder UI (`src/js/modules/barcode/barcodeBuilderUI.js`)
- **Batch generation**: Create multiple labels at once (single, range, or list)
- **Three generation modes**: Single, Batch, Reprint existing
- **Container input parsing**: Supports "100", "100-105", "100,101,102"
- **Duplicate detection**: Warns before creating duplicate container IDs
- **Format validation**: Validates input before generation
- **Label templates**: Standard, Small, Large, QR Only, Code128
- **Barcode formats**: QR Code and Code128 support
- **Live preview**: See label before printing
- **Print queue**: Queue multiple labels for batch printing
- **Print history**: Log of all printed labels with reprint capability
- **Modal interface**: Clean modal-based workflow
- **LocalStorage persistence**: Queue survives page refresh

### 🎨 New Styles (`src/styles/analytics.css`)
- **Chart containers**: Consistent styling for all chart types
- **Bar chart styles**: Animated fill, hover states, value labels
- **Pie chart styles**: Conic gradients, donut hole, legend
- **Heatmap styles**: Cell colors, day/hour labels
- **Stat card styles**: Icon, value, trend indicators
- **Date range selector**: Compact dropdown with refresh button
- **Quick actions**: Grid of action buttons
- **Barcode builder**: Modal, tabs, form elements, queue/history
- **Responsive design**: Mobile-friendly layouts

### 📁 New Files Added
- `src/js/modules/dashboard/analyticsEngine.js` - Analytics calculations
- `src/js/modules/dashboard/chartRenderer.js` - Chart visualizations
- `src/js/modules/barcode/barcodeBuilderUI.js` - Enhanced barcode builder
- `src/styles/analytics.css` - Analytics and builder styles
- `tests/phase5-analytics.test.js` - Phase 5 unit tests

### 📝 Modified Files
- `index.html` - Added new dashboard sections and script imports
- `src/js/modules/dashboard/dashboardMain.js` - Integrated analytics
- `tests/smoke-test.js` - Added Phase 5 file checks
- `package.json` - Added Phase 5 test script

### ✅ Tests
- **20 new tests** for analytics engine and barcode builder
- All existing tests continue to pass
- Smoke test updated to verify Phase 5 files

---

## Version 2.3 - Recipe & Media Tracking with Cloud HQ Integration (2026-02-07)

### ☁️ Phase 4: Cloud HQ Configuration & Recipe Enhancements

#### 1. Configurable Cloud HQ Connection
- **Removed hardcoded URL**: SharePoint workbook URL now configurable via `config/cloud-hq-config.js`
- **Configuration template**: `config/cloud-hq-config.template.js` provides full documentation
- **Table name mapping**: Configure Excel Table names for inventory, recipes, batches
- **Sheet name mapping**: Configure sheet names if workbook uses different naming
- **Column mapping**: Flexible column name matching for different workbook structures
- **Sync behavior options**: Configure read-only mode, auto-sync, retry settings

#### 2. Connection Status Indicator (UI)
- **Header indicator**: Visual status icon showing cloud connection state
- **States**: 🟢 Connected, 🔄 Syncing, 🔴 Error, 🟡 Ready, ⚪ Offline
- **Last sync timestamp**: Shows relative time since last successful sync
- **Click-to-sync**: Click indicator to trigger manual sync
- **Real-time updates**: Indicator updates automatically during sync operations

#### 3. Recipe Versioning System
- **Version tracking**: Every recipe modification creates a version entry
- **Version history**: Complete history of all changes to each recipe
- **Change detection**: Automatic calculation of what changed between versions
- **Version comparison**: Compare any two versions side-by-side
- **Revert capability**: Restore recipe to any previous version
- **Import/export**: Backup and restore version history data

#### 4. Recipe-Container Usage Tracking
- **Usage linking**: Track which containers used which recipes
- **Usage details**: Record batch ID, stage, strain, owner for each usage
- **Query by recipe**: Find all containers that used a specific recipe
- **Query by container**: Find which recipe a specific container used
- **Usage statistics**: Total containers, unique strains, usage by stage
- **Most used recipes**: Get recipes ranked by container usage count

#### 5. Enhanced Documentation
- **Cloud integration guide**: Comprehensive `docs/CLOUD_HQ_INTEGRATION.md`
- **Phase 4 documentation**: Detailed `docs/PHASE4_RECIPE_MEDIA_TRACKING.md`
- **Configuration examples**: Template files with inline documentation
- **API reference**: Complete method documentation for all modules

#### 6. Security Enhancements
- **Read-only by default**: All cloud write operations blocked
- **Config file protection**: Sensitive config files added to .gitignore
- **Audit-ready**: All operations logged for compliance

### 📁 New Files Added
- `config/cloud-hq-config.template.js` - Cloud configuration template
- `src/js/modules/recipe/recipeVersioning.js` - Recipe version tracking
- `docs/CLOUD_HQ_INTEGRATION.md` - Cloud integration documentation
- `docs/PHASE4_RECIPE_MEDIA_TRACKING.md` - Phase 4 documentation

### 📝 Files Modified
- `src/js/main.js` - Use configurable cloud settings
- `src/js/modules/cloud/oneDriveSync.js` - Add connection indicator updates
- `src/styles/dashboard.css` - Add connection indicator styles
- `index.html` - Add connection status indicator element
- `.gitignore` - Protect sensitive config files

---

## Version 2.2 - Data Tracking & Lineage Enhancements (2026-02-07)

### 🔗 Phase 3: Enhanced Lineage & Audit System

#### 1. LineageService - Comprehensive Relationship Tracking
- **Parent-Child Tracking**: Full relationship graph between containers
- **Generation Depth**: Track how many generations from original (G0, G1, G2, etc.)
- **Ancestor Retrieval**: Get full ancestor path from any container to root
- **Descendant Retrieval**: Find all containers derived from a source
- **Lineage Path**: Human-readable path string (e.g., "100 → 101 → 102")
- **Visual Tree Building**: Generate tree structures for UI rendering
- **Transfer Recording**: Automatically tracks splits and transfers

#### 2. AuditService - Complete Change History
- **Timestamps**: Every operation logged with ISO timestamp
- **User Attribution**: Tracks who performed each action
- **Event Types**: Create, Update, Transfer, Split, Discard, Delete, Location Change, etc.
- **Change Tracking**: Records what changed, previous values, and new values
- **Container Timeline**: Get chronological history for any container
- **Relative Time Display**: "2 hours ago", "Yesterday", etc.
- **Export Capabilities**: CSV and JSON export of audit logs

#### 3. LineageUI - Visual Components
- **Lineage Badges**: Click-to-view badges showing generation (G0, G1, G2+)
- **Enhanced Table Display**: Improved lineage column in inventory table
- **Lineage Modal**: Full-screen modal with tree view, timeline, and path
- **Timeline View**: Visual history of container events with icons
- **Lineage Filter**: Filter inventory by lineage (descendants, ancestors, siblings)
- **Click-Through Navigation**: Navigate from parent to child in modal

#### 4. LineageReports - Analytics & Export
- **Full Lineage Report**: Comprehensive JSON report with all data
- **Excel Export**: Multi-sheet workbook with lineage, stats, orphans, audit log
- **CSV Export**: Simple lineage data export
- **Orphan Detection**: Find containers with missing parent references
- **Isolated Node Detection**: Find containers with no lineage connections
- **Transfer Statistics**: Analysis of transfer patterns by hour, day, user
- **Validation Reports**: Check for circular references and inconsistencies
- **Lineage Repair**: Automatic fix for common lineage issues

#### 5. Integration Points
- **TransferProcessor**: Automatically records transfers in LineageService and AuditService
- **ContainerInitiator**: Logs container creation with full audit trail
- **InventoryTableManager**: Uses enhanced lineage badges and filters
- **Reference Data Section**: New Lineage & Audit Tracking panel

### 📁 New Files Added
- `src/js/modules/lineage/lineageService.js` - Core lineage tracking
- `src/js/modules/lineage/auditService.js` - Audit trail system
- `src/js/modules/lineage/lineageUI.js` - UI components
- `src/js/modules/lineage/lineageReports.js` - Reports & analytics
- `tests/lineage-tracking.test.js` - Comprehensive test suite

### 🔧 Files Modified
- `index.html` - Added lineage module scripts, Lineage Reports panel
- `src/js/main.js` - Initialize LineageService, AuditService, LineageUI
- `src/js/modules/transfer/transferProcessor.js` - Integrate with lineage/audit
- `src/js/modules/inventory/tableManager.js` - Use enhanced lineage display
- `src/js/modules/initiator/containerInitiator.js` - Log container creation

### 📊 Technical Details

#### Lineage Data Structure
```javascript
{
  nodes: {
    "containerId": {
      id: "containerId",
      parent: "parentId" | null,
      children: ["childId1", "childId2"],
      generation: 0,
      createdAt: "ISO timestamp",
      strain: "strain name",
      owner: "owner code",
      status: "Active" | "Consumed" | "Discarded"
    }
  }
}
```

#### Audit Event Structure
```javascript
{
  id: "evt_xxx",
  type: "CONTAINER_CREATED",
  timestamp: "ISO timestamp",
  user: { id, name, email },
  containerId: "containerId",
  relatedContainers: [],
  changes: { field: { from, to } },
  message: "Human readable description"
}
```

### 🧪 Test Coverage
- LineageService: Node creation, ancestors, descendants, transfers, validation
- AuditService: Event logging, history retrieval, timeline, export
- LineageUI: Badge creation, modal functionality
- LineageReports: Report generation, orphan detection
- Integration: Inventory and transfer integration

---

## Version 2.0 - Security & Authentication Enhancement (2024-01-13)

### 🔐 Major Features Added

#### 1. Authentication Required Access
- **Login Page**: Users must sign in with Microsoft 365 before accessing any app features
- **Beautiful UI**: Professional login screen with gradient purple background
- **Single Sign-On**: Integrated with Azure AD (LWG-inventory_tracker app)
- **Secure Access**: No app functionality accessible without authentication

#### 2. Automatic Email Notifications
- **Auto-Send**: Intake forms automatically emailed to pozersky@lonewolfgenetics.com after submission
- **Microsoft Graph API**: Emails sent via user's Microsoft 365 account
- **PDF Attachment**: Complete intake form included as PDF attachment
- **Progress Notifications**: Users see "Sending email..." and success/error messages
- **Graceful Fallback**: Manual email button still available if auto-send fails

#### 3. Inactivity Timeout
- **Auto Sign-Out**: Users automatically signed out after 30 minutes of inactivity
- **Activity Detection**: Monitors mouse, keyboard, scroll, and touch events
- **Timer Reset**: Any user activity resets the 30-minute timer
- **Warning Notification**: Users notified when signed out due to inactivity
- **Configurable**: Timeout duration can be changed via console or code
- **Resource Efficient**: Single timeout timer, event listeners cleaned up on sign out

#### 4. Session Persistence
- **Mode Restoration**: Returns user to last active section after inactivity timeout
- **Default Mode**: First login opens to Intake section
- **Smart Routing**: SessionStorage tracks last active mode

#### 5. Enhanced User Display
- **Prominent Badge**: User info displayed in top-right with styled purple badge
- **Name & Email**: Shows both user's name and email address
- **Visual Design**: Purple theme with user icon, rounded border
- **Compact Layout**: Sized to avoid overlap with app title
- **Always Visible**: Displayed on all pages when authenticated

### 📝 Technical Details

#### Authentication Flow
1. User lands on login page (no app access)
2. Clicks "Sign In with Microsoft 365"
3. Redirected to Microsoft login
4. Azure AD authenticates user
5. User redirected back to app
6. App content becomes accessible
7. Inactivity timer begins

#### Auto-Email Flow
1. User fills out intake form
2. Clicks "Submit Intake"
3. Form validated and saved
4. If signed in: Auto-generate PDF
5. Get Microsoft Graph access token
6. Send email to pozersky@lonewolfgenetics.com
7. Show success notification
8. Email appears with PDF attachment

#### Inactivity Timeout
- **Default Duration**: 30 minutes (1800000 ms)
- **Monitored Events**: mousedown, mousemove, keypress, scroll, touchstart, click
- **Timer Behavior**: Single setTimeout that resets on activity
- **Storage**: Session-based (cleared on browser close)
- **Cleanup**: Event listeners removed on sign out

### 🔧 Configuration

#### Change Inactivity Timeout

**Via Console (Temporary)**:
```javascript
// Set to 15 minutes
AuthManager.setInactivityTimeout(15);

// Set to 1 hour
AuthManager.setInactivityTimeout(60);
```

**In Code (Permanent)**:
Edit `src/js/modules/auth/authManager.js` line 10:
```javascript
inactivityTimeout: 30 * 60 * 1000, // Change 30 to desired minutes
```

#### Change Default Email Recipient

Edit `src/js/modules/intake/intakeMain.js` line 58:
```javascript
const recipients = ['pozersky@lonewolfgenetics.com']; // Add/change emails
```

#### Change Default Mode

Edit `src/js/main.js` line 35:
```javascript
UIUtils.switchMode('intake'); // Change to: 'builder', 'transfer', 'initiator'
```

### 📂 Files Modified

#### New Files
- `backend/` - Node.js email server
- `backend/server.js` - Express API for email sending
- `backend/package.json` - Backend dependencies
- `backend/.gitignore` - Backend ignore rules
- `src/js/modules/auth/authManager.js` - Authentication manager
- `src/js/modules/email/emailService.js` - Email service
- `docs/AZURE_AD_SETUP.md` - Azure configuration guide
- `docs/EMAIL_AUTH_FEATURE.md` - Email feature documentation
- `docs/INACTIVITY_TIMEOUT.md` - Timeout feature documentation
- `NEXT_STEPS.md` - Implementation guide
- `TESTING_GUIDE.md` - Testing instructions
- `CHANGELOG.md` - This file
- `start-servers.sh` - Convenience startup script

#### Modified Files
- `index.html` - Added login page, user info display, email section
- `src/js/main.js` - Added auth initialization, email function, default mode
- `src/js/modules/intake/intakeMain.js` - Added auto-email on submission
- `src/js/modules/intake/pdfGenerator.js` - Added base64 PDF generation, fixed jsPDF check
- `src/js/modules/auth/authManager.js` - Complete authentication system

### 🔒 Security Enhancements

1. **Mandatory Authentication**: All features require sign-in
2. **OAuth 2.0**: Industry-standard authentication protocol
3. **Azure AD Integration**: Enterprise-grade identity management
4. **Session Management**: Automatic timeout prevents unauthorized access
5. **Token Storage**: Secure session storage (cleared on browser close)
6. **Activity Monitoring**: Detects user presence
7. **No Credentials Stored**: All authentication via Microsoft

### 🎨 User Experience Improvements

1. **Professional Login**: Beautiful gradient login screen
2. **User Identification**: Always shows who is logged in
3. **Automatic Actions**: Forms auto-email without extra clicks
4. **Smart Routing**: Returns to last section after timeout
5. **Clear Feedback**: Notifications for all actions
6. **Responsive Design**: Works on desktop and mobile
7. **Intuitive Flow**: Minimal clicks required

### 🐛 Bug Fixes

- **PDF Generation Error**: Fixed jsPDF initialization check (changed from `typeof jsPDF` to `typeof window.jspdf`)
- **Default Mode**: Changed from Builder to Intake for better workflow

### 📊 Default Settings

| Setting | Value | Configurable |
|---------|-------|--------------|
| Inactivity Timeout | 30 minutes | Yes (console or code) |
| Email Recipient | pozersky@lonewolfgenetics.com | Yes (code) |
| Default Mode | Intake | Yes (code) |
| Auto-Email | Enabled | No (always on when signed in) |
| Session Storage | Browser session | No |

### 🚀 Deployment Notes

#### Azure AD Requirements
- App registered as "LWG-inventory_tracker"
- Redirect URI: `http://localhost:8000` (dev) + production URLs
- API Permissions: User.Read, Mail.Send
- Admin consent granted

#### Backend Requirements
- Node.js installed
- npm packages: express, cors, @microsoft/microsoft-graph-client, multer, isomorphic-fetch
- Backend server running on port 3001

#### Frontend Requirements
- Python HTTP server or equivalent on port 8000
- MSAL.js library (loaded from CDN)
- jsPDF library (loaded from CDN)

### 📖 Documentation

- **Azure Setup**: See `docs/AZURE_AD_SETUP.md`
- **Email Feature**: See `docs/EMAIL_AUTH_FEATURE.md`
- **Inactivity Timeout**: See `docs/INACTIVITY_TIMEOUT.md`
- **Testing Guide**: See `TESTING_GUIDE.md`
- **Implementation Steps**: See `NEXT_STEPS.md`

### 🔄 Migration Notes

**For Existing Users**:
- First time: Will be prompted to sign in
- Must approve Mail.Send permission
- Previous inventory data preserved
- No data loss or migration needed

**For Administrators**:
- Azure AD app already configured
- Backend server must be started
- Update production redirect URIs when deploying

### 🎯 Future Enhancements

Planned improvements:
1. **Timeout Warning**: 5-minute warning before auto sign-out
2. **User Roles**: Different permissions for different users
3. **Email History**: Track sent emails in app
4. **Customizable Templates**: User-configurable email templates
5. **Recipient Management**: Save frequently used recipients
6. **Activity Logging**: Track user actions and sign-in events
7. **Mobile App**: Native mobile applications

### 🤝 Support

For issues or questions:
1. Check browser console for errors
2. Verify backend server is running (`curl http://localhost:3001/health`)
3. Check Azure AD configuration
4. Review documentation in `/docs`
5. Test with different timeout settings

### 📈 Version History

- **v2.0** (2024-01-13): Authentication, auto-email, inactivity timeout, session persistence
- **v1.0** (Previous): Base scanner app with barcode builder, transfer, inventory

---

## Breaking Changes

⚠️ **Authentication Required**: Users can no longer access the app without signing in. Ensure all team members have Microsoft 365 accounts with access to the Azure AD app.

## Tested On

- ✅ macOS (Chrome, Safari, Firefox)
- ✅ Windows (Chrome, Edge)
- ✅ Microsoft 365 Authentication
- ✅ Email sending via Microsoft Graph API
- ✅ Inactivity timeout (1 min, 5 min, 30 min tested)
- ✅ Mode persistence after timeout
- ✅ PDF generation and download

## Contributors

- Authentication & Email System
- Inactivity Timeout Feature
- UI/UX Improvements
- Documentation
