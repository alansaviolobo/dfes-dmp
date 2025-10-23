// Atlas Layer Registry - Central source of truth for all atlas layers
// Handles cross-atlas layer management and ID normalization

export class LayerRegistry {
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

        // After all atlases are loaded, resolve cross-atlas references
        this._resolveCrossAtlasReferences();
        
        // Sort registry by layer ID for consistent logging
        const sortedRegistry = Array.from(this._registry.entries())
            .sort(([a], [b]) => a.localeCompare(b));
        console.log(`[LayerRegistry] Initialized with ${this._registry.size} layers from ${this._atlasLayers.size} atlases`, sortedRegistry);
        
        
        this._initialized = true;
    }

    /**
     * Resolve cross-atlas references after all atlases are loaded
     */
    _resolveCrossAtlasReferences() {
        // Find all layers that are incomplete (missing title, type, etc.)
        const incompleteLayers = [];
        for (const [layerId, layer] of this._registry.entries()) {
            if (!layer.title && !layer.type && layer.id.includes('-')) {
                incompleteLayers.push({ layerId, layer });
            }
        }
        
        // Try to resolve each incomplete layer
        for (const { layerId, layer } of incompleteLayers) {
            const potentialAtlas = layer.id.split('-')[0];
            const originalId = layer.id.substring(potentialAtlas.length + 1);
            
            // Try to find the original layer in the potential atlas
            const crossAtlasLayers = this._atlasLayers.get(potentialAtlas);
            if (crossAtlasLayers) {
                const originalLayer = crossAtlasLayers.find(l => l.id === originalId);
                if (originalLayer) {
                    // Found the original layer, update the registry entry
                    const resolvedLayer = {
                        ...originalLayer,
                        id: layer.id, // Keep the cross-atlas ID
                        _crossAtlasReference: true,
                        _originalAtlas: potentialAtlas,
                        _originalId: originalId,
                        _sourceAtlas: layer._sourceAtlas, // Preserve the source atlas
                        _prefixedId: layer._prefixedId // Preserve the prefixed ID
                    };
                    
                    this._registry.set(layerId, resolvedLayer);
                }
            }
        }
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

    /**
     * Get the current atlas ID
     */
    getCurrentAtlas() {
        return this._currentAtlas;
    }

    /**
     * Check if the registry is initialized
     */
    isInitialized() {
        return this._initialized;
    }
}

// Create global layer registry instance
const layerRegistry = new LayerRegistry();

// Make it available globally for backwards compatibility
if (typeof window !== 'undefined') {
    window.layerRegistry = layerRegistry;
}

export { layerRegistry };
