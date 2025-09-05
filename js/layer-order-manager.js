// Handles the default ordering of different map layers based on their types and properties
//
// IMPORTANT: Map Layer Rendering Order Logic
// ========================================
// In Mapbox GL JS, layers are rendered in the order they appear in the style - 
// layers added later appear ABOVE layers added earlier. This creates a visual stacking effect.
//
// Config Order vs Visual Order:
// - Config order: weather-satellite (1st), modis-terra-truecolor (2nd), viirs-night-lights (3rd)  
// - Visual result: weather-satellite (top), modis-terra-truecolor (middle), viirs-night-lights (bottom)
//
// The getInsertPosition() function determines WHERE in the existing layer stack to insert each new layer.
// For same-type layers, we want layers defined first in the config to appear visually ABOVE later ones.

// Define the order of different layer types (higher order = rendered later = appears on top)
const LAYER_TYPE_ORDER = {
    'terrain': 1,
    'style': 10,
    'vector': 20,
    'tms': 30,
    'wms': 30,      // WMS layers - positioned between TMS and CSV
    'wmts': 30,     // WMTS layers - positioned after WMS but before CSV
    'csv': 40,
    'geojson': 50,
    'img': 60,
    'markers': 70,
    'layer-group': 80
};

// Define specific layer ID ordering overrides
const LAYER_ID_ORDER = {
    'osm': 25,  // OSM should appear below other TMS layers
    'mask': 200 // Mask should appear on top of everything
};

/**
 * Calculates the rendering position for a new layer
 * @param {Object} map - Mapbox map instance
 * @param {string} type - Layer type
 * @param {string|null} layerType - Specific layer type
 * @param {Object} currentGroup - Current layer group being processed
 * @param {Array} orderedGroups - All layer groups in their defined order
 * @returns {string|null} - The ID of the layer to insert before, or null for append
 */
function getInsertPosition(map, type, layerType, currentGroup, orderedGroups) {

    const layers = map.getStyle().layers;
    
    console.log(`[LayerOrder] Getting insert position for layer: ${currentGroup?.id || 'unknown'} (type: ${type})`);
    
    // Find current layer's index in the configuration
    const currentGroupIndex = orderedGroups.findIndex(group => 
        group.id === currentGroup?.id
    );

    console.log(`[LayerOrder] Current layer config index: ${currentGroupIndex}`);
    console.log(`[LayerOrder] Ordered groups:`, orderedGroups.map(g => g.id));

    // Get the order value for the current layer type
    // For vector layers, use the main type ('vector') not the sublayer type ('fill', 'line', etc.)
    const lookupType = (type === 'vector') ? type : (layerType || type);
    const currentTypeOrder = LAYER_TYPE_ORDER[lookupType] || Infinity;
    
    // Special case for layer ID-specific ordering
    const currentIdOrder = currentGroup && LAYER_ID_ORDER[currentGroup.id];
    const orderValue = currentIdOrder !== undefined ? currentIdOrder : currentTypeOrder;
    
    console.log(`[LayerOrder] Layer order value: ${orderValue} (lookupType: ${lookupType} = ${currentTypeOrder}, id override: ${currentIdOrder})`);
    
    // Show current layer stack from bottom to top
    console.log(`[LayerOrder] Total layers in style: ${layers.length}`);
    
    const allLayersWithMetadata = layers.filter(l => l.metadata);
    console.log(`[LayerOrder] Layers with metadata:`, allLayersWithMetadata.length);
    
    const currentLayerStack = layers
        .filter(l => l.metadata?.groupId)
        .map(l => `${l.metadata.groupId} (${l.metadata.layerType})`);
    console.log(`[LayerOrder] Current layer stack (bottom to top):`, currentLayerStack);
    
    // Show all layers with their IDs for debugging
    const allCustomLayers = layers.filter(l => l.metadata?.groupId);
    if (allCustomLayers.length > 0) {
        console.log(`[LayerOrder] Custom layers found:`, allCustomLayers.map(l => ({
            id: l.id,
            groupId: l.metadata.groupId,
            layerType: l.metadata.layerType
        })));
    }


    // For all other cases, go through layers in reverse to find insertion point
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        
        // Skip layers that don't have metadata (likely base layers)
        if (!layer.metadata || !layer.metadata.groupId) {
            // For layers without metadata, try to match by ID instead
            if (LAYER_ID_ORDER[layer.id] !== undefined && currentGroup) {
                // Compare using ID ordering directly
                const layerIdOrder = LAYER_ID_ORDER[layer.id];
                if (layerIdOrder < orderValue) {
                    return layers[i + 1]?.id;
                }
            }
            continue;
        }
        
        const groupId = layer.metadata.groupId;
        const layerGroupIndex = orderedGroups.findIndex(g => g.id === groupId);
        
        // Use explicit layer ID ordering if available
        const layerIdOrder = LAYER_ID_ORDER[groupId];
        
        // Get order value based on type or ID override
        // For vector layers, always use 'vector' as the lookup type regardless of sublayer type
        const existingLayerLookupType = layer.metadata.layerType === 'fill' || 
                                       layer.metadata.layerType === 'line' || 
                                       layer.metadata.layerType === 'circle' || 
                                       layer.metadata.layerType === 'symbol' 
                                       ? 'vector' 
                                       : layer.metadata.layerType;
        const thisLayerOrderValue = layerIdOrder !== undefined 
            ? layerIdOrder 
            : LAYER_TYPE_ORDER[existingLayerLookupType] || 0;
        
        // If this layer should be rendered before our new layer
        // For same-type layers: layers defined first in config (lower index) should appear on top visually
        // This means we insert new layers BEFORE existing layers with lower config index (earlier defined layers)
        if (thisLayerOrderValue < orderValue || 
            (thisLayerOrderValue === orderValue && layerGroupIndex < currentGroupIndex)) {
            
            console.log(`[LayerOrder] Found insertion point: before layer group ${groupId} (config index ${layerGroupIndex})`);
            
            // Find the FIRST layer of this group (go backwards to find the start of the group)
            let firstLayerOfGroup = i;
            while (firstLayerOfGroup > 0 && layers[firstLayerOfGroup - 1].metadata?.groupId === groupId) {
                firstLayerOfGroup--;
            }
            
            console.log(`[LayerOrder] Returning beforeId: ${layers[firstLayerOfGroup].id} (first layer of group ${groupId})`);
            return layers[firstLayerOfGroup].id;
        }
    }

    // Fallback: look for specific layer IDs to insert before based on type
    if (type === 'vector' || type === 'geojson') {
        // Insert vector/geojson layers before labels
        const labelsLayers = layers.filter(layer => 
            layer.type === 'symbol' && (
                layer.id.includes('label') || 
                layer.id.includes('place-') || 
                layer.id.includes('-name') ||
                layer.id === 'poi-label'
            )
        );
        
        if (labelsLayers.length > 0) {
            return labelsLayers[0].id;
        }
    }

    // If no position found, append to the end
    console.log(`[LayerOrder] No insertion point found, appending to end (will appear on top)`);
    return null;
}

/**
 * Shows the current layer stack order from bottom to top for debugging
 * @param {Object} map - Mapbox map instance
 */
function logLayerStack(map, label = '') {
    if (!map) return;
    
    const layers = map.getStyle().layers;
    const layerStack = layers
        .filter(l => l.metadata?.groupId)
        .map((l, index) => `${index}: ${l.metadata.groupId} (${l.metadata.layerType})`);
    
    console.log(`[LayerOrder] ${label} - Layer stack (bottom to top):`, layerStack);
}

/**
 * Fixes the layer ordering for specific layers that need to be in a certain order
 * @param {Object} map - Mapbox map instance
 */
function fixLayerOrdering(map) {
    if (!map) {
        console.error('Map instance not provided to fixLayerOrdering');
        return;
    }
}

// Export the function so it can be called from elsewhere
export { getInsertPosition, LAYER_TYPE_ORDER, LAYER_ID_ORDER, fixLayerOrdering, logLayerStack };