/**
 * Media Batch Manager Module
 * Tracks actual media batch preparation for realistic lab workflow
 * Manages batch lifecycle: preparation -> ready -> in use -> depleted/expired
 */

window.MediaBatchManager = (function() {
    'use strict';

    // Configuration
    const STORAGE_KEY = 'mediaBatches';
    const DEFAULT_EXPIRY_DAYS = 30;

    // Lock to prevent concurrent batch creation
    let createLock = false;

    // Batch status enum
    const BatchStatus = {
        IN_PREP: 'in_prep',
        READY: 'ready',
        IN_USE: 'in_use',
        DEPLETED: 'depleted',
        EXPIRED: 'expired',
        DISCARDED: 'discarded'
    };

    // Preparation step definitions
    const PREP_STEPS = [
        { id: 'weigh', name: 'Weigh Ingredients', description: 'Weigh all dry ingredients accurately' },
        { id: 'dissolve', name: 'Dissolve & Mix', description: 'Dissolve ingredients in distilled water' },
        { id: 'ph_adjust', name: 'Adjust pH', description: 'Adjust pH to target range (5.7-6.0)' },
        { id: 'autoclave', name: 'Autoclave', description: 'Autoclave at 120°C for 20 minutes' },
        { id: 'cool', name: 'Cool Media', description: 'Cool to 55°C before adding post-autoclave ingredients' },
        { id: 'post_autoclave', name: 'Add Post-Autoclave', description: 'Add temperature-sensitive ingredients' },
        { id: 'pour', name: 'Pour into Containers', description: 'Dispense into sterile containers' },
        { id: 'label', name: 'Label Containers', description: 'Apply batch labels to all containers' }
    ];

    /**
     * Initialize the batch manager
     */
    function initialize() {
        console.log('MediaBatchManager initializing...');

        // Check for expired batches on startup
        checkExpiredBatches();

        // Set up periodic expiry check
        setInterval(checkExpiredBatches, 60 * 60 * 1000); // Check every hour

        console.log('MediaBatchManager initialized');
    }

    /**
     * Generate a unique batch ID
     */
    function generateBatchId() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `MB-${dateStr}-${random}`;
    }

    /**
     * Create a new media batch from a recipe
     */
    function createBatch(recipeId, options = {}) {
        // Prevent concurrent batch creation
        if (createLock) {
            console.log('Batch creation already in progress, skipping...');
            throw new Error('Batch creation already in progress');
        }

        createLock = true;

        try {
            // Get recipe details
            let recipe = null;
            if (window.RecipeStorage) {
                recipe = RecipeStorage.loadRecipe(recipeId);
            }

            if (!recipe && !options.recipeData) {
                throw new Error('Recipe not found');
            }

            const recipeData = recipe || options.recipeData;
            const prepDate = new Date();
            const expiryDays = options.expiryDays || DEFAULT_EXPIRY_DAYS;
            const expiryDate = new Date(prepDate);
            expiryDate.setDate(expiryDate.getDate() + expiryDays);

            const batch = {
                id: generateBatchId(),
                recipeId: recipeId,
                recipeName: recipeData.name,
                mediaType: recipeData.mediaType,
                volume: recipeData.volume,

                // Preparation details
                preparedBy: options.preparedBy || 'Unknown',
                prepDate: prepDate.toISOString(),
                expiryDate: expiryDate.toISOString(),

                // Container tracking
                totalContainers: options.containerCount || 0,
                availableContainers: options.containerCount || 0,
                usedContainers: 0,

                // Status and workflow
                status: BatchStatus.IN_PREP,
                prepSteps: PREP_STEPS.map(step => ({
                    ...step,
                    completed: false,
                    completedAt: null,
                    notes: ''
                })),

                // Actual measurements (can differ from recipe)
                actualMeasurements: {
                    phMeasured: null,
                    autoclaveTemp: null,
                    autoclaveTime: null,
                    coolTemp: null
                },

                // Notes and metadata
                notes: options.notes || '',
                createdAt: prepDate.toISOString(),
                lastModified: prepDate.toISOString()
            };

            // Save batch
            const batches = getAllBatches();
            batches.push(batch);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));

            if (window.UIUtils) {
                UIUtils.showNotification(`Batch ${batch.id} created for ${recipeData.name}`, 'success');
            }

            // Release lock before returning
            createLock = false;
            return batch;

        } catch (error) {
            console.error('Failed to create batch:', error);
            if (window.UIUtils) {
                UIUtils.showNotification(`Failed to create batch: ${error.message}`, 'error');
            }
            throw error;
        } finally {
            // Always release the lock
            createLock = false;
        }
    }

    /**
     * Get all batches
     */
    function getAllBatches() {
        try {
            const batchesJson = localStorage.getItem(STORAGE_KEY);
            return batchesJson ? JSON.parse(batchesJson) : [];
        } catch (error) {
            console.error('Failed to load batches:', error);
            return [];
        }
    }

    /**
     * Get batch by ID
     */
    function getBatch(batchId) {
        const batches = getAllBatches();
        return batches.find(b => b.id === batchId);
    }

    /**
     * Update a batch
     */
    function updateBatch(batchId, updates) {
        try {
            const batches = getAllBatches();
            const index = batches.findIndex(b => b.id === batchId);

            if (index < 0) {
                throw new Error('Batch not found');
            }

            batches[index] = {
                ...batches[index],
                ...updates,
                lastModified: new Date().toISOString()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
            return batches[index];

        } catch (error) {
            console.error('Failed to update batch:', error);
            throw error;
        }
    }

    /**
     * Complete a preparation step
     */
    function completeStep(batchId, stepId, notes = '') {
        try {
            const batch = getBatch(batchId);
            if (!batch) {
                throw new Error('Batch not found');
            }

            const step = batch.prepSteps.find(s => s.id === stepId);
            if (!step) {
                throw new Error('Step not found');
            }

            step.completed = true;
            step.completedAt = new Date().toISOString();
            step.notes = notes;

            // Check if all steps are complete
            const allComplete = batch.prepSteps.every(s => s.completed);
            if (allComplete) {
                batch.status = BatchStatus.READY;
            }

            updateBatch(batchId, {
                prepSteps: batch.prepSteps,
                status: batch.status
            });

            if (window.UIUtils) {
                UIUtils.showNotification(`Step "${step.name}" completed`, 'success');
            }

            return batch;

        } catch (error) {
            console.error('Failed to complete step:', error);
            throw error;
        }
    }

    /**
     * Mark batch as ready for use
     */
    function markReady(batchId) {
        return updateBatch(batchId, { status: BatchStatus.READY });
    }

    /**
     * Use containers from a batch
     */
    function useContainers(batchId, count = 1) {
        try {
            const batch = getBatch(batchId);
            if (!batch) {
                throw new Error('Batch not found');
            }

            if (batch.availableContainers < count) {
                throw new Error(`Only ${batch.availableContainers} containers available`);
            }

            const newAvailable = batch.availableContainers - count;
            const newUsed = batch.usedContainers + count;
            const newStatus = newAvailable === 0 ? BatchStatus.DEPLETED : BatchStatus.IN_USE;

            return updateBatch(batchId, {
                availableContainers: newAvailable,
                usedContainers: newUsed,
                status: newStatus
            });

        } catch (error) {
            console.error('Failed to use containers:', error);
            throw error;
        }
    }

    /**
     * Get available batches for a media type
     */
    function getAvailableBatches(mediaType = null) {
        const batches = getAllBatches();
        const now = new Date();

        return batches.filter(batch => {
            // Filter by status
            if (batch.status !== BatchStatus.READY && batch.status !== BatchStatus.IN_USE) {
                return false;
            }

            // Filter by expiry
            if (new Date(batch.expiryDate) < now) {
                return false;
            }

            // Filter by available containers
            if (batch.availableContainers <= 0) {
                return false;
            }

            // Filter by media type if specified
            if (mediaType && batch.mediaType !== mediaType) {
                return false;
            }

            return true;
        });
    }

    /**
     * Get batches expiring soon
     */
    function getExpiringBatches(daysAhead = 7) {
        const batches = getAllBatches();
        const now = new Date();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + daysAhead);

        return batches.filter(batch => {
            if (batch.status === BatchStatus.DEPLETED ||
                batch.status === BatchStatus.EXPIRED ||
                batch.status === BatchStatus.DISCARDED) {
                return false;
            }

            const expiryDate = new Date(batch.expiryDate);
            return expiryDate >= now && expiryDate <= threshold;
        });
    }

    /**
     * Check and update expired batches
     */
    function checkExpiredBatches() {
        const batches = getAllBatches();
        const now = new Date();
        let expiredCount = 0;

        batches.forEach(batch => {
            if (batch.status !== BatchStatus.EXPIRED &&
                batch.status !== BatchStatus.DEPLETED &&
                batch.status !== BatchStatus.DISCARDED) {

                if (new Date(batch.expiryDate) < now) {
                    batch.status = BatchStatus.EXPIRED;
                    batch.lastModified = now.toISOString();
                    expiredCount++;
                }
            }
        });

        if (expiredCount > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
            console.log(`Marked ${expiredCount} batches as expired`);
        }

        return expiredCount;
    }

    /**
     * Discard a batch
     */
    function discardBatch(batchId, reason = '') {
        return updateBatch(batchId, {
            status: BatchStatus.DISCARDED,
            discardReason: reason,
            discardedAt: new Date().toISOString()
        });
    }

    /**
     * Delete a batch
     */
    function deleteBatch(batchId) {
        try {
            const batches = getAllBatches();
            const filtered = batches.filter(b => b.id !== batchId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

            if (window.UIUtils) {
                UIUtils.showNotification('Batch deleted', 'success');
            }

            return true;

        } catch (error) {
            console.error('Failed to delete batch:', error);
            return false;
        }
    }

    /**
     * Get batch statistics
     */
    function getBatchStats() {
        const batches = getAllBatches();
        const now = new Date();

        return {
            total: batches.length,
            inPrep: batches.filter(b => b.status === BatchStatus.IN_PREP).length,
            ready: batches.filter(b => b.status === BatchStatus.READY).length,
            inUse: batches.filter(b => b.status === BatchStatus.IN_USE).length,
            depleted: batches.filter(b => b.status === BatchStatus.DEPLETED).length,
            expired: batches.filter(b => b.status === BatchStatus.EXPIRED).length,
            expiringSoon: getExpiringBatches(7).length,
            totalContainersAvailable: batches
                .filter(b => b.status === BatchStatus.READY || b.status === BatchStatus.IN_USE)
                .reduce((sum, b) => sum + b.availableContainers, 0)
        };
    }

    /**
     * Get preparation steps
     */
    function getPrepSteps() {
        return [...PREP_STEPS];
    }

    /**
     * Export all batches
     */
    function exportBatches() {
        const batches = getAllBatches();
        return JSON.stringify({
            version: '1.0',
            exportDate: new Date().toISOString(),
            batches: batches
        }, null, 2);
    }

    // Expose BatchStatus for external use
    window.BatchStatus = BatchStatus;

    // Public API
    return {
        initialize,
        createBatch,
        getAllBatches,
        getBatch,
        updateBatch,
        completeStep,
        markReady,
        useContainers,
        getAvailableBatches,
        getExpiringBatches,
        checkExpiredBatches,
        discardBatch,
        deleteBatch,
        getBatchStats,
        getPrepSteps,
        exportBatches,
        BatchStatus
    };
})();
