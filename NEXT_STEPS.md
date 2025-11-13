# Next Steps for Email & Authentication Implementation

## What's Been Created

✅ **Backend Server** (`backend/server.js`)
- Express server with Microsoft Graph API integration
- Email sending endpoint
- Email validation endpoint
- Default recipients endpoint

✅ **Frontend Authentication** (`src/js/modules/auth/authManager.js`)
- MSAL.js integration for Microsoft 365 login
- Token management
- UI state updates

✅ **Email Service** (`src/js/modules/email/emailService.js`)
- PDF generation for email attachments
- Professional HTML email templates
- Email validation

✅ **Documentation**
- Azure AD setup guide (`docs/AZURE_AD_SETUP.md`)
- Feature documentation (`docs/EMAIL_AUTH_FEATURE.md`)

## What You Need To Do

### 1. Install Backend Dependencies (5 minutes)

```bash
cd /Users/pozersky/Projects/Scanner/backend
npm install
```

This will install:
- express
- cors
- @microsoft/microsoft-graph-client
- multer
- isomorphic-fetch

### 2. Register App in Azure AD (10-15 minutes)

Follow the guide in `docs/AZURE_AD_SETUP.md`:

1. Go to https://portal.azure.com
2. Navigate to Azure Active Directory → App registrations
3. Create new registration:
   - Name: "LoneWolf Scanner App"
   - Account type: Single tenant
   - Redirect URI: `http://localhost:8000` (SPA type)
4. Add API permissions:
   - Microsoft Graph → Delegated → User.Read
   - Microsoft Graph → Delegated → Mail.Send
5. Grant admin consent
6. Copy Client ID and Tenant ID

### 3. Configure the App (2 minutes)

Edit `src/js/modules/auth/authManager.js` (lines 12-14):

Replace:
```javascript
clientId: 'YOUR_CLIENT_ID_HERE',
authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE',
```

With your actual IDs from Azure:
```javascript
clientId: '12345678-1234-1234-1234-123456789012',  // Your Client ID
authority: 'https://login.microsoftonline.com/87654321-4321-4321-4321-210987654321',  // Your Tenant ID
```

### 4. Update index.html (10 minutes)

You need to add:

#### A. MSAL Library (in `<head>` section, after jsPDF)
```html
<!-- Microsoft Authentication Library -->
<script src="https://alcdn.msauth.net/browser/2.32.2/js/msal-browser.min.js"></script>
```

#### B. Authentication UI (in header, after the h1)
```html
<div class="auth-controls" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 10px;">
    <div id="userInfo" style="display: none; color: #2c3e50; font-size: 0.9rem;">
        👤 <span id="userEmail"></span>
    </div>
    <button id="loginBtn" class="btn btn-primary btn-sm" onclick="signIn()" style="padding: 8px 16px;">
        🔐 Sign In
    </button>
    <button id="logoutBtn" class="btn btn-secondary btn-sm" onclick="signOut()" style="display: none; padding: 8px 16px;">
        Sign Out
    </button>
</div>
```

#### C. Email Section in Intake Summary (find the intakeSummary div, add before the download buttons)
```html
<!-- Email Section (only visible when signed in) -->
<div id="intakeEmailSection" style="display: none; margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
    <h4 style="margin: 0 0 10px 0; color: #1976d2;">📧 Email This Form</h4>
    <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Recipients:</label>
        <input type="text" id="emailRecipients" class="form-input" placeholder="pozersky@lonewolfgenetics.com" value="pozersky@lonewolfgenetics.com" style="width: 100%; padding: 8px;">
        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #6c757d;">Separate multiple emails with commas</p>
    </div>
    <button class="btn btn-primary" onclick="emailIntakeForm()">
        📧 Send Email
    </button>
</div>
```

#### D. Load New JavaScript Modules (before main.js)
```html
<!-- Authentication Module -->
<script src="src/js/modules/auth/authManager.js"></script>
<!-- Email Service Module -->
<script src="src/js/modules/email/emailService.js"></script>
```

### 5. Update main.js (5 minutes)

Add to the `initializeApp()` function (around line 70, after IntakeMain init):

```javascript
// Initialize authentication
if (window.AuthManager) {
    AuthManager.init().catch(error => {
        console.error('Error initializing auth:', error);
    });
}
```

Add this global function at the end of main.js:

```javascript
/**
 * Email intake form
 */
async function emailIntakeForm() {
    const formData = IntakeFormManager.currentIntakeData;
    if (!formData) {
        NotificationSystem.error('No intake data to email');
        return;
    }
    
    if (!AuthManager.isSignedIn()) {
        NotificationSystem.error('Please sign in to send emails');
        return;
    }
    
    const recipientsInput = document.getElementById('emailRecipients');
    const recipientsText = recipientsInput ? recipientsInput.value : 'pozersky@lonewolfgenetics.com';
    const recipients = recipientsText.split(',').map(e => e.trim()).filter(e => e);
    
    if (recipients.length === 0) {
        NotificationSystem.error('Please enter at least one email address');
        return;
    }
    
    try {
        NotificationSystem.info('Sending email...');
        
        const result = await EmailService.sendIntakeForm(formData, recipients);
        
        NotificationSystem.success(`Email sent successfully to ${result.recipientCount} recipient(s)!`);
    } catch (error) {
        console.error('Error sending email:', error);
        NotificationSystem.error('Failed to send email: ' + error.message);
    }
}

// Expose to window
window.emailIntakeForm = emailIntakeForm;
```

### 6. Test the Implementation (10 minutes)

#### Start Backend:
```bash
cd backend
npm start
```
You should see: "🚀 Scanner Backend running on http://localhost:3001"

#### Start Frontend (in another terminal):
```bash
cd /Users/pozersky/Projects/Scanner
python server.py
```

#### Test in Browser:
1. Open http://localhost:8000
2. Click "Sign In" - should redirect to Microsoft login
3. Sign in with your Microsoft 365 account
4. You should be redirected back and see your email in header
5. Go to Intake mode
6. Fill out and submit a form
7. Click "Email PDF"
8. Verify email is received

## Troubleshooting

### Backend won't start
```bash
cd backend
rm -rf node_modules
npm install
npm start
```

### "MSAL is not defined" error
- Check that MSAL script tag is in index.html
- Verify it loads before auth/authManager.js
- Check browser console for script loading errors

### "Failed to send email" error
- Ensure backend is running on port 3001
- Check backend console for error details
- Verify Mail.Send permission is granted in Azure AD
- Try signing out and back in

### Authentication redirect issues
- Verify redirect URI in Azure AD matches exactly: `http://localhost:8000`
- Check that Client ID and Tenant ID are correct
- Clear browser cache and session storage

## Commit the Changes

Once everything works:

```bash
git add backend/
git add src/js/modules/auth/
git add src/js/modules/email/
git add docs/AZURE_AD_SETUP.md
git add docs/EMAIL_AUTH_FEATURE.md
git add NEXT_STEPS.md
git add index.html
git add src/js/main.js
git add src/js/modules/intake/pdfGenerator.js

git commit -m "Add Microsoft 365 authentication and email functionality for intake forms"
git push origin main
```

## Future Enhancements

After basic functionality works, consider:

1. **User Roles & Permissions** - Different access levels for different users
2. **Email History** - Track sent emails in the app
3. **Template Customization** - Allow customizing email templates
4. **Bulk Operations** - Send multiple intake forms at once
5. **Email Preview** - Preview email before sending
6. **Recipient Management** - Save frequently used recipients

## Support Files Created

- `backend/server.js` - Backend email server
- `backend/package.json` - Backend dependencies
- `src/js/modules/auth/authManager.js` - Authentication module
- `src/js/modules/email/emailService.js` - Email service
- `docs/AZURE_AD_SETUP.md` - Azure configuration guide
- `docs/EMAIL_AUTH_FEATURE.md` - Feature documentation
- `NEXT_STEPS.md` - This file

## Questions?

If you encounter issues:
1. Check the troubleshooting sections in the docs
2. Review browser console for errors
3. Check backend server logs
4. Verify Azure AD configuration

Let me know if you need help with any step!
