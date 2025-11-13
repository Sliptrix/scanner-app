/**
 * Authentication Manager
 * Handles Microsoft 365 authentication via MSAL.js
 */

window.AuthManager = {
    msalInstance: null,
    currentUser: null,
    
    // MSAL Configuration - REPLACE THESE VALUES WITH YOUR AZURE AD APP REGISTRATION
    msalConfig: {
        auth: {
            clientId: 'c5fd0c6d-55ab-46ac-aa66-af2befec9560', // Replace with your Azure AD app client ID
            authority: 'https://login.microsoftonline.com/a1b92892-5ecd-4f98-ae48-e552b6767726', // Replace with your tenant ID
            redirectUri: window.location.origin // Current origin (e.g., http://localhost:8000)
        },
        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false
        }
    },
    
    // Microsoft Graph API scopes
    loginRequest: {
        scopes: ['User.Read', 'Mail.Send']
    },
    
    /**
     * Initialize MSAL and check for existing session
     */
    async init() {
        console.log('Initializing AuthManager...');
        
        // Check if MSAL library is loaded
        if (typeof msal === 'undefined') {
            console.error('MSAL library not loaded. Please include msal-browser.min.js');
            this.showError('Authentication library not loaded');
            return;
        }
        
        try {
            // Create MSAL instance
            this.msalInstance = new msal.PublicClientApplication(this.msalConfig);
            await this.msalInstance.initialize();
            
            // Handle redirect response if returning from login
            const response = await this.msalInstance.handleRedirectPromise();
            if (response) {
                this.handleLoginSuccess(response);
            } else {
                // Check if user is already signed in
                const accounts = this.msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    this.currentUser = accounts[0];
                    this.updateUI(true);
                    console.log('User already signed in:', this.currentUser.username);
                }
            }
            
            console.log('AuthManager initialized');
        } catch (error) {
            console.error('Error initializing auth:', error);
            this.showError('Failed to initialize authentication');
        }
    },
    
    /**
     * Sign in with Microsoft 365
     */
    async signIn() {
        try {
            console.log('Initiating sign in...');
            
            // Use redirect flow (better for production)
            await this.msalInstance.loginRedirect(this.loginRequest);
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Failed to sign in: ' + error.message);
        }
    },
    
    /**
     * Sign out
     */
    async signOut() {
        try {
            const logoutRequest = {
                account: this.currentUser
            };
            
            this.currentUser = null;
            this.updateUI(false);
            
            await this.msalInstance.logoutRedirect(logoutRequest);
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Failed to sign out');
        }
    },
    
    /**
     * Get access token for Microsoft Graph API
     */
    async getAccessToken() {
        try {
            if (!this.currentUser) {
                throw new Error('User not signed in');
            }
            
            const tokenRequest = {
                scopes: this.loginRequest.scopes,
                account: this.currentUser
            };
            
            // Try to acquire token silently
            const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
            return response.accessToken;
            
        } catch (error) {
            console.error('Error getting token:', error);
            
            // If silent acquisition fails, try interactive
            if (error instanceof msal.InteractionRequiredAuthError) {
                try {
                    const response = await this.msalInstance.acquireTokenRedirect(tokenRequest);
                    return response.accessToken;
                } catch (interactiveError) {
                    console.error('Interactive token acquisition failed:', interactiveError);
                    throw interactiveError;
                }
            }
            throw error;
        }
    },
    
    /**
     * Check if user is signed in
     */
    isSignedIn() {
        return this.currentUser !== null;
    },
    
    /**
     * Get current user info
     */
    getCurrentUser() {
        return this.currentUser ? {
            email: this.currentUser.username,
            name: this.currentUser.name || this.currentUser.username,
            id: this.currentUser.localAccountId
        } : null;
    },
    
    /**
     * Handle successful login
     */
    handleLoginSuccess(response) {
        this.currentUser = response.account;
        this.updateUI(true);
        console.log('Login successful:', this.currentUser.username);
        
        if (window.NotificationSystem) {
            NotificationSystem.success(`Welcome, ${this.currentUser.name || this.currentUser.username}!`);
        }
    },
    
    /**
     * Update UI based on authentication state
     */
    updateUI(isSignedIn) {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        const userEmail = document.getElementById('userEmail');
        
        if (isSignedIn && this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'inline-block';
            if (userEmail) userEmail.textContent = this.currentUser.username;
            
            // Enable email functionality in intake form
            this.enableEmailFeatures();
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
            
            // Disable email functionality
            this.disableEmailFeatures();
        }
    },
    
    /**
     * Enable email features in intake form
     */
    enableEmailFeatures() {
        const emailSection = document.getElementById('intakeEmailSection');
        if (emailSection) {
            emailSection.style.display = 'block';
        }
    },
    
    /**
     * Disable email features in intake form
     */
    disableEmailFeatures() {
        const emailSection = document.getElementById('intakeEmailSection');
        if (emailSection) {
            emailSection.style.display = 'none';
        }
    },
    
    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        if (window.NotificationSystem) {
            NotificationSystem.error(message);
        } else {
            alert(message);
        }
    }
};

// Global functions for HTML onclick events
function signIn() {
    AuthManager.signIn();
}

function signOut() {
    AuthManager.signOut();
}

// Expose to window
window.signIn = signIn;
window.signOut = signOut;
