/**
 * Recipe Storage Module
 * Handles all recipe storage, retrieval, import/export functionality
 * Manages localStorage and recipe data persistence
 */

// Note: mediaData.js is loaded separately via script tag

window.RecipeStorage = (function() {
    'use strict';

    // Configuration
    const STORAGE_KEY = 'labRecipes';
    const BACKUP_KEY = 'labRecipesBackup';
    const MAX_BACKUP_COUNT = 5;

    /**
     * Check if localStorage is available
     */
    function isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.error('localStorage is not available:', e);
            return false;
        }
    }

    /**
     * Initialize the recipe storage system
     */
    function initialize() {
        console.log('RecipeStorage initializing...');

        // Check localStorage availability
        if (!isLocalStorageAvailable()) {
            console.error('RecipeStorage: localStorage is not available. Recipe persistence will not work.');
            if (window.UIUtils) {
                UIUtils.showNotification('Warning: Recipe storage is not available. Recipes cannot be saved.', 'warning');
            }
            return;
        }

        // Ensure default recipes are available
        ensureDefaultRecipes();

        // Setup periodic backup
        setupPeriodicBackup();

        console.log('RecipeStorage initialized');
    }

    /**
     * Generate a unique recipe ID
     */
    function generateRecipeId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        return `recipe_${timestamp}_${random}`;
    }

    /**
     * Save a recipe to localStorage
     */
    function saveRecipe(recipeData) {
        // Check localStorage availability
        if (!isLocalStorageAvailable()) {
            const error = new Error('localStorage is not available');
            console.error('saveRecipe:', error);
            throw error;
        }

        try {
            // Validate recipe data
            if (!recipeData.name || !recipeData.mediaType) {
                throw new Error('Recipe must have at least a name and media type');
            }

            // Generate ID if not provided
            if (!recipeData.id) {
                recipeData.id = generateRecipeId();
            }

            // Add metadata
            const recipe = {
                ...RECIPE_TEMPLATE,
                ...recipeData,
                createdDate: recipeData.createdDate || new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            // Get existing recipes
            const recipes = getAllRecipes();

            // Check if recipe already exists (update) or is new
            const existingIndex = recipes.findIndex(r => r.id === recipe.id);

            if (existingIndex >= 0) {
                // Update existing recipe
                recipes[existingIndex] = recipe;
            } else {
                // Add new recipe
                recipes.push(recipe);
            }

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
            
            // Update usage statistics
            updateRecipeUsage(recipe.id);
            
            UIUtils.showNotification(`Recipe "${recipe.name}" saved successfully`, 'success');
            return recipe.id;
            
        } catch (error) {
            console.error('Failed to save recipe:', error);
            UIUtils.showNotification(`Failed to save recipe: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Load a recipe by ID
     */
    function loadRecipe(recipeId) {
        // Check localStorage availability
        if (!isLocalStorageAvailable()) {
            console.error('loadRecipe: localStorage is not available');
            return null;
        }

        try {
            const recipes = getAllRecipes();
            const recipe = recipes.find(r => r.id === recipeId);
            
            if (!recipe) {
                throw new Error(`Recipe with ID ${recipeId} not found`);
            }

            // Update last used date
            recipe.lastUsed = new Date().toISOString();
            saveRecipe(recipe);
            
            return recipe;
            
        } catch (error) {
            console.error('Failed to load recipe:', error);
            UIUtils.showNotification(`Failed to load recipe: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Get all recipes from localStorage
     */
    function getAllRecipes() {
        try {
            const recipesJson = localStorage.getItem(STORAGE_KEY);
            const recipes = recipesJson ? JSON.parse(recipesJson) : [];
            
            // Ensure default recipes are included
            return mergeWithDefaults(recipes);
            
        } catch (error) {
            console.error('Failed to load recipes:', error);
            return Object.values(DEFAULT_RECIPES);
        }
    }

    /**
     * Delete a recipe by ID
     */
    function deleteRecipe(recipeId) {
        try {
            // Don't allow deletion of default recipes
            if (recipeId.startsWith('default_')) {
                UIUtils.showNotification('Cannot delete default recipes', 'warning');
                return false;
            }

            const recipes = getAllRecipes();
            const filteredRecipes = recipes.filter(r => r.id !== recipeId && !r.isTemplate);
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecipes));
            UIUtils.showNotification('Recipe deleted successfully', 'success');
            return true;
            
        } catch (error) {
            console.error('Failed to delete recipe:', error);
            UIUtils.showNotification(`Failed to delete recipe: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Search recipes by various criteria
     */
    function searchRecipes(query) {
        const recipes = getAllRecipes();
        const searchTerm = query.toLowerCase();
        
        return recipes.filter(recipe => {
            return (
                recipe.name.toLowerCase().includes(searchTerm) ||
                recipe.mediaType.toLowerCase().includes(searchTerm) ||
                recipe.volume.toLowerCase().includes(searchTerm) ||
                recipe.basalSalt.type.toLowerCase().includes(searchTerm) ||
                recipe.gellingAgent.type.toLowerCase().includes(searchTerm) ||
                (recipe.notes && recipe.notes.toLowerCase().includes(searchTerm)) ||
                (recipe.tags && recipe.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );
        });
    }

    /**
     * Get recipes filtered by media type
     */
    function getRecipesByMediaType(mediaType) {
        const recipes = getAllRecipes();
        return recipes.filter(recipe => recipe.mediaType === mediaType);
    }

    /**
     * Get recently used recipes
     */
    function getRecentRecipes(limit = 5) {
        const recipes = getAllRecipes();
        return recipes
            .filter(recipe => recipe.lastUsed)
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .slice(0, limit);
    }

    /**
     * Get most used recipes
     */
    function getPopularRecipes(limit = 5) {
        const recipes = getAllRecipes();
        return recipes
            .filter(recipe => recipe.useCount > 0)
            .sort((a, b) => b.useCount - a.useCount)
            .slice(0, limit);
    }

    /**
     * Export recipes to JSON
     */
    function exportRecipes(recipes = null) {
        try {
            const recipesToExport = recipes || getAllRecipes().filter(r => !r.isTemplate);
            
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                recipeCount: recipesToExport.length,
                recipes: recipesToExport
            };
            
            return JSON.stringify(exportData, null, 2);
            
        } catch (error) {
            console.error('Failed to export recipes:', error);
            throw error;
        }
    }

    /**
     * Import recipes from JSON
     */
    function importRecipes(jsonData, options = {}) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validate import data structure
            if (!data.recipes || !Array.isArray(data.recipes)) {
                throw new Error('Invalid recipe import format - missing recipes array');
            }

            const existingRecipes = getAllRecipes().filter(r => !r.isTemplate);
            let importedCount = 0;
            let skippedCount = 0;
            let updatedCount = 0;

            data.recipes.forEach(importedRecipe => {
                try {
                    // Validate required fields
                    if (!importedRecipe.name || !importedRecipe.mediaType) {
                        console.warn('Skipping invalid recipe:', importedRecipe);
                        skippedCount++;
                        return;
                    }

                    // Check for duplicates
                    const existingRecipe = existingRecipes.find(r => 
                        r.name === importedRecipe.name && 
                        r.mediaType === importedRecipe.mediaType
                    );

                    if (existingRecipe && !options.allowDuplicates) {
                        if (options.updateExisting) {
                            // Update existing recipe
                            const updatedRecipe = {
                                ...existingRecipe,
                                ...importedRecipe,
                                id: existingRecipe.id, // Keep original ID
                                createdDate: existingRecipe.createdDate, // Keep original creation date
                                lastModified: new Date().toISOString()
                            };
                            saveRecipe(updatedRecipe);
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                        return;
                    }

                    // Generate new ID for imported recipe
                    const newRecipe = {
                        ...importedRecipe,
                        id: generateRecipeId(),
                        createdDate: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                        isTemplate: false
                    };

                    saveRecipe(newRecipe);
                    importedCount++;
                    
                } catch (error) {
                    console.error('Error importing recipe:', error);
                    skippedCount++;
                }
            });

            const message = `Import complete: ${importedCount} imported, ${updatedCount} updated, ${skippedCount} skipped`;
            UIUtils.showNotification(message, 'success');
            
            return {
                imported: importedCount,
                updated: updatedCount,
                skipped: skippedCount,
                total: data.recipes.length
            };
            
        } catch (error) {
            console.error('Failed to import recipes:', error);
            UIUtils.showNotification(`Import failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Create backup of current recipes
     */
    function createBackup() {
        try {
            const recipes = getAllRecipes().filter(r => !r.isTemplate);
            const backup = {
                timestamp: new Date().toISOString(),
                recipeCount: recipes.length,
                recipes: recipes
            };

            // Get existing backups
            const backupsJson = localStorage.getItem(BACKUP_KEY);
            const backups = backupsJson ? JSON.parse(backupsJson) : [];
            
            // Add new backup
            backups.unshift(backup);
            
            // Keep only the last MAX_BACKUP_COUNT backups
            if (backups.length > MAX_BACKUP_COUNT) {
                backups.splice(MAX_BACKUP_COUNT);
            }
            
            localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
            return backup;
            
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    function restoreFromBackup(backupIndex = 0) {
        try {
            const backupsJson = localStorage.getItem(BACKUP_KEY);
            const backups = backupsJson ? JSON.parse(backupsJson) : [];
            
            if (backupIndex >= backups.length) {
                throw new Error('Backup not found');
            }
            
            const backup = backups[backupIndex];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.recipes));
            
            UIUtils.showNotification(`Restored ${backup.recipeCount} recipes from backup`, 'success');
            return true;
            
        } catch (error) {
            console.error('Failed to restore backup:', error);
            UIUtils.showNotification(`Restore failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Get available backups
     */
    function getBackups() {
        try {
            const backupsJson = localStorage.getItem(BACKUP_KEY);
            return backupsJson ? JSON.parse(backupsJson) : [];
        } catch (error) {
            console.error('Failed to get backups:', error);
            return [];
        }
    }

    /**
     * Clear all recipes (except defaults)
     */
    function clearAllRecipes() {
        try {
            // Create backup before clearing
            createBackup();
            
            // Keep only default recipes
            localStorage.removeItem(STORAGE_KEY);
            
            UIUtils.showNotification('All custom recipes cleared. Backup created.', 'success');
            return true;
            
        } catch (error) {
            console.error('Failed to clear recipes:', error);
            UIUtils.showNotification(`Failed to clear recipes: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Update recipe usage statistics
     */
    function updateRecipeUsage(recipeId) {
        try {
            const recipes = getAllRecipes();
            const recipe = recipes.find(r => r.id === recipeId);
            
            if (recipe && !recipe.isTemplate) {
                recipe.useCount = (recipe.useCount || 0) + 1;
                recipe.lastUsed = new Date().toISOString();
                
                // Save updated recipes without triggering notifications
                const filteredRecipes = recipes.filter(r => !r.isTemplate);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecipes));
            }
            
        } catch (error) {
            console.error('Failed to update recipe usage:', error);
        }
    }

    /**
     * Ensure default recipes are available
     */
    function ensureDefaultRecipes() {
        // Default recipes are included in getAllRecipes() via mergeWithDefaults
        // This ensures they're always available but not stored in localStorage
    }

    /**
     * Merge user recipes with default recipes
     */
    function mergeWithDefaults(userRecipes) {
        const defaultRecipes = Object.values(DEFAULT_RECIPES);
        return [...defaultRecipes, ...userRecipes];
    }

    /**
     * Setup periodic backup (every hour)
     */
    function setupPeriodicBackup() {
        setInterval(() => {
            const recipes = getAllRecipes().filter(r => !r.isTemplate);
            if (recipes.length > 0) {
                createBackup();
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    /**
     * Validate recipe structure
     */
    function validateRecipeStructure(recipe) {
        const requiredFields = ['name', 'mediaType', 'volume'];
        const missing = requiredFields.filter(field => !recipe.hasOwnProperty(field));
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        return true;
    }

    /**
     * Get storage statistics
     */
    function getStorageStats() {
        const recipes = getAllRecipes();
        const userRecipes = recipes.filter(r => !r.isTemplate);
        const backups = getBackups();
        
        return {
            totalRecipes: recipes.length,
            userRecipes: userRecipes.length,
            defaultRecipes: recipes.filter(r => r.isTemplate).length,
            backupCount: backups.length,
            storageUsed: JSON.stringify(userRecipes).length,
            lastBackup: backups.length > 0 ? backups[0].timestamp : null
        };
    }

    // Public API
    return {
        initialize,
        saveRecipe,
        loadRecipe,
        getAllRecipes,
        deleteRecipe,
        searchRecipes,
        getRecipesByMediaType,
        getRecentRecipes,
        getPopularRecipes,
        exportRecipes,
        importRecipes,
        createBackup,
        restoreFromBackup,
        getBackups,
        clearAllRecipes,
        updateRecipeUsage,
        getStorageStats,
        generateRecipeId
    };
})();
