/**
 * Performance Monitoring & Optimization Module
 * Lab Scanner System - Phase 7: Performance Enhancements
 * 
 * Provides:
 * - Performance metrics tracking
 * - Memory leak detection
 * - Debounce/throttle utilities
 * - localStorage optimization
 * - Event listener cleanup registry
 */

window.PerformanceMonitor = (function() {
    'use strict';

    // Performance metrics storage
    const metrics = {
        pageLoadTime: 0,
        domContentLoaded: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        apiCallTimes: [],
        renderTimes: [],
        memorySnapshots: []
    };

    // Event listener registry for cleanup
    const eventListenerRegistry = new Map();
    let listenerIdCounter = 0;

    // Debounce timers cache
    const debounceTimers = new Map();

    // Throttle last call times
    const throttleLastCalls = new Map();

    // localStorage cache to reduce I/O
    const localStorageCache = new Map();
    let cacheInitialized = false;

    /**
     * Initialize performance monitoring
     */
    function initialize() {
        console.log('[Performance] Initializing performance monitoring...');

        // Capture navigation timing
        captureNavigationTiming();

        // Setup performance observer for Core Web Vitals
        setupPerformanceObserver();

        // Initialize localStorage cache
        initializeLocalStorageCache();

        // Setup memory monitoring (if available)
        if (window.performance && window.performance.memory) {
            setInterval(captureMemorySnapshot, 30000); // Every 30 seconds
        }

        // Log initial metrics after page load
        window.addEventListener('load', () => {
            setTimeout(logPerformanceMetrics, 1000);
        });

        console.log('[Performance] Performance monitoring initialized');
    }

    /**
     * Capture navigation timing metrics
     */
    function captureNavigationTiming() {
        if (!window.performance || !window.performance.timing) return;

        const timing = window.performance.timing;
        
        window.addEventListener('load', () => {
            metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
            metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
        });
    }

    /**
     * Setup PerformanceObserver for Core Web Vitals
     */
    function setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            // First Contentful Paint
            const fcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntriesByName('first-contentful-paint');
                if (entries.length > 0) {
                    metrics.firstContentfulPaint = entries[0].startTime;
                }
            });
            fcpObserver.observe({ type: 'paint', buffered: true });

            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                if (entries.length > 0) {
                    metrics.largestContentfulPaint = entries[entries.length - 1].startTime;
                }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        } catch (e) {
            console.warn('[Performance] PerformanceObserver not fully supported:', e.message);
        }
    }

    /**
     * Capture memory snapshot (Chrome only)
     */
    function captureMemorySnapshot() {
        if (!window.performance || !window.performance.memory) return;

        const snapshot = {
            timestamp: Date.now(),
            usedJSHeapSize: window.performance.memory.usedJSHeapSize,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
        };

        metrics.memorySnapshots.push(snapshot);

        // Keep only last 20 snapshots
        if (metrics.memorySnapshots.length > 20) {
            metrics.memorySnapshots.shift();
        }

        // Check for potential memory leak (heap growing continuously)
        if (metrics.memorySnapshots.length >= 5) {
            const recent = metrics.memorySnapshots.slice(-5);
            const isGrowing = recent.every((snap, i) => 
                i === 0 || snap.usedJSHeapSize > recent[i - 1].usedJSHeapSize
            );
            
            if (isGrowing) {
                console.warn('[Performance] Potential memory leak detected - heap size continuously increasing');
            }
        }
    }

    /**
     * Log performance metrics to console
     */
    function logPerformanceMetrics() {
        console.log('[Performance] === Page Load Metrics ===');
        console.log(`  Page Load Time: ${metrics.pageLoadTime}ms`);
        console.log(`  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
        console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(2)}ms`);
        console.log(`  Largest Contentful Paint: ${metrics.largestContentfulPaint.toFixed(2)}ms`);
        
        if (window.performance && window.performance.memory) {
            const mb = window.performance.memory.usedJSHeapSize / (1024 * 1024);
            console.log(`  Current JS Heap: ${mb.toFixed(2)} MB`);
        }
    }

    /**
     * Track API call performance
     * @param {string} name - API call name
     * @param {number} duration - Duration in ms
     */
    function trackApiCall(name, duration) {
        metrics.apiCallTimes.push({
            name,
            duration,
            timestamp: Date.now()
        });

        // Keep only last 50 calls
        if (metrics.apiCallTimes.length > 50) {
            metrics.apiCallTimes.shift();
        }

        if (duration > 3000) {
            console.warn(`[Performance] Slow API call: ${name} took ${duration}ms`);
        }
    }

    /**
     * Track render performance
     * @param {string} component - Component name
     * @param {number} duration - Duration in ms
     */
    function trackRender(component, duration) {
        metrics.renderTimes.push({
            component,
            duration,
            timestamp: Date.now()
        });

        // Keep only last 50 renders
        if (metrics.renderTimes.length > 50) {
            metrics.renderTimes.shift();
        }

        if (duration > 100) {
            console.warn(`[Performance] Slow render: ${component} took ${duration}ms`);
        }
    }

    // ============ Event Listener Management ============

    /**
     * Register an event listener with automatic cleanup tracking
     * @param {Element} element - DOM element
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event listener options
     * @returns {number} Listener ID for cleanup
     */
    function registerEventListener(element, eventType, handler, options = {}) {
        const listenerId = ++listenerIdCounter;

        element.addEventListener(eventType, handler, options);

        eventListenerRegistry.set(listenerId, {
            element,
            eventType,
            handler,
            options
        });

        return listenerId;
    }

    /**
     * Remove a registered event listener
     * @param {number} listenerId - Listener ID
     */
    function removeEventListener(listenerId) {
        const entry = eventListenerRegistry.get(listenerId);
        if (entry) {
            entry.element.removeEventListener(entry.eventType, entry.handler, entry.options);
            eventListenerRegistry.delete(listenerId);
        }
    }

    /**
     * Remove all registered event listeners (for cleanup)
     */
    function removeAllEventListeners() {
        eventListenerRegistry.forEach((entry, id) => {
            entry.element.removeEventListener(entry.eventType, entry.handler, entry.options);
        });
        eventListenerRegistry.clear();
        console.log('[Performance] All registered event listeners removed');
    }

    /**
     * Get count of registered event listeners
     * @returns {number}
     */
    function getEventListenerCount() {
        return eventListenerRegistry.size;
    }

    // ============ Debounce & Throttle Utilities ============

    /**
     * Debounce function with named timer support
     * @param {string} name - Unique debounce name
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in ms (default 300)
     */
    function debounce(name, fn, delay = 300) {
        // Clear existing timer for this name
        if (debounceTimers.has(name)) {
            clearTimeout(debounceTimers.get(name));
        }

        const timerId = setTimeout(() => {
            debounceTimers.delete(name);
            fn();
        }, delay);

        debounceTimers.set(name, timerId);
    }

    /**
     * Throttle function execution
     * @param {string} name - Unique throttle name
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Minimum time between calls in ms (default 1000)
     * @returns {boolean} Whether the function was executed
     */
    function throttle(name, fn, limit = 1000) {
        const now = Date.now();
        const lastCall = throttleLastCalls.get(name) || 0;

        if (now - lastCall >= limit) {
            throttleLastCalls.set(name, now);
            fn();
            return true;
        }
        return false;
    }

    /**
     * Clear all debounce timers
     */
    function clearAllDebounceTimers() {
        debounceTimers.forEach((timerId) => clearTimeout(timerId));
        debounceTimers.clear();
    }

    // ============ localStorage Optimization ============

    /**
     * Initialize localStorage cache
     */
    function initializeLocalStorageCache() {
        if (cacheInitialized) return;

        try {
            // Pre-load frequently accessed keys
            const frequentKeys = [
                'labScanner_excelData',
                'labScanner_excelMetadata',
                'labScanner_debugMode',
                'cloud:onedrive:meta',
                'cloud:onedrive:lastSync'
            ];

            frequentKeys.forEach(key => {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    localStorageCache.set(key, value);
                }
            });

            cacheInitialized = true;
            console.log(`[Performance] localStorage cache initialized with ${localStorageCache.size} entries`);
        } catch (e) {
            console.warn('[Performance] Failed to initialize localStorage cache:', e.message);
        }
    }

    /**
     * Get item from localStorage with caching
     * @param {string} key - Storage key
     * @returns {string|null} Stored value
     */
    function getStorageItem(key) {
        // Check cache first
        if (localStorageCache.has(key)) {
            return localStorageCache.get(key);
        }

        // Fallback to localStorage
        try {
            const value = localStorage.getItem(key);
            if (value !== null) {
                localStorageCache.set(key, value);
            }
            return value;
        } catch (e) {
            console.error('[Performance] localStorage.getItem failed:', e.message);
            return null;
        }
    }

    /**
     * Set item in localStorage with caching
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @returns {boolean} Success
     */
    function setStorageItem(key, value) {
        try {
            localStorage.setItem(key, value);
            localStorageCache.set(key, value);
            return true;
        } catch (e) {
            console.error('[Performance] localStorage.setItem failed:', e.message);
            
            // Try to clear old data if quota exceeded
            if (e.name === 'QuotaExceededError') {
                console.warn('[Performance] Storage quota exceeded, attempting cleanup...');
                cleanupOldStorageData();
                
                // Retry
                try {
                    localStorage.setItem(key, value);
                    localStorageCache.set(key, value);
                    return true;
                } catch (retryError) {
                    console.error('[Performance] Retry failed:', retryError.message);
                }
            }
            return false;
        }
    }

    /**
     * Remove item from localStorage and cache
     * @param {string} key - Storage key
     */
    function removeStorageItem(key) {
        try {
            localStorage.removeItem(key);
            localStorageCache.delete(key);
        } catch (e) {
            console.error('[Performance] localStorage.removeItem failed:', e.message);
        }
    }

    /**
     * Cleanup old storage data when quota is exceeded
     */
    function cleanupOldStorageData() {
        const keysToCleanup = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Find old or temporary data to remove
            if (key && (key.includes(':lastError') || key.includes('_temp_'))) {
                keysToCleanup.push(key);
            }
        }

        keysToCleanup.forEach(key => {
            localStorage.removeItem(key);
            localStorageCache.delete(key);
        });

        console.log(`[Performance] Cleaned up ${keysToCleanup.length} old storage entries`);
    }

    /**
     * Get localStorage usage statistics
     * @returns {Object} Storage stats
     */
    function getStorageStats() {
        let totalSize = 0;
        const items = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = (key.length + (value ? value.length : 0)) * 2; // UTF-16
            
            items[key] = size;
            totalSize += size;
        }

        return {
            totalBytes: totalSize,
            totalKB: (totalSize / 1024).toFixed(2),
            itemCount: localStorage.length,
            items,
            cacheSize: localStorageCache.size
        };
    }

    // ============ Utility Functions ============

    /**
     * Measure function execution time
     * @param {string} label - Measurement label
     * @param {Function} fn - Function to measure
     * @returns {*} Function result
     */
    function measure(label, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
        trackRender(label, duration);
        
        return result;
    }

    /**
     * Measure async function execution time
     * @param {string} label - Measurement label
     * @param {Function} asyncFn - Async function to measure
     * @returns {Promise<*>} Function result
     */
    async function measureAsync(label, asyncFn) {
        const start = performance.now();
        const result = await asyncFn();
        const duration = performance.now() - start;
        
        console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
        trackApiCall(label, duration);
        
        return result;
    }

    /**
     * Get all performance metrics
     * @returns {Object} Performance metrics
     */
    function getMetrics() {
        return {
            ...metrics,
            eventListenerCount: eventListenerRegistry.size,
            debounceTimerCount: debounceTimers.size,
            storageCacheSize: localStorageCache.size
        };
    }

    /**
     * Request idle callback wrapper with fallback
     * @param {Function} callback - Callback to run when idle
     * @param {Object} options - Options
     */
    function runWhenIdle(callback, options = { timeout: 2000 }) {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(callback, options);
        } else {
            // Fallback for Safari
            setTimeout(callback, 100);
        }
    }

    // ============ Public API ============

    return {
        // Initialization
        initialize,

        // Metrics
        getMetrics,
        logPerformanceMetrics,
        trackApiCall,
        trackRender,

        // Event listener management
        registerEventListener,
        removeEventListener,
        removeAllEventListeners,
        getEventListenerCount,

        // Debounce/Throttle
        debounce,
        throttle,
        clearAllDebounceTimers,

        // Storage optimization
        getStorageItem,
        setStorageItem,
        removeStorageItem,
        getStorageStats,

        // Utilities
        measure,
        measureAsync,
        runWhenIdle
    };
})();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PerformanceMonitor.initialize();
    });
} else {
    PerformanceMonitor.initialize();
}
