/**
 * ConfigManager - Central configuration specification and validation for map layers
 *
 * Defines all supported layer types and their configuration schemas.
 * Used by MapLayerControl and MapboxAPI for rendering different layer types.
 */

export const LAYER_TYPES = {
    STYLE: 'style',
    VECTOR: 'vector',
    TMS: 'tms',
    WMTS: 'wmts',
    WMS: 'wms',
    GEOJSON: 'geojson',
    CSV: 'csv',
    IMG: 'img',
    RASTER_STYLE: 'raster-style-layer',
    LAYER_GROUP: 'layer-group'
};

export const LAYER_SPECIFICATIONS = {
    [LAYER_TYPES.STYLE]: {
        name: 'Style Layer',
        description: 'Controls visibility of layers already present in the base Mapbox style',
        required: ['id', 'type', 'layers'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'style', description: 'Layer type identifier' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            layers: {
                type: 'array',
                description: 'Array of sublayers to control',
                items: {
                    sourceLayer: { type: 'string', description: 'Source layer name from style' },
                    title: { type: 'string', description: 'Display name for sublayer' }
                }
            },
            style: { type: 'object', description: 'Paint/layout properties to apply when visible' }
        },
        example: {
            id: 'contours',
            type: 'style',
            title: 'Contour Lines',
            layers: [
                { sourceLayer: 'contour', title: 'Contours' },
                { sourceLayer: 'contour_index', title: 'Index Contours' }
            ]
        }
    },

    [LAYER_TYPES.VECTOR]: {
        name: 'Vector Tile Layer',
        description: 'Vector tiles (.pbf/.mvt) with configurable styling',
        required: ['id', 'type', 'url', 'sourceLayer'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'filter', 'inspect', 'opacity', 'maxzoom'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'vector', description: 'Layer type identifier' },
            url: { type: 'string', description: 'Vector tile URL template with {z}/{x}/{y}' },
            sourceLayer: { type: 'string', description: 'Source layer name within vector tiles' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            style: { type: 'object', description: 'Mapbox GL style properties (fill-*, line-*, circle-*, text-*)' },
            filter: { type: 'array', description: 'Mapbox GL filter expression' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity multiplier' },
            maxzoom: { type: 'number', default: 22, description: 'Maximum zoom level for tiles' },
            inspect: {
                type: 'object',
                description: 'Feature inspection configuration',
                properties: {
                    id: { type: 'string', description: 'Property to use as feature ID' },
                    title: { type: 'string', description: 'Title for popup' },
                    label: { type: 'string', description: 'Property to use as feature label' },
                    fields: { type: 'array', description: 'Properties to display in popup' }
                }
            }
        },
        example: {
            id: 'villages',
            type: 'vector',
            title: 'Village Boundaries',
            url: 'https://example.com/tiles/{z}/{x}/{y}.pbf',
            sourceLayer: 'villages',
            style: {
                'fill-color': '#f0f0f0',
                'fill-opacity': 0.5,
                'line-color': '#333',
                'line-width': 2
            },
            inspect: {
                title: 'Village Info',
                label: 'name',
                fields: ['population', 'area']
            }
        }
    },

    [LAYER_TYPES.TMS]: {
        name: 'Tile Map Service (Raster)',
        description: 'Raster tile service with XYZ or TMS tiling scheme',
        required: ['id', 'type', 'url'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'opacity', 'scheme', 'maxzoom', 'urlTimeParam'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'tms', description: 'Layer type identifier' },
            url: { type: 'string', description: 'Tile URL template with {z}/{x}/{y}' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            scheme: { type: 'string', enum: ['xyz', 'tms'], default: 'xyz', description: 'Tile coordinate scheme' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity' },
            maxzoom: { type: 'number', default: 22, description: 'Maximum zoom level for tiles' },
            style: { type: 'object', description: 'Raster paint properties (raster-*)' },
            urlTimeParam: { type: 'string', description: 'Time parameter template (e.g., "TIME={time}")' }
        },
        example: {
            id: 'satellite',
            type: 'tms',
            title: 'Satellite Imagery',
            url: 'https://example.com/tiles/{z}/{x}/{y}.png',
            opacity: 0.8,
            maxzoom: 18
        }
    },

    [LAYER_TYPES.WMTS]: {
        name: 'Web Map Tile Service',
        description: 'OGC WMTS standard raster tiles',
        required: ['id', 'type', 'url'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'opacity', 'tileSize', 'maxzoom', 'forceWebMercator', 'urlTimeParam'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'wmts', description: 'Layer type identifier' },
            url: { type: 'string', description: 'WMTS GetTile URL with TileMatrix/TileRow/TileCol parameters' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            tileSize: { type: 'number', default: 256, description: 'Tile size in pixels' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity' },
            maxzoom: { type: 'number', default: 22, description: 'Maximum zoom level' },
            forceWebMercator: { type: 'boolean', description: 'Force conversion to EPSG:3857' },
            style: { type: 'object', description: 'Raster paint properties (raster-*)' },
            urlTimeParam: { type: 'string', description: 'Time parameter template (e.g., "TIME={time}")' }
        },
        example: {
            id: 'nasa-viirs',
            type: 'wmts',
            title: 'NASA VIIRS',
            url: 'https://gibs.earthdata.nasa.gov/wmts/.../TileMatrix={z}/TileRow={y}/TileCol={x}.png',
            urlTimeParam: 'TIME={time}',
            opacity: 0.9
        }
    },

    [LAYER_TYPES.WMS]: {
        name: 'Web Map Service',
        description: 'OGC WMS standard raster service',
        required: ['id', 'type', 'url'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'opacity', 'tileSize', 'srs', 'maxzoom', 'proxyUrl', 'proxyReferer', 'urlTimeParam'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'wms', description: 'Layer type identifier' },
            url: { type: 'string', description: 'WMS GetMap base URL with parameters' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            tileSize: { type: 'number', default: 256, description: 'Tile size for requests' },
            srs: { type: 'string', default: 'EPSG:3857', description: 'Spatial reference system' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity' },
            maxzoom: { type: 'number', default: 22, description: 'Maximum zoom level' },
            proxyUrl: { type: 'string', description: 'Proxy server URL for CORS' },
            proxyReferer: { type: 'string', description: 'Referer header for proxy' },
            style: { type: 'object', description: 'Raster paint properties (raster-*)' },
            urlTimeParam: { type: 'string', description: 'Time parameter template (e.g., "TIME={time}")' }
        },
        example: {
            id: 'weather-radar',
            type: 'wms',
            title: 'Weather Radar',
            url: 'https://example.com/wms?service=WMS&version=1.1.1&request=GetMap&layers=radar&styles=',
            srs: 'EPSG:3857',
            opacity: 0.7
        }
    },

    [LAYER_TYPES.GEOJSON]: {
        name: 'GeoJSON Layer',
        description: 'Vector features in GeoJSON format',
        required: ['id', 'type'],
        requiredOneOf: ['url', 'data'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'filter', 'inspect', 'opacity', 'clustered', 'clusterMaxZoom', 'clusterRadius', 'clusterSeparateBy', 'clusterStyles'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'geojson', description: 'Layer type identifier' },
            url: { type: 'string', description: 'GeoJSON data URL (or .kml file)' },
            data: { type: 'object', description: 'Inline GeoJSON data' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            style: { type: 'object', description: 'Mapbox GL style properties (fill-*, line-*, circle-*, text-*)' },
            filter: { type: 'array', description: 'Mapbox GL filter expression' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity multiplier' },
            clustered: { type: 'boolean', default: false, description: 'Enable point clustering' },
            clusterMaxZoom: { type: 'number', default: 14, description: 'Max zoom for clustering' },
            clusterRadius: { type: 'number', default: 50, description: 'Cluster radius in pixels' },
            clusterSeparateBy: { type: 'string', description: 'Property name to create separate clusters by category' },
            clusterStyles: { type: 'object', description: 'Color mapping for clustered categories' },
            inspect: {
                type: 'object',
                description: 'Feature inspection configuration',
                properties: {
                    id: { type: 'string', description: 'Property to use as feature ID' },
                    title: { type: 'string', description: 'Title for popup' },
                    label: { type: 'string', description: 'Property to use as feature label' },
                    fields: { type: 'array', description: 'Properties to display in popup' }
                }
            }
        },
        example: {
            id: 'poi',
            type: 'geojson',
            title: 'Points of Interest',
            url: 'https://example.com/data.geojson',
            clustered: true,
            clusterSeparateBy: 'category',
            clusterStyles: {
                'restaurant': { color: '#ff0000' },
                'hotel': { color: '#0000ff' }
            },
            style: {
                'circle-radius': 8,
                'circle-color': '#f00'
            }
        }
    },

    [LAYER_TYPES.CSV]: {
        name: 'CSV Layer',
        description: 'Tabular data with latitude/longitude columns',
        required: ['id', 'type'],
        requiredOneOf: ['url', 'data'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'inspect', 'opacity', 'csvParser', 'refresh'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'csv', description: 'Layer type identifier' },
            url: { type: 'string', description: 'CSV data URL' },
            data: { type: 'string', description: 'Inline CSV data' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            style: { type: 'object', description: 'Mapbox GL style properties (circle-*, text-*)' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity multiplier' },
            csvParser: { type: 'function', description: 'Custom CSV parsing function' },
            refresh: { type: 'number', description: 'Auto-refresh interval in milliseconds' },
            inspect: {
                type: 'object',
                description: 'Feature inspection configuration',
                properties: {
                    id: { type: 'string', description: 'Property to use as feature ID' },
                    title: { type: 'string', description: 'Title for popup' },
                    label: { type: 'string', description: 'Property to use as feature label' },
                    fields: { type: 'array', description: 'Properties to display in popup' }
                }
            }
        },
        example: {
            id: 'sensors',
            type: 'csv',
            title: 'Sensor Locations',
            url: 'https://example.com/sensors.csv',
            refresh: 60000,
            style: {
                'circle-radius': 6,
                'circle-color': '#00ff00'
            }
        }
    },

    [LAYER_TYPES.IMG]: {
        name: 'Image Overlay',
        description: 'Single georeferenced image overlay',
        required: ['id', 'type', 'url', 'bounds'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'opacity', 'refresh', 'urlTimeParam'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'img', description: 'Layer type identifier' },
            url: { type: 'string', description: 'Image URL' },
            bounds: { type: 'array', description: 'Bounding box [west, south, east, north]' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            opacity: { type: 'number', min: 0, max: 1, default: 0.85, description: 'Image opacity' },
            refresh: { type: 'number', description: 'Auto-refresh interval in milliseconds' },
            style: { type: 'object', description: 'Raster paint properties (raster-*)' },
            urlTimeParam: { type: 'string', description: 'Time parameter template (e.g., "TIME={time}")' }
        },
        example: {
            id: 'historic-map',
            type: 'img',
            title: 'Historic Map 1906',
            url: 'https://example.com/map.jpg',
            bounds: [73.5, 15.0, 74.5, 16.0],
            opacity: 0.7
        }
    },

    [LAYER_TYPES.RASTER_STYLE]: {
        name: 'Raster Style Layer',
        description: 'Controls existing raster layers in the base map style',
        required: ['id', 'type', 'styleLayer'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked', 'style', 'opacity'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'raster-style-layer', description: 'Layer type identifier' },
            styleLayer: { type: 'string', description: 'Style layer ID to control' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether layer is visible on load' },
            opacity: { type: 'number', min: 0, max: 1, default: 1, description: 'Layer opacity' },
            style: { type: 'object', description: 'Raster paint properties to apply' }
        },
        example: {
            id: 'hillshade-control',
            type: 'raster-style-layer',
            title: 'Hillshade',
            styleLayer: 'hillshade',
            opacity: 0.5
        }
    },

    [LAYER_TYPES.LAYER_GROUP]: {
        name: 'Layer Group',
        description: 'Radio button group to toggle between multiple layers',
        required: ['id', 'type', 'groups'],
        optional: ['title', 'description', 'headerImage', 'attribution', 'initiallyChecked'],
        properties: {
            id: { type: 'string', description: 'Unique layer identifier' },
            type: { type: 'string', value: 'layer-group', description: 'Layer type identifier' },
            title: { type: 'string', description: 'Display name in UI' },
            description: { type: 'string', description: 'Layer description (supports HTML)' },
            headerImage: { type: 'string', description: 'Header image URL for layer card' },
            attribution: { type: 'string', description: 'Data attribution text' },
            initiallyChecked: { type: 'boolean', default: false, description: 'Whether group is visible on load' },
            groups: {
                type: 'array',
                description: 'Array of layer options',
                items: {
                    id: { type: 'string', description: 'Layer ID to toggle' },
                    title: { type: 'string', description: 'Option label' },
                    attribution: { type: 'string', description: 'Source link' },
                    location: { type: 'string', description: 'Location to fly to when selected' }
                }
            }
        },
        example: {
            id: 'basemap-group',
            type: 'layer-group',
            title: 'Base Map',
            groups: [
                { id: 'streets', title: 'Streets' },
                { id: 'satellite', title: 'Satellite' },
                { id: 'terrain', title: 'Terrain' }
            ]
        }
    }
};

export class ConfigManager {
    static getLayerType(config) {
        return config?.type || null;
    }

    static getLayerSpec(type) {
        return LAYER_SPECIFICATIONS[type] || null;
    }

    static getAllLayerTypes() {
        return Object.values(LAYER_TYPES);
    }

    static validateLayerConfig(config) {
        const errors = [];
        const warnings = [];

        if (!config.id) {
            errors.push('Missing required field: id');
        }

        if (!config.type) {
            errors.push('Missing required field: type');
        }

        const spec = this.getLayerSpec(config.type);
        if (!spec) {
            warnings.push(`Unknown layer type: ${config.type}`);
            return { valid: false, errors, warnings };
        }

        spec.required?.forEach(field => {
            if (config[field] === undefined) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        if (spec.requiredOneOf) {
            const hasOne = spec.requiredOneOf.some(field => config[field] !== undefined);
            if (!hasOne) {
                errors.push(`Must have one of: ${spec.requiredOneOf.join(', ')}`);
            }
        }

        Object.keys(config).forEach(key => {
            if (!spec.required?.includes(key) && !spec.optional?.includes(key) && key !== 'type' && key !== 'id') {
                warnings.push(`Unknown property: ${key}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    static getLayerDocumentation(type) {
        const spec = this.getLayerSpec(type);
        if (!spec) return null;

        return {
            name: spec.name,
            description: spec.description,
            required: spec.required || [],
            optional: spec.optional || [],
            properties: spec.properties || {},
            example: spec.example || null
        };
    }

    static generateLayerTemplate(type) {
        const spec = this.getLayerSpec(type);
        if (!spec) return null;

        const template = {
            id: 'my-layer-id',
            type: type
        };

        spec.required?.forEach(field => {
            if (field !== 'id' && field !== 'type') {
                const prop = spec.properties[field];
                if (prop?.default !== undefined) {
                    template[field] = prop.default;
                } else if (prop?.value !== undefined) {
                    template[field] = prop.value;
                } else {
                    template[field] = null;
                }
            }
        });

        return template;
    }
}

export default ConfigManager;
