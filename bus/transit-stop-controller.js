import { BusStop, DataUtils } from './transit-data.js';

export class TransitStopController {
    constructor(mapController, config) {
        this.mapController = mapController;
        this.map = mapController.map;
        this.config = config;

        this.sourceName = config.sourceName;
        this.sourceLayer = config.sourceLayer;

        this.currentStop = null;
        this.currentSelectedStop = null;
        this.currentHighlightedStop = null;
        this.nearestStopMarker = null;
        this.visibleStops = null;
        this.nearbyStops = null;
        this.isSelectingStop = false;

        this.setupStopSelector();
    }

    setupStopSelector() {
        const stopSelectorBtn = document.getElementById('stop-selector-btn');
        const stopDropdown = document.getElementById('stop-dropdown');
        const stopSearchInput = document.getElementById('stop-search-input');

        stopSelectorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleStopDropdown();
        });

        stopSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.filterStopOptions(query);
        });

        stopSearchInput.addEventListener('focus', () => {
            stopSearchInput.value = '';
            this.loadVisibleStops();
        });

        console.log('✅ Stop selector events set up');
    }

    toggleStopDropdown() {
        const dropdown = document.getElementById('stop-dropdown');
        const isHidden = dropdown.classList.contains('hidden');

        if (isHidden) {
            this.showStopDropdown();
        } else {
            this.hideStopDropdown();
        }
    }

    showStopDropdown() {
        const dropdown = document.getElementById('stop-dropdown');
        dropdown.classList.remove('hidden');

        if (!this.visibleStops || this.visibleStops.length === 0) {
            this.loadVisibleStops();
        }

        setTimeout(() => {
            document.getElementById('stop-search-input').focus();
        }, 100);
    }

    hideStopDropdown() {
        const dropdown = document.getElementById('stop-dropdown');
        dropdown.classList.add('hidden');
    }

    async loadVisibleStops() {
        console.log('🔍 Loading visible stops for dropdown...');

        try {
            const bounds = this.map.getBounds();

            const allStopFeatures = this.map.querySourceFeatures(this.sourceName, {
                sourceLayer: this.sourceLayer,
                filter: ['==', ['get', 'feature_type'], 'stop']
            });

            if (!allStopFeatures || allStopFeatures.length === 0) {
                this.displayStopOptions([]);
                return;
            }

            const visibleStops = allStopFeatures
                .filter(feature => {
                    const busStop = new BusStop(feature);
                    if (!busStop.lat || !busStop.lon) return false;
                    return busStop.lon >= bounds.getWest() && busStop.lon <= bounds.getEast() &&
                           busStop.lat >= bounds.getSouth() && busStop.lat <= bounds.getNorth();
                })
                .map(feature => {
                    const busStop = new BusStop(feature);
                    if (this.mapController.userLocation) {
                        busStop.distance = busStop.getDistance(this.mapController.userLocation);
                    } else {
                        busStop.distance = null;
                    }
                    busStop.routeCount = busStop.getRoutesFromTimetable().length;
                    return busStop;
                })
                .sort((a, b) => {
                    if (a.distance !== null && b.distance !== null) {
                        return a.distance - b.distance;
                    } else if (a.distance !== null) {
                        return -1;
                    } else if (b.distance !== null) {
                        return 1;
                    } else {
                        if (a.routeCount !== b.routeCount) {
                            return b.routeCount - a.routeCount;
                        }
                        return a.name.localeCompare(b.name);
                    }
                })
                .slice(0, 50);

            this.visibleStops = visibleStops;
            this.displayStopOptions(visibleStops);

            if (!this.mapController.userLocation && visibleStops.length > 0) {
                console.log(`📍 Loaded ${visibleStops.length} stops (sorted by activity since no location available)`);
            }

        } catch (error) {
            console.error('Error loading visible stops:', error);
            this.displayStopOptions([]);
        }
    }

    displayStopOptions(stops) {
        const stopOptionsList = document.getElementById('stop-options-list');

        if (stops.length === 0) {
            const noLocationMessage = !this.mapController.userLocation ?
                `<div class="px-4 py-3 text-center">
                    <div class="text-gray-400 text-sm mb-2">No stops found in current view</div>
                    <div class="text-xs text-gray-500">Try zooming out or moving the map</div>
                </div>` :
                `<div class="px-4 py-3 text-gray-400 text-sm text-center">
                    No stops found in current view
                </div>`;

            stopOptionsList.innerHTML = noLocationMessage;
            return;
        }

        const currentStopId = this.currentStop?.properties?.id ||
                             this.currentStop?.properties?.stop_id;

        if (stops.length > 0) {
            console.log('🔍 First stop properties:', stops[0].feature?.properties);
            console.log('🔍 First stop displayInfo:', stops[0].getDisplayInfo());
        }

        let headerHTML = '';
        if (!this.mapController.userLocation && stops.length > 0) {
            headerHTML = `
                <div class="px-4 py-2 border-b border-gray-600 text-xs text-gray-400">
                    <div class="flex items-center gap-2">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Sorted by activity (busiest stops first)
                    </div>
                </div>
            `;
        }

        const optionsHTML = stops.map(stop => {
            const isSelected = stop.id === currentStopId;
            const routesInfo = stop.getRoutesFromTimetable();
            const topRoutes = routesInfo.slice(0, 3);
            const displayInfo = stop.getDisplayInfo();

            const towardsStop = stop.getProperty('towards_stop');
            console.log(`🔍 Stop ${stop.name}: towards_stop="${towardsStop}", displayInfo.to="${displayInfo.to}"`);

            return `
                <div class="stop-option ${isSelected ? 'stop-option-selected' : ''}"
                     data-stop-id="${stop.id}">
                    <div class="stop-option-name">${stop.name}</div>
                    <div class="stop-option-details">
                        <span>${routesInfo.length} routes</span>
                        <div class="status-indicator ${stop.hasLiveData ? 'status-live' : 'status-scheduled'}"></div>
                    </div>
                    ${topRoutes.length > 0 ? `
                        <div class="stop-option-routes">
                            ${topRoutes.map(route => {
                                const routeInfo = {
                                    agency: route.agency || 'BEST',
                                    fareType: route.fareType || DataUtils.detectFareTypeFromRoute(route.name)
                                };
                                return DataUtils.getStyledRouteBadge(route.name, routeInfo, 'small');
                            }).join('')}
                            ${routesInfo.length > 3 ? `<span class="text-gray-400 text-xs">+${routesInfo.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                    ${displayInfo.to ? `
                        <div class="stop-option-destinations text-xs text-gray-400 mt-1">
                            <span class="text-gray-500">To:</span> ${displayInfo.to}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        stopOptionsList.innerHTML = headerHTML + optionsHTML;

        stopOptionsList.querySelectorAll('.stop-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const stopId = option.dataset.stopId;
                const stop = stops.find(s => s.id === stopId);
                if (stop) {
                    this.selectStopFromDropdown(stop);
                }
            });
        });
    }

    filterStopOptions(query) {
        if (!this.visibleStops) return;

        const filteredStops = this.visibleStops.filter(stop =>
            stop.name.toLowerCase().includes(query) ||
            stop.description?.toLowerCase().includes(query)
        );

        this.displayStopOptions(filteredStops);
    }

    selectStopFromDropdown(busStop) {
        console.log(`🚏 Selecting stop from dropdown: ${busStop.name}`);

        this.updateStopSelectorButton(busStop);
        this.hideStopDropdown();

        if (this.mapController.clearAllSelections) {
            this.mapController.clearAllSelections();
        }

        this.selectStop(busStop.feature);

        if (busStop.coordinates) {
            this.map.flyTo({
                center: busStop.coordinates,
                zoom: Math.max(15, this.map.getZoom()),
                duration: 1500
            });
        }
    }

    updateStopSelectorButton(busStop) {
        const selectedStopName = document.getElementById('selected-stop-name');

        selectedStopName.innerHTML = `
            <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
            </svg>
            <span>${busStop.name}</span>
        `;
    }

    async findNearestStop() {
        if (!this.mapController.userLocation) return;

        console.log('🔍 Finding nearest bus stop...');

        try {
            if (!this.map || !this.map.isSourceLoaded(this.sourceName)) {
                console.log('⏳ Map source not loaded yet, waiting...');

                await new Promise((resolve) => {
                    const checkSource = () => {
                        if (this.map.isSourceLoaded(this.sourceName)) {
                            resolve();
                        } else {
                            setTimeout(checkSource, 500);
                        }
                    };
                    checkSource();
                });
            }

            this.map.setCenter([this.mapController.userLocation.lng, this.mapController.userLocation.lat]);

            const pixelRadius = 5;
            const center = this.map.project([this.mapController.userLocation.lng, this.mapController.userLocation.lat]);

            const bbox = [
                [center.x - pixelRadius, center.y - pixelRadius],
                [center.x + pixelRadius, center.y + pixelRadius]
            ];

            let features = this.map.queryRenderedFeatures(bbox, {
                layers: ['stops']
            });

            if (!features || features.length === 0) {
                console.log('🔍 No rendered features found, trying source features...');

                features = this.map.querySourceFeatures(this.sourceName, {
                    sourceLayer: this.sourceLayer,
                    filter: ['==', ['get', 'feature_type'], 'stop']
                });

                console.log(`📊 Found ${features.length} total features from source`);

                if (features && features.length > 0) {
                    features = features.filter(feature => {
                        const busStop = new BusStop(feature);
                        if (busStop.lat && busStop.lon) {
                            const distance = DataUtils.calculateDistance(
                                this.mapController.userLocation.lat, this.mapController.userLocation.lng,
                                busStop.lat, busStop.lon
                            );
                            return distance <= 5;
                        }
                        return false;
                    });
                }
            }

            if (!features || features.length === 0) {
                console.log('❌ No stop features found');
                this.showNoStopsMessage();
                return;
            }

            const uniqueFeatures = this.deduplicateFeatures(features);
            console.log(`🚏 Found ${uniqueFeatures.length} unique stop features to analyze`);

            let nearestStop = null;
            let minDistance = Infinity;
            let debugStops = [];

            uniqueFeatures.forEach(feature => {
                const busStop = new BusStop(feature);
                if (busStop.lat && busStop.lon) {
                    const distance = DataUtils.calculateDistance(
                        this.mapController.userLocation.lat, this.mapController.userLocation.lng,
                        busStop.lat, busStop.lon
                    );

                    debugStops.push({
                        name: busStop.name || 'Unknown',
                        distance: distance,
                        lat: busStop.lat,
                        lon: busStop.lon
                    });

                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestStop = feature;
                    }
                }
            });

            console.log('🔍 Nearest stops analysis:', debugStops.sort((a, b) => a.distance - b.distance).slice(0, 5));

            if (nearestStop && minDistance <= 2) {
                console.log(`🚏 Nearest stop found: ${nearestStop.properties.name || 'Unknown'} at ${(minDistance * 1000).toFixed(0)}m`);
                this.selectStop(nearestStop);
                this.highlightNearestStop(nearestStop);
            } else if (nearestStop) {
                console.log(`⚠️ Nearest stop is too far: ${(minDistance * 1000).toFixed(0)}m away`);
                this.showDistantStopMessage(minDistance);
            } else {
                console.log('❌ No valid stops found');
                this.showNoStopsMessage();
            }

        } catch (error) {
            console.error('Error finding nearest stop:', error);
            this.showStopError('Unable to find nearby stops.');
        }
    }

    async findNearestStopManually() {
        console.log('🎯 Manual nearest stop finding triggered...');

        if (!this.mapController.userLocation) {
            console.warn('❌ Cannot find nearest stop: user location not available');
            if (this.mapController.updateLocationStatus) {
                this.mapController.updateLocationStatus('Location required for nearest stop', 'status-scheduled', true);
            }
            return;
        }

        if (this.mapController.clearAllSelections) {
            this.mapController.clearAllSelections();
        }

        if (this.mapController.updateTransitURL) {
            this.mapController.updateTransitURL({ route: null, stop: null });
        }

        await this.findNearestStop();

        if (this.mapController.updateLocationStatus) {
            this.mapController.updateLocationStatus('Nearest stop selected', 'status-live', false);
        }
    }

    async findClosestStopToMapCenter() {
        if (!this.map || !this.map.isSourceLoaded(this.sourceName)) {
            console.log('⏳ Map source not loaded yet, skipping auto-select');
            return;
        }

        if (this.isSelectingStop) {
            console.log('⏳ Stop selection already in progress, skipping');
            return;
        }

        this.isSelectingStop = true;

        try {
            const center = this.map.getCenter();

            const rawFeatures = this.map.querySourceFeatures(this.sourceName, {
                sourceLayer: this.sourceLayer,
                filter: ['==', ['get', 'feature_type'], 'stop']
            });

            if (!rawFeatures || rawFeatures.length === 0) {
                console.log('❌ No stop features found for auto-select');
                return;
            }

            const uniqueFeatures = this.deduplicateFeatures(rawFeatures);

            let closestStop = null;
            let minDistance = Infinity;

            uniqueFeatures.forEach(feature => {
                const busStop = new BusStop(feature);
                if (busStop.lat && busStop.lon) {
                    const distance = DataUtils.calculateDistance(
                        center.lat, center.lng,
                        busStop.lat, busStop.lon
                    );

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStop = feature;
                    }
                }
            });

            if (closestStop) {
                const busStop = new BusStop(closestStop);

                if (!this.currentStop ||
                    this.currentStop.properties?.id !== closestStop.properties?.id) {
                    console.log(`🎯 Auto-selecting closest stop: ${busStop.name} (ID: ${busStop.id}) at ${(minDistance * 1000).toFixed(0)}m from map center`);
                    this.selectStop(closestStop);
                } else {
                    console.log(`🎯 Closest stop unchanged: ${busStop.name}`);
                }
            }
        } catch (error) {
            console.error('❌ Error in findClosestStopToMapCenter:', error);
        } finally {
            this.isSelectingStop = false;
        }
    }

    selectStop(stopFeature) {
        this.currentStop = stopFeature;

        if (this.mapController.clearAllSelections) {
            this.mapController.clearAllSelections();
        }

        const busStop = new BusStop(stopFeature);
        this.currentSelectedStop = busStop;

        this.highlightStop(busStop.id);

        this.displayStopInfo(stopFeature);

        if (this.mapController.loadDepartures) {
            this.mapController.loadDepartures(stopFeature);
        }

        if (this.mapController.updateTransitURL && stopFeature.properties) {
            const stopName = stopFeature.properties.name || stopFeature.properties.stop_name;
            if (stopName) {
                this.mapController.updateTransitURL({ stop: stopName });
            }
        }

        if (this.mapController.startAutoRefresh) {
            this.mapController.startAutoRefresh();
        }
    }

    selectStopFromNearby(busStop) {
        console.log(`🚏 Selecting nearby stop: ${busStop.name}`);

        this.selectStop(busStop.feature);

        if (busStop.coordinates) {
            this.map.flyTo({
                center: busStop.coordinates,
                zoom: Math.max(15, this.map.getZoom()),
                duration: 1500
            });
        }

        this.hideNearbyStopsPanel();

        this.loadNearbyStops(busStop);
    }

    highlightNearestStop(stopFeature) {
        const busStop = new BusStop(stopFeature);
        console.log(`🚏 Found nearest stop: ${busStop.name}`);

        if (this.nearestStopMarker) {
            this.nearestStopMarker.remove();
            this.nearestStopMarker = null;
        }
    }

    displayStopInfo(stopFeature, busStop = null) {
        if (!busStop) {
            busStop = new BusStop(stopFeature);
        }

        this.updateStopSelectorButton(busStop);

        const stopInfoEl = document.getElementById('stop-info');
        const displayInfo = busStop.getDisplayInfo(this.mapController.userLocation);

        const routesWithInfo = busStop.getRoutesFromTimetable();

        stopInfoEl.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-400">Routes:</span>
                        <span class="text-white font-medium">${routesWithInfo.length}</span>
                    </div>

                    ${displayInfo.tripCount ? `
                        <div>
                            <span class="text-gray-400">Daily Trips:</span>
                            <span class="text-white font-medium">${displayInfo.tripCount}</span>
                        </div>
                    ` : ''}

                    ${displayInfo.avgWaitTime ? `
                        <div>
                            <span class="text-gray-400">Avg Wait:</span>
                            <span class="text-white font-medium">${displayInfo.avgWaitTime} min</span>
                        </div>
                    ` : ''}
                </div>

                ${displayInfo.to ? `
                    <div>
                        <div class="text-gray-400 text-sm mb-2">Buses go to:</div>
                        <div class="text-white text-sm bg-gray-700/30 rounded p-3 border-l-4 border-blue-500">
                            ${displayInfo.to}
                        </div>
                    </div>
                ` : ''}

                <div class="flex items-center gap-2 pt-2 border-t border-gray-600">
                    <div class="status-indicator ${displayInfo.hasLiveData ? 'status-live' : 'status-scheduled'}"></div>
                    <span class="text-xs text-gray-400">
                        ${displayInfo.hasLiveData ? 'Live data available' : 'Scheduled data only'}
                    </span>
                </div>
            </div>
        `;

        if (this.mapController.displayInteractiveRoutes) {
            this.mapController.displayInteractiveRoutes(routesWithInfo);
        }

        this.setupBrowseStopsIfNeeded(busStop);
    }

    setupBrowseStopsIfNeeded(busStop) {
        this.loadNearbyStops(busStop);
    }

    async loadNearbyStops(currentStop) {
        console.log('🔍 Loading nearby stops...');

        try {
            const allStopFeatures = this.map.querySourceFeatures(this.sourceName, {
                sourceLayer: this.sourceLayer,
                filter: ['==', ['get', 'feature_type'], 'stop']
            });

            if (!allStopFeatures || allStopFeatures.length === 0) {
                console.warn('No stop features found');
                return;
            }

            const nearbyStops = allStopFeatures
                .map(feature => new BusStop(feature))
                .filter(stop => stop.id !== currentStop.id)
                .map(stop => ({
                    ...stop,
                    distance: this.mapController.userLocation ? stop.getDistance(this.mapController.userLocation) : null
                }))
                .filter(stop => stop.distance === null || stop.distance <= 2)
                .sort((a, b) => {
                    if (a.distance === null && b.distance === null) return 0;
                    if (a.distance === null) return 1;
                    if (b.distance === null) return -1;
                    return a.distance - b.distance;
                })
                .slice(0, 10);

            this.nearbyStops = nearbyStops;
            this.displayNearbyStops(nearbyStops);

        } catch (error) {
            console.error('Error loading nearby stops:', error);
        }
    }

    displayNearbyStops(stops) {
        const nearbyStopsList = document.getElementById('nearby-stops-list');

        if (!nearbyStopsList) {
            console.warn('⚠️ nearby-stops-list element not found in DOM - nearby stops display not available');
            return;
        }

        if (stops.length === 0) {
            nearbyStopsList.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <p class="text-sm">No nearby stops found</p>
                </div>
            `;
            return;
        }

        const stopsHTML = stops.map(stop => {
            const displayInfo = stop.getDisplayInfo(this.mapController.userLocation);

            const routes = stop.getRoutesFromTimetable();
            const topRoutes = routes.slice(0, 3);
            const remainingCount = Math.max(0, routes.length - 3);

            const avgHeadway = displayInfo.avgWaitTime || '15';
            const agencyText = routes.length > 0 ? routes[0].agency || 'BEST' : 'BEST';

            return `
                <div class="nearby-stop-item bg-gray-700/50 rounded p-3 cursor-pointer hover:bg-gray-700 transition-colors"
                     data-stop-id="${stop.id}">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h5 class="font-medium text-white text-sm">${displayInfo.name}</h5>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs text-gray-400">${displayInfo.routeCount} routes</span>
                                <span class="text-gray-500">•</span>
                                <span class="text-xs text-gray-400">~${avgHeadway}min avg</span>
                                <div class="status-indicator status-${displayInfo.hasLiveData ? 'live' : 'scheduled'} scale-75"></div>
                            </div>

                            <div class="text-xs text-gray-500 mb-2">${agencyText}</div>

                            <div class="flex flex-wrap gap-1 mb-2">
                                ${topRoutes.map(route => {
                                    const routeInfo = {
                                        agency: route.agency || 'BEST',
                                        fareType: route.fareType || DataUtils.detectFareTypeFromRoute(route.name)
                                    };
                                    return DataUtils.getStyledRouteBadge(route.name, routeInfo, 'small');
                                }).join('')}
                                ${remainingCount > 0 ?
                                    `<span class="text-gray-400 text-xs">+${remainingCount}</span>` : ''}
                            </div>

                            ${displayInfo.description ? `
                                <div class="text-xs text-gray-400 truncate">${displayInfo.description}</div>
                            ` : ''}

                            ${displayInfo.to ? `
                                <div class="text-xs text-gray-500 mt-1">
                                    <span class="text-gray-600">To:</span> ${displayInfo.to}
                                </div>
                            ` : ''}
                        </div>
                        <button class="select-stop-btn text-green-400 hover:text-green-300 ml-2 flex-shrink-0">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        nearbyStopsList.innerHTML = stopsHTML;

        nearbyStopsList.querySelectorAll('.nearby-stop-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const stopId = item.dataset.stopId;
                const stop = stops.find(s => s.id === stopId);
                if (stop) {
                    this.selectStopFromNearby(stop);
                }
            });
        });
    }

    showNearbyStopsPanel() {
        const panel = document.getElementById('nearby-stops-panel');
        if (panel && panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            console.log('📋 Showing nearby stops panel');
        }
    }

    hideNearbyStopsPanel() {
        const panel = document.getElementById('nearby-stops-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    highlightStop(stopId, isTemporary = false) {
        if (!stopId) return;

        if (isTemporary) {
            console.log(`🎯 Skipping temporary highlight for stop: ${stopId}`);
            return;
        }

        console.log(`🎯 Highlighting stop: ${stopId}`);

        if (this.currentHighlightedStop !== null) {
            try {
                this.map.setFeatureState(
                    {
                        source: this.sourceName,
                        sourceLayer: this.sourceLayer,
                        id: this.currentHighlightedStop
                    },
                    { selected: false }
                );
            } catch (error) {
                console.warn('⚠️ Failed to clear previous selection state:', error);
            }
        }

        try {
            this.map.setFeatureState(
                {
                    source: this.sourceName,
                    sourceLayer: this.sourceLayer,
                    id: stopId
                },
                { selected: true }
            );
            console.log(`🎯 Set selection state for stop: ${stopId}`);
        } catch (error) {
            console.warn('⚠️ Failed to set selection state:', error);
        }

        this.currentHighlightedStop = stopId;
    }

    clearStopHighlight() {
        if (this.currentHighlightedStop !== null) {
            try {
                this.map.setFeatureState(
                    {
                        source: this.sourceName,
                        sourceLayer: this.sourceLayer,
                        id: this.currentHighlightedStop
                    },
                    { selected: false }
                );
                console.log('🎯 Cleared stop selection state');
            } catch (error) {
                console.warn('⚠️ Failed to clear selection state:', error);
            }
        }
        this.currentHighlightedStop = null;
    }

    deduplicateFeatures(features, layerId = null) {
        const seen = new Map();

        for (const feature of features) {
            if (!feature.properties) continue;

            let uniqueId;
            if (layerId === 'stops') {
                uniqueId = feature.properties.id || feature.properties.stop_id || feature.id;
            } else if (layerId === 'routes') {
                uniqueId = feature.properties.route_id || feature.properties.id || feature.id;
            } else {
                uniqueId = feature.properties.id ||
                          feature.properties.stop_id ||
                          feature.properties.route_id ||
                          feature.id;
            }

            if (uniqueId && !seen.has(uniqueId)) {
                seen.set(uniqueId, feature);
            }
        }

        return Array.from(seen.values());
    }

    showStopError(message) {
        console.warn('🚏 Stop error:', message);

        const departureList = document.getElementById('departure-list');
        if (departureList) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-red-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <p>${message}</p>
                    <p class="text-sm mt-1">Try selecting a different area</p>
                </div>
            `;
        }

        if (this.mapController.updateLocationStatus) {
            this.mapController.updateLocationStatus(message, 'status-scheduled', true);
        }
    }

    showNoStopsMessage() {
        console.warn('🚏 No stops found in area');
        this.showStopError('No bus stops found in this area');
    }

    showDistantStopMessage(distance) {
        const distanceText = distance > 1 ?
            `${distance.toFixed(1)}km` :
            `${(distance * 1000).toFixed(0)}m`;

        console.warn(`🚏 Nearest stop is ${distanceText} away`);
        this.showStopError(`Nearest stop is ${distanceText} away. Try moving closer to a bus route.`);
    }
}
