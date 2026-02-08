/**
 * Authentication Manager
 * Handles Microsoft 365 authentication via MSAL.js
 */

window.AuthManager = {
    msalInstance: null,
    currentUser: null,
    inactivityTimer: null,
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds (configurable)
    
    // MSAL Configuration - loaded from environment config or defaults
    // SECURITY FIX: Credentials should be configured via environment, not hardcoded
    // See: config/auth-config.js or set window.MSAL_CONFIG before loading this script
    msalConfig: {
        auth: {
            // Try to load from environment config, fall back to defaults for development
            clientId: (window.MSAL_CONFIG && window.MSAL_CONFIG.clientId) || 'c5fd0c6d-55ab-46ac-aa66-af2befec9560',
            authority: (window.MSAL_CONFIG && window.MSAL_CONFIG.authority) || 'https://login.microsoftonline.com/a1b92892-5ecd-4f98-ae48-e552b6767726',
            redirectUri: (window.MSAL_CONFIG && window.MSAL_CONFIG.redirectUri) || window.location.origin
        },
        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false
        }
    },
    
    // Microsoft Graph API scopes
    loginRequest: {
        scopes: ['User.Read', 'Mail.Send', 'Files.Read.All', 'Sites.Read.All']
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
            
            // Setup inactivity timeout if user is signed in
            if (this.currentUser) {
                this.setupInactivityTimeout();
            }
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
            // Clear inactivity timer and remove listeners
            this.clearInactivityTimeout();
            this.removeActivityListeners();
            
            // Clear the current user
            this.currentUser = null;
            
            // Clear MSAL cache
            if (this.msalInstance) {
                const accounts = this.msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    this.msalInstance.setActiveAccount(null);
                }
            }
            
            // Clear session storage
            sessionStorage.clear();
            
            // Update UI to show login page
            this.updateUI(false);
            
            // Show notification
            if (window.NotificationSystem) {
                NotificationSystem.info('Signed out successfully');
            }
            
            console.log('User signed out locally');
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Failed to sign out');
        }
    },
    
    /**
     * Get access token for Microsoft Graph API
     */
    async getAccessToken() {
        if (!this.currentUser) {
            throw new Error('User not signed in');
        }
        
        const tokenRequest = {
            scopes: this.loginRequest.scopes,
            account: this.currentUser
        };
        
        try {
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
        
        // Setup inactivity timeout
        this.setupInactivityTimeout();
        
        // Restore last active mode or default to intake
        const lastMode = sessionStorage.getItem('lastActiveMode') || 'intake';
        if (window.UIUtils && typeof window.UIUtils.switchMode === 'function') {
            setTimeout(() => {
                window.UIUtils.switchMode(lastMode);
                console.log(`Restored mode: ${lastMode}`);
            }, 100); // Small delay to ensure app is fully loaded
        }
        
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
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const loginPage = document.getElementById('loginPage');
        const appContent = document.getElementById('appContent');
        
        if (isSignedIn && this.currentUser) {
            // Hide login page, show app
            if (loginPage) loginPage.style.display = 'none';
            if (appContent) appContent.style.display = 'block';
            
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'block';
            
            // Display user name and email
            if (userName) {
                userName.textContent = this.currentUser.name || this.currentUser.username.split('@')[0];
            }
            if (userEmail) {
                userEmail.textContent = this.currentUser.username;
            }
            
            // Enable email functionality in intake form
            this.enableEmailFeatures();
        } else {
            // Show login page, hide app
            if (loginPage) loginPage.style.display = 'flex';
            if (appContent) appContent.style.display = 'none';
            
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
    },
    
    /**
     * Setup inactivity timeout
     * Automatically signs out user after period of inactivity
     */
    setupInactivityTimeout() {
        console.log(`Setting up inactivity timeout: ${this.inactivityTimeout / 60000} minutes`);
        
        // Clear any existing timer
        this.clearInactivityTimeout();
        
        // Events that indicate user activity
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        // Reset timer function
        const resetTimer = () => {
            this.clearInactivityTimeout();
            
            this.inactivityTimer = setTimeout(() => {
                console.log('Inactivity timeout reached - signing out user');
                
                // Save current mode before signing out
                if (window.appState && window.appState.mode) {
                    sessionStorage.setItem('lastActiveMode', window.appState.mode);
                }
                
                if (window.NotificationSystem) {
                    NotificationSystem.warning('You have been signed out due to inactivity');
                }
                
                // Sign out the user
                this.signOut();
            }, this.inactivityTimeout);
        };
        
        // Add event listeners for user activity
        activityEvents.forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });
        
        // Start the initial timer
        resetTimer();
        
        // Store event listeners so we can remove them later if needed
        this.activityResetFunction = resetTimer;
        this.activityEvents = activityEvents;
    },
    
    /**
     * Clear inactivity timeout
     */
    clearInactivityTimeout() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    },
    
    /**
     * Remove activity event listeners
     */
    removeActivityListeners() {
        if (this.activityResetFunction && this.activityEvents) {
            this.activityEvents.forEach(event => {
                document.removeEventListener(event, this.activityResetFunction, true);
            });
        }
    },
    
    /**
     * Set inactivity timeout duration (in minutes)
     */
    setInactivityTimeout(minutes) {
        this.inactivityTimeout = minutes * 60 * 1000;
        console.log(`Inactivity timeout set to ${minutes} minutes`);
        
        // Restart timer with new timeout if user is signed in
        if (this.currentUser) {
            this.setupInactivityTimeout();
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

/**
 * Enter dev mode - bypass authentication for local testing
 * Only available when running on localhost
 */
function enterDevMode() {
    // Only allow dev mode on localhost
    if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        alert('Dev mode is only available on localhost');
        return;
    }
    
    console.log('Entering dev mode - bypassing authentication');
    
    // Set a mock user
    AuthManager.currentUser = {
        username: 'dev@localhost.test',
        name: 'Dev Mode User',
        localAccountId: 'dev-mode-user'
    };
    
    // Mark as dev mode
    window.isDevMode = true;
    
    // Update UI to show app
    AuthManager.updateUI(true);
    
    // Notify user
    if (window.NotificationSystem) {
        NotificationSystem.info('Running in Dev Mode - Authentication bypassed');
    }
    
    console.log('Dev mode activated');
}

// Expose to window
window.signIn = signIn;
window.signOut = signOut;
window.enterDevMode = enterDevMode;
