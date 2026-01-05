export class TransitLayerStyles {
    static getRouteOutlineLayer(sourceName, sourceLayer) {
        return {
            id: 'routes',
            type: 'line',
            source: sourceName,
            'source-layer': sourceLayer,
            filter: ['==', ['get', 'feature_type'], 'route'],
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': [
                    'case',
                    ['==', ['get', 'fare_type'], 'Premium'], '#8b5cf6',
                    ['any',
                        ['==', ['get', 'fare_type'], 'AC'],
                        ['==', ['get', 'ac_service'], true]
                    ], '#3b82f6',
                    ['==', ['get', 'fare_type'], 'Express'], '#f97316',
                    ['==', ['get', 'fare_type'], 'Regular'], '#ef4444',
                    ['==', ['to-string', ['get', 'is_live']], 'true'], '#22c55e',
                    '#10b981'
                ],
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,
                    16, 6
                ],
                'line-opacity': 0.5
            }
        };
    }

    static getRouteHighlightLayer(sourceName, sourceLayer) {
        return {
            id: 'routes-highlight',
            type: 'line',
            source: sourceName,
            'source-layer': sourceLayer,
            filter: ['all',
                ['==', ['get', 'feature_type'], 'route'],
                ['==', ['get', 'route_id'], '']
            ],
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#fbbf24',
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 6,
                    16, 12
                ],
                'line-opacity': 0.9,
                'line-blur': 1
            }
        };
    }

    static getStopsLayer(sourceName, sourceLayer) {
        return {
            id: 'stops',
            type: 'circle',
            source: sourceName,
            'source-layer': sourceLayer,
            filter: ['==', ['get', 'feature_type'], 'stop'],
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, [
                        '+',
                        2,
                        [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false], 6,
                            ['boolean', ['feature-state', 'hover'], false], 3,
                            0
                        ]
                    ],
                    16, [
                        '+',
                        4,
                        [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false], 6,
                            ['boolean', ['feature-state', 'hover'], false], 3,
                            0
                        ]
                    ]
                ],
                'circle-color': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], '#22c55e',
                    ['boolean', ['feature-state', 'hover'], false], '#22c55e',
                    '#f59e0b'
                ],
                'circle-stroke-width': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 3,
                    ['boolean', ['feature-state', 'hover'], false], 2,
                    1
                ],
                'circle-stroke-color': '#ffffff',
                'circle-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 1,
                    0.9
                ]
            }
        };
    }

    static getStopHighlightLayer(sourceName, sourceLayer) {
        return {
            id: 'stops-highlight',
            type: 'circle',
            source: sourceName,
            'source-layer': sourceLayer,
            filter: ['all',
                ['==', ['get', 'feature_type'], 'stop'],
                ['==', ['get', 'id'], '']
            ],
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 12,
                    16, 20
                ],
                'circle-color': '#22c55e',
                'circle-stroke-width': 4,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.8,
                'circle-blur': 0.5
            }
        };
    }

    static getStopDebugLabelsLayer(sourceName, sourceLayer) {
        return {
            id: 'stops-debug-labels',
            type: 'symbol',
            source: sourceName,
            'source-layer': sourceLayer,
            filter: ['==', ['get', 'feature_type'], 'stop'],
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-offset': [0, 2],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2
            }
        };
    }

    static getBusLocationsLayer() {
        return {
            id: 'bus-locations',
            type: 'circle',
            source: 'bus-locations',
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 6,
                    16, 12
                ],
                'circle-color': [
                    'case',
                    ['get', 'isHalted'], '#f59e0b',
                    '#22c55e'
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
            }
        };
    }

    static getBusLabelsLayer() {
        return {
            id: 'bus-labels',
            type: 'symbol',
            source: 'bus-locations',
            layout: {
                'text-field': ['get', 'vehicleNo'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 10,
                'text-offset': [0, -2],
                'text-anchor': 'bottom'
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 1
            }
        };
    }

    static getBusLocationSource() {
        return {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        };
    }
}
