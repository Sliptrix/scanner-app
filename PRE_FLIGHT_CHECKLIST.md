# 🛫 Pre-Flight Checklist for Go-Live

Complete this checklist before deploying the Scanner App to production.

---

## 📋 Preparation Phase

### Azure AD Setup
- [ ] Application registered in Azure AD
- [ ] Client ID documented: `_________________________________`
- [ ] Tenant ID documented: `_________________________________`
- [ ] Redirect URI added: `https://___________________________`
- [ ] API Permissions configured:
  - [ ] User.Read (Delegated)
  - [ ] Mail.Send (Delegated)
  - [ ] Files.Read.All (Delegated) - if using cloud sync
- [ ] Admin consent granted for all permissions
- [ ] Test user added and can authenticate

### Configuration Files
- [ ] `config/auth-config.js` created from template
- [ ] Client ID populated in auth-config.js
- [ ] Tenant ID populated in auth-config.js
- [ ] `config/cloud-hq-config.js` created (if using cloud sync)
- [ ] SharePoint workbook URL configured
- [ ] `backend/.env` created with environment variables
- [ ] Config files added to `.gitignore`

### SSL/HTTPS
- [ ] SSL certificate obtained
- [ ] Certificate installed on web server
- [ ] Certificate expiration date noted: `____________`
- [ ] HTTP redirects to HTTPS
- [ ] No mixed content warnings in browser

---

## 🖥️ Infrastructure Phase

### Server Setup
- [ ] Production server provisioned
- [ ] Node.js 18+ installed: `node --version`
- [ ] Python 3.8+ installed: `python3 --version`
- [ ] Git installed and repo cloned
- [ ] Firewall configured (ports 80, 443 open)

### Backend Deployment
- [ ] `cd backend && npm ci --production` completed
- [ ] PM2 installed: `npm install -g pm2`
- [ ] Backend started: `pm2 start server.js --name scanner-backend`
- [ ] PM2 startup configured: `pm2 startup && pm2 save`
- [ ] Health check passing: `curl http://localhost:3001/health`

### Web Server (Nginx/Apache)
- [ ] Web server installed and running
- [ ] Virtual host configured for domain
- [ ] SSL configured in virtual host
- [ ] Reverse proxy to backend API (/api/)
- [ ] Static files served correctly
- [ ] Nginx/Apache restarted and tested

### DNS Configuration
- [ ] DNS A record points to server IP
- [ ] DNS propagation complete (check with `dig` or `nslookup`)
- [ ] Domain accessible in browser

---

## 🧪 Testing Phase

### Authentication Flow
- [ ] Login page loads correctly
- [ ] "Sign In with Microsoft 365" button works
- [ ] Redirects to Microsoft login
- [ ] Successful authentication returns to app
- [ ] User info displayed in header
- [ ] Sign out works correctly
- [ ] Inactivity timeout triggers (test with 1-minute timeout)

### Core Features
- [ ] Barcode generation works
- [ ] Container transfer works
- [ ] Inventory table displays
- [ ] Search and filter work
- [ ] Export to Excel works
- [ ] Import from Excel works

### Email Functionality
- [ ] Email sending works
- [ ] PDF attachment included
- [ ] Email received by recipient
- [ ] Error handling works (invalid email)

### Cloud Sync (if enabled)
- [ ] Sync status indicator shows
- [ ] Manual sync button works
- [ ] Data loads from SharePoint
- [ ] No write operations occur (read-only mode)

### Browser Compatibility
- [ ] Chrome: all features work
- [ ] Firefox: all features work
- [ ] Safari: all features work
- [ ] Edge: all features work
- [ ] Mobile browser: basic functionality

### Performance
- [ ] Page loads in < 3 seconds
- [ ] No JavaScript errors in console
- [ ] No network errors in dev tools
- [ ] Memory usage stable over time

---

## 🔒 Security Phase

### Configuration Security
- [ ] `auth-config.js` not in git repository
- [ ] `cloud-hq-config.js` not in git repository
- [ ] `backend/.env` not in git repository
- [ ] No hardcoded credentials in source code
- [ ] `.gitignore` includes all sensitive files

### Application Security
- [ ] HTTPS enforced on all pages
- [ ] Secure headers configured (CSP, HSTS, etc.)
- [ ] Session storage used (not localStorage)
- [ ] Inactivity timeout enabled
- [ ] CORS configured for production domains only

### Azure AD Security
- [ ] App is single-tenant
- [ ] Minimal permissions granted
- [ ] Admin consent required for sensitive permissions
- [ ] Regular access reviews scheduled

---

## 📚 Documentation Phase

- [ ] README.md updated with production URLs
- [ ] DEPLOYMENT.md reviewed and accurate
- [ ] User training materials prepared
- [ ] Admin documentation available
- [ ] Support contact information documented
- [ ] Rollback procedure documented

---

## 🚀 Go-Live Phase

### Final Checks
- [ ] All previous checklist items completed
- [ ] Stakeholders notified of go-live date
- [ ] Support team briefed
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested

### Launch Steps
1. [ ] Final deployment to production
2. [ ] Smoke test all critical features
3. [ ] Send announcement to users
4. [ ] Monitor for first 24 hours
5. [ ] Collect initial user feedback

### Post-Launch
- [ ] First-day monitoring completed
- [ ] Any critical issues addressed
- [ ] User feedback collected
- [ ] Documentation updated with any changes
- [ ] Lessons learned documented

---

## 📞 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Technical Lead | _____________ | _____________ |
| Azure AD Admin | _____________ | _____________ |
| Server Admin | _____________ | _____________ |

---

## 🔄 Rollback Procedure

If critical issues arise after go-live:

1. **Immediate**: Notify stakeholders of issue
2. **Assess**: Determine severity (P1/P2/P3)
3. **Rollback** (if P1):
   ```bash
   # Stop current deployment
   pm2 stop scanner-backend
   
   # Restore previous version
   git checkout <previous-tag>
   
   # Restart
   pm2 start scanner-backend
   ```
4. **Communicate**: Update stakeholders on status
5. **Fix**: Address issue in development
6. **Redeploy**: After testing fix

---

## ✅ Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA/Tester | | | |
| IT Admin | | | |
| Project Owner | | | |

---

*Checklist Version: 1.0*
*Last Updated: February 2026*
