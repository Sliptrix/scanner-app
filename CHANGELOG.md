# Changelog - Scanner App Updates

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
