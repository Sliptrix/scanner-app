# Inactivity Timeout Feature

## Overview

The app now includes automatic sign-out after a period of user inactivity. This enhances security by ensuring that unattended sessions are automatically terminated.

## Default Settings

- **Timeout Duration**: 30 minutes
- **Activity Detection**: Mouse movements, clicks, keyboard input, scrolling, and touch events
- **Notification**: User receives a warning notification when signed out due to inactivity

## How It Works

1. **Timer Starts**: When user signs in, an inactivity timer begins
2. **Activity Monitoring**: The app monitors for user activity:
   - Mouse movements and clicks
   - Keyboard input
   - Scrolling
   - Touch events (mobile)
3. **Timer Reset**: Any activity resets the inactivity timer back to 30 minutes
4. **Auto Sign-Out**: If no activity detected for 30 minutes:
   - User is automatically signed out
   - Warning notification displayed
   - User returned to login page
   - Must sign in again to continue working

## Configuring Timeout Duration

The timeout duration can be changed in the code or at runtime.

### Method 1: Change Default in Code

Edit `src/js/modules/auth/authManager.js` line 10:

```javascript
inactivityTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
```

Change to desired duration:
- 15 minutes: `15 * 60 * 1000`
- 45 minutes: `45 * 60 * 1000`
- 1 hour: `60 * 60 * 1000`
- 2 hours: `120 * 60 * 1000`

### Method 2: Change at Runtime (via Console)

Open browser console and run:

```javascript
// Set timeout to 15 minutes
AuthManager.setInactivityTimeout(15);

// Set timeout to 1 hour
AuthManager.setInactivityTimeout(60);

// Set timeout to 2 hours
AuthManager.setInactivityTimeout(120);
```

## User Experience

### Normal Usage
- User works in the app normally
- Any interaction resets the timer
- User remains signed in as long as they're active

### Inactive Session
- User leaves app open but inactive for 30 minutes
- Timer expires
- User sees: "⚠️ You have been signed out due to inactivity"
- App returns to login page
- User must sign in again

### Before Sign Out
- No warning before timeout (by design)
- User doesn't see countdown
- Sign out happens automatically and silently

## Security Benefits

1. **Automatic Lock**: Prevents unauthorized access to unattended sessions
2. **Compliance**: Meets security requirements for healthcare/lab environments
3. **Data Protection**: Ensures sensitive lab data isn't exposed when user steps away
4. **No Manual Action**: Automatic protection without requiring user action

## Technical Details

### Events Monitored
```javascript
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
```

### Timer Behavior
- Timer starts when user signs in
- Each activity event resets timer to full duration
- Timer cleared when user manually signs out
- Event listeners removed on sign out to prevent memory leaks

### Resource Efficiency
- Lightweight event listeners
- Minimal performance impact
- Single timeout timer (not continuous polling)
- Automatic cleanup on sign out

## Disabling Inactivity Timeout

If you need to disable the inactivity timeout (not recommended for production):

1. **Temporary Disable** (via console):
```javascript
// Set to very long timeout (24 hours)
AuthManager.setInactivityTimeout(1440);
```

2. **Permanent Disable** (in code):
Edit `src/js/modules/auth/authManager.js` and comment out:
```javascript
// setupInactivityTimeout() {
//     // ... entire function
// }
```

And remove the calls to `this.setupInactivityTimeout()` in the code.

## Testing Inactivity Timeout

### Quick Test (Short Timeout)

1. **Set short timeout** (1 minute) via console:
   ```javascript
   AuthManager.setInactivityTimeout(1);
   ```

2. **Sign in** to the app

3. **Wait 1 minute** without interacting

4. **Verify**: Should see "signed out due to inactivity" and return to login page

### Reset to Normal
```javascript
AuthManager.setInactivityTimeout(30);
```

## Recommendations

### For Different Environments

**Lab Environment (Current Default)**
- 30 minutes is appropriate
- Balance between security and convenience
- Users typically work in continuous sessions

**High Security Environment**
- Consider 15 minutes
- More frequent re-authentication
- Enhanced security for sensitive data

**Office/Administrative Use**
- 45-60 minutes acceptable
- Less frequent re-authentication
- Lower security requirements

**Development/Testing**
- Longer timeout (60+ minutes)
- Reduces interruptions during development
- Remember to reset for production

## Future Enhancements

Possible improvements:
1. **Warning Dialog**: Show 5-minute warning before timeout
2. **Configurable in UI**: Admin settings page for timeout duration
3. **Per-User Settings**: Different timeouts for different users
4. **Activity Log**: Track sign-in/sign-out events
5. **Persistent Setting**: Save timeout preference in database

## Support

If users report being signed out too frequently:
- Increase timeout duration
- Verify activity events are firing correctly
- Check browser console for timeout messages
- Consider per-user timeout settings
