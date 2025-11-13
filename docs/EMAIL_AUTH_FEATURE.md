# Email & Authentication Feature

## Overview

The Scanner app now supports Microsoft 365 authentication and email functionality. Users can sign in with their LoneWolf Biotech Microsoft 365 accounts and email intake form PDFs directly from the application.

## Features

- **Microsoft 365 Single Sign-On (SSO)**: Secure authentication using Azure AD
- **Email Intake Forms**: Send completed intake form PDFs to team members
- **Multiple Recipients**: Add multiple email addresses
- **Professional Email Templates**: Formatted emails with intake summary
- **Session Persistence**: Stay signed in across browser sessions

## Architecture

### Frontend Components

1. **AuthManager** (`src/js/modules/auth/authManager.js`)
   - Handles Microsoft 365 authentication via MSAL.js
   - Token management and session handling
   - UI updates based on authentication state

2. **EmailService** (`src/js/modules/email/emailService.js`)
   - Sends intake form PDFs via backend API
   - Generates professional HTML email bodies
   - Validates email addresses

3. **PDF Generator** (`src/js/modules/intake/pdfGenerator.js`)
   - Updated to support base64 PDF generation
   - Used for email attachments

### Backend Server

**Location**: `backend/server.js`

**Endpoints**:
- `GET /health` - Health check
- `POST /api/email/send` - Send email with PDF attachment
- `POST /api/email/validate` - Validate email addresses
- `GET /api/email/recipients` - Get default recipients

## Setup Instructions

### 1. Azure AD Configuration

Follow the detailed guide in `docs/AZURE_AD_SETUP.md` to:
1. Register the application in Azure AD
2. Configure API permissions
3. Get Client ID and Tenant ID
4. Update the app configuration

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Start the Backend Server

```bash
cd backend
npm start
```

The server will run on `http://localhost:3001`

### 4. Start the Frontend Server

In a separate terminal:

```bash
python server.py
```

The app will be available at `http://localhost:8000`

### 5. Configure Authentication

Edit `src/js/modules/auth/authManager.js` and replace:
- `YOUR_CLIENT_ID_HERE` with your Azure AD Application (client) ID
- `YOUR_TENANT_ID_HERE` with your Azure AD Directory (tenant) ID

## Usage

### Signing In

1. Open the Scanner app
2. Click the "Sign In" button in the header
3. You'll be redirected to Microsoft login
4. Enter your Microsoft 365 credentials
5. Approve permissions if prompted
6. You'll be redirected back to the app

### Sending Intake Form Emails

1. Ensure you're signed in
2. Navigate to the Intake module
3. Fill out the intake form
4. Click "Submit Intake"
5. In the summary section, you'll see an "Email PDF" button
6. Click "Email PDF"
7. A dialog will appear with:
   - Default recipient (pozersky@lonewolfgenetics.com)
   - Option to add more recipients
8. Click "Send Email"
9. You'll receive confirmation when the email is sent

### Adding Recipients

The email dialog allows you to:
- Use the default recipient
- Add additional email addresses (comma-separated)
- Validate email addresses before sending

## Technical Details

### Authentication Flow

1. User clicks "Sign In"
2. App redirects to Microsoft login page
3. User authenticates with Microsoft 365
4. Microsoft redirects back to app with auth code
5. MSAL.js exchanges code for access token
6. Token is stored in session storage
7. Token is used for Microsoft Graph API calls

### Email Flow

1. User completes intake form
2. User clicks "Email PDF"
3. Frontend generates PDF as base64
4. Frontend gets access token from MSAL
5. Frontend sends request to backend with:
   - Access token
   - Recipients list
   - PDF data
   - Email subject and body
6. Backend uses Microsoft Graph API to send email
7. Email is sent from user's mailbox
8. Success confirmation shown to user

### Security

- **No passwords stored**: OAuth 2.0 flow, no credentials in app
- **Token management**: Tokens stored securely in session storage
- **API permissions**: Minimal permissions (User.Read, Mail.Send)
- **Backend validation**: All requests validated on backend
- **HTTPS required**: Production must use HTTPS

## Dependencies

### Frontend
- MSAL.js 2.x (Microsoft Authentication Library)
- jsPDF (PDF generation)
- Native Fetch API

### Backend
- Express.js (Web server)
- @microsoft/microsoft-graph-client (Graph API client)
- cors (CORS middleware)
- multer (File uploads)

## Configuration

### Environment Variables (Optional)

Create a `.env` file in the backend directory:

```env
PORT=3001
FRONTEND_URL=http://localhost:8000
```

### Default Recipients

Edit `backend/server.js` to update default recipients:

```javascript
app.get('/api/email/recipients', (req, res) => {
    res.json({
        default: ['pozersky@lonewolfgenetics.com'],
        suggestions: [
            'pozersky@lonewolfgenetics.com',
            'team@lonewolfgenetics.com',
            // Add more team members here
        ]
    });
});
```

## Troubleshooting

### "User not signed in" Error
- Click "Sign In" button in header
- Ensure popup blockers aren't preventing login
- Check browser console for errors

### "Failed to send email" Error
- Verify backend server is running
- Check backend console for detailed error
- Ensure user has Mail.Send permission
- Try signing out and signing in again

### "PDF generation failed" Error
- Check that jsPDF library is loaded
- Verify form data is complete
- Check browser console for details

### Backend Connection Issues
- Ensure backend is running on port 3001
- Check for CORS errors in browser console
- Verify `backendUrl` in `emailService.js` is correct

## Future Enhancements

Potential improvements for future versions:

1. **Email Templates**: Customizable email templates
2. **Email History**: Track sent emails in app
3. **Bulk Email**: Send to distribution lists
4. **Attachments**: Add additional files to emails
5. **Email Preview**: Preview email before sending
6. **Offline Queue**: Queue emails when offline
7. **Email Tracking**: Read receipts and tracking
8. **User Roles**: Different permissions for different users

## API Reference

### Backend API

#### POST /api/email/send

Send an email with PDF attachment.

**Request Body**:
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJub25jZSI6...",
  "recipients": ["user@example.com", "team@example.com"],
  "subject": "LoneWolf Biotech - Intake Form: Strain ABC",
  "body": "<html>...</html>",
  "pdfData": "data:application/pdf;base64,JVBERi0xLjQKJeLj...",
  "pdfFilename": "intake_ABC_2024-01-15.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "recipientCount": 2
}
```

#### POST /api/email/validate

Validate email addresses.

**Request Body**:
```json
{
  "emails": ["user@example.com", "invalid-email"]
}
```

**Response**:
```json
{
  "results": [
    { "email": "user@example.com", "valid": true },
    { "email": "invalid-email", "valid": false }
  ]
}
```

#### GET /api/email/recipients

Get default and suggested recipients.

**Response**:
```json
{
  "default": ["pozersky@lonewolfgenetics.com"],
  "suggestions": [
    "pozersky@lonewolfgenetics.com",
    "team@lonewolfgenetics.com"
  ]
}
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Check backend server logs
4. Refer to Azure AD setup documentation
5. Contact IT support for Azure AD issues
