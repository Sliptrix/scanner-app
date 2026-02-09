/**
 * LONE WOLF BIOTECH - AUDIT SERVICE
 * Phase 3: Enhanced Data Tracking & Lineage System
 * 
 * Provides comprehensive audit trail for containers including:
 * - Timestamps for all operations (create, update, transfer)
 * - User attribution (who performed each action)
 * - Full change history for each container
 * - Event logging and retrieval
 */

window.AuditService = (function() {
    'use strict';

    // Storage keys
    const STORAGE_KEY = 'lwb_audit_log';
    const MAX_LOG_ENTRIES = 10000; // Limit to prevent localStorage overflow

    // Audit event types
    const EventTypes = {
        CONTAINER_CREATED: 'CONTAINER_CREATED',
        CONTAINER_UPDATED: 'CONTAINER_UPDATED',
        CONTAINER_TRANSFERRED: 'CONTAINER_TRANSFERRED',
        CONTAINER_SPLIT: 'CONTAINER_SPLIT',
        CONTAINER_DISCARDED: 'CONTAINER_DISCARDED',
        CONTAINER_DELETED: 'CONTAINER_DELETED',
        LOCATION_CHANGED: 'LOCATION_CHANGED',
        STAGE_CHANGED: 'STAGE_CHANGED',
        MEDIA_CHANGED: 'MEDIA_CHANGED',
        COUNT_ADJUSTED: 'COUNT_ADJUSTED',
        NOTES_UPDATED: 'NOTES_UPDATED',
        BATCH_IMPORT: 'BATCH_IMPORT',
        BATCH_EXPORT: 'BATCH_EXPORT',
        SYNC_CLOUD_PUSH: 'SYNC_CLOUD_PUSH',
        SYNC_CLOUD_PULL: 'SYNC_CLOUD_PULL',
        QR_ASSIGNED: 'QR_ASSIGNED',
        LINEAGE_REPAIR: 'LINEAGE_REPAIR'
    };

    // Audit log store
    const auditStore = {
        // Array of audit entries
        entries: [],
        // Container-specific history index
        containerIndex: {},
        // Statistics
        stats: {
            totalEvents: 0,
            byType: {},
            byUser: {}
        }
    };

    /**
     * Initialize the audit service
     */
    function initialize() {
        loadFromStorage();
        console.log('AuditService: Initialized with', auditStore.entries.length, 'entries');
        
        // Subscribe to inventory events
        window.addEventListener('inventoryUpdated', handleInventoryEvent);
        window.addEventListener('lineageUpdated', handleLineageEvent);
    }

    /**
     * Load audit log from localStorage
     */
    function loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                auditStore.entries = parsed.entries || [];
                auditStore.stats = parsed.stats || { totalEvents: 0, byType: {}, byUser: {} };
                rebuildContainerIndex();
                return true;
            }
        } catch (error) {
            console.error('AuditService: Failed to load from storage:', error);
        }
        return false;
    }

    /**
     * Save audit log to localStorage
     */
    function saveToStorage() {
        try {
            // Trim old entries if exceeding limit
            if (auditStore.entries.length > MAX_LOG_ENTRIES) {
                auditStore.entries = auditStore.entries.slice(-MAX_LOG_ENTRIES);
                rebuildContainerIndex();
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                entries: auditStore.entries,
                stats: auditStore.stats,
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.error('AuditService: Failed to save to storage:', error);
            
            // If quota exceeded, try trimming more
            if (error.name === 'QuotaExceededError') {
                auditStore.entries = auditStore.entries.slice(-Math.floor(MAX_LOG_ENTRIES / 2));
                rebuildContainerIndex();
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        entries: auditStore.entries,
                        stats: auditStore.stats,
                        savedAt: new Date().toISOString()
                    }));
                } catch (retryError) {
                    console.error('AuditService: Storage quota exceeded even after trim');
                }
            }
        }
    }

    /**
     * Rebuild container index from entries
     */
    function rebuildContainerIndex() {
        auditStore.containerIndex = {};
        
        auditStore.entries.forEach((entry, index) => {
            if (entry.containerId) {
                const id = String(entry.containerId);
                if (!auditStore.containerIndex[id]) {
                    auditStore.containerIndex[id] = [];
                }
                auditStore.containerIndex[id].push(index);
            }
            
            // Also index related containers
            if (entry.relatedContainers) {
                entry.relatedContainers.forEach(relatedId => {
                    const id = String(relatedId);
                    if (!auditStore.containerIndex[id]) {
                        auditStore.containerIndex[id] = [];
                    }
                    if (!auditStore.containerIndex[id].includes(index)) {
                        auditStore.containerIndex[id].push(index);
                    }
                });
            }
        });
    }

    /**
     * Get current user info
     */
    function getCurrentUser() {
        if (window.AuthManager && AuthManager.isSignedIn && AuthManager.isSignedIn()) {
            const user = AuthManager.getUser ? AuthManager.getUser() : null;
            if (user) {
                return {
                    id: user.id || user.localAccountId || 'unknown',
                    name: user.name || user.username || 'Unknown User',
                    email: user.username || user.email || null
                };
            }
        }
        
        // No authenticated user available
        return {
            id: 'unknown',
            name: 'Unknown User',
            email: null
        };
    }

    /**
     * Log an audit event
     * @param {string} eventType - Type of event (from EventTypes)
     * @param {Object} data - Event data
     * @returns {Object} The created audit entry
     */
    function logEvent(eventType, data = {}) {
        const user = getCurrentUser();
        
        const entry = {
            id: generateEventId(),
            type: eventType,
            timestamp: new Date().toISOString(),
            user: user,
            containerId: data.containerId || null,
            relatedContainers: data.relatedContainers || [],
            changes: data.changes || null,
            previousValues: data.previousValues || null,
            newValues: data.newValues || null,
            metadata: data.metadata || {},
            message: data.message || generateEventMessage(eventType, data)
        };
        
        // Add to entries
        auditStore.entries.push(entry);
        
        // Update container index
        if (entry.containerId) {
            const id = String(entry.containerId);
            if (!auditStore.containerIndex[id]) {
                auditStore.containerIndex[id] = [];
            }
            auditStore.containerIndex[id].push(auditStore.entries.length - 1);
        }
        
        // Update stats
        auditStore.stats.totalEvents++;
        auditStore.stats.byType[eventType] = (auditStore.stats.byType[eventType] || 0) + 1;
        auditStore.stats.byUser[user.name] = (auditStore.stats.byUser[user.name] || 0) + 1;
        
        saveToStorage();
        
        // Emit event for UI updates
        window.dispatchEvent(new CustomEvent('auditEventLogged', {
            detail: entry
        }));
        
        return entry;
    }

    /**
     * Generate a unique event ID
     */
    function generateEventId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `evt_${timestamp}_${random}`;
    }

    /**
     * Generate human-readable message for an event
     */
    function generateEventMessage(eventType, data) {
        const containerId = data.containerId || 'Unknown';
        
        switch (eventType) {
            case EventTypes.CONTAINER_CREATED:
                return `Container ${containerId} created`;
            
            case EventTypes.CONTAINER_UPDATED:
                if (data.changes) {
                    const changeList = Object.keys(data.changes).join(', ');
                    return `Container ${containerId} updated: ${changeList}`;
                }
                return `Container ${containerId} updated`;
            
            case EventTypes.CONTAINER_TRANSFERRED:
                const dest = data.relatedContainers?.[0] || 'unknown';
                return `Container ${containerId} transferred to ${dest}`;
            
            case EventTypes.CONTAINER_SPLIT:
                const count = data.relatedContainers?.length || 0;
                return `Container ${containerId} split into ${count} containers`;
            
            case EventTypes.CONTAINER_DISCARDED:
                const reason = data.metadata?.reason || 'no reason given';
                return `Container ${containerId} discarded: ${reason}`;
            
            case EventTypes.CONTAINER_DELETED:
                return `Container ${containerId} deleted`;
            
            case EventTypes.LOCATION_CHANGED:
                const newLoc = data.newValues?.location || 'unknown';
                return `Container ${containerId} moved to ${newLoc}`;
            
            case EventTypes.STAGE_CHANGED:
                const newStage = data.newValues?.stage || 'unknown';
                return `Container ${containerId} stage changed to ${newStage}`;
            
            case EventTypes.MEDIA_CHANGED:
                const newMedia = data.newValues?.media || 'unknown';
                return `Container ${containerId} media changed to ${newMedia}`;
            
            case EventTypes.COUNT_ADJUSTED:
                const newCount = data.newValues?.count || 0;
                return `Container ${containerId} tissue count adjusted to ${newCount}`;
            
            case EventTypes.QR_ASSIGNED:
                const qrRow = data.metadata?.qrRow || 'unknown';
                return `QR code (row ${qrRow}) assigned to container ${containerId}`;
            
            default:
                return `Event ${eventType} on container ${containerId}`;
        }
    }

    /**
     * Handle inventory update events
     */
    function handleInventoryEvent(event) {
        const { item, action } = event.detail || {};
        
        if (!item) return;
        
        const containerId = item.containerId || item.asset_id;
        
        switch (action) {
            case 'add':
                logEvent(EventTypes.CONTAINER_CREATED, {
                    containerId,
                    newValues: {
                        strain: item.strain || item.strain_name,
                        owner: item.owner || item.owner_code,
                        stage: item.stage || item.stage_name,
                        media: item.media || item.media_batch_id,
                        location: item.location,
                        count: item.tissueCount || item.sample_count || 1
                    }
                });
                break;
            
            case 'update':
                logEvent(EventTypes.CONTAINER_UPDATED, {
                    containerId,
                    changes: event.detail.changes,
                    previousValues: event.detail.previousValues,
                    newValues: event.detail.newValues
                });
                break;
            
            case 'delete':
                logEvent(EventTypes.CONTAINER_DELETED, { containerId });
                break;
        }
    }

    /**
     * Handle lineage update events
     */
    function handleLineageEvent(event) {
        const { sourceId, destinationIds, type } = event.detail || {};
        
        if (sourceId && destinationIds) {
            const eventType = destinationIds.length > 1 
                ? EventTypes.CONTAINER_SPLIT 
                : EventTypes.CONTAINER_TRANSFERRED;
            
            logEvent(eventType, {
                containerId: sourceId,
                relatedContainers: destinationIds,
                metadata: { transferType: type }
            });
        }
    }

    /**
     * Log a container creation event
     */
    function logContainerCreated(containerId, data = {}) {
        return logEvent(EventTypes.CONTAINER_CREATED, {
            containerId,
            newValues: data,
            metadata: data.metadata
        });
    }

    /**
     * Log a container update event with change tracking
     */
    function logContainerUpdated(containerId, previousValues, newValues, changedFields = null) {
        const changes = changedFields || {};
        
        // Auto-detect changes if not provided
        if (!changedFields && previousValues && newValues) {
            Object.keys(newValues).forEach(key => {
                if (previousValues[key] !== newValues[key]) {
                    changes[key] = {
                        from: previousValues[key],
                        to: newValues[key]
                    };
                }
            });
        }
        
        // Determine more specific event type based on changes
        let eventType = EventTypes.CONTAINER_UPDATED;
        const changeKeys = Object.keys(changes);
        
        if (changeKeys.length === 1) {
            if (changeKeys[0] === 'location') eventType = EventTypes.LOCATION_CHANGED;
            else if (changeKeys[0] === 'stage') eventType = EventTypes.STAGE_CHANGED;
            else if (changeKeys[0] === 'media') eventType = EventTypes.MEDIA_CHANGED;
            else if (changeKeys[0] === 'tissueCount' || changeKeys[0] === 'count') eventType = EventTypes.COUNT_ADJUSTED;
            else if (changeKeys[0] === 'notes') eventType = EventTypes.NOTES_UPDATED;
        }
        
        return logEvent(eventType, {
            containerId,
            changes,
            previousValues,
            newValues
        });
    }

    /**
     * Log a transfer/split event
     */
    function logTransfer(sourceId, destinationIds, options = {}) {
        const eventType = destinationIds.length > 1 
            ? EventTypes.CONTAINER_SPLIT 
            : EventTypes.CONTAINER_TRANSFERRED;
        
        return logEvent(eventType, {
            containerId: sourceId,
            relatedContainers: destinationIds,
            metadata: {
                tissuesTransferred: options.tissuesTransferred,
                tissuesDiscarded: options.tissuesDiscarded,
                discardReason: options.discardReason,
                splitCount: destinationIds.length
            }
        });
    }

    /**
     * Log a discard event
     */
    function logDiscard(containerId, count, reason = '') {
        return logEvent(EventTypes.CONTAINER_DISCARDED, {
            containerId,
            metadata: {
                count,
                reason
            }
        });
    }

    /**
     * Log a QR code assignment
     */
    function logQRAssigned(containerId, qrData) {
        return logEvent(EventTypes.QR_ASSIGNED, {
            containerId,
            metadata: {
                qrRow: qrData.excelRow,
                qrUrl: qrData.excelUrl
            }
        });
    }

    /**
     * Log a cloud sync event
     */
    function logCloudSync(type, details = {}) {
        const eventType = type === 'push' 
            ? EventTypes.SYNC_CLOUD_PUSH 
            : EventTypes.SYNC_CLOUD_PULL;
        
        return logEvent(eventType, {
            metadata: details,
            message: `Cloud sync ${type}: ${details.itemCount || 0} items`
        });
    }

    /**
     * Get audit history for a specific container
     * @param {string} containerId - Container ID
     * @returns {Array} Array of audit entries for this container
     */
    function getContainerHistory(containerId) {
        const id = String(containerId);
        const indices = auditStore.containerIndex[id] || [];
        
        return indices
            .map(idx => auditStore.entries[idx])
            .filter(entry => entry)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get recent audit events
     * @param {number} limit - Maximum number of events to return
     * @param {Object} filters - Optional filters (type, user, containerId)
     */
    function getRecentEvents(limit = 50, filters = {}) {
        let entries = [...auditStore.entries];
        
        // Apply filters
        if (filters.type) {
            entries = entries.filter(e => e.type === filters.type);
        }
        if (filters.user) {
            entries = entries.filter(e => e.user?.name === filters.user);
        }
        if (filters.containerId) {
            entries = entries.filter(e => 
                e.containerId === filters.containerId ||
                e.relatedContainers?.includes(filters.containerId)
            );
        }
        if (filters.since) {
            const sinceDate = new Date(filters.since);
            entries = entries.filter(e => new Date(e.timestamp) >= sinceDate);
        }
        
        // Sort by timestamp descending and limit
        return entries
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Get events by date range
     */
    function getEventsByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return auditStore.entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= start && entryDate <= end;
        });
    }

    /**
     * Get audit statistics
     */
    function getStats() {
        return {
            ...auditStore.stats,
            entryCount: auditStore.entries.length,
            oldestEntry: auditStore.entries[0]?.timestamp,
            newestEntry: auditStore.entries[auditStore.entries.length - 1]?.timestamp,
            containerCount: Object.keys(auditStore.containerIndex).length
        };
    }

    /**
     * Export audit log as JSON
     */
    function exportLog(filters = {}) {
        const entries = filters ? getRecentEvents(MAX_LOG_ENTRIES, filters) : auditStore.entries;
        
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            entryCount: entries.length,
            entries: entries,
            stats: getStats()
        };
    }

    /**
     * Export audit log as CSV
     */
    function exportAsCSV(filters = {}) {
        const entries = filters ? getRecentEvents(MAX_LOG_ENTRIES, filters) : auditStore.entries;
        
        const headers = ['Timestamp', 'Type', 'Container ID', 'User', 'Message', 'Changes'];
        const rows = entries.map(entry => [
            entry.timestamp,
            entry.type,
            entry.containerId || '',
            entry.user?.name || '',
            entry.message || '',
            entry.changes ? JSON.stringify(entry.changes) : ''
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        return csvContent;
    }

    /**
     * Clear audit log (use with caution)
     */
    function clearLog() {
        auditStore.entries = [];
        auditStore.containerIndex = {};
        auditStore.stats = { totalEvents: 0, byType: {}, byUser: {} };
        saveToStorage();
        
        console.log('AuditService: Audit log cleared');
    }

    /**
     * Get activity timeline for a container
     * @param {string} containerId - Container ID
     * @returns {Array} Timeline entries with formatted data
     */
    function getContainerTimeline(containerId) {
        const history = getContainerHistory(containerId);
        
        return history.map(entry => ({
            timestamp: entry.timestamp,
            formattedTime: new Date(entry.timestamp).toLocaleString(),
            relativeTime: getRelativeTime(entry.timestamp),
            type: entry.type,
            typeLabel: formatEventType(entry.type),
            user: entry.user?.name || 'Unknown',
            message: entry.message,
            changes: entry.changes,
            icon: getEventIcon(entry.type)
        }));
    }

    /**
     * Get relative time string (e.g., "2 hours ago")
     */
    function getRelativeTime(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return then.toLocaleDateString();
    }

    /**
     * Format event type for display
     */
    function formatEventType(type) {
        const labels = {
            [EventTypes.CONTAINER_CREATED]: 'Created',
            [EventTypes.CONTAINER_UPDATED]: 'Updated',
            [EventTypes.CONTAINER_TRANSFERRED]: 'Transferred',
            [EventTypes.CONTAINER_SPLIT]: 'Split',
            [EventTypes.CONTAINER_DISCARDED]: 'Discarded',
            [EventTypes.CONTAINER_DELETED]: 'Deleted',
            [EventTypes.LOCATION_CHANGED]: 'Location Changed',
            [EventTypes.STAGE_CHANGED]: 'Stage Changed',
            [EventTypes.MEDIA_CHANGED]: 'Media Changed',
            [EventTypes.COUNT_ADJUSTED]: 'Count Adjusted',
            [EventTypes.QR_ASSIGNED]: 'QR Assigned'
        };
        return labels[type] || type;
    }

    /**
     * Get icon for event type
     */
    function getEventIcon(type) {
        const icons = {
            [EventTypes.CONTAINER_CREATED]: '✨',
            [EventTypes.CONTAINER_UPDATED]: '✏️',
            [EventTypes.CONTAINER_TRANSFERRED]: '📦',
            [EventTypes.CONTAINER_SPLIT]: '🌱',
            [EventTypes.CONTAINER_DISCARDED]: '🗑️',
            [EventTypes.CONTAINER_DELETED]: '❌',
            [EventTypes.LOCATION_CHANGED]: '📍',
            [EventTypes.STAGE_CHANGED]: '📈',
            [EventTypes.MEDIA_CHANGED]: '🧪',
            [EventTypes.COUNT_ADJUSTED]: '🔢',
            [EventTypes.QR_ASSIGNED]: '📱',
            [EventTypes.SYNC_CLOUD_PUSH]: '☁️',
            [EventTypes.SYNC_CLOUD_PULL]: '⬇️'
        };
        return icons[type] || '📝';
    }

    // Public API
    return {
        // Initialization
        initialize,
        
        // Event types constant
        EventTypes,
        
        // Event logging
        logEvent,
        logContainerCreated,
        logContainerUpdated,
        logTransfer,
        logDiscard,
        logQRAssigned,
        logCloudSync,
        
        // History & queries
        getContainerHistory,
        getContainerTimeline,
        getRecentEvents,
        getEventsByDateRange,
        
        // Stats & export
        getStats,
        exportLog,
        exportAsCSV,
        
        // Utility
        clearLog,
        formatEventType,
        getEventIcon,
        getRelativeTime
    };

})();
