import { DataUtils } from './transit-data.js';

export class ChaloAPI {
    static async fetchLiveEta(stopId, city, map, sourceName, sourceLayer, extractAgencyFromRoute) {
        if (!stopId) {
            console.warn('🚌 No stop ID available for live ETA fetch');
            return [];
        }

        const apiUrl = `https://chalo.com/app/api/vasudha/stop/${city}/${stopId}`;
        console.log(`🔴 Fetching live ETA from: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                console.warn(`🚌 Live ETA API returned ${response.status}`);
                return [];
            }

            const data = await response.json();

            const busRoutes = map.querySourceFeatures(sourceName, {
                sourceLayer: sourceLayer,
                filter: ['==', ['get', 'feature_type'], 'route']
            });

            const liveArrivals = [];
            const now = new Date();

            for (const routeId in data) {
                if (!Object.keys(data[routeId]).length) continue;

                const routeDetail = busRoutes.find(r => r.properties.route_id === routeId || r.properties.id === routeId);
                const routeProps = routeDetail?.properties || {};

                for (const tripId in data[routeId]) {
                    try {
                        const val = typeof data[routeId][tripId] === 'string'
                            ? JSON.parse(data[routeId][tripId])
                            : data[routeId][tripId];

                        const updatedMinsAgo = Math.floor((now.getTime() - val.tS) / 60000);
                        if (updatedMinsAgo > 60) continue;

                        if (val.eta === -1) continue;

                        const etaMins = Math.floor(val.eta / 60);
                        const arrivalTime = new Date(now.getTime() + etaMins * 60 * 1000);

                        liveArrivals.push({
                            route: val.rN || routeProps.route_short_name || routeProps.route_name || 'Unknown',
                            routeId: routeId,
                            time: arrivalTime,
                            isLive: true,
                            destination: val.dest || routeProps.last_stop_name || 'Terminal',
                            agencyName: routeProps.agency_name || extractAgencyFromRoute(routeProps) || 'BEST',
                            vehicleId: val.vNo || null,
                            etaMins: etaMins,
                            timestamp: val.tS,
                            updatedMinsAgo: updatedMinsAgo,
                            fareType: DataUtils.detectFareTypeFromRoute(val.rN || routeProps.route_short_name),
                            tripId: tripId,
                            trackingUrl: `https://chalo.com/app/live-tracking/route-map/${routeId}`,
                            timetableUrl: `https://chalo.com/app/live-tracking/time-table/${routeId}`
                        });
                    } catch (parseError) {
                        console.warn(`🚌 Error parsing trip data for route ${routeId}:`, parseError);
                    }
                }
            }

            liveArrivals.sort((a, b) => a.etaMins - b.etaMins);

            console.log(`🟢 Fetched ${liveArrivals.length} live arrivals from Chalo API`);
            return liveArrivals;

        } catch (error) {
            console.error('🔴 Error fetching live ETA:', error);
            return [];
        }
    }

    static async fetchBusLocations(routeId, city) {
        if (!routeId) return [];

        const apiUrl = `https://chalo.com/app/api/vasudha/route/${city}/${routeId}`;
        console.log(`🚌 Fetching bus locations from: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                console.warn(`🚌 Bus locations API returned ${response.status}`);
                return [];
            }

            const data = await response.json();
            const busFeatures = [];
            const now = new Date();

            for (const vehicleId in data) {
                try {
                    const val = typeof data[vehicleId] === 'string'
                        ? JSON.parse(data[vehicleId])
                        : data[vehicleId];

                    if (!val.lat || !val.lng) continue;

                    const updatedMinsAgo = Math.floor((now.getTime() - val.tS) / 60000);
                    if (updatedMinsAgo > 10) continue;

                    busFeatures.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [val.lng, val.lat]
                        },
                        properties: {
                            vehicleNo: val.vNo || vehicleId,
                            routeId: routeId,
                            timestamp: val.tS,
                            updatedMinsAgo: updatedMinsAgo,
                            isHalted: val.isHalted || false,
                            speed: val.speed || 0,
                            bearing: val.bearing || 0,
                            eta: val.eta || 0
                        }
                    });
                } catch (parseError) {
                    console.warn(`🚌 Error parsing vehicle ${vehicleId}:`, parseError);
                }
            }

            console.log(`🚌 Found ${busFeatures.length} live bus positions for route ${routeId}`);
            return busFeatures;

        } catch (error) {
            console.error('🔴 Error fetching bus locations:', error);
            return [];
        }
    }
}
