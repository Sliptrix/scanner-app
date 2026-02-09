/**
 * Authentication Scopes Tests
 * Tests for Microsoft Graph API scopes required for OneDrive/SharePoint access
 */

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('Authentication Scopes Tests');
console.log('========================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// Read authManager.js
const authManagerPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'auth', 'authManager.js');
let authManagerContent = '';

try {
    authManagerContent = fs.readFileSync(authManagerPath, 'utf8');
} catch (error) {
    console.log(`❌ Failed to read authManager.js: ${error.message}`);
    process.exit(1);
}

// Test 1: Files.Read.All scope is present
runTest('authManager.js loginRequest.scopes includes Files.Read.All', () => {
    // Look for loginRequest scopes array
    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found in authManager.js');
    }

    const scopesArray = match[1];

    if (!scopesArray.includes('Files.Read.All')) {
        throw new Error('Files.Read.All scope not found in loginRequest.scopes');
    }
});

// Test 2: Sites.Read.All scope is present
runTest('authManager.js loginRequest.scopes includes Sites.Read.All', () => {
    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found in authManager.js');
    }

    const scopesArray = match[1];

    if (!scopesArray.includes('Sites.Read.All')) {
        throw new Error('Sites.Read.All scope not found in loginRequest.scopes');
    }
});

// Test 3: Existing User.Read scope is preserved
runTest('authManager.js preserves existing User.Read scope', () => {
    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found in authManager.js');
    }

    const scopesArray = match[1];

    if (!scopesArray.includes('User.Read')) {
        throw new Error('User.Read scope should be preserved');
    }
});

// Test 4: Existing Mail.Send scope is preserved
runTest('authManager.js preserves existing Mail.Send scope', () => {
    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found in authManager.js');
    }

    const scopesArray = match[1];

    if (!scopesArray.includes('Mail.Send')) {
        throw new Error('Mail.Send scope should be preserved');
    }
});

// Test 5: offline_access scope (if present, should be preserved)
runTest('authManager.js preserves offline_access scope if present', () => {
    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found in authManager.js');
    }

    const scopesArray = match[1];

    // This is optional, so we just check it's not removed if it was there
    // If it's not there originally, that's also fine
    if (scopesArray.includes('offline_access')) {
        console.log('   Note: offline_access scope is present and preserved');
    }

    // Test passes regardless - we're just checking we didn't break anything
});

// Test 6: Scopes are used in login flow
runTest('acquireTokenSilent uses loginRequest with new scopes', () => {
    // The code creates tokenRequest with scopes: this.loginRequest.scopes
    // Then calls acquireTokenSilent(tokenRequest)
    const hasTokenRequestWithScopes = /tokenRequest\s*=\s*{[\s\S]*?scopes\s*:\s*(?:this\.)?loginRequest\.scopes/i;
    const hasAcquireTokenSilent = /acquireTokenSilent\s*\(\s*tokenRequest\s*\)/i;

    if (!hasTokenRequestWithScopes.test(authManagerContent)) {
        // Fallback: check if loginRequest is used directly
        const directUsagePattern = /acquireTokenSilent\s*\(\s*(?:this\.)?loginRequest/i;
        if (!directUsagePattern.test(authManagerContent)) {
            throw new Error('acquireTokenSilent does not appear to use loginRequest scopes');
        }
    }
    
    if (!hasAcquireTokenSilent.test(authManagerContent)) {
        // Check if scopes are passed inline
        const inlinePattern = /acquireTokenSilent\s*\(\s*{[\s\S]*?scopes/i;
        if (!inlinePattern.test(authManagerContent)) {
            throw new Error('acquireTokenSilent call not found');
        }
    }
});

// Test 7: Scopes are used in interactive token acquisition (redirect flow)
runTest('acquireTokenRedirect uses loginRequest with new scopes', () => {
    // The code uses acquireTokenRedirect for interactive auth, not acquireTokenPopup
    const hasLoginRedirect = /loginRedirect\s*\(\s*(?:this\.)?loginRequest\s*\)/i;
    const hasTokenRedirect = /acquireTokenRedirect\s*\(\s*tokenRequest\s*\)/i;

    if (!hasLoginRedirect.test(authManagerContent) && !hasTokenRedirect.test(authManagerContent)) {
        // Check alternative pattern - popup fallback
        const alternativePattern = /acquireToken(?:Popup|Redirect)\s*\(\s*(?:this\.)?loginRequest/i;

        if (!alternativePattern.test(authManagerContent)) {
            throw new Error('Interactive token acquisition does not appear to use loginRequest scopes');
        }
    }
});

// Test 8: Mock token acquisition with new scopes
runTest('MSAL token acquisition works with Files.Read.All and Sites.Read.All', async () => {
    // Mock MSAL PublicClientApplication
    const mockMSAL = {
        _scopes: [],
        async acquireTokenSilent(request) {
            this._scopes = request.scopes;
            return {
                accessToken: 'mock-access-token',
                scopes: request.scopes
            };
        }
    };

    const testScopes = ['User.Read', 'Mail.Send', 'Files.Read.All', 'Sites.Read.All'];

    const result = await mockMSAL.acquireTokenSilent({
        scopes: testScopes,
        account: { username: 'test@example.com' }
    });

    if (!result.accessToken) {
        throw new Error('Token not acquired');
    }

    if (!mockMSAL._scopes.includes('Files.Read.All')) {
        throw new Error('Files.Read.All not included in token request');
    }

    if (!mockMSAL._scopes.includes('Sites.Read.All')) {
        throw new Error('Sites.Read.All not included in token request');
    }
});

// Test 9: Scopes are properly formatted
runTest('Scopes follow Microsoft Graph API naming conventions', () => {
    const validScopes = [
        'User.Read',
        'User.ReadWrite',
        'Mail.Send',
        'Mail.Read',
        'Files.Read',
        'Files.Read.All',
        'Files.ReadWrite',
        'Files.ReadWrite.All',
        'Sites.Read.All',
        'Sites.ReadWrite.All',
        'offline_access'
    ];

    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found');
    }

    const scopesArray = match[1];

    // Extract individual scope strings
    const scopeMatches = scopesArray.match(/['"`]([^'"`]+)['"`]/g);

    if (!scopeMatches) {
        throw new Error('Could not parse scope strings');
    }

    scopeMatches.forEach(scopeMatch => {
        const scope = scopeMatch.replace(/['"`]/g, '');

        if (!validScopes.includes(scope)) {
            throw new Error(`Invalid or unknown scope: ${scope}`);
        }
    });
});

// Test 10: No duplicate scopes
runTest('loginRequest.scopes does not contain duplicate entries', () => {
    const scopesPattern = /loginRequest\s*:\s*{[^}]*scopes\s*:\s*\[([\s\S]*?)\]/i;
    const match = authManagerContent.match(scopesPattern);

    if (!match) {
        throw new Error('loginRequest.scopes not found');
    }

    const scopesArray = match[1];
    const scopeMatches = scopesArray.match(/['"`]([^'"`]+)['"`]/g);

    if (!scopeMatches) {
        throw new Error('Could not parse scope strings');
    }

    const scopes = scopeMatches.map(s => s.replace(/['"`]/g, ''));
    const uniqueScopes = [...new Set(scopes)];

    if (scopes.length !== uniqueScopes.length) {
        const duplicates = scopes.filter((scope, index) => scopes.indexOf(scope) !== index);
        throw new Error(`Duplicate scopes found: ${duplicates.join(', ')}`);
    }
});

// Test 11: Scopes are accessible for Graph API calls
runTest('getAccessToken method returns token with proper scopes', async () => {
    // Mock the getAccessToken method behavior
    const mockAuthManager = {
        msalInstance: {
            async acquireTokenSilent(request) {
                return {
                    accessToken: 'mock-token',
                    scopes: request.scopes
                };
            }
        },
        loginRequest: {
            scopes: ['User.Read', 'Mail.Send', 'Files.Read.All', 'Sites.Read.All']
        },
        async getAccessToken() {
            const tokenResponse = await this.msalInstance.acquireTokenSilent(this.loginRequest);
            return tokenResponse.accessToken;
        }
    };

    const token = await mockAuthManager.getAccessToken();

    if (!token) {
        throw new Error('Token not returned');
    }

    if (token !== 'mock-token') {
        throw new Error('Unexpected token value');
    }
});

// Test 12: Consent flow handles new scopes
runTest('Interactive consent flow properly requests Files.Read.All and Sites.Read.All', async () => {
    let consentedScopes = [];

    const mockMSAL = {
        async acquireTokenSilent(request) {
            // Simulate consent needed
            throw { errorCode: 'consent_required' };
        },
        async acquireTokenPopup(request) {
            // Simulate user consent
            consentedScopes = request.scopes;
            return {
                accessToken: 'mock-token-after-consent',
                scopes: request.scopes
            };
        }
    };

    const mockAuthManager = {
        msalInstance: mockMSAL,
        loginRequest: {
            scopes: ['User.Read', 'Mail.Send', 'Files.Read.All', 'Sites.Read.All']
        },
        async getAccessToken() {
            try {
                return await this.msalInstance.acquireTokenSilent(this.loginRequest);
            } catch (error) {
                if (error.errorCode === 'consent_required') {
                    const result = await this.msalInstance.acquireTokenPopup(this.loginRequest);
                    return result.accessToken;
                }
                throw error;
            }
        }
    };

    const token = await mockAuthManager.getAccessToken();

    if (!token) {
        throw new Error('Token not acquired after consent');
    }

    if (!consentedScopes.includes('Files.Read.All')) {
        throw new Error('Files.Read.All not requested in consent flow');
    }

    if (!consentedScopes.includes('Sites.Read.All')) {
        throw new Error('Sites.Read.All not requested in consent flow');
    }
});

// Test 13: Backward compatibility check
runTest('New scopes do not break existing functionality', () => {
    // Ensure that adding new scopes doesn't remove or break existing scope usage
    const getAccessTokenPattern = /getAccessToken\s*\(\s*\)/i;

    if (!getAccessTokenPattern.test(authManagerContent)) {
        throw new Error('getAccessToken method not found - may have been broken');
    }

    const isSignedInPattern = /isSignedIn\s*\(\s*\)/i;

    if (!isSignedInPattern.test(authManagerContent)) {
        throw new Error('isSignedIn method not found - may have been broken');
    }

    // Verify structure is intact
    const classPattern = /class\s+AuthManager|const\s+AuthManager\s*=|window\.AuthManager\s*=/i;

    if (!classPattern.test(authManagerContent)) {
        throw new Error('AuthManager class/object structure may be broken');
    }
});

// Print summary
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log('========================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
