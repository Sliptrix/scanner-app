/**
 * Recipe Versioning Module
 * Tracks recipe versions and history
 * Links recipes to containers that used them
 */

window.RecipeVersioning = (function() {
    'use strict';

    // Storage keys
    const VERSION_HISTORY_KEY = 'recipeVersionHistory';
    const RECIPE_USAGE_KEY = 'recipeContainerUsage';

    /**
     * Initialize the versioning module
     */
    function initialize() {
        console.log('RecipeVersioning initializing...');
        
        // Ensure storage structures exist
        if (!localStorage.getItem(VERSION_HISTORY_KEY)) {
            localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify({}));
        }
        if (!localStorage.getItem(RECIPE_USAGE_KEY)) {
            localStorage.setItem(RECIPE_USAGE_KEY, JSON.stringify({}));
        }
        
        console.log('RecipeVersioning initialized');
    }

    /**
     * Create a new version of a recipe
     * @param {Object} recipe - The recipe being saved
     * @param {Object} previousVersion - The previous version (if exists)
     * @returns {Object} Recipe with version metadata
     */
    function createVersion(recipe, previousVersion = null) {
        const history = getVersionHistory(recipe.id) || [];
        
        // Calculate next version number
        const versionNumber = history.length > 0 
            ? Math.max(...history.map(v => v.version)) + 1 
            : 1;
        
        // Create version entry
        const versionEntry = {
            version: versionNumber,
            timestamp: new Date().toISOString(),
            changes: calculateChanges(previousVersion, recipe),
            snapshot: JSON.parse(JSON.stringify(recipe))
        };
        
        // Add to history
        history.push(versionEntry);
        
        // Save history
        const allHistory = JSON.parse(localStorage.getItem(VERSION_HISTORY_KEY) || '{}');
        allHistory[recipe.id] = history;
        localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(allHistory));
        
        // Add version metadata to recipe
        recipe.version = versionNumber;
        recipe.versionTimestamp = versionEntry.timestamp;
        
        console.log(`RecipeVersioning: Created version ${versionNumber} for recipe ${recipe.id}`);
        
        return recipe;
    }

    /**
     * Calculate changes between two recipe versions
     * @param {Object} oldRecipe - Previous version
     * @param {Object} newRecipe - New version
     * @returns {Array<string>} List of changes
     */
    function calculateChanges(oldRecipe, newRecipe) {
        if (!oldRecipe) {
            return ['Initial version'];
        }
        
        const changes = [];
        
        // Check basic fields
        if (oldRecipe.name !== newRecipe.name) {
            changes.push(`Name changed from "${oldRecipe.name}" to "${newRecipe.name}"`);
        }
        if (oldRecipe.mediaType !== newRecipe.mediaType) {
            changes.push(`Media type changed from "${oldRecipe.mediaType}" to "${newRecipe.mediaType}"`);
        }
        if (oldRecipe.volume !== newRecipe.volume) {
            changes.push(`Volume changed from "${oldRecipe.volume}" to "${newRecipe.volume}"`);
        }
        
        // Check basal salt
        if (oldRecipe.basalSalt?.type !== newRecipe.basalSalt?.type) {
            changes.push(`Basal salt type changed to "${newRecipe.basalSalt?.type}"`);
        }
        if (oldRecipe.basalSalt?.amount !== newRecipe.basalSalt?.amount) {
            changes.push(`Basal salt amount changed from ${oldRecipe.basalSalt?.amount}g to ${newRecipe.basalSalt?.amount}g`);
        }
        
        // Check gelling agent
        if (oldRecipe.gellingAgent?.type !== newRecipe.gellingAgent?.type) {
            changes.push(`Gelling agent changed to "${newRecipe.gellingAgent?.type}"`);
        }
        if (oldRecipe.gellingAgent?.amount !== newRecipe.gellingAgent?.amount) {
            changes.push(`Gelling agent amount changed from ${oldRecipe.gellingAgent?.amount}g to ${newRecipe.gellingAgent?.amount}g`);
        }
        
        // Check pre-autoclave ingredients
        const oldPre = oldRecipe.preAutoclave || {};
        const newPre = newRecipe.preAutoclave || {};
        if (oldPre.gamborgVitamin !== newPre.gamborgVitamin) {
            changes.push(`Gamborg vitamin changed from ${oldPre.gamborgVitamin}g to ${newPre.gamborgVitamin}g`);
        }
        if (oldPre.sucrose !== newPre.sucrose) {
            changes.push(`Sucrose changed from ${oldPre.sucrose}g to ${newPre.sucrose}g`);
        }
        if (oldPre.ppm !== newPre.ppm) {
            changes.push(`PPM changed from ${oldPre.ppm}mL to ${newPre.ppm}mL`);
        }
        
        // Check pH
        if (oldRecipe.pH !== newRecipe.pH) {
            changes.push(`pH changed from ${oldRecipe.pH} to ${newRecipe.pH}`);
        }
        
        // Check post-autoclave additions count
        const oldPostCount = (oldRecipe.postAutoclave || []).length;
        const newPostCount = (newRecipe.postAutoclave || []).length;
        if (oldPostCount !== newPostCount) {
            changes.push(`Post-autoclave additions changed (${oldPostCount} → ${newPostCount} items)`);
        }
        
        return changes.length > 0 ? changes : ['Minor adjustments'];
    }

    /**
     * Get version history for a recipe
     * @param {string} recipeId - Recipe ID
     * @returns {Array<Object>} Version history entries
     */
    function getVersionHistory(recipeId) {
        const allHistory = JSON.parse(localStorage.getItem(VERSION_HISTORY_KEY) || '{}');
        return allHistory[recipeId] || [];
    }

    /**
     * Get a specific version of a recipe
     * @param {string} recipeId - Recipe ID
     * @param {number} versionNumber - Version number to retrieve
     * @returns {Object|null} Recipe snapshot at that version
     */
    function getVersion(recipeId, versionNumber) {
        const history = getVersionHistory(recipeId);
        const versionEntry = history.find(v => v.version === versionNumber);
        return versionEntry ? versionEntry.snapshot : null;
    }

    /**
     * Compare two versions of a recipe
     * @param {string} recipeId - Recipe ID
     * @param {number} version1 - First version number
     * @param {number} version2 - Second version number
     * @returns {Object} Comparison result
     */
    function compareVersions(recipeId, version1, version2) {
        const v1 = getVersion(recipeId, version1);
        const v2 = getVersion(recipeId, version2);
        
        if (!v1 || !v2) {
            return { error: 'One or both versions not found' };
        }
        
        return {
            version1: v1,
            version2: v2,
            changes: calculateChanges(v1, v2)
        };
    }

    /**
     * Track container usage of a recipe
     * @param {string} recipeId - Recipe ID
     * @param {string} containerId - Container that used this recipe
     * @param {Object} usageDetails - Additional usage details
     */
    function trackContainerUsage(recipeId, containerId, usageDetails = {}) {
        const allUsage = JSON.parse(localStorage.getItem(RECIPE_USAGE_KEY) || '{}');
        
        if (!allUsage[recipeId]) {
            allUsage[recipeId] = [];
        }
        
        // Check for duplicate
        const existing = allUsage[recipeId].find(u => u.containerId === containerId);
        if (!existing) {
            allUsage[recipeId].push({
                containerId: containerId,
                timestamp: new Date().toISOString(),
                batchId: usageDetails.batchId || null,
                stage: usageDetails.stage || null,
                strain: usageDetails.strain || null,
                owner: usageDetails.owner || null,
                notes: usageDetails.notes || null
            });
            
            localStorage.setItem(RECIPE_USAGE_KEY, JSON.stringify(allUsage));
            console.log(`RecipeVersioning: Tracked container ${containerId} usage of recipe ${recipeId}`);
        }
    }

    /**
     * Get all containers that used a specific recipe
     * @param {string} recipeId - Recipe ID
     * @returns {Array<Object>} Container usage records
     */
    function getContainersByRecipe(recipeId) {
        const allUsage = JSON.parse(localStorage.getItem(RECIPE_USAGE_KEY) || '{}');
        return allUsage[recipeId] || [];
    }

    /**
     * Get recipe usage for a specific container
     * @param {string} containerId - Container ID
     * @returns {Object|null} Recipe usage record
     */
    function getRecipeForContainer(containerId) {
        const allUsage = JSON.parse(localStorage.getItem(RECIPE_USAGE_KEY) || '{}');
        
        for (const [recipeId, usages] of Object.entries(allUsage)) {
            const usage = usages.find(u => u.containerId === containerId);
            if (usage) {
                return {
                    recipeId: recipeId,
                    ...usage
                };
            }
        }
        
        return null;
    }

    /**
     * Get usage statistics for a recipe
     * @param {string} recipeId - Recipe ID
     * @returns {Object} Usage statistics
     */
    function getRecipeUsageStats(recipeId) {
        const usages = getContainersByRecipe(recipeId);
        
        if (usages.length === 0) {
            return {
                totalContainers: 0,
                firstUsed: null,
                lastUsed: null,
                uniqueStrains: [],
                uniqueOwners: [],
                byStage: {}
            };
        }
        
        const timestamps = usages.map(u => new Date(u.timestamp)).sort((a, b) => a - b);
        const strains = [...new Set(usages.filter(u => u.strain).map(u => u.strain))];
        const owners = [...new Set(usages.filter(u => u.owner).map(u => u.owner))];
        
        const byStage = {};
        usages.forEach(u => {
            const stage = u.stage || 'Unknown';
            byStage[stage] = (byStage[stage] || 0) + 1;
        });
        
        return {
            totalContainers: usages.length,
            firstUsed: timestamps[0].toISOString(),
            lastUsed: timestamps[timestamps.length - 1].toISOString(),
            uniqueStrains: strains,
            uniqueOwners: owners,
            byStage: byStage
        };
    }

    /**
     * Revert a recipe to a previous version
     * @param {string} recipeId - Recipe ID
     * @param {number} versionNumber - Version to revert to
     * @returns {Object|null} Reverted recipe or null if failed
     */
    function revertToVersion(recipeId, versionNumber) {
        const snapshot = getVersion(recipeId, versionNumber);
        if (!snapshot) {
            console.error(`RecipeVersioning: Version ${versionNumber} not found for recipe ${recipeId}`);
            return null;
        }
        
        // Create a new version from the reverted snapshot
        const currentRecipe = window.RecipeStorage ? 
            window.RecipeStorage.loadRecipe(recipeId) : null;
        
        const revertedRecipe = {
            ...snapshot,
            id: recipeId,
            lastModified: new Date().toISOString()
        };
        
        // Create new version entry for the revert
        createVersion(revertedRecipe, currentRecipe);
        
        // Save the reverted recipe
        if (window.RecipeStorage) {
            window.RecipeStorage.saveRecipe(revertedRecipe);
        }
        
        console.log(`RecipeVersioning: Reverted recipe ${recipeId} to version ${versionNumber}`);
        
        return revertedRecipe;
    }

    /**
     * Get all recipes sorted by usage
     * @param {number} limit - Maximum number of recipes to return
     * @returns {Array<Object>} Recipes with usage counts
     */
    function getMostUsedRecipes(limit = 10) {
        const allUsage = JSON.parse(localStorage.getItem(RECIPE_USAGE_KEY) || '{}');
        
        const usageCounts = Object.entries(allUsage)
            .map(([recipeId, usages]) => ({
                recipeId: recipeId,
                containerCount: usages.length,
                lastUsed: usages.length > 0 
                    ? usages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp
                    : null
            }))
            .sort((a, b) => b.containerCount - a.containerCount)
            .slice(0, limit);
        
        return usageCounts;
    }

    /**
     * Export version history and usage data
     * @returns {string} JSON export
     */
    function exportData() {
        return JSON.stringify({
            versionHistory: JSON.parse(localStorage.getItem(VERSION_HISTORY_KEY) || '{}'),
            containerUsage: JSON.parse(localStorage.getItem(RECIPE_USAGE_KEY) || '{}'),
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Import version history and usage data
     * @param {string} jsonData - JSON data to import
     * @param {boolean} merge - Whether to merge with existing data
     */
    function importData(jsonData, merge = true) {
        try {
            const data = JSON.parse(jsonData);
            
            if (merge) {
                // Merge with existing data
                const existingHistory = JSON.parse(localStorage.getItem(VERSION_HISTORY_KEY) || '{}');
                const existingUsage = JSON.parse(localStorage.getItem(RECIPE_USAGE_KEY) || '{}');
                
                // Merge histories
                for (const [recipeId, history] of Object.entries(data.versionHistory || {})) {
                    if (existingHistory[recipeId]) {
                        // Merge, avoiding duplicates by version number
                        const existingVersions = new Set(existingHistory[recipeId].map(v => v.version));
                        for (const entry of history) {
                            if (!existingVersions.has(entry.version)) {
                                existingHistory[recipeId].push(entry);
                            }
                        }
                    } else {
                        existingHistory[recipeId] = history;
                    }
                }
                
                // Merge usage
                for (const [recipeId, usages] of Object.entries(data.containerUsage || {})) {
                    if (existingUsage[recipeId]) {
                        const existingContainers = new Set(existingUsage[recipeId].map(u => u.containerId));
                        for (const usage of usages) {
                            if (!existingContainers.has(usage.containerId)) {
                                existingUsage[recipeId].push(usage);
                            }
                        }
                    } else {
                        existingUsage[recipeId] = usages;
                    }
                }
                
                localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(existingHistory));
                localStorage.setItem(RECIPE_USAGE_KEY, JSON.stringify(existingUsage));
            } else {
                // Replace existing data
                localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(data.versionHistory || {}));
                localStorage.setItem(RECIPE_USAGE_KEY, JSON.stringify(data.containerUsage || {}));
            }
            
            console.log('RecipeVersioning: Data imported successfully');
        } catch (error) {
            console.error('RecipeVersioning: Import failed:', error);
            throw error;
        }
    }

    // Public API
    return {
        initialize,
        createVersion,
        getVersionHistory,
        getVersion,
        compareVersions,
        revertToVersion,
        trackContainerUsage,
        getContainersByRecipe,
        getRecipeForContainer,
        getRecipeUsageStats,
        getMostUsedRecipes,
        exportData,
        importData
    };
})();
