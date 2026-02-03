// Barcode Event Logger and Persistence Module
// Lab Barcode Builder & Transfer System

/**
 * BarcodeEventLogger - Logs and persists all barcode-related events
 * 
 * Features:
 * - Event logging for generation, scanning, and transfer events
 * - Persistent storage and inventory integration
 * - Event history tracking and lineage
 * - Export and analysis capabilities
 */
window.BarcodeEventLogger = {
    
    // Event storage arrays
    eventHistory: [],
    sessionEvents: [],
    
    /**
     * Initialize the event logger
     */
    initialize: function() {
        // Load existing event history from localStorage if available
        this.loadEventHistory();
        
        // Initialize session tracking
        this.initializeSession();
        
        console.log('BarcodeEventLogger initialized');
    },
    
    /**
     * Log a barcode-related event
     * @param {Object} event - Event data to log
     * @returns {String} Event ID
     */
    logEvent: function(event) {
        try {
            // Validate event data
            this.validateEventData(event);
            
            // Generate unique event ID
            const eventId = this.generateEventId(event);
            
            // Enrich event with system metadata
            const enrichedEvent = this.enrichEvent(event, eventId);
            
            // Store in memory
            this.storeEventInMemory(enrichedEvent);
            
            // Save to persistent storage
            this.saveEventToPersistentStorage(enrichedEvent);
            
            // Update inventory if applicable
            this.updateInventoryWithEvent(enrichedEvent);
            
            // Check for duplicates
            this.checkForDuplicates(enrichedEvent);
            
            console.log(`Event logged: ${enrichedEvent.type} [${eventId}]`);
            
            return eventId;
            
        } catch (error) {
            console.error('Failed to log barcode event:', error);
            throw error;
        }
    },
    
    /**
     * Validate event data structure
     * @param {Object} event - Event to validate
     * @throws {Error} If validation fails
     */
    validateEventData: function(event) {
        if (!event || typeof event !== 'object') {
            throw new Error('Invalid event data: must be an object');
        }
        
        if (!event.type) {
            throw new Error('Invalid event data: missing event type');
        }
        
        if (!event.timestamp) {
            throw new Error('Invalid event data: missing timestamp');
        }
        
        // Validate specific event types
        switch (event.type) {
            case 'barcode_generated':
                if (!event.composite_string || !event.fields) {
                    throw new Error('Invalid generation event: missing composite_string or fields');
                }
                break;
                
            case 'barcode_scanned':
                if (!event.scanned_data || !event.parsed_fields) {
                    throw new Error('Invalid scan event: missing scanned_data or parsed_fields');
                }
                break;
                
            case 'barcode_transferred':
                if (!event.source_barcode || !event.target_barcodes) {
                    throw new Error('Invalid transfer event: missing source_barcode or target_barcodes');
                }
                break;
        }
    },
    
    /**
     * Generate unique event ID
     * @param {Object} event - Event data
     * @returns {String} Unique event ID
     */
    generateEventId: function(event) {
        const timestamp = new Date(event.timestamp);
        const timestampStr = timestamp.toISOString().replace(/[-:.TZ]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        
        return `evt_${event.type}_${timestampStr}_${randomSuffix}`;
    },
    
    /**
     * Enrich event with system metadata
     * @param {Object} event - Original event
     * @param {String} eventId - Generated event ID
     * @returns {Object} Enriched event
     */
    enrichEvent: function(event, eventId) {
        const enriched = {
            ...event,
            event_id: eventId,
            logged_at: new Date().toISOString(),
            session_id: this.getSessionId(),
            system_metadata: {
                user_agent: navigator.userAgent,
                timestamp_ms: Date.now(),
                event_sequence: this.getNextSequenceNumber(),
                logger_version: '1.0.0'
            }
        };
        
        // Add specific enrichments based on event type
        switch (event.type) {
            case 'barcode_generated':
                enriched.generation_metadata = {
                    field_count: Object.keys(event.fields).length,
                    composite_length: event.composite_string.length,
                    container_id: event.metadata?.container_id || null
                };
                break;
                
            case 'barcode_scanned':
                enriched.scan_metadata = {
                    data_length: event.scanned_data.length,
                    scan_method: event.scan_method || 'unknown',
                    parsing_success: !!event.parsed_fields
                };
                break;
                
            case 'barcode_transferred':
                enriched.transfer_metadata = {
                    target_count: event.target_barcodes.length,
                    transfer_type: event.transfer_type || 'unknown',
                    lineage_depth: event.container_lineage?.length || 0
                };
                break;
        }
        
        return enriched;
    },
    
    /**
     * Store event in memory arrays
     * @param {Object} event - Enriched event
     */
    storeEventInMemory: function(event) {
        // Add to main event history
        this.eventHistory.push(event);
        
        // Add to session events
        this.sessionEvents.push(event);
        
        // Maintain memory limits
        this.maintainMemoryLimits();
    },
    
    /**
     * Save event to persistent storage (localStorage)
     * @param {Object} event - Enriched event
     */
    saveEventToPersistentStorage: function(event) {
        try {
            // Save individual event
            const eventKey = `barcode_event_${event.event_id}`;
            localStorage.setItem(eventKey, JSON.stringify(event));
            
            // Update event index
            this.updateEventIndex(event);
            
            // Save updated history (keep last 1000 events)
            this.saveEventHistoryToStorage();
            
        } catch (error) {
            console.warn('Failed to save event to persistent storage:', error);
        }
    },
    
    /**
     * Update inventory with barcode event
     * @param {Object} event - Enriched event
     */
    updateInventoryWithEvent: function(event) {
        try {
            if (!window.appState || !window.appState.inventory) {
                return;
            }
            
            switch (event.type) {
                case 'barcode_generated':
                    // DO NOT auto-add to inventory - this should be handled by explicit save action
                    // Only log the event for history/tracking purposes
                    console.log('Barcode generation event logged (inventory update skipped - handled by save action)');
                    break;
                    
                case 'barcode_transferred':
                    this.updateInventoryWithTransfer(event);
                    break;
                    
                case 'barcode_scanned':
                    this.updateInventoryWithScan(event);
                    break;
            }
            
        } catch (error) {
            console.warn('Failed to update inventory with event:', error);
        }
    },
    
    /**
     * Add barcode generation to inventory
     * @param {Object} event - Generation event
     */
    addBarcodeToInventory: function(event) {
        const inventoryEntry = {
            timestamp: new Date(event.timestamp),
containerId: event.metadata?.container_id || (window.DataUtils && DataUtils.getNextContainerId ? DataUtils.getNextContainerId() : (window.appState?.highestContainerId || 0) + 1),
            sampleBarcode: event.composite_string,
            strain: event.fields.strain,
            strainId: event.fields.strain,
            owner: event.fields.owner,
            ownerId: event.fields.owner,
            stage: event.fields.stage,
            stageId: event.fields.stage,
            mediaType: event.fields.media,
            mediaId: event.fields.media,
            tissueCount: parseInt(event.fields.tissue),
            date: this.formatDate(event.fields.date),
            status: 'Active',
            barcodeEvent: {
                event_id: event.event_id,
                type: event.type,
                timestamp: event.timestamp,
                logged_at: event.logged_at
            }
        };
        
        // Add to inventory
        window.appState.inventory.unshift(inventoryEntry);
        window.appState.sessionCounter++;
        
        // Update UI if available
        if (window.UIUtils && window.UIUtils.updateStats) {
            window.UIUtils.updateStats();
        }
    },
    
    /**
     * Update inventory with transfer event
     * @param {Object} event - Transfer event
     */
    updateInventoryWithTransfer: function(event) {
        // Find source barcode in inventory and mark as transferred
        const sourceEntry = window.appState.inventory.find(item => 
            item.sampleBarcode === event.source_barcode
        );
        
        if (sourceEntry) {
            sourceEntry.status = 'Transferred';
            sourceEntry.transferEvent = {
                event_id: event.event_id,
                target_barcodes: event.target_barcodes,
                transfer_type: event.transfer_type,
                timestamp: event.timestamp
            };
        }
        
        // Add new target barcodes to inventory if provided
        if (event.target_barcode_data) {
            event.target_barcode_data.forEach(targetData => {
                this.addBarcodeToInventory({
                    ...event,
                    composite_string: targetData.composite_string,
                    fields: targetData.fields,
                    metadata: {
                        ...event.metadata,
                        container_id: targetData.container_id,
                        source_event_id: event.event_id
                    }
                });
            });
        }
    },
    
    /**
     * Update inventory with scan event
     * @param {Object} event - Scan event
     */
    updateInventoryWithScan: function(event) {
        // Find matching barcode in inventory and update last scan info
        const matchingEntry = window.appState.inventory.find(item => 
            item.sampleBarcode === event.scanned_data
        );
        
        if (matchingEntry) {
            matchingEntry.lastScanned = {
                event_id: event.event_id,
                timestamp: event.timestamp,
                scan_method: event.scan_method
            };
        }
    },
    
    /**
     * Check for potential duplicate events
     * @param {Object} event - Event to check
     */
    checkForDuplicates: function(event) {
        const recentEvents = this.eventHistory.slice(-10); // Check last 10 events
        
        for (const recentEvent of recentEvents) {
            if (this.isLikelyDuplicate(event, recentEvent)) {
                console.warn('Potential duplicate event detected:', {
                    current: event.event_id,
                    duplicate_of: recentEvent.event_id,
                    time_diff: new Date(event.timestamp) - new Date(recentEvent.timestamp)
                });
                
                event.duplicate_warning = {
                    likely_duplicate_of: recentEvent.event_id,
                    time_difference_ms: new Date(event.timestamp) - new Date(recentEvent.timestamp)
                };
                
                // For barcode_generated events, this likely indicates a double-click or race condition
                if (event.type === 'barcode_generated') {
                    console.error('DUPLICATE BARCODE GENERATION DETECTED - This may cause inventory duplication!');
                    // Optional: Prevent the duplicate from being logged
                    // throw new Error('Duplicate barcode generation prevented');
                }
                break;
            }
        }
    },
    
    /**
     * Check if two events are likely duplicates
     * @param {Object} event1 - First event
     * @param {Object} event2 - Second event
     * @returns {Boolean} True if likely duplicates
     */
    isLikelyDuplicate: function(event1, event2) {
        // Same type and very close timestamps (within 5 seconds)
        if (event1.type === event2.type) {
            const timeDiff = Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp));
            if (timeDiff < 5000) {
                // Check type-specific criteria
                switch (event1.type) {
                    case 'barcode_generated':
                        return event1.composite_string === event2.composite_string;
                    case 'barcode_scanned':
                        return event1.scanned_data === event2.scanned_data;
                    case 'barcode_transferred':
                        return event1.source_barcode === event2.source_barcode;
                }
            }
        }
        
        return false;
    },
    
    /**
     * Get event history
     * @param {Object} options - Query options
     * @returns {Array} Event history
     */
    getEventHistory: function(options = {}) {
        let events = [...this.eventHistory];
        
        // Apply filters
        if (options.type) {
            events = events.filter(event => event.type === options.type);
        }
        
        if (options.since) {
            const sinceDate = new Date(options.since);
            events = events.filter(event => new Date(event.timestamp) >= sinceDate);
        }
        
        if (options.composite_string) {
            events = events.filter(event => 
                event.composite_string === options.composite_string ||
                event.scanned_data === options.composite_string
            );
        }
        
        // Apply sorting
        if (options.sort === 'oldest') {
            events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } else {
            events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        
        // Apply limit
        if (options.limit) {
            events = events.slice(0, options.limit);
        }
        
        return events;
    },
    
    /**
     * Export event log data
     * @param {Object} options - Export options
     * @returns {Object} Export data
     */
    exportEventLog: function(options = {}) {
        const events = this.getEventHistory(options);
        
        const summary = {
            total_events: events.length,
            generation_events: events.filter(e => e.type === 'barcode_generated').length,
            scan_events: events.filter(e => e.type === 'barcode_scanned').length,
            transfer_events: events.filter(e => e.type === 'barcode_transferred').length,
            export_timestamp: new Date().toISOString(),
            session_id: this.getSessionId()
        };
        
        return {
            events: events,
            summary: summary,
            metadata: {
                exported_by: 'BarcodeEventLogger',
                version: '1.0.0',
                options: options
            }
        };
    },
    
    /**
     * Find event by composite string
     * @param {String} compositeString - Composite barcode string
     * @returns {Object|null} Found event or null
     */
    findEventByComposite: function(compositeString) {
        return this.eventHistory.find(event => 
            event.composite_string === compositeString ||
            event.scanned_data === compositeString
        ) || null;
    },
    
    // Utility and maintenance methods
    
    /**
     * Initialize session tracking
     */
    initializeSession: function() {
        if (!this.sessionId) {
            this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        }
        this.sequenceNumber = 0;
    },
    
    /**
     * Get current session ID
     * @returns {String} Session ID
     */
    getSessionId: function() {
        return this.sessionId || 'session_unknown';
    },
    
    /**
     * Get next sequence number
     * @returns {Number} Sequence number
     */
    getNextSequenceNumber: function() {
        return ++this.sequenceNumber;
    },
    
    /**
     * Load event history from localStorage
     */
    loadEventHistory: function() {
        try {
            const storedHistory = localStorage.getItem('barcode_event_history');
            if (storedHistory) {
                this.eventHistory = JSON.parse(storedHistory);
            }
        } catch (error) {
            console.warn('Failed to load event history from storage:', error);
            this.eventHistory = [];
        }
    },
    
    /**
     * Save event history to localStorage
     */
    saveEventHistoryToStorage: function() {
        try {
            // Keep only last 1000 events to prevent storage bloat
            const historyToSave = this.eventHistory.slice(-1000);
            localStorage.setItem('barcode_event_history', JSON.stringify(historyToSave));
        } catch (error) {
            console.warn('Failed to save event history to storage:', error);
        }
    },
    
    /**
     * Update event index in localStorage
     * @param {Object} event - Event to index
     */
    updateEventIndex: function(event) {
        try {
            let eventIndex = JSON.parse(localStorage.getItem('barcode_event_index') || '{}');
            
            if (!eventIndex[event.type]) {
                eventIndex[event.type] = [];
            }
            
            eventIndex[event.type].push({
                event_id: event.event_id,
                timestamp: event.timestamp,
                composite_string: event.composite_string || event.scanned_data
            });
            
            // Keep index reasonable size
            if (eventIndex[event.type].length > 500) {
                eventIndex[event.type] = eventIndex[event.type].slice(-500);
            }
            
            localStorage.setItem('barcode_event_index', JSON.stringify(eventIndex));
        } catch (error) {
            console.warn('Failed to update event index:', error);
        }
    },
    
    /**
     * Maintain memory limits for event arrays
     */
    maintainMemoryLimits: function() {
        // Keep event history reasonable size
        if (this.eventHistory.length > 5000) {
            this.eventHistory = this.eventHistory.slice(-5000);
        }
        
        // Keep session events reasonable size
        if (this.sessionEvents.length > 1000) {
            this.sessionEvents = this.sessionEvents.slice(-1000);
        }
    },
    
    /**
     * Format date for display
     * @param {String} dateString - YYYYMMDD date string
     * @returns {String} Formatted date
     */
    formatDate: function(dateString) {
        if (dateString && dateString.length === 8) {
            const year = dateString.substr(0, 4);
            const month = dateString.substr(4, 2);
            const day = dateString.substr(6, 2);
            return `${year}-${month}-${day}`;
        }
        return dateString;
    },
    
    /**
     * Get logger configuration
     * @returns {Object} Logger configuration
     */
    getConfiguration: function() {
        return {
            maxHistorySize: 5000,
            maxSessionSize: 1000,
            persistentStorage: true,
            duplicateDetection: true,
            inventoryIntegration: true,
            exportFormats: ['json'],
            version: '1.0.0'
        };
    },
    
    /**
     * Clear all event data (for testing/reset)
     */
    clearAllEvents: function() {
        this.eventHistory = [];
        this.sessionEvents = [];
        localStorage.removeItem('barcode_event_history');
        localStorage.removeItem('barcode_event_index');
        
        console.log('All barcode events cleared');
    }
};

// Auto-initialize when module loads
document.addEventListener('DOMContentLoaded', function() {
    window.BarcodeEventLogger.initialize();
});
