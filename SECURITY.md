# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in this application, please report it responsibly by contacting the maintainers directly. Do not open public issues for security vulnerabilities.

## Security Best Practices

This document outlines security practices and guidelines for the Scanner App.

### Authentication & Authorization

#### Azure AD / MSAL Configuration
- **NEVER** commit real Azure AD credentials to version control
- Configuration must be provided via `config/auth-config.js` (copied from template)
- The template file `config/auth-config.template.js` is safe to commit
- `config/auth-config.js` is in `.gitignore` and should stay there

```javascript
// Example: config/auth-config.js (do NOT commit this file)
window.MSAL_CONFIG = {
    clientId: 'your-actual-client-id',
    authority: 'https://login.microsoftonline.com/your-tenant-id',
    redirectUri: window.location.origin
};
```

#### Token Handling
- Access tokens are stored in `sessionStorage` (cleared on tab close)
- Tokens are never logged or exposed in error messages
- Token refresh is handled automatically by MSAL
- Inactivity timeout (30 minutes default) automatically signs out users

### API Security

#### Backend Environment Variables
The following environment variables must be set for the backend:

| Variable | Description | Required |
|----------|-------------|----------|
| `QR_API_KEY` | QR code generator API key | For QR proxy feature |
| `CORS_ORIGINS` | Comma-separated allowed origins | Production |
| `ZEBRA_PRINTER_IP` | Zebra printer IP address | For printing |
| `ZEBRA_PRINTER_PORT` | Printer port (default: 9100) | For printing |

Example `.env` file (do NOT commit):
```bash
QR_API_KEY=your_api_key_here
CORS_ORIGINS=https://your-production-domain.com
ZEBRA_PRINTER_IP=192.168.1.100
```

#### CORS Configuration
- Development: Allows localhost origins
- Production: Set `CORS_ORIGINS` to specific allowed domains
- Never use `*` (wildcard) in production

### XSS Prevention

#### Input Sanitization
Always sanitize user input before inserting into the DOM:

```javascript
// GOOD: Use the sanitize function
const safe = UIUtils.sanitize(userInput);
element.innerHTML = `<span>${safe}</span>`;

// GOOD: Use textContent for plain text
element.textContent = userInput;

// BAD: Never insert unsanitized user input
element.innerHTML = userInput; // XSS vulnerability!
```

#### Sanitization Utility
The `UIUtils.sanitize()` function is available globally:
```javascript
UIUtils.sanitize(str)        // Sanitize single string
UIUtils.sanitizeObject(obj)  // Sanitize all string values in object
```

### Content Security Policy (CSP)

For production deployment, add these CSP headers to your web server:

```
Content-Security-Policy: 
    default-src 'self';
    script-src 'self' https://alcdn.msauth.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com;
    frame-src https://login.microsoftonline.com;
    font-src 'self';
```

### Security Headers

The backend automatically sets these security headers:
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS filter for older browsers
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

For production web servers, also add:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HTTPS only)

### Data Storage Security

#### localStorage Usage
- Debug mode flag only
- Excel/reference data (non-sensitive)
- Metadata caching with TTL expiration

#### sessionStorage Usage
- Authentication tokens (cleared on tab close)
- Session-specific state

#### Sensitive Data
- Never store passwords, secrets, or API keys in browser storage
- PII should be handled according to your data retention policies
- Cloud sync is read-only by default to protect data integrity

### Cloud Sync Security

#### Read-Only Mode
Cloud sync operates in read-only mode by default:
```javascript
readOnlyMode: true  // Blocks ALL write operations
```

This prevents accidental data corruption of the cloud Excel workbook.

#### Share URL Handling
- SharePoint/OneDrive share URLs should be treated as sensitive
- Do not commit share URLs to version control
- Configure via `config/cloud-hq-config.js`

### Input Validation

#### Email Validation
- Backend validates email format before sending
- Maximum 10 recipients per email (abuse prevention)
- Subject lines sanitized to prevent header injection
- Filenames sanitized to prevent path traversal

#### Barcode/Container IDs
- Input validation for expected formats
- Sanitization before display

### Development Mode

#### Dev Mode Access
- Dev mode bypasses authentication
- Only available on localhost (127.0.0.1, localhost)
- Never enable dev mode in production

```javascript
// Dev mode is automatically blocked on non-localhost
if (!window.location.hostname.includes('localhost')) {
    // Dev mode disabled
}
```

### Dependency Security

#### Regular Updates
- Keep npm dependencies updated
- Run `npm audit` regularly to check for vulnerabilities
- Address critical and high severity vulnerabilities promptly

```bash
npm audit
npm audit fix
```

### Deployment Checklist

Before deploying to production:

1. ☐ Remove or disable dev mode entry points
2. ☐ Set proper CORS_ORIGINS environment variable
3. ☐ Configure all API keys via environment variables
4. ☐ Enable HTTPS with valid TLS certificate
5. ☐ Add Strict-Transport-Security header
6. ☐ Configure Content Security Policy
7. ☐ Verify auth-config.js is not in version control
8. ☐ Run npm audit and fix vulnerabilities
9. ☐ Enable logging for security-relevant events
10. ☐ Configure proper error handling (no stack traces to users)

### Incident Response

If a security incident is suspected:
1. Rotate any potentially compromised credentials immediately
2. Review access logs for suspicious activity
3. Notify affected users if data was exposed
4. Document the incident and remediation steps

---

Last Updated: 2026-02-08
