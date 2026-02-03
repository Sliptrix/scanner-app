/**
 * Inventory Lookup Service
 *
 * Provides flexible input resolution for strains, owners, stages, media types, and locations.
 * Accepts any input format (ID, abbreviation, or full name) and resolves to canonical values.
 *
 * Integrates with window.appState for reference data and updates automatically when data changes.
 */

window.InventoryLookupService = (function() {
    'use strict';

    // Private lookup maps (built from appState reference tables)
    let strainMap = new Map();       // input → { id, name, abbreviation }
    let ownerMap = new Map();        // input → { code, name, alternates }
    let stageMap = new Map();        // input → { id, name }
    let mediaMap = new Map();        // input → { code, name }
    let locationSet = new Set();     // valid location names (lowercase)
    let locationMap = new Map();     // lowercase → canonical name

    // Abbreviation data (loaded from Excel or JSON)
    let strainAbbreviations = {};    // strain ID → abbreviation
    let ownerAlternates = {};        // owner code → [alternates]

    let initialized = false;
    let lastBuildTime = 0;

    /**
     * Initialize the lookup service
     * Should be called after data is loaded into appState
     */
    function initialize() {
        console.log('🔍 InventoryLookupService initializing...');

        // Build lookup maps from current appState
        buildLookupMaps();

        // Subscribe to data updates
        subscribeToDataUpdates();

        initialized = true;
        console.log('✅ InventoryLookupService initialized');

        return true;
    }

    /**
     * Build lookup maps from appState reference tables
     */
    function buildLookupMaps() {
        const startTime = Date.now();

        // Clear existing maps
        strainMap.clear();
        ownerMap.clear();
        stageMap.clear();
        mediaMap.clear();
        locationSet.clear();
        locationMap.clear();

        // Build strain lookup map
        buildStrainMap();

        // Build owner lookup map
        buildOwnerMap();

        // Build stage lookup map
        buildStageMap();

        // Build media type lookup map
        buildMediaMap();

        // Build location lookup
        buildLocationMap();

        lastBuildTime = Date.now();
        console.log(`🔍 Lookup maps built in ${lastBuildTime - startTime}ms`);
        console.log(`   Strains: ${strainMap.size} entries`);
        console.log(`   Owners: ${ownerMap.size} entries`);
        console.log(`   Stages: ${stageMap.size} entries`);
        console.log(`   Media: ${mediaMap.size} entries`);
        console.log(`   Locations: ${locationSet.size} entries`);
    }

    /**
     * Build strain lookup map
     * Supports lookup by: ID (number), abbreviation, or full name
     */
    function buildStrainMap() {
        const strainsTable = window.appState.strainsTable || {};

        // Merge abbreviations from appState (from cloud sync) with locally loaded ones
        const cloudAbbreviations = window.appState.strainAbbreviations || {};
        const mergedAbbreviations = { ...strainAbbreviations, ...cloudAbbreviations };

        console.log('=== InventoryLookupService.buildStrainMap DEBUG ===');
        console.log('strainsTable source:', strainsTable);
        console.log('strainsTable keys:', Object.keys(strainsTable));
        console.log('strainsTable entries count:', Object.keys(strainsTable).length);
        console.log('strainAbbreviations count:', Object.keys(mergedAbbreviations).length);

        Object.entries(strainsTable).forEach(([id, name]) => {
            const strainId = String(id);
            const strainName = typeof name === 'object' ? name.name : String(name);
            const abbreviation = mergedAbbreviations[strainId] || generateDefaultAbbreviation(strainName, strainId);

            const strainData = {
                id: strainId,
                name: strainName,
                abbreviation: abbreviation
            };

            // Map by ID (as string, unpadded)
            strainMap.set(strainId, strainData);

            // Also map by padded ID (e.g., "00013" for ID 13) for barcode compatibility
            const numericId = parseInt(strainId, 10);
            if (!isNaN(numericId)) {
                const paddedId = String(numericId).padStart(5, '0');
                if (paddedId !== strainId) {
                    strainMap.set(paddedId, strainData);
                }
            }

            // Map by abbreviation (case-insensitive)
            if (abbreviation) {
                strainMap.set(abbreviation.toLowerCase(), strainData);
            }

            // Map by full name (case-insensitive)
            strainMap.set(strainName.toLowerCase(), strainData);
        });

        console.log('strainMap built with', strainMap.size, 'entries');
        console.log('Sample strainMap entries (first 10):', Array.from(strainMap.entries()).slice(0, 10));
    }

    /**
     * Generate a default abbreviation for a strain if none exists
     * Uses first letters of words + ID
     */
    function generateDefaultAbbreviation(name, id) {
        if (!name) return null;

        // Get first letter of each word, uppercase
        const initials = name
            .split(/[\s\-_]+/)
            .filter(word => word.length > 0)
            .map(word => word[0].toUpperCase())
            .join('');

        return initials + id;
    }

    /**
     * Build owner lookup map
     * Supports lookup by: code, full name, or alternate names
     */
    function buildOwnerMap() {
        const ownersTable = window.appState.ownersTable || {};

        Object.entries(ownersTable).forEach(([code, nameOrObj]) => {
            const ownerCode = String(code);
            const ownerName = typeof nameOrObj === 'object' ? nameOrObj.name : String(nameOrObj);
            // FIX: Ensure alternates is always an array (could be string, array, or undefined)
            let alternates = ownerAlternates[ownerCode];
            if (!alternates) {
                alternates = [];
            } else if (!Array.isArray(alternates)) {
                // Convert single value to array
                alternates = [alternates];
            }

            const ownerData = {
                code: ownerCode,
                name: ownerName,
                alternates: alternates
            };

            // Map by code (case-insensitive)
            ownerMap.set(ownerCode.toLowerCase(), ownerData);

            // Map by full name (case-insensitive)
            if (ownerName) {
                ownerMap.set(ownerName.toLowerCase(), ownerData);
            }

            // Map by alternates (case-insensitive)
            alternates.forEach(alt => {
                if (alt) {
                    ownerMap.set(alt.toLowerCase(), ownerData);
                }
            });
        });

        // Also check strainOwnerMapping for owner codes that might not be in ownersTable
        const strainOwnerMapping = window.appState.strainOwnerMapping || {};
        const ownerCodes = new Set(Object.values(strainOwnerMapping));

        ownerCodes.forEach(code => {
            const normalizedCode = String(code).toLowerCase();
            if (!ownerMap.has(normalizedCode)) {
                // Add owner with code as both code and name
                const ownerData = {
                    code: String(code),
                    name: String(code),
                    alternates: []
                };
                ownerMap.set(normalizedCode, ownerData);
            }
        });
    }

    /**
     * Build stage lookup map
     * Supports lookup by: ID (number) or name
     */
    function buildStageMap() {
        const stagesTable = window.appState.stagesTable || {};

        Object.entries(stagesTable).forEach(([id, name]) => {
            const stageId = String(id);
            const stageName = typeof name === 'object' ? name.name : String(name);

            const stageData = {
                id: stageId,
                name: stageName
            };

            // Map by ID (as string)
            stageMap.set(stageId, stageData);

            // Map by name (case-insensitive)
            stageMap.set(stageName.toLowerCase(), stageData);
        });

        // Add default stages if table is empty
        if (stageMap.size === 0) {
            const defaultStages = {
                '1': 'In Vitro',
                '2': 'Rooted',
                '3': 'Hardened',
                '4': 'Mother',
                '5': 'Discarded',
                '6': 'Acclimated'
            };

            Object.entries(defaultStages).forEach(([id, name]) => {
                const stageData = { id, name };
                stageMap.set(id, stageData);
                stageMap.set(name.toLowerCase(), stageData);
            });
        }
    }

    /**
     * Build media type lookup map
     * Supports lookup by: code or name
     */
    function buildMediaMap() {
        const mediaTypesTable = window.appState.mediaTypesTable || {};

        Object.entries(mediaTypesTable).forEach(([code, name]) => {
            const mediaCode = String(code);
            const mediaName = typeof name === 'object' ? name.name : String(name);

            const mediaData = {
                code: mediaCode,
                name: mediaName
            };

            // Map by code (case-insensitive)
            mediaMap.set(mediaCode.toLowerCase(), mediaData);

            // Map by name (case-insensitive)
            mediaMap.set(mediaName.toLowerCase(), mediaData);
        });

        // Add default media types if table is empty
        if (mediaMap.size === 0) {
            const defaultMedia = {
                'IA': 'Initiation',
                'MA': 'Multiplication',
                'RA': 'Rooting'
            };

            Object.entries(defaultMedia).forEach(([code, name]) => {
                const mediaData = { code, name };
                mediaMap.set(code.toLowerCase(), mediaData);
                mediaMap.set(name.toLowerCase(), mediaData);
            });
        }
    }

    /**
     * Build location lookup
     */
    function buildLocationMap() {
        const locationsTable = window.appState.locationsTable || [];

        locationsTable.forEach(location => {
            if (location) {
                const locName = String(location);
                locationSet.add(locName.toLowerCase());
                locationMap.set(locName.toLowerCase(), locName);
            }
        });
    }

    /**
     * Subscribe to data update events
     */
    function subscribeToDataUpdates() {
        // Listen for strainOwnerMapping updates
        window.addEventListener('strainOwnerMapping:updated', () => {
            console.log('🔍 Data updated, rebuilding lookup maps...');
            buildLookupMaps();
        });

        // Listen for reference data updates from cloud sync
        window.addEventListener('referenceData:updated', (event) => {
            console.log('🔍 Reference data updated from cloud, rebuilding lookup maps...', event.detail);
            buildLookupMaps();
        });

        // Also rebuild when Excel data is loaded
        if (window.DataUtils && window.DataUtils.onDataLoaded) {
            window.DataUtils.onDataLoaded(() => {
                console.log('🔍 Excel data loaded, rebuilding lookup maps...');
                buildLookupMaps();
            });
        }
    }

    /**
     * Load abbreviation data from external source
     * @param {Object} data - Object with strainAbbreviations and ownerAlternates
     */
    function loadAbbreviationData(data) {
        if (data.strainAbbreviations) {
            strainAbbreviations = data.strainAbbreviations;
            console.log(`Loaded ${Object.keys(strainAbbreviations).length} strain abbreviations`);
        }

        if (data.ownerAlternates) {
            // FIX: Ensure all values are arrays to prevent forEach errors
            ownerAlternates = {};
            Object.entries(data.ownerAlternates).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    ownerAlternates[key] = value;
                } else if (value) {
                    // Convert single value to array
                    ownerAlternates[key] = [value];
                }
            });
            console.log(`Loaded ${Object.keys(ownerAlternates).length} owner alternate names`);
        }

        // Rebuild maps with new abbreviation data
        if (initialized) {
            buildLookupMaps();
        }
    }

    // ==================== PUBLIC RESOLVE METHODS ====================

    /**
     * Resolve strain input to canonical data
     * @param {string|number} input - Strain ID, abbreviation, or name
     * @returns {Object|null} { id, name, abbreviation } or null if not found
     */
    function resolveStrain(input) {
        if (input === null || input === undefined || input === '') return null;

        // Ensure maps are built
        if (strainMap.size === 0 && window.appState.isDataLoaded) {
            buildLookupMaps();
        }

        const key = String(input).toLowerCase().trim();

        // Try direct lookup first
        let found = strainMap.get(key);
        if (found) {
            return found;
        }

        // If input looks numeric, also try unpadded version (e.g., "00013" -> "13")
        const numericId = parseInt(input, 10);
        if (!isNaN(numericId) && numericId > 0) {
            const unpaddedKey = String(numericId);
            found = strainMap.get(unpaddedKey);
            if (found) {
                return found;
            }
        }

        // If not found in map but input is a valid numeric ID, accept it as a new/unknown strain
        // This allows newer strains that haven't been synced yet to still work
        if (!isNaN(numericId) && numericId > 0 && String(numericId) === String(input).trim()) {
            console.log(`InventoryLookupService: Strain ID ${numericId} not in reference data, accepting as valid numeric ID`);
            return {
                id: String(numericId),
                name: `Strain #${numericId}`,
                abbreviation: null
            };
        }

        return null;
    }

    /**
     * Resolve strain input to canonical name only
     * @param {string|number} input - Strain ID, abbreviation, or name
     * @returns {string|null} Canonical strain name or null
     */
    function resolveStrainName(input) {
        const result = resolveStrain(input);
        return result ? result.name : null;
    }

    /**
     * Resolve strain input to ID only
     * @param {string|number} input - Strain ID, abbreviation, or name
     * @returns {string|null} Strain ID or null
     */
    function resolveStrainId(input) {
        const result = resolveStrain(input);
        return result ? result.id : null;
    }

    /**
     * Resolve owner input to canonical data
     * @param {string} input - Owner code, name, or alternate
     * @returns {Object|null} { code, name, alternates } or null if not found
     */
    function resolveOwner(input) {
        if (!input) return null;

        // Ensure maps are built
        if (ownerMap.size === 0 && window.appState.isDataLoaded) {
            buildLookupMaps();
        }

        const key = String(input).toLowerCase();
        return ownerMap.get(key) || null;
    }

    /**
     * Resolve owner input to canonical code only
     * @param {string} input - Owner code, name, or alternate
     * @returns {string|null} Canonical owner code or null
     */
    function resolveOwnerCode(input) {
        const result = resolveOwner(input);
        return result ? result.code : null;
    }

    /**
     * Resolve owner input to canonical name only
     * @param {string} input - Owner code, name, or alternate
     * @returns {string|null} Canonical owner name or null
     */
    function resolveOwnerName(input) {
        const result = resolveOwner(input);
        return result ? result.name : null;
    }

    /**
     * Resolve stage input to canonical data
     * @param {string|number} input - Stage ID or name
     * @returns {Object|null} { id, name } or null if not found
     */
    function resolveStage(input) {
        if (input === null || input === undefined || input === '') return null;

        // Ensure maps are built
        if (stageMap.size === 0 && window.appState.isDataLoaded) {
            buildLookupMaps();
        }

        const key = String(input).toLowerCase();
        return stageMap.get(key) || null;
    }

    /**
     * Resolve stage input to canonical name only
     * @param {string|number} input - Stage ID or name
     * @returns {string|null} Canonical stage name or null
     */
    function resolveStageName(input) {
        const result = resolveStage(input);
        return result ? result.name : null;
    }

    /**
     * Resolve stage input to ID only
     * @param {string|number} input - Stage ID or name
     * @returns {string|null} Stage ID or null
     */
    function resolveStageId(input) {
        const result = resolveStage(input);
        return result ? result.id : null;
    }

    /**
     * Resolve media type input to canonical data
     * @param {string} input - Media code or name
     * @returns {Object|null} { code, name } or null if not found
     */
    function resolveMediaType(input) {
        if (!input) return null;

        // Handle N/A case
        const upperInput = String(input).toUpperCase();
        if (upperInput === 'N/A' || upperInput === 'NA' || upperInput === 'NONE') {
            return { code: 'N/A', name: 'N/A' };
        }

        // Ensure maps are built
        if (mediaMap.size === 0 && window.appState.isDataLoaded) {
            buildLookupMaps();
        }

        const key = String(input).toLowerCase();
        return mediaMap.get(key) || null;
    }

    /**
     * Resolve media type input to canonical name only
     * @param {string} input - Media code or name
     * @returns {string|null} Canonical media name or null
     */
    function resolveMediaName(input) {
        const result = resolveMediaType(input);
        return result ? result.name : null;
    }

    /**
     * Resolve media type input to code only
     * @param {string} input - Media code or name
     * @returns {string|null} Media code or null
     */
    function resolveMediaCode(input) {
        const result = resolveMediaType(input);
        return result ? result.code : null;
    }

    /**
     * Resolve location input (exact match, case-insensitive)
     * @param {string} input - Location name
     * @returns {string|null} Canonical location name or null
     */
    function resolveLocation(input) {
        if (!input) return null;

        // Ensure maps are built
        if (locationSet.size === 0 && window.appState.isDataLoaded) {
            buildLookupMaps();
        }

        const key = String(input).toLowerCase();
        return locationMap.get(key) || null;
    }

    /**
     * Check if a location is valid
     * @param {string} input - Location name
     * @returns {boolean}
     */
    function isValidLocation(input) {
        if (!input) return false;
        return locationSet.has(String(input).toLowerCase());
    }

    /**
     * Resolve all fields of a container input object
     * @param {Object} container - Container with raw input values
     * @returns {Object} Container with resolved canonical values + validation info
     */
    function resolveContainer(container) {
        const resolved = {
            strain: resolveStrain(container.strain),
            owner: resolveOwner(container.owner),
            stage: resolveStage(container.stage),
            location: resolveLocation(container.location),
            mediaType: resolveMediaType(container.mediaType || container.media),
            errors: [],
            warnings: []
        };

        // Track validation errors
        if (container.strain && !resolved.strain) {
            resolved.errors.push(`Unknown strain: "${container.strain}"`);
        }
        if (container.owner && !resolved.owner) {
            resolved.warnings.push(`Unknown owner: "${container.owner}" - will be used as-is`);
        }
        if (container.stage && !resolved.stage) {
            resolved.errors.push(`Unknown stage: "${container.stage}"`);
        }
        if (container.location && !resolved.location) {
            resolved.warnings.push(`Unknown location: "${container.location}" - will be used as-is`);
        }
        if ((container.mediaType || container.media) && !resolved.mediaType) {
            resolved.warnings.push(`Unknown media type: "${container.mediaType || container.media}" - will be used as-is`);
        }

        resolved.isValid = resolved.errors.length === 0;
        resolved.hasWarnings = resolved.warnings.length > 0;

        return resolved;
    }

    // ==================== SEARCH / AUTOCOMPLETE METHODS ====================

    /**
     * Search strains by partial match
     * @param {string} query - Search query
     * @param {number} limit - Max results (default 10)
     * @returns {Array} Matching strain objects
     */
    function searchStrains(query, limit = 10) {
        if (!query) return [];

        const q = String(query).toLowerCase();
        const results = [];
        const seen = new Set();

        const strainsTable = window.appState.strainsTable || {};

        Object.entries(strainsTable).forEach(([id, name]) => {
            const strainName = typeof name === 'object' ? name.name : String(name);
            const abbreviation = strainAbbreviations[id] || '';

            if (seen.has(id)) return;

            if (String(id).includes(q) ||
                strainName.toLowerCase().includes(q) ||
                abbreviation.toLowerCase().includes(q)) {

                seen.add(id);
                results.push({
                    id: id,
                    name: strainName,
                    abbreviation: abbreviation
                });
            }

            if (results.length >= limit) return;
        });

        return results.slice(0, limit);
    }

    /**
     * Search owners by partial match
     * @param {string} query - Search query
     * @param {number} limit - Max results (default 10)
     * @returns {Array} Matching owner objects
     */
    function searchOwners(query, limit = 10) {
        if (!query) return [];

        const q = String(query).toLowerCase();
        const results = [];
        const seen = new Set();

        ownerMap.forEach((data, key) => {
            if (seen.has(data.code)) return;

            if (data.code.toLowerCase().includes(q) ||
                (data.name && data.name.toLowerCase().includes(q))) {

                seen.add(data.code);
                results.push(data);
            }
        });

        return results.slice(0, limit);
    }

    // ==================== GETTER METHODS ====================

    /**
     * Get all strains
     * @returns {Array} Array of strain objects
     */
    function getAllStrains() {
        const strainsTable = window.appState.strainsTable || {};
        return Object.entries(strainsTable).map(([id, name]) => ({
            id: id,
            name: typeof name === 'object' ? name.name : String(name),
            abbreviation: strainAbbreviations[id] || null
        }));
    }

    /**
     * Get all owners
     * @returns {Array} Array of owner objects
     */
    function getAllOwners() {
        const seen = new Set();
        const results = [];

        ownerMap.forEach((data) => {
            if (!seen.has(data.code)) {
                seen.add(data.code);
                results.push(data);
            }
        });

        return results;
    }

    /**
     * Get all stages
     * @returns {Array} Array of stage objects
     */
    function getAllStages() {
        const seen = new Set();
        const results = [];

        stageMap.forEach((data) => {
            if (!seen.has(data.id)) {
                seen.add(data.id);
                results.push(data);
            }
        });

        return results.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    }

    /**
     * Get all media types
     * @returns {Array} Array of media type objects
     */
    function getAllMediaTypes() {
        const seen = new Set();
        const results = [];

        mediaMap.forEach((data) => {
            if (!seen.has(data.code)) {
                seen.add(data.code);
                results.push(data);
            }
        });

        return results;
    }

    /**
     * Get all locations
     * @returns {Array} Array of location names
     */
    function getAllLocations() {
        return Array.from(locationMap.values());
    }

    /**
     * Check if the service is initialized
     * @returns {boolean}
     */
    function isInitialized() {
        return initialized;
    }

    /**
     * Force rebuild of lookup maps
     */
    function rebuild() {
        buildLookupMaps();
    }

    // Public API
    return {
        // Initialization
        initialize: initialize,
        isInitialized: isInitialized,
        rebuild: rebuild,
        loadAbbreviationData: loadAbbreviationData,

        // Strain resolution
        resolveStrain: resolveStrain,
        resolveStrainName: resolveStrainName,
        resolveStrainId: resolveStrainId,

        // Owner resolution
        resolveOwner: resolveOwner,
        resolveOwnerCode: resolveOwnerCode,
        resolveOwnerName: resolveOwnerName,

        // Stage resolution
        resolveStage: resolveStage,
        resolveStageName: resolveStageName,
        resolveStageId: resolveStageId,

        // Media type resolution
        resolveMediaType: resolveMediaType,
        resolveMediaName: resolveMediaName,
        resolveMediaCode: resolveMediaCode,

        // Location resolution
        resolveLocation: resolveLocation,
        isValidLocation: isValidLocation,

        // Container resolution (all fields at once)
        resolveContainer: resolveContainer,

        // Search / autocomplete
        searchStrains: searchStrains,
        searchOwners: searchOwners,

        // Getters
        getAllStrains: getAllStrains,
        getAllOwners: getAllOwners,
        getAllStages: getAllStages,
        getAllMediaTypes: getAllMediaTypes,
        getAllLocations: getAllLocations
    };
})();

console.log('📦 InventoryLookupService module loaded');
