/**
 * Handles the default ordering of different map layers based on their types and properties.
 */

export class LayerOrderManager {
    /**
     * Calculates the rendering position for a new layer using slot-based insertion
     * @param {Object} map - Mapbox map instance
     * @param {string} type - Layer type
     * @param {string|null} layerType - Specific layer type
     * @param {Object} currentGroup - Current layer group being processed
     * @param {Array} orderedGroups - All layer groups in their defined order
     * @returns {string|null} - The slot name to insert into
     */
    static getInsertPosition(map, type, layerType, currentGroup, orderedGroups) {
        if (['tms', 'wmts', 'wms', 'img', 'raster-style-layer'].includes(type)) {
            return 'bottom';
        }

        if (['vector', 'geojson', 'csv'].includes(type)) {
            return 'middle';
        }

        return 'middle';
    }

    /**
     * Shows the current layer stack order from bottom to top for debugging
     * @param {Object} map - Mapbox map instance
     * @param {string} label - Debug label
     */
    static logLayerStack(map, label = '') {
        if (!map) return;

        const layers = map.getStyle().layers;
        const layerStack = layers
            .filter(l => l.metadata?.groupId)
            .map((l, index) => `${index}: ${l.metadata.groupId} (${l.metadata.layerType})`);

        console.log(`[LayerOrder] ${label} - Layer stack (bottom to top):`, layerStack);
    }
}
