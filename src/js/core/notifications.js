// Notification and Feedback System
// Lab Barcode Builder & Transfer System

window.NotificationSystem = {
    // Main notification function
    showNotification: function(message, type = 'info', duration = 4000) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            // Hide after duration
            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        }
        
        // Also log to console for debugging
        console.log(`${type.toUpperCase()}: ${message}`);
    },
    
    // Specific notification types
    success: function(message, duration = 4000) {
        this.showNotification(message, 'success', duration);
    },
    
    error: function(message, duration = 5000) {
        this.showNotification(message, 'error', duration);
    },
    
    info: function(message, duration = 3000) {
        this.showNotification(message, 'info', duration);
    },
    
    // Builder feedback system
    showBuilderFeedback: function(message, type, duration = 2000) {
        const feedback = document.getElementById('builderFeedback');
        if (feedback) {
            feedback.textContent = message;
            feedback.className = `scan-feedback feedback-${type}`;
            feedback.style.display = 'block';
            
            setTimeout(() => {
                feedback.style.display = 'none';
            }, duration);
        }
    },
    
    // Transfer feedback system
    showTransferFeedback: function(message, type, duration = 3000) {
        const feedback = document.getElementById('transferFeedback');
        if (feedback) {
            feedback.textContent = message;
            feedback.className = `scan-feedback feedback-${type}`;
            feedback.style.display = 'block';
            
            setTimeout(() => {
                feedback.style.display = 'none';
            }, duration);
        }
    },
    
    // Clear all feedback
    clearFeedback: function() {
        const feedbackElements = [
            'builderFeedback',
            'transferFeedback'
        ];
        
        feedbackElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
    }
};
