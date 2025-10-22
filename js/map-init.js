import { MapLayerControl } from './map-layer-controls.js';
import { MapFeatureControl } from './map-feature-control.js';
import { MapFeatureStateManager } from './map-feature-state-manager.js';
import { configControl } from './config-control.js';
import { localization } from './localization.js';
import { URLManager } from './url-api.js';
import { permalinkHandler } from './permalink-handler.js';
import { Terrain3DControl } from './3d-control.js';
import { TimeControl } from './timeControl.js';
import { StatePersistence } from './pwa/state-persistence.js';
import { MapAttributionControl } from './map-attribution-control.js';

// Global layer registry - compiles all atlas configurations into a single lookup
// This ensures cross-atlas layers are handled consistently
class LayerRegistry {
    constructor() {
        this._registry = new Map(); // layerId -> layer config
        this._libraryLayers = new Map(); // library layer presets
        this._atlasLayers = new Map(); // atlasId -> array of layer configs
        this._currentAtlas = 'index'; // default atlas
        this._initialized = false;
    }

    async initialize() {
        if (this._initialized) return;
                
        // Load layer library first
        try {
            const libraryResponse = await fetch('/config/_map-layer-presets.json');
            if (libraryResponse.ok) {
                const library = await libraryResponse.json();
                if (library.layers && Array.isArray(library.layers)) {
                    library.layers.forEach(layer => {
                        this._libraryLayers.set(layer.id, layer);
                    });
                }
            }
        } catch (error) {
            console.warn('[LayerRegistry] Failed to load layer library:', error);
        }

        // Load all atlas configurations
        const atlasConfigs = [
            'index', 'goa', 'mumbai', 'bengaluru-flood', 'bombay', 'madras',
            'gurugram', 'maharashtra', 'telangana', 'kerala', 'india', 
            'world', 'historic', 'community', 'mhadei'
        ];
        
        // Create a Set for fast lookup of known atlas IDs
        const knownAtlases = new Set(atlasConfigs);

        for (const atlasId of atlasConfigs) {
            try {
                const response = await fetch(`/config/${atlasId}.atlas.json`);
                if (response.ok) {
                    const config = await response.json();
                    if (config.layers && Array.isArray(config.layers)) {
                        this._atlasLayers.set(atlasId, config.layers);
                        
                        // Register each layer with appropriate ID
                        config.layers.forEach(layer => {
                            const resolvedLayer = this._resolveLayer(layer, atlasId);
                            if (resolvedLayer) {
                                // Check if the layer ID already has an atlas prefix
                                const layerId = resolvedLayer.id;
                                let prefixedId;
                                
                                // If the ID already contains a dash and might be prefixed, check if it's a valid atlas prefix
                                if (layerId.includes('-')) {
                                    const potentialPrefix = layerId.split('-')[0];
                                    // If it's a known atlas prefix, use the ID as-is (it's already prefixed)
                                    if (knownAtlases.has(potentialPrefix)) {
                                        prefixedId = layerId;
                                    } else {
                                        // Not a valid prefix, add the atlas prefix
                                        prefixedId = `${atlasId}-${layerId}`;
                                    }
                                } else {
                                    // No dash, definitely not prefixed
                                    prefixedId = `${atlasId}-${layerId}`;
                                }
                                
                                this._registry.set(prefixedId, {
                                    ...resolvedLayer,
                                    _sourceAtlas: atlasId,
                                    _prefixedId: prefixedId,
                                    // Store the original unprefixed ID for reference
                                    _originalId: layerId
                                });
                                
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn(`[LayerRegistry] Failed to load atlas ${atlasId}:`, error);
            }
        }

        console.log(`[LayerRegistry] Initialized with ${this._registry.size} layers from ${this._atlasLayers.size} atlases`);
        this._initialized = true;
    }

    /**
     * Set the current active atlas
     */
    setCurrentAtlas(atlasId) {
        this._currentAtlas = atlasId;
    }

    /**
     * Resolve a layer reference from library if needed
     */
    _resolveLayer(layer, atlasId) {
        // If layer only has an id, resolve it from library
        if (layer.id && !layer.type) {
            const libraryLayer = this._libraryLayers.get(layer.id);
            if (libraryLayer) {
                return { ...libraryLayer, ...layer };
            }
        }
        return layer;
    }

    /**
     * Get a layer by ID, handling both prefixed and unprefixed IDs
     * @param {string} layerId - The layer ID (can be prefixed with atlas-)
     * @param {string} currentAtlas - The current atlas context (optional)
     * @returns {object|null} The layer configuration
     */
    getLayer(layerId, currentAtlas = null) {
        if (!layerId) return null;

        const contextAtlas = currentAtlas || this._currentAtlas;

        // First, try unprefixed ID in current atlas
        const currentAtlasId = `${contextAtlas}-${layerId}`;
        if (this._registry.has(currentAtlasId)) {
            return this._registry.get(currentAtlasId);
        }

        // Then try the ID as-is (might be prefixed)
        if (this._registry.has(layerId)) {
            return this._registry.get(layerId);
        }

        // Try to find in library
        if (this._libraryLayers.has(layerId)) {
            return this._libraryLayers.get(layerId);
        }

        console.warn(`[LayerRegistry] Layer not found: ${layerId} (context: ${contextAtlas})`);
        return null;
    }

    /**
     * Get all layers for a specific atlas
     */
    getAtlasLayers(atlasId) {
        return this._atlasLayers.get(atlasId) || [];
    }

    /**
     * Search layers across all atlases
     */
    searchLayers(searchTerm, excludeAtlas = null) {
        const results = [];
        const term = searchTerm.toLowerCase();

        for (const [prefixedId, layer] of this._registry.entries()) {
            // Skip layers from excluded atlas
            if (excludeAtlas && layer._sourceAtlas === excludeAtlas) {
                continue;
            }

            // Search in layer properties
            const matches = 
                (layer.id && layer.id.toLowerCase().includes(term)) ||
                (layer.title && layer.title.toLowerCase().includes(term)) ||
                (layer.name && layer.name.toLowerCase().includes(term)) ||
                (layer.description && layer.description.toLowerCase().includes(term)) ||
                (layer.tags && Array.isArray(layer.tags) && 
                 layer.tags.some(tag => tag.toLowerCase().includes(term)));

            if (matches) {
                results.push(layer);
            }
        }

        return results;
    }

    /**
     * Normalize a layer ID for URL serialization
     * Removes atlas prefix if it matches current atlas
     */
    normalizeLayerId(layerId, currentAtlas = null) {
        const contextAtlas = currentAtlas || this._currentAtlas;
        const prefix = `${contextAtlas}-`;
        
        if (layerId.startsWith(prefix)) {
            return layerId.substring(prefix.length);
        }
        
        return layerId;
    }

    /**
     * Get the full prefixed ID for a layer
     */
    getPrefixedLayerId(layerId, atlasId = null) {
        const contextAtlas = atlasId || this._currentAtlas;
        
        // If already prefixed, return as-is
        if (layerId.includes('-')) {
            const potentialPrefix = layerId.split('-')[0];
            if (this._atlasLayers.has(potentialPrefix)) {
                return layerId;
            }
        }
        
        return `${contextAtlas}-${layerId}`;
    }

    /**
     * Check if two layer IDs refer to the same layer (accounting for prefixes)
     */
    isSameLayer(layerId1, layerId2) {
        const layer1 = this.getLayer(layerId1);
        const layer2 = this.getLayer(layerId2);
        
        if (!layer1 || !layer2) return false;
        
        // Compare the base IDs
        const baseId1 = layer1.id || layerId1;
        const baseId2 = layer2.id || layerId2;
        
        return baseId1 === baseId2;
    }
}

// Create global layer registry instance
const layerRegistry = new LayerRegistry();
window.layerRegistry = layerRegistry;

// Function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Function to parse layers from URL parameter
function parseLayersFromUrl(layersParam) {
    if (!layersParam) return [];
    
    
    const layers = [];
    let currentItem = '';
    let braceCount = 0;
    let inQuotes = false;
    let quoteChar = null; // Track which quote character we're inside
    let escapeNext = false;
    
    // Parse the comma-separated string, being careful about JSON objects
    for (let i = 0; i < layersParam.length; i++) {
        const char = layersParam[i];
        
        // Handle escape sequences
        if (escapeNext) {
            currentItem += char;
            escapeNext = false;
            continue;
        }
        
        if (char === '\\') {
            currentItem += char;
            escapeNext = true;
            continue;
        }
        
        // Handle quote toggling - only toggle if we encounter the matching quote type
        if (char === '"' || char === "'") {
            if (!inQuotes) {
                // Starting a quoted string
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar) {
                // Ending a quoted string (matching quote type)
                inQuotes = false;
                quoteChar = null;
            }
            // If we're in quotes but encounter a different quote type, just add it
            currentItem += char;
            continue;
        }
        
        // Track brace depth only when outside quotes
        if (!inQuotes) {
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
            }
        }
        
        // Check for comma separator (only outside braces and quotes)
        if (char === ',' && braceCount === 0 && !inQuotes) {
            // Found a separator, process current item
            const trimmedItem = currentItem.trim();
            if (trimmedItem) {
                if (trimmedItem.startsWith('{') && trimmedItem.endsWith('}')) {
                    try {
                        // Convert single-quoted JSON to double-quoted JSON
                        // First unescape escaped single quotes, then replace single quotes with double quotes
                        const jsonString = trimmedItem.replace(/\\'/g, '\u0001').replace(/'/g, '"').replace(/\u0001/g, "'");
                        const parsedLayer = JSON.parse(jsonString);
                        // Minify the JSON by removing extra whitespace and use single quotes
                        const minifiedItem = JSON.stringify(parsedLayer).replace(/'/g, "\\'").replace(/"/g, "'");
                        layers.push({ ...parsedLayer, _originalJson: minifiedItem });
                    } catch (error) {
                        console.warn('Failed to parse layer JSON:', trimmedItem, error);
                        // Treat as layer ID if JSON parsing fails
                        layers.push({ id: trimmedItem });
                    }
                } else {
                    // Simple layer ID
                    layers.push({ id: trimmedItem });
                }
            }
            currentItem = '';
        } else {
            currentItem += char;
        }
    }
    
    // Process the last item
    const trimmedItem = currentItem.trim();
    if (trimmedItem) {
        if (trimmedItem.startsWith('{') && trimmedItem.endsWith('}')) {
            try {
                // Convert single-quoted JSON to double-quoted JSON
                // First unescape escaped single quotes, then replace single quotes with double quotes
                const jsonString = trimmedItem.replace(/\\'/g, '\u0001').replace(/'/g, '"').replace(/\u0001/g, "'");
                const parsedLayer = JSON.parse(jsonString);
                // Minify the JSON by removing extra whitespace and use single quotes
                const minifiedItem = JSON.stringify(parsedLayer).replace(/'/g, "\\'").replace(/"/g, "'");
                layers.push({ ...parsedLayer, _originalJson: minifiedItem });
            } catch (error) {
                console.warn('Failed to parse layer JSON:', trimmedItem, error);
                // Treat as layer ID if JSON parsing fails
                layers.push({ id: trimmedItem });
            }
        } else {
            // Simple layer ID
            layers.push({ id: trimmedItem });
        }
    }
    
    return layers;
}

// Function to check if URL needs prettification (has URL-encoded parameters)
function needsURLPrettification() {
    const currentURL = window.location.href;
    return currentURL.includes('%2C') || currentURL.includes('%7B') || currentURL.includes('%7D') || currentURL.includes('%22');
}

// Helper function to get available config files
async function getAvailableConfigs() {
    // Return a list of known config files based on the file structure
    // This could be made dynamic by fetching a directory listing in the future
    return ['index', 'maharashtra', 'community', 'historic', 'bombay', 'mumbai', 'madras', 'gurugram', 'bengaluru-flood'].join(', ');
}

// Helper function to try loading a layer from a different config file
async function tryLoadCrossConfigLayer(layerId, layerConfig) {
    
    // Parse the layer ID to extract potential config prefix
    const dashIndex = layerId.indexOf('-');
    if (dashIndex === -1) return null;
    
    const configPrefix = layerId.substring(0, dashIndex);
    const originalLayerId = layerId.substring(dashIndex + 1);
    
    
    // Try to load the config file
    try {
        const configPath = `config/${configPrefix}.atlas.json`;
        const configResponse = await fetch(configPath);
        
        if (!configResponse.ok) {
            return null;
        }
        
        const crossConfig = await configResponse.json();
        
        // Look for the layer in the cross-config
        if (crossConfig.layers && Array.isArray(crossConfig.layers)) {
            const foundLayer = crossConfig.layers.find(layer => layer.id === originalLayerId);
            
            if (foundLayer) {
                
                // Create a merged layer with the prefixed ID and source config info
                return {
                    ...foundLayer,
                    id: layerId, // Keep the prefixed ID
                    title: `${foundLayer.title} (${configPrefix})`, // Add config source to title
                    _sourceConfig: configPrefix,
                    _originalId: originalLayerId,
                    // Preserve important URL-specific properties
                    ...(layerConfig._originalJson && { _originalJson: layerConfig._originalJson }),
                    ...(layerConfig.initiallyChecked !== undefined && { initiallyChecked: layerConfig.initiallyChecked }),
                    ...(layerConfig.opacity !== undefined && { opacity: layerConfig.opacity })
                };
            }
        }
        
        // Also check if we need to load the cross-config's library
        try {
            const libraryResponse = await fetch('config/_map-layer-presets.json');
            const layerLibrary = await libraryResponse.json();
            
            // Look for the original layer ID in the main library
            const libraryLayer = layerLibrary.layers.find(lib => lib.id === originalLayerId);
            
            if (libraryLayer) {
                
                return {
                    ...libraryLayer,
                    id: layerId, // Keep the prefixed ID
                    title: `${libraryLayer.title} (${configPrefix})`, // Add config source to title
                    _sourceConfig: configPrefix,
                    _originalId: originalLayerId,
                    // Preserve important URL-specific properties
                    ...(layerConfig._originalJson && { _originalJson: layerConfig._originalJson }),
                    ...(layerConfig.initiallyChecked !== undefined && { initiallyChecked: layerConfig.initiallyChecked }),
                    ...(layerConfig.opacity !== undefined && { opacity: layerConfig.opacity })
                };
            }
        } catch (libraryError) {
        }
        
        return null;
        
    } catch (error) {
        return null;
    }
}

// Function to load configuration
async function loadConfiguration() {
    // Initialize the layer registry first
    await layerRegistry.initialize();
    
    // Check for permalink first - this takes precedence over direct URL parameters
    const permalinkParams = await permalinkHandler.checkForPermalink();
    
    if (permalinkParams) {
        // Apply the resolved permalink URL and let the normal parameter parsing handle it
        permalinkHandler.applyPermalinkToURL(permalinkParams);
        
        // Use the resolved parameters directly
        var configParam = permalinkParams.atlas;
        var layersParam = permalinkParams.layers;
    } else {
        // Check if a specific config is requested via URL parameter
        var configParam = getUrlParameter('atlas');
        var layersParam = getUrlParameter('layers');
    }
    
    let configPath = 'config/index.atlas.json';
    let config;
    let atlasId = 'index'; // Track which atlas we're using
    
    // If a config parameter is provided, determine how to handle it
    if (configParam) {
        // Check if the config parameter is a JSON string
        if (configParam.startsWith('{') && configParam.endsWith('}')) {
            try {
                config = JSON.parse(configParam); // Parse JSON directly
                
                // Minify the JSON by removing whitespace and rewrite the URL
                const minifiedJson = JSON.stringify(config);
                if (minifiedJson !== configParam) {
                    // Update the URL with minified JSON without URL encoding
                    const url = new URL(window.location);
                    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
                    const otherParams = new URLSearchParams(url.search);
                    otherParams.delete('atlas'); // Remove existing atlas param
                    
                    // Build the new URL manually to avoid URL encoding the JSON
                    let newUrl = baseUrl;
                    if (otherParams.toString()) {
                        newUrl += '?' + otherParams.toString() + '&atlas=' + minifiedJson;
                    } else {
                        newUrl += '?atlas=' + minifiedJson;
                    }
                    
                    // Add hash if it exists
                    if (url.hash) {
                        newUrl += url.hash;
                    }
                    
                    window.history.replaceState({}, '', newUrl);
                }
                            } catch (error) {
                console.error('Failed to parse atlas JSON from URL parameter:', error);
                throw new Error('Invalid JSON in atlas parameter');
            }
        }
        // Check if the config parameter is a URL
        else if (configParam.startsWith('http://') || configParam.startsWith('https://')) {
            configPath = configParam; // Use the URL directly
            atlasId = 'custom'; // Mark as custom atlas
        } else {
            configPath = `config/${configParam}.atlas.json`; // Treat as local file
            atlasId = configParam; // Use the config name as atlas ID
        }
    }
    
    // Load the configuration file (only if we didn't parse JSON directly)
    if (!config) {
        const configResponse = await fetch(configPath);
        config = await configResponse.json();
    }
    
    // Set current atlas in registry
    layerRegistry.setCurrentAtlas(atlasId);
    
            // Parse layers from URL parameter if provided
        if (layersParam) {
            const urlLayers = parseLayersFromUrl(layersParam);
            
            // Set URL layers to be visible by default and maintain order
            if (urlLayers.length > 0) {
                // Set initiallyChecked to true for all URL layers
                const processedUrlLayers = urlLayers.map(layer => ({
                    ...layer,
                    initiallyChecked: true,
                    // Preserve the original JSON for custom layers
                    ...(layer._originalJson && { _originalJson: layer._originalJson })
                }));
                
                
                // When URL layers are specified, set ALL existing layers to initiallyChecked: false
                // This ensures only URL-specified layers are visible
                const existingLayers = config.layers || [];
                const urlLayerIds = new Set(processedUrlLayers.map(l => l.id));
                
                // Reset all existing layers to not be initially checked
                existingLayers.forEach(layer => {
                    if (!urlLayerIds.has(layer.id)) {
                        layer.initiallyChecked = false;
                    }
                });
                            
            // Create minified layers parameter for URL rewriting
            const minifiedLayersParam = processedUrlLayers.map(layer => {
                return layer._originalJson || layer.id;
            }).join(',');
            
            // Check if we need to create a pretty URL (either layers changed or URL has encoded params)
            const shouldPrettifyURL = minifiedLayersParam !== layersParam || needsURLPrettification();
            
            if (shouldPrettifyURL) {
                const url = new URL(window.location);
                const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
                const otherParams = new URLSearchParams(url.search);
                otherParams.delete('layers'); // Remove existing layers param
                
                // Build a clean, pretty URL without URL encoding the layers parameter
                let newUrl = baseUrl;
                const params = [];
                
                // Add other parameters first (these may be URL-encoded)
                const otherParamsString = otherParams.toString();
                if (otherParamsString) {
                    params.push(otherParamsString);
                }
                
                // Add layers parameter without URL encoding to keep it readable
                if (minifiedLayersParam) {
                    params.push('layers=' + minifiedLayersParam);
                }
                
                // Build the final URL
                if (params.length > 0) {
                    newUrl += '?' + params.join('&');
                }
                
                // Add hash if it exists
                if (url.hash) {
                    newUrl += url.hash;
                }
                
                // Update to ensure we have a pretty URL
                window.history.replaceState({}, '', newUrl);
            }
            
            // Merge URL layers while preserving the original config order and respecting URL ordering
            const urlLayersMap = new Map(processedUrlLayers.map(l => [l.id, l]));
            
            // Build final layers array
            const finalLayers = [...existingLayers];
            
            // Process URL layers in the order they appear in the URL
            let lastInsertedIndex = -1;
            
            processedUrlLayers.forEach((urlLayer, urlIndex) => {
                const existingIndex = finalLayers.findIndex(layer => layer.id === urlLayer.id);
                
                if (existingIndex !== -1) {
                    // Merge existing layer with URL layer properties (preserving all config properties while adding URL-specific ones)
                    finalLayers[existingIndex] = { 
                        ...finalLayers[existingIndex], 
                        ...urlLayer,
                        // Ensure critical URL properties are preserved
                        ...(urlLayer._originalJson && { _originalJson: urlLayer._originalJson }),
                        ...(urlLayer.initiallyChecked !== undefined && { initiallyChecked: urlLayer.initiallyChecked }),
                        ...(urlLayer.opacity !== undefined && { opacity: urlLayer.opacity })
                    };
                    lastInsertedIndex = existingIndex;
                } else {
                    // This is a new layer - insert it in the right position based on URL order
                    let insertPosition;
                    
                    if (lastInsertedIndex !== -1) {
                        // Insert after the last processed URL layer
                        insertPosition = lastInsertedIndex + 1;
                    } else {
                        // First new layer - find where to insert based on previous URL layers
                        let insertAfterIndex = -1;
                        
                        // Look for the previous URL layer in the URL list
                        for (let i = urlIndex - 1; i >= 0; i--) {
                            const prevUrlLayer = processedUrlLayers[i];
                            const prevLayerIndex = finalLayers.findIndex(layer => layer.id === prevUrlLayer.id);
                            if (prevLayerIndex !== -1) {
                                insertAfterIndex = prevLayerIndex;
                                break;
                            }
                        }
                        
                        insertPosition = insertAfterIndex !== -1 ? insertAfterIndex + 1 : 0;
                    }
                    
                    // Insert the new layer
                    finalLayers.splice(insertPosition, 0, urlLayer);
                    lastInsertedIndex = insertPosition;
                }
            });
            
            config.layers = finalLayers;
            
        }
    }

    // Load defaults
    try {
        const configDefaultsResponse = await fetch('config/_defaults.json');
        const configDefaults = await configDefaultsResponse.json();
        
        // Merge defaults with anyoverrides in config
        config.defaults = config.defaults ? 
            deepMerge(configDefaults, config.defaults) : 
            configDefaults;
    } catch (error) {
        console.warn('Default configuration values not found or invalid:', error);
    }

    // Process each layer in the config using the layer registry
    if (config.layers && Array.isArray(config.layers)) {
        const validLayers = [];
        const invalidLayers = [];
        
        // Process layers one by one
        for (const layerConfig of config.layers) {
            // If the layer only has an id (or minimal properties), look it up using the registry
            if (layerConfig.id && !layerConfig.type) {
                // Try to resolve the layer from the registry
                // This handles both current atlas layers and cross-atlas references
                let resolvedLayer = layerRegistry.getLayer(layerConfig.id, atlasId);
                
                if (resolvedLayer) {
                    // Merge the resolved layer with any custom overrides from config
                    // Preserve important URL-specific properties
                    validLayers.push({ 
                        ...resolvedLayer, 
                        ...layerConfig,
                        // Ensure these critical properties are preserved
                        ...(layerConfig._originalJson && { _originalJson: layerConfig._originalJson }),
                        ...(layerConfig.initiallyChecked !== undefined && { initiallyChecked: layerConfig.initiallyChecked }),
                        ...(layerConfig.opacity !== undefined && { opacity: layerConfig.opacity }),
                        // Store normalized ID for URL serialization
                        _normalizedId: layerRegistry.normalizeLayerId(layerConfig.id, atlasId)
                    });
                } else {
                    // Layer not found in registry - check if it came from URL
                    if (layerConfig.initiallyChecked === true) {
                        console.warn(`Unknown layer ID from URL: "${layerConfig.id}" - ignoring.`);
                        invalidLayers.push(layerConfig.id);
                    } else {
                        // For non-URL layers, keep them as-is (they might be fully defined custom layers)
                        validLayers.push(layerConfig);
                    }
                }
            } else {
                // If it's a fully defined layer, return as is
                validLayers.push(layerConfig);
            }
        }
        
        config.layers = validLayers;
        
        // If we found invalid layers from URL, update the URL to remove them
        if (invalidLayers.length > 0 && layersParam) {
            console.warn(`Removing invalid layer IDs from URL: ${invalidLayers.join(', ')}`);
            
            // Get the remaining valid layers that were originally from URL
            const validUrlLayers = validLayers.filter(layer => layer.initiallyChecked === true);
            
            // Reconstruct the layers parameter with only valid layers
            const newLayersParam = validUrlLayers.map(layer => {
                return layer._originalJson || layer._normalizedId || layer.id;
            }).join(',');
            
            // Update the URL
            const url = new URL(window.location);
            const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
            const otherParams = new URLSearchParams(url.search);
            otherParams.delete('layers');
            
            let newUrl = baseUrl;
            if (newLayersParam) {
                // Only add layers parameter if there are valid layers
                if (otherParams.toString()) {
                    newUrl += '?' + otherParams.toString() + '&layers=' + newLayersParam;
                } else {
                    newUrl += '?layers=' + newLayersParam;
                }
            } else {
                // No valid layers left, just add other parameters if any
                if (otherParams.toString()) {
                    newUrl += '?' + otherParams.toString();
                }
            }
            
            // Add hash if it exists
            if (url.hash) {
                newUrl += url.hash;
            }
            
            window.history.replaceState({}, '', newUrl);
        }
    }
    
    // Load and apply localized UI strings
    localization.loadStrings(config);
    
    // Final check: prettify URL if it still has encoded parameters (e.g., terrain parameter)
    if (needsURLPrettification()) {
        const url = new URL(window.location);
        const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
        const params = new URLSearchParams(url.search);
        
        // Manually build pretty URL without re-encoding
        let newUrl = baseUrl;
        const prettyParams = [];
        
        for (const [key, value] of params.entries()) {
            if (key === 'layers') {
                // Keep layers parameter unencoded for readability
                prettyParams.push(`${key}=${value}`);
            } else {
                // For other parameters, we can allow minimal encoding if needed
                prettyParams.push(`${key}=${value}`);
            }
        }
        
        if (prettyParams.length > 0) {
            newUrl += '?' + prettyParams.join('&');
        }
        
        // Add hash if it exists
        if (url.hash) {
            newUrl += url.hash;
        }
        
        window.history.replaceState({}, '', newUrl);
    }
    
    return config;
}

// Helper function to deep merge objects
function deepMerge(target, source) {
    const output = Object.assign({}, target);
    
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1Ijoib3NtaW5kaWEiLCJhIjoiY202czRpbWdpMDNyZjJwczJqZXdkMGR1eSJ9.eQQf--msfqtZIamJN-KKVQ';

// Default map options
const defaultMapOptions = {
    container: 'map',
    style: 'mapbox://styles/planemad/cm3gyibd3004x01qz08rohcsg',
    center: [73.9414, 15.4121],
    zoom: 9.99,
    hash: true,
    attributionControl: false
};

// Initialize the map with the configuration
async function initializeMap() {
    const config = await loadConfiguration();
    const layers = config.layers || [];
    
    // Apply map settings from config if available
    const mapOptions = { ...defaultMapOptions };
    if (config.map) {
        // Apply all properties from config.map to mapOptions
        Object.assign(mapOptions, config.map);
    }
    
    const map = new mapboxgl.Map(mapOptions);

    // Make map accessible globally for debugging
    window.map = map;

    // Add custom attribution control that handles formatting and removes duplicates
    const attributionControl = new MapAttributionControl({
        compact: false
        // Note: customAttribution removed - attributions now come dynamically from layer configs
    });
    map.addControl(attributionControl, 'bottom-right');
    
    // Make attribution control globally accessible
    window.attributionControl = attributionControl;

            // Setup proper cursor handling for map dragging
    map.on('load', () => {
        // Add 3D terrain control (will be initialized after URL manager is ready)
        const terrain3DControl = new Terrain3DControl();
        map.addControl(terrain3DControl, 'top-right');
        
        // Add time control for time-based layers
        const timeControl = new TimeControl();
        map.addControl(timeControl, 'top-right');
        
        // Store global reference for other components
        window.timeControl = timeControl;
        
        // Add debugging method to global scope
        
        const canvas = map.getCanvas();
        
        // Set default cursor
        canvas.style.cursor = 'grab';
        
        // Handle mouse events for proper cursor states
        map.on('mousedown', () => {
            canvas.style.cursor = 'grabbing';
        });
        
        map.on('mouseup', () => {
            canvas.style.cursor = 'grab';
        });
        
        map.on('mouseleave', () => {
            canvas.style.cursor = 'grab';
        });
        
        // Handle drag events
        map.on('dragstart', () => {
            canvas.style.cursor = 'grabbing';
        });
        
        map.on('dragend', () => {
            canvas.style.cursor = 'grab';
        });
        
        // Initialize geolocation (will be connected to URL manager later)
        const geolocationManager = new GeolocationManager(map);
        
        // Make geolocation manager globally accessible
        window.geolocationManager = geolocationManager;
        
        // Add view control
        map.addControl(new ViewControl(), 'top-right');
        

        
        // Initialize centralized state manager (NEW ARCHITECTURE)
        const stateManager = new MapFeatureStateManager(map);
        
        // Enable debug logging temporarily to diagnose layer matching issues
        stateManager.setDebug(true);        
        // Initialize layer control
        const layerControl = new MapLayerControl(layers);
        const container = document.getElementById('layer-controls-container');
        
        // Hide loader and show controls
        document.getElementById('layer-controls-loader').classList.add('hidden');
        document.getElementById('map-layer-filter').classList.remove('hidden');
        container.classList.remove('hidden');
        
        // Initialize layer control with state manager
        layerControl.renderToContainer(container, map);
        layerControl.setStateManager(stateManager);
        
        // Make layer control globally accessible
        window.layerControl = layerControl;
        
        // Initialize the feature control with state manager and config
        const featureControl = new MapFeatureControl({
            position: 'top-left',
            maxHeight: '600px',
            maxWidth: '350px'
        });
        featureControl.addTo(map);
        featureControl.initialize(stateManager, config);
        
        // Make components globally accessible
        window.featureControl = featureControl;
        window.stateManager = stateManager;
                
        // Initialize state persistence and try to restore saved state
        const statePersistence = new StatePersistence();
        const stateRestored = statePersistence.restoreStateOnLoad();
        
        // Initialize URL manager after layer control is ready
        const urlManager = new URLManager(layerControl, map, geolocationManager);
        urlManager.setupLayerControlEventListeners();
        
        // Connect geolocation manager to URL manager
        geolocationManager.urlManager = urlManager;
        
        // Apply URL parameters (including geolocate parameter)
        // Skip URL parameter application if state was restored from localStorage
        if (!stateRestored) {
            urlManager.applyURLParameters();
        } else {
            // If state was restored, still need to apply URL parameters for restored URL
            setTimeout(() => {
                urlManager.applyURLParameters();
            }, 100);
        }
        
        // Initialize state persistence event listeners after URL manager is ready
        statePersistence.initialize();
        
        // Make URL manager globally accessible for ShareLink
        window.urlManager = urlManager;
        
        // Make 3D control globally accessible
        window.terrain3DControl = terrain3DControl;
        
        // Initialize 3D control from URL parameters after URL manager is ready
        terrain3DControl.initializeFromURL();
        
        // Force update localization after DOM elements are ready
        setTimeout(() => {
            localization.forceUpdateUIElements();
        }, 100);
        
        // Set up click listener for geolocate buttons in documentation
        $(document).on('click', '.geolocate', function(e) {
            e.preventDefault();
            if (window.geolocationManager && window.geolocationManager.geolocate) {
                // Trigger the Mapbox geolocation control
                window.geolocationManager.geolocate.trigger();
            }
        });
        
        // Initialize config control after layer control is ready
        configControl.initialize(layerControl);
        
        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl({
            showCompass: true,
            showZoom: true
        }));
        
        // Only set camera position if there's no hash in URL
        if (!window.location.hash) {
            setTimeout(() => {
                // Use config center and zoom if available, otherwise fallback to hardcoded values
                const flyToOptions = {
                    center: config.map?.center || [73.8274, 15.4406],
                    zoom: config.map?.zoom || 9,
                    pitch: 28,
                    bearing: 0,
                    duration: 3000,
                    essential: true,
                    curve: 1.42,
                    speed: 0.6
                };
                map.flyTo(flyToOptions);
            }, 2000);
        }
        
        // Add global keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Toggle layer drawer with '/' key
            if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                // First, check if the event target itself is an input field
                const target = event.target;
                const isTargetInput = target && (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.contentEditable === 'true' ||
                    target.tagName === 'SL-INPUT' ||
                    target.tagName === 'SL-TEXTAREA' ||
                    target.tagName === 'MAPBOX-SEARCH-BOX' ||
                    target.type === 'text' ||
                    target.type === 'search' ||
                    target.type === 'email' ||
                    target.type === 'password' ||
                    target.type === 'number' ||
                    target.type === 'tel' ||
                    target.type === 'url'
                );
                
                if (isTargetInput) {
                    return; // Don't prevent default, let the input handle the key
                }
                // Check if we're in an input field or search box
                const activeElement = document.activeElement;
                
                // Comprehensive check for input fields including shadow DOM
                const isInputField = activeElement && (
                    // Direct input elements
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.contentEditable === 'true' ||
                    activeElement.tagName === 'SL-INPUT' ||
                    activeElement.tagName === 'SL-TEXTAREA' ||
                    activeElement.tagName === 'MAPBOX-SEARCH-BOX' ||
                    
                    // Check if element is inside any input container
                    activeElement.closest('mapbox-search-box') ||
                    activeElement.closest('input') ||
                    activeElement.closest('textarea') ||
                    activeElement.closest('[contenteditable="true"]') ||
                    activeElement.closest('sl-input') ||
                    activeElement.closest('sl-textarea') ||
                    activeElement.closest('sl-select') ||
                    activeElement.closest('sl-combobox') ||
                    
                    // Check if element is inside a shadow DOM input
                    activeElement.closest('*').shadowRoot?.querySelector('input:focus') ||
                    activeElement.closest('*').shadowRoot?.querySelector('textarea:focus') ||
                    
                    // Check for common input-related classes and attributes
                    activeElement.classList.contains('search-input') ||
                    activeElement.classList.contains('geocoder-input') ||
                    activeElement.hasAttribute('data-input') ||
                    activeElement.hasAttribute('role') && activeElement.getAttribute('role') === 'combobox' ||
                    
                    // Check if the element or its parent has input-related properties
                    activeElement.type === 'text' ||
                    activeElement.type === 'search' ||
                    activeElement.type === 'email' ||
                    activeElement.type === 'password' ||
                    activeElement.type === 'number' ||
                    activeElement.type === 'tel' ||
                    activeElement.type === 'url'
                );
                
                // If we're in any input field, don't trigger the shortcut
                if (isInputField) {
                    return; // Don't prevent default, let the input handle the key
                }
                
                // Additional check for Mapbox search box shadow DOM
                const mapboxSearchBox = document.querySelector('mapbox-search-box');
                if (mapboxSearchBox && mapboxSearchBox.shadowRoot) {
                    const shadowInput = mapboxSearchBox.shadowRoot.querySelector('input:focus');
                    if (shadowInput) {
                        return; // Don't prevent default, let the input handle the key
                    }
                }
                
                // Prevent default behavior (e.g., quick search in browsers)
                event.preventDefault();
                
                // Special case: if focused on the layer search input, blur it and toggle
                const isLayerSearchInput = activeElement && activeElement.id === 'layer-search-input';
                
                if (isLayerSearchInput) {
                    // Blur the search input and toggle the drawer
                    activeElement.blur();
                    if (window.drawerStateManager) {
                        window.drawerStateManager.toggle();
                    }
                } else if (window.drawerStateManager) {
                    // Normal case: not in any input field
                    window.drawerStateManager.toggle();
                }
            }
        });
        
        // Emit mapReady event for plugins
        const mapReadyEvent = new CustomEvent('mapReady', {
            detail: { map: map }
        });
        window.dispatchEvent(mapReadyEvent);
    });
}

// Start initialization
window.addEventListener('load', () => {
    // Only call initializeMap() - don't call initializeSearch() directly
    initializeMap().then(() => {
        // Now window.map exists, so we can initialize search
        initializeSearch();
    });
});

// Initialize search box with enhanced functionality
function initializeSearch() {
    // Note: We now need to use the global map variable
    const searchSetup = () => {
        // Check if MapSearchControl is available
        if (typeof MapSearchControl === 'undefined') {
            console.error('MapSearchControl class not found. Make sure map-search-control.js is loaded.');
            return;
        }
        
        // Check if MapFeatureStateManager is available
        if (typeof MapFeatureStateManager === 'undefined') {
            console.error('MapFeatureStateManager class not found. Make sure map-feature-state-manager.js is loaded.');
            return;
        }
        
        // Initialize the feature state manager
        const featureStateManager = new MapFeatureStateManager(window.map);
        
        // Start watching for layer additions
        featureStateManager.watchLayerAdditions();
        
        // Initialize the enhanced search control
        const searchControl = new MapSearchControl(window.map, {
            // You can add custom options here if needed
            proximity: '73.87916,15.26032', // Goa center
            country: 'IN',
            language: 'en'
        });
        
        // Connect the feature state manager to the search control
        searchControl.setFeatureStateManager(featureStateManager);
        
        // Make both globally accessible for debugging
        window.searchControl = searchControl;
        window.featureStateManager = featureStateManager;
        
  };

    // Wait for style to load before setting up search
    if (window.map) {
        window.map.on('style.load', searchSetup);
    } else {
        // If map isn't available yet, set up a listener to check when it becomes available
        const checkMapInterval = setInterval(() => {
            if (window.map) {
                clearInterval(checkMapInterval);
                window.map.on('style.load', searchSetup);
            }
        }, 100);
    }
} 