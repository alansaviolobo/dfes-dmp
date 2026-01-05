import { DataUtils, BusStop, BusRoute } from './transit-data.js';
import { ChaloAPI } from './chalo-api.js';

export class TransitDepartureController {
    constructor(mapController, stopController, config = {}) {
        this.mapController = mapController;
        this.stopController = stopController;
        this.map = mapController.map;

        this.currentStop = null;
        this.currentDepartures = [];
        this.currentAllRoutes = [];
        this.currentDepartureTab = 'live';
        this.currentTrackedRoute = null;
        this.currentHighlightedDepartures = null;

        this.refreshInterval = null;
        this.busLocationInterval = null;

        this.currentCity = config.currentCity || { id: 'mumbai' };
        this.sourceName = config.sourceName || 'transit';
        this.sourceLayer = config.sourceLayer || 'transit';

        this.onRouteHighlight = config.onRouteHighlight || (() => {});
        this.onRouteHighlightClear = config.onRouteHighlightClear || (() => {});
        this.onStopHighlightClear = config.onStopHighlightClear || (() => {});
        this.onRouteSelectionsClear = config.onRouteSelectionsClear || (() => {});
        this.onBusLocationTrackingStop = config.onBusLocationTrackingStop || (() => {});

        this.setupDepartureTabs();
    }

    async loadDepartures(stopFeature) {
        const departureList = document.getElementById('departure-list');
        const lastUpdated = document.getElementById('last-updated');

        try {
            const props = stopFeature.properties;
            const stopName = props.name || props.stop_name || 'Unknown Stop';
            const stopId = props.id || props.stop_id;

            console.log(`🔄 Loading departures for stop: ${stopName} (ID: ${stopId})`);

            this.currentStop = stopFeature;

            if (lastUpdated) {
                lastUpdated.innerHTML = `<span class="animate-pulse">Loading live data...</span>`;
            }

            const busStop = new BusStop(stopFeature);
            const currentTime = new Date();
            const scheduledDepartures = busStop.getUpcomingDepartures(currentTime, 12);

            scheduledDepartures.forEach(departure => {
                if (!departure.vehicleId) {
                    departure.vehicleId = this.generateRealisticVehicleId(departure.agencyName, departure.route);
                }
                departure.isLive = false;
            });

            let liveArrivals = [];
            try {
                liveArrivals = await this.fetchLiveEta(stopFeature);
                console.log(`🟢 Fetched ${liveArrivals.length} live arrivals`);
            } catch (liveError) {
                console.warn('🔴 Could not fetch live data, using scheduled only:', liveError);
            }

            const mergedDepartures = this.mergeLiveAndScheduledDepartures(liveArrivals, scheduledDepartures);

            let dataSource = 'Scheduled data';
            const hasLiveData = mergedDepartures.some(d => d.isLive);
            if (hasLiveData) {
                const liveCount = mergedDepartures.filter(d => d.isLive).length;
                dataSource = `${liveCount} live + scheduled data`;
            }

            console.log(`🚌 Total departures: ${mergedDepartures.length} (${mergedDepartures.filter(d => d.isLive).length} live, ${mergedDepartures.filter(d => !d.isLive).length} scheduled)`);

            this.currentDepartures = mergedDepartures;

            this.displayDepartures(mergedDepartures);

            setTimeout(() => {
                this.setupDepartureRowInteractions();
            }, 100);

            if (lastUpdated) {
                const updateTime = new Date().toLocaleTimeString();
                const liveIndicator = hasLiveData
                    ? '<span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>'
                    : '';
                lastUpdated.innerHTML = `${liveIndicator}${dataSource} • Updated ${updateTime}`;
            }

        } catch (error) {
            console.error('Error loading departures:', error);
            this.showDepartureError();
        }
    }

    async fetchLiveEta(stopFeature) {
        const stopId = stopFeature.properties?.id || stopFeature.properties?.stop_id;
        const city = this.currentCity?.id || 'mumbai';

        return ChaloAPI.fetchLiveEta(
            stopId,
            city,
            this.map,
            this.sourceName,
            this.sourceLayer,
            this.extractAgencyFromRoute.bind(this)
        );
    }

    async fetchBusLocations(routeId) {
        const city = this.currentCity?.id || 'mumbai';
        return ChaloAPI.fetchBusLocations(routeId, city);
    }

    mergeLiveAndScheduledDepartures(liveArrivals, scheduledDepartures) {
        const merged = [];
        const routesWithLiveData = new Set();

        liveArrivals.forEach(live => {
            merged.push(live);
            routesWithLiveData.add(live.route?.toLowerCase());
        });

        scheduledDepartures.forEach(scheduled => {
            const routeKey = scheduled.route?.toLowerCase();

            if (routesWithLiveData.has(routeKey)) {
                const liveForRoute = liveArrivals
                    .filter(l => l.route?.toLowerCase() === routeKey)
                    .sort((a, b) => b.time - a.time);

                if (liveForRoute.length > 0) {
                    const latestLive = liveForRoute[0];
                    const timeDiff = (scheduled.time - latestLive.time) / (1000 * 60);

                    if (timeDiff >= 15) {
                        merged.push(scheduled);
                    }
                }
            } else {
                merged.push(scheduled);
            }
        });

        merged.sort((a, b) => a.time - b.time);

        return merged.slice(0, 20);
    }

    displayDepartures(departures) {
        const liveDepartures = departures.filter(d => d.isLive);
        const scheduledDepartures = departures.filter(d => !d.isLive);

        console.log(`📊 Displaying ${liveDepartures.length} live and ${scheduledDepartures.length} scheduled departures`);

        if (liveDepartures.length === 0 && scheduledDepartures.length > 0) {
            console.log('🔄 No live departures available, switching to scheduled tab');
            this.switchDepartureTab('scheduled');
        } else if (liveDepartures.length > 0) {
            this.switchDepartureTab('live');
        }

        this.displayLiveDepartures(liveDepartures);
        this.displayScheduledDepartures(scheduledDepartures);
        this.displayAllRoutes(departures);
        this.displayLegacyDepartures(departures);
    }

    displayLiveDepartures(departures) {
        const departureList = document.getElementById('live-departure-list');

        if (departures.length === 0) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                    </svg>
                    <p>No live departures available</p>
                    <p class="text-sm mt-1 text-amber-400">Switch to Scheduled tab for timetable data</p>
                </div>
            `;
            return;
        }

        const departureHTML = this.generateDepartureHTML(departures, 'live');
        departureList.innerHTML = departureHTML;
    }

    displayScheduledDepartures(departures) {
        const departureList = document.getElementById('scheduled-departure-list');

        if (departures.length === 0) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                    </svg>
                    <p>No scheduled departures available</p>
                    <p class="text-sm mt-1">Service may have ended for today</p>
                </div>
            `;
            return;
        }

        const departureHTML = this.generateDepartureHTML(departures, 'scheduled');
        departureList.innerHTML = departureHTML;
    }

    displayLegacyDepartures(departures) {
        const departureList = document.getElementById('departure-list');

        if (departures.length === 0) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                    </svg>
                    <p>No departures available</p>
                    <p class="text-sm mt-1">Service may have ended for today</p>
                </div>
            `;
            return;
        }

        const departureHTML = this.generateDepartureHTML(departures, 'legacy');
        departureList.innerHTML = departureHTML;
    }

    displayAllRoutes(departures) {
        const departureList = document.getElementById('all-departure-list');

        if (departures.length === 0) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                    </svg>
                    <p>No routes available</p>
                    <p class="text-sm mt-1">No bus routes serve this stop</p>
                </div>
            `;
            return;
        }

        const routeMap = new Map();
        departures.forEach(departure => {
            const routeKey = departure.routeId || departure.route;
            if (!routeMap.has(routeKey)) {
                routeMap.set(routeKey, {
                    route: departure.route,
                    routeId: departure.routeId,
                    agencyName: departure.agencyName,
                    fareType: departure.fareType,
                    destinations: new Set(),
                    departures: [],
                    liveDepartures: [],
                    scheduledDepartures: []
                });
            }
            const routeData = routeMap.get(routeKey);
            routeData.destinations.add(departure.destination);
            routeData.departures.push(departure);
            if (departure.isLive) {
                routeData.liveDepartures.push(departure);
            } else {
                routeData.scheduledDepartures.push(departure);
            }
        });

        const routes = Array.from(routeMap.values());
        routes.sort((a, b) => {
            const aNum = parseInt(a.route.match(/\d+/)?.[0] || '999');
            const bNum = parseInt(b.route.match(/\d+/)?.[0] || '999');
            return aNum - bNum;
        });

        this.currentAllRoutes = routes;

        const routesHTML = routes.map((route, index) => {
            const nextDeparture = route.departures[0];
            const now = new Date();
            const minutesUntil = Math.ceil((nextDeparture.time - now) / (1000 * 60));

            let timeDisplay = '';
            let timeClass = 'text-white';
            if (minutesUntil <= 0) {
                timeDisplay = 'Due';
                timeClass = 'text-green-400';
            } else if (minutesUntil === 1) {
                timeDisplay = '1 min';
                timeClass = 'text-green-400';
            } else if (minutesUntil <= 5) {
                timeDisplay = `${minutesUntil} min`;
                timeClass = 'text-yellow-400';
            } else {
                timeDisplay = `${minutesUntil} min`;
            }

            const routeInfo = {
                agency: route.agencyName,
                fareType: DataUtils.detectFareTypeFromRoute(route.route)
            };
            const routeBadge = DataUtils.getStyledRouteBadge(route.route, routeInfo, 'medium');

            const destinations = Array.from(route.destinations);
            const destinationsText = destinations.length > 2
                ? `${destinations.slice(0, 2).join(', ')} +${destinations.length - 2}`
                : destinations.join(', ');

            const hasLive = route.liveDepartures.length > 0;
            const statusClass = hasLive ? 'status-live' : 'status-scheduled';
            const statusText = hasLive ? 'Live' : 'Scheduled';

            return `
                <div class="departure-row departure-row-all flex items-center justify-between p-3 rounded transition-all duration-200 ${hasLive ? 'bg-green-900/10 border-l-2 border-green-500' : ''}"
                     data-route-id="${route.routeId || ''}"
                     data-departure-index="all-${index}"
                     data-tab-type="all">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="status-indicator ${statusClass}"></div>
                            ${routeBadge}
                        </div>
                        <div class="text-sm text-gray-300 mb-1">
                            <span class="font-medium">To:</span> ${destinationsText}
                        </div>
                        <div class="text-xs text-gray-400 space-y-0.5">
                            <div>
                                <span class="${hasLive ? 'text-green-400' : ''}">${statusText}</span>
                                <span class="mx-1">•</span>
                                <span>${route.agencyName}</span>
                            </div>
                            <div>
                                ${route.liveDepartures.length > 0 ? `<span class="text-green-400">${route.liveDepartures.length} live</span>` : ''}
                                ${route.liveDepartures.length > 0 && route.scheduledDepartures.length > 0 ? '<span class="mx-1">•</span>' : ''}
                                ${route.scheduledDepartures.length > 0 ? `<span>${route.scheduledDepartures.length} scheduled</span>` : ''}
                                <span class="mx-1">•</span>
                                <span>${route.departures.length} total departures</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-500 mb-1">Next</div>
                        <div class="${timeClass} font-bold text-lg">${timeDisplay}</div>
                    </div>
                </div>
            `;
        }).join('');

        departureList.innerHTML = routesHTML;
    }

    generateDepartureHTML(departures, tabType) {
        return departures.map((departure, index) => {
            const timeStr = departure.time.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            const now = new Date();
            const minutesUntil = Math.ceil((departure.time - now) / (1000 * 60));

            let timeDisplay;
            let timeClass = 'text-white';
            if (minutesUntil <= 0) {
                timeDisplay = 'Due';
                timeClass = 'text-green-400';
            } else if (minutesUntil === 1) {
                timeDisplay = '1 min';
                timeClass = 'text-green-400';
            } else if (minutesUntil <= 5) {
                timeDisplay = `${minutesUntil} min`;
                timeClass = 'text-yellow-400';
            } else {
                timeDisplay = `${minutesUntil} min`;
            }

            const statusClass = departure.isLive ? 'status-live' : 'status-scheduled';
            const statusText = departure.isLive ? 'Live' : 'Scheduled';

            const updatedText = departure.isLive && departure.updatedMinsAgo !== undefined
                ? (departure.updatedMinsAgo < 1 ? 'just now' : `${departure.updatedMinsAgo}m ago`)
                : '';

            const routeInfo = {
                agency: departure.agencyName,
                fareType: DataUtils.detectFareTypeFromRoute(departure.route)
            };
            const routeBadge = DataUtils.getStyledRouteBadge(departure.route, routeInfo, 'medium');

            const tabClass = tabType !== 'legacy' ? `departure-row-${tabType}` : '';
            const tabPrefix = tabType !== 'legacy' ? `${tabType}-` : '';

            const trackingLink = departure.isLive && departure.trackingUrl
                ? `<a href="${departure.trackingUrl}" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 ml-2" title="Track on Chalo">
                     <svg class="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                       <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                       <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                     </svg>
                   </a>`
                : '';

            const freshnessIndicator = departure.isLive
                ? (departure.updatedMinsAgo <= 3
                    ? '<span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" title="Fresh data"></span>'
                    : '<span class="inline-block w-2 h-2 bg-yellow-500 rounded-full ml-1" title="Data may be stale"></span>')
                : '';

            return `
                <div class="departure-row ${tabClass} flex items-center justify-between p-3 rounded transition-all duration-200 ${departure.isLive ? 'bg-green-900/10 border-l-2 border-green-500' : ''}"
                     data-route-id="${departure.routeId || ''}"
                     data-departure-index="${tabPrefix}${index}"
                     data-tab-type="${tabType}"
                     data-tracking-url="${departure.trackingUrl || ''}">
                    <div class="flex items-center gap-3">
                        <div class="status-indicator ${statusClass}"></div>
                        <div>
                            <div class="flex items-center gap-2">
                                ${routeBadge}
                                <span class="text-white font-medium">${departure.destination}</span>
                                ${trackingLink}
                            </div>
                            <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                <span class="${departure.isLive ? 'text-green-400' : ''}">${statusText}</span>
                                ${freshnessIndicator}
                                ${updatedText ? `<span class="text-gray-500">(${updatedText})</span>` : ''}
                                <span>•</span>
                                <span>${departure.agencyName}</span>
                                ${departure.vehicleId ? `
                                    <span>•</span>
                                    <span class="${departure.isLive ? 'text-green-300' : ''}">🚌 ${departure.vehicleId}</span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="${timeClass} font-bold text-lg">${timeDisplay}</div>
                        <div class="text-xs text-gray-400">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    setupDepartureTabs() {
        console.log('🏷️ Setting up departure tabs...');

        const liveTabBtn = document.getElementById('live-tab-btn');
        const scheduledTabBtn = document.getElementById('scheduled-tab-btn');
        const allTabBtn = document.getElementById('all-tab-btn');

        if (liveTabBtn) {
            liveTabBtn.addEventListener('click', () => {
                this.switchDepartureTab('live');
            });
        }

        if (scheduledTabBtn) {
            scheduledTabBtn.addEventListener('click', () => {
                this.switchDepartureTab('scheduled');
            });
        }

        if (allTabBtn) {
            allTabBtn.addEventListener('click', () => {
                this.switchDepartureTab('all');
            });
        }

        this.currentDepartureTab = 'live';

        console.log('✅ Departure tabs set up successfully');
    }

    switchDepartureTab(tabName) {
        console.log(`🔄 Switching to ${tabName} tab`);

        this.currentDepartureTab = tabName;

        const liveTabBtn = document.getElementById('live-tab-btn');
        const scheduledTabBtn = document.getElementById('scheduled-tab-btn');
        const allTabBtn = document.getElementById('all-tab-btn');

        const inactiveClass = 'departure-tab-btn px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-gray-400 hover:text-white hover:bg-gray-700';

        if (tabName === 'live') {
            liveTabBtn.className = 'departure-tab-btn px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-green-400 bg-green-900/30 border border-green-600/50';
            scheduledTabBtn.className = inactiveClass;
            allTabBtn.className = inactiveClass;
        } else if (tabName === 'scheduled') {
            scheduledTabBtn.className = 'departure-tab-btn px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-amber-400 bg-amber-900/30 border border-amber-600/50';
            liveTabBtn.className = inactiveClass;
            allTabBtn.className = inactiveClass;
        } else if (tabName === 'all') {
            allTabBtn.className = 'departure-tab-btn px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 text-blue-400 bg-blue-900/30 border border-blue-600/50';
            liveTabBtn.className = inactiveClass;
            scheduledTabBtn.className = inactiveClass;
        }

        const liveContent = document.getElementById('live-departures');
        const scheduledContent = document.getElementById('scheduled-departures');
        const allContent = document.getElementById('all-departures');

        if (tabName === 'live') {
            liveContent.classList.remove('hidden');
            scheduledContent.classList.add('hidden');
            allContent.classList.add('hidden');
        } else if (tabName === 'scheduled') {
            liveContent.classList.add('hidden');
            scheduledContent.classList.remove('hidden');
            allContent.classList.add('hidden');
        } else if (tabName === 'all') {
            liveContent.classList.add('hidden');
            scheduledContent.classList.add('hidden');
            allContent.classList.remove('hidden');
        }

        setTimeout(() => {
            this.setupDepartureRowInteractions();
        }, 100);
    }

    setupDepartureRowInteractions() {
        const allDepartureRows = document.querySelectorAll('.departure-row');

        console.log(`🎯 Setting up interactions for ${allDepartureRows.length} departure rows`);

        allDepartureRows.forEach((row, globalIndex) => {
            const newRow = row.cloneNode(true);
            row.parentNode.replaceChild(newRow, row);

            newRow.style.cursor = 'pointer';

            newRow.addEventListener('click', (e) => {
                const routeBadge = newRow.querySelector('.route-badge-text');
                const routeId = newRow.dataset.routeId;
                const routeName = routeBadge ? routeBadge.textContent.trim() : '';
                const departureIndex = newRow.dataset.departureIndex;
                const tabType = newRow.dataset.tabType;
                const departureData = this.getDepartureDataFromTab(departureIndex, tabType);

                if (routeId && routeName) {
                    console.log(`🚌 Departure row clicked: ${routeName} (ID: ${routeId}) from ${tabType} tab`);

                    this.clearDepartureHighlights();
                    this.onRouteHighlightClear();
                    this.stopBusLocationUpdates();

                    newRow.classList.add('departure-row-selected');

                    this.onRouteHighlight(routeId);

                    this.startBusLocationTracking(routeId, departureData);

                    this.currentTrackedRoute = { routeId, routeName, departureData };
                    this.currentHighlightedDepartures = { routeId, routeName };

                    const trackingText = departureData?.isLive ?
                        `Tracking Route ${routeName} - Live bus locations updating` :
                        `Route ${routeName} selected - Scheduled departures`;
                    this.updateSelectionIndicator(trackingText);
                }
            });

            newRow.addEventListener('mouseenter', (e) => {
                const routeId = newRow.dataset.routeId;
                const routeBadge = newRow.querySelector('.route-badge-text');
                const routeName = routeBadge ? routeBadge.textContent.trim() : '';

                if (routeId && !newRow.classList.contains('departure-row-selected')) {
                    newRow.classList.add('departure-row-hover');
                    this.onRouteHighlight(routeId, true);
                }
            });

            newRow.addEventListener('mouseleave', (e) => {
                const routeId = newRow.dataset.routeId;

                if (!newRow.classList.contains('departure-row-selected')) {
                    newRow.classList.remove('departure-row-hover');

                    if (this.currentTrackedRoute && this.currentTrackedRoute.routeId !== routeId) {
                        this.onRouteHighlight(this.currentTrackedRoute.routeId);
                    } else if (!this.currentTrackedRoute) {
                        this.onRouteHighlightClear();
                    }
                }
            });
        });
    }

    highlightDepartureRows(routeId, routeName, isTemporary = false) {
        this.clearDepartureHighlights(isTemporary);

        const departureRows = document.querySelectorAll('.departure-row');
        let highlightedCount = 0;

        departureRows.forEach(row => {
            const routeBadge = row.querySelector('.route-badge-text');
            if (routeBadge && routeBadge.textContent.trim().includes(routeName)) {
                const highlightClass = isTemporary ? 'departure-row-hover' : 'departure-row-selected';
                row.classList.add(highlightClass);
                highlightedCount++;
            }
        });

        if (!isTemporary && highlightedCount > 0) {
            this.currentHighlightedDepartures = { routeId, routeName };
            this.updateSelectionIndicator(`Route ${routeName} selected`);
        }

        console.log(`🎯 Highlighted ${highlightedCount} departure rows for route: ${routeName}`);
    }

    clearDepartureHighlights(isTemporaryOnly = false) {
        const departureRows = document.querySelectorAll('.departure-row');
        departureRows.forEach(row => {
            if (isTemporaryOnly) {
                row.classList.remove('departure-row-hover');
            } else {
                row.classList.remove('departure-row-selected', 'departure-row-hover');
            }
        });

        if (!isTemporaryOnly) {
            this.currentHighlightedDepartures = null;
            this.updateSelectionIndicator('');
        }
    }

    getDepartureDataFromTab(departureIndex, tabType) {
        let actualIndex;
        let departureArray;

        if (tabType === 'live') {
            actualIndex = parseInt(departureIndex.replace('live-', ''));
            departureArray = this.currentDepartures ? this.currentDepartures.filter(d => d.isLive) : [];
        } else if (tabType === 'scheduled') {
            actualIndex = parseInt(departureIndex.replace('scheduled-', ''));
            departureArray = this.currentDepartures ? this.currentDepartures.filter(d => !d.isLive) : [];
        } else if (tabType === 'all') {
            actualIndex = parseInt(departureIndex.replace('all-', ''));
            departureArray = this.currentAllRoutes || [];
        } else {
            actualIndex = parseInt(departureIndex);
            departureArray = this.currentDepartures || [];
        }

        return departureArray[actualIndex] || null;
    }

    getDepartureData(departureIndex) {
        if (this.currentDepartures && this.currentDepartures[departureIndex]) {
            return this.currentDepartures[departureIndex];
        }
        return null;
    }

    async startBusLocationTracking(routeId, departureData) {
        console.log(`🔄 Starting bus location tracking for route: ${routeId}`);

        const currentStopId = this.currentStop?.properties?.id || this.currentStop?.properties?.stop_id;
        const stopIds = currentStopId ? [currentStopId] : [];

        this.startBusLocationUpdates(routeId, stopIds);

        this.showBusTrackingNotification(routeId, departureData);
    }

    showBusTrackingNotification(routeId, departureData) {
        let notification = document.getElementById('bus-tracking-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'bus-tracking-notification';
            notification.className = 'fixed top-4 right-4 z-50 max-w-sm';
            document.body.appendChild(notification);
        }

        const routeName = departureData?.route || 'Unknown Route';
        const vehicleNo = departureData?.vehicleId || '';
        const destination = departureData?.destination || '';

        notification.innerHTML = `
            <div class="bg-green-800 border border-green-600 rounded-lg p-4 shadow-lg">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <div>
                            <div class="font-semibold text-white">Tracking Route ${routeName}</div>
                            <div class="text-sm text-green-200">
                                ${destination}
                                ${vehicleNo ? ` • Bus ${vehicleNo}` : ''}
                            </div>
                            <div class="text-xs text-green-300 mt-1">
                                Live bus locations updating every minute
                            </div>
                        </div>
                    </div>
                    <button onclick="window.transitDepartureController?.stopBusLocationTracking()"
                            class="text-green-300 hover:text-white ml-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        setTimeout(() => {
            if (notification) {
                notification.style.opacity = '0.7';
            }
        }, 5000);
    }

    stopBusLocationTracking() {
        console.log('🛑 Stopping bus location tracking');

        this.stopBusLocationUpdates();

        this.currentTrackedRoute = null;

        const notification = document.getElementById('bus-tracking-notification');
        if (notification) {
            notification.remove();
        }

        if (this.currentHighlightedDepartures) {
            this.updateSelectionIndicator(`Route ${this.currentHighlightedDepartures.routeName} selected`);
        } else {
            this.updateSelectionIndicator('');
        }
    }

    startBusLocationUpdates(routeId, stopIds = []) {
        console.log(`🔄 Starting bus location updates for route: ${routeId}`);

        this.stopBusLocationUpdates();

        this.busLocationInterval = setInterval(() => {
            this.updateBusLocations(routeId, stopIds);
        }, 30000);

        this.updateBusLocations(routeId, stopIds);
    }

    stopBusLocationUpdates() {
        if (this.busLocationInterval) {
            clearInterval(this.busLocationInterval);
            this.busLocationInterval = null;
        }

        if (this.map && this.map.getSource('bus-locations')) {
            this.map.getSource('bus-locations').setData({
                type: 'FeatureCollection',
                features: []
            });
        }

        console.log('🛑 Bus location updates stopped');
    }

    async updateBusLocations(routeId, stopIds = []) {
        console.log(`🚌 Updating bus locations for route: ${routeId}`);

        try {
            const busFeatures = await this.fetchBusLocations(routeId);

            if (this.map && this.map.getSource('bus-locations')) {
                this.map.getSource('bus-locations').setData({
                    type: 'FeatureCollection',
                    features: busFeatures
                });

                if (busFeatures.length > 0) {
                    console.log(`🚌 Updated map with ${busFeatures.length} live bus positions`);
                }
            }
        } catch (error) {
            console.error('🔴 Error updating bus locations:', error);

            if (this.map && this.map.getSource('bus-locations')) {
                this.map.getSource('bus-locations').setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (this.currentStop && this.currentStop.properties.id) {
                console.log('🔄 Auto-refreshing live data...');
                this.loadDepartures(this.currentStop);
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    extractAgencyFromRoute(routeInfo) {
        if (routeInfo.agency_name) return routeInfo.agency_name;
        if (routeInfo.route_name && routeInfo.route_name.includes('TMT')) return 'TMT';
        if (routeInfo.route_name && routeInfo.route_name.includes('MSRTC')) return 'MSRTC';
        if (routeInfo.route_name && routeInfo.route_name.includes('NMMT')) return 'NMMT';
        return 'BEST';
    }

    determineIfLive(routeInfo, agencyName) {
        if (routeInfo.is_live === true || routeInfo.is_live === 'true') return true;
        if (routeInfo.ac_service === true) return true;
        if (agencyName === 'BEST' && Math.random() > 0.7) return true;
        return false;
    }

    generateRealisticVehicleId(agencyName, routeName) {
        const random4Digit = Math.floor(Math.random() * 9000) + 1000;

        switch (agencyName.toUpperCase()) {
            case 'BEST':
                return `MH01-${random4Digit}`;
            case 'TMT':
                return `MH04-${random4Digit}`;
            case 'NMMT':
                return `MH02-${random4Digit}`;
            case 'MSRTC':
                return `MH12-${random4Digit}`;
            default:
                return `MH01-${random4Digit}`;
        }
    }

    generateDestination(routeName, agency) {
        const destinations = {
            'BEST': [
                'Borivali Station (E)', 'Andheri Station (W)', 'Bandra Station',
                'Dadar Station', 'CST', 'Colaba', 'Worli', 'BKC',
                'Kurla Station', 'Ghatkopar', 'Mulund', 'Thane'
            ],
            'TMT': [
                'Thane Station', 'Kalwa', 'Mumbra', 'Dombivli',
                'Airoli', 'Ghansoli', 'Vashi', 'Nerul'
            ]
        };

        const agencyDestinations = destinations[agency] || destinations['BEST'];
        return agencyDestinations[Math.floor(Math.random() * agencyDestinations.length)];
    }

    showDepartureError() {
        const departureList = document.getElementById('departure-list');
        departureList.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p>Unable to load departure information</p>
            </div>
        `;
    }

    showDepartureFallbackMessage() {
        const departureList = document.getElementById('departure-list');
        const liveList = document.getElementById('live-departure-list');
        const scheduledList = document.getElementById('scheduled-departure-list');

        const fallbackHTML = `
            <div class="text-center py-8">
                <div class="mb-4">
                    <svg class="w-16 h-16 mx-auto text-blue-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-white mb-2">Select a Bus Stop</h3>
                <p class="text-gray-300 mb-4">Choose a stop from the dropdown above to see live departures</p>
                <div class="space-y-2 text-sm text-gray-400">
                    <p>• Click on the map to explore stops</p>
                    <p>• Use the search to find specific stops</p>
                    <p>• Enable location for automatic nearest stop</p>
                </div>
                <button id="open-stop-selector-btn" class="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                    Browse Stops
                </button>
            </div>
        `;

        if (departureList) departureList.innerHTML = fallbackHTML;
        if (liveList) liveList.innerHTML = fallbackHTML;
        if (scheduledList) scheduledList.innerHTML = fallbackHTML;

        setTimeout(() => {
            const btn = document.getElementById('open-stop-selector-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    const stopSelector = document.getElementById('stop-selector-btn');
                    if (stopSelector) {
                        stopSelector.click();
                    }
                });
            }
        }, 100);
    }

    updateSelectionIndicator(message) {
        let indicator = document.getElementById('selection-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'selection-indicator';
            indicator.className = 'selection-indicator';

            const departureHeader = document.querySelector('.departure-board h3');
            if (departureHeader) {
                departureHeader.parentElement.insertAdjacentElement('afterend', indicator);
            }
        }

        if (message) {
            indicator.innerHTML = `
                <div class="flex items-center justify-between text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-600/30 rounded px-3 py-2 mb-2">
                    <span>${message}</span>
                    <button onclick="window.transitDepartureController?.clearAllSelections()" class="text-yellow-400 hover:text-yellow-200">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            `;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    clearAllSelections() {
        console.log('🔄 Clearing all departure selections...');
        this.clearDepartureHighlights();
        this.onRouteHighlightClear();
        this.onStopHighlightClear();
        this.onRouteSelectionsClear();
        this.stopBusLocationTracking();
        this.updateSelectionIndicator('');
    }
}
