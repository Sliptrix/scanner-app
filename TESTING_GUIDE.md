# Testing Guide - Email & Authentication

## Current Status

✅ **Backend Server**: Running on http://localhost:3001
✅ **Frontend Server**: Running on http://localhost:8000
✅ **Azure AD Configuration**: Updated with Client ID and Tenant ID
✅ **Code Integration**: Complete

## Testing Steps

### 1. Test Authentication Flow

1. **Open the app**: Navigate to http://localhost:8000
2. **Check UI**: You should see a "🔐 Sign In" button in the top-right corner
3. **Click Sign In**: You'll be redirected to Microsoft login page
4. **Sign in**: Use your Microsoft 365 account (e.g., your LoneWolf account)
5. **Approve permissions** (first time only):
   - User.Read
   - Mail.Send
6. **Redirect back**: You should return to the app
7. **Verify signed in**: Top-right should show your email and "Sign Out" button

**Expected Result**: 
- ✅ Redirected to Microsoft login
- ✅ Successfully authenticated
- ✅ Returned to app with email displayed
- ✅ "Sign Out" button visible

**If authentication fails**:
- Check browser console for errors
- Verify Client ID and Tenant ID are correct
- Ensure redirect URI in Azure AD is `http://localhost:8000`
- Make sure Mail.Send permission has admin consent granted

### 2. Test Intake Form Submission

1. **Go to Intake mode**: Click "📥 Intake" button
2. **Fill out the form**:
   - Customer Type: Select "New"
   - Customer Name: Enter test customer (e.g., "Test Company")
   - Strain Name: Enter test strain (e.g., "Test Strain 1")
   - Services: Check at least one service
   - Genetics: Select an option
3. **Submit**: Click "Submit Intake"
4. **Verify summary**: Success message should appear

**Expected Result**:
- ✅ Form validates correctly
- ✅ Owner ID and Strain ID auto-generated
- ✅ Success message shown
- ✅ Summary displayed with all form data

### 3. Test Email Functionality

1. **After submitting intake form** (step 2 above)
2. **Check email section visibility**: 
   - If signed in: Blue "📧 Email This Form" section should be visible
   - If not signed in: Section should be hidden
3. **Verify default recipient**: Should show `pozersky@lonewolfgenetics.com`
4. **Optionally add more recipients**: Add comma-separated emails
5. **Click "📧 Send Email"**
6. **Wait for confirmation**: Should see "Sending email..." then success message
7. **Check email**: Verify email received in inbox

**Expected Result**:
- ✅ Email section visible when signed in
- ✅ Default recipient pre-filled
- ✅ "Sending email..." notification appears
- ✅ "Email sent successfully" notification
- ✅ Email received with PDF attachment
- ✅ Email has proper formatting and summary

**Email should contain**:
- Subject: "LoneWolf Biotech - Intake Form: [Strain Name]"
- Body: HTML formatted with intake summary
- Attachment: PDF of intake form

### 4. Test Multiple Recipients

1. **After submitting an intake form**
2. **In the email recipients field**, enter:
   ```
   pozersky@lonewolfgenetics.com, test@example.com
   ```
3. **Send email**
4. **Verify**: Success message should say "sent to 2 recipient(s)"

**Expected Result**:
- ✅ Multiple emails parsed correctly
- ✅ Email sent to all recipients
- ✅ Confirmation shows correct count

### 5. Test Error Cases

#### Test: Not signed in
1. Sign out if signed in
2. Submit an intake form
3. Try to send email
4. **Expected**: Error message "Please sign in to send emails"

#### Test: Empty recipients
1. Sign in
2. Submit intake form
3. Clear the recipients field
4. Try to send email
5. **Expected**: Error message about missing recipients

#### Test: Backend not running
1. Stop backend server: `pkill -f "node.*server.js"`
2. Try to send email
3. **Expected**: Error message about connection failure

### 6. Test Sign Out

1. **While signed in**, click "Sign Out" button
2. **Verify**:
   - Redirected to Microsoft logout
   - Returned to app
   - "Sign In" button visible again
   - Email section hidden in intake form

**Expected Result**:
- ✅ Successfully signed out
- ✅ UI updated correctly
- ✅ Email functionality disabled

## Common Issues & Solutions

### Issue: "MSAL is not defined"
**Solution**: 
- Clear browser cache
- Ensure MSAL script loads before authManager.js
- Check browser console for script loading errors

### Issue: "endpoints_resolution_error"
**Solution**:
- Verify Client ID and Tenant ID are correct (not placeholder values)
- Check Azure AD app registration exists
- Ensure you're using actual GUIDs, not "YOUR_CLIENT_ID_HERE"

### Issue: "redirect_uri_mismatch"
**Solution**:
- In Azure AD, go to Authentication
- Ensure `http://localhost:8000` is listed as redirect URI
- Redirect URI must match exactly (including http:// and port)

### Issue: "Failed to send email"
**Solution**:
- Check backend is running: `curl http://localhost:3001/health`
- Verify Mail.Send permission granted in Azure AD
- Check backend console for detailed error
- Try signing out and back in

### Issue: Email not received
**Solution**:
- Check spam/junk folder
- Verify email address is correct
- Check backend logs for sending confirmation
- Ensure Mail.Send permission has admin consent

### Issue: PDF generation error
**Solution**:
- Verify jsPDF library loaded
- Check browser console for errors
- Ensure form data is complete

## Server Management

### Start Both Servers
```bash
# Option 1: Use startup script
./start-servers.sh

# Option 2: Manual start
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
python server.py
```

### Stop Servers
```bash
# If using start-servers.sh
Press Ctrl+C

# Manual stop
pkill -f "node.*server.js"
pkill -f "python.*server.py"
```

### Check Server Status
```bash
# Backend health
curl http://localhost:3001/health

# Frontend health
curl -I http://localhost:8000
```

## Success Checklist

Before considering testing complete, verify:

- [ ] Can sign in with Microsoft 365 account
- [ ] User email displayed in header after sign in
- [ ] Can submit intake form successfully
- [ ] Email section visible after sign in
- [ ] Can send email with default recipient
- [ ] Email received with PDF attachment
- [ ] PDF contains correct intake data
- [ ] Can send to multiple recipients
- [ ] Error messages work correctly (not signed in, empty recipients)
- [ ] Can sign out successfully
- [ ] UI updates correctly based on auth state

## Next Steps After Testing

Once all tests pass:

1. **Commit the changes**:
   ```bash
   git add .
   git commit -m "Add Microsoft 365 authentication and email functionality"
   git push origin main
   ```

2. **Update team documentation**:
   - Share Azure AD app name (LWG-inventory_tracker)
   - Document who has access
   - Share this testing guide with team

3. **Production deployment**:
   - Add production redirect URIs to Azure AD
   - Update environment variables
   - Set up HTTPS
   - Configure production email recipients

4. **Optional enhancements**:
   - Add user roles and permissions
   - Track email history
   - Add email templates
   - Implement bulk email operations

## Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check backend logs for server errors
3. Verify Azure AD configuration
4. Review `docs/AZURE_AD_SETUP.md`
5. Review `docs/EMAIL_AUTH_FEATURE.md`
