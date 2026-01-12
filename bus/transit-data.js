// Transit Data Models and Configuration
// Contains data schemas, styling configuration, and data model classes

// Vector tile source configuration
export const VECTOR_TILE_SOURCE = {
    url: 'mapbox://planemad.iw3kycq2pc42',
    sourceName: 'transit-data',
    sourceLayer: '97b9d98c23c4604f1dc8' // Layer name in the vector tiles
};

// Configuration for tileset schema mapping
export const TILESET_SCHEMA = {
    routes: {
        layer: 'transit-data', // Source name
        sourceLayer: '97b9d98c23c4604f1dc8', // Source layer within the tiles
        featureType: 'route', // feature_type property value
        fields: {
            id: 'id',
            shortName: 'route_short_name',
            longName: 'name', // Full display name with modifiers (RING, LTD, etc)
            description: 'route_desc',
            color: 'route_color',
            textColor: 'route_text_color',
            isLive: 'is_live',
            isPremium: 'is_premium',
            agency: 'agency_name',
            city: 'city_name',
            routeType: 'trip_type',
            fareType: 'fare_type',
            acService: 'ac_service',
            direction: 'direction',
            firstStopName: 'from', // Origin stop name
            lastStopName: 'to', // Destination stop name
            via: 'via', // Via stops/areas
            stopCount: 'stop_count',
            stopTimetable: 'stop_timetable',
            tripHeadway: 'trip_headway',
            tripDuration: 'trip_duration', // Average trip duration HH:MM
            tripCount: 'trip_count',
            morningTripHeadway: 'morning_trip_headway',
            afternoonTripHeadway: 'afternoon_trip_headway',
            eveningTripHeadway: 'evening_trip_headway',
            nightTripHeadway: 'night_trip_headway',
            morningTripCount: 'morning_trip_count',
            afternoonTripCount: 'afternoon_trip_count',
            eveningTripCount: 'evening_trip_count',
            nightTripCount: 'night_trip_count',
            reverseRouteId: 'reverse_id',
            openingHours: 'opening_hours' // Service hours in OSM format
        }
    },
    stops: {
        layer: 'transit-data', // Source name
        sourceLayer: '97b9d98c23c4604f1dc8', // Source layer within the tiles
        featureType: 'stop', // feature_type property value
        fields: {
            id: 'id',
            name: 'name',
            timetable: 'stop_timetable',
            routeList: 'route_name_list',
            terminalRouteList: 'terminal_route_name_list',
            tripCount: 'trip_count',
            terminalTripCount: 'terminal_trip_count',
            avgWaitTime: 'avg_wait_time',
            minTripHeadway: 'min_trip_headway',
            description: 'stop_description',
            towardsStop: 'towards_stop',
            openingHours: 'opening_hours' // Service hours in OSM format
        }
    }
};

// Transit Agency styling configuration
export const AGENCY_STYLES = {
    'BEST': {
        name: 'Brihanmumbai Electric Supply and Transport',
        colors: {
            'AC': {
                background: '#2563eb',      // Blue-600
                text: '#ffffff',
                mapLine: '#3b82f6'          // Blue-500
            },
            'Regular': {
                background: '#dc2626',      // Red-600
                text: '#ffffff', 
                mapLine: '#ef4444'          // Red-500
            },
            'Express': {
                background: '#f97316',      // Orange-500
                text: '#ffffff',
                mapLine: '#f97316'          // Orange-500
            },
            'default': {
                background: '#059669',      // Green-600
                text: '#ffffff',
                mapLine: '#10b981'          // Green-500
            }
        }
    },
    'CHALO BUS MUMBAI': {
        name: 'Chalo Bus Mumbai',
        colors: {
            'Premium': {
                background: '#8b5cf6',      // Purple-500
                text: '#ffffff',
                mapLine: '#8b5cf6'          // Purple-500
            },
            'AC': {
                background: '#2563eb',      // Blue-600
                text: '#ffffff',
                mapLine: '#3b82f6'          // Blue-500
            },
            'Regular': {
                background: '#dc2626',      // Red-600
                text: '#ffffff', 
                mapLine: '#ef4444'          // Red-500
            },
            'Express': {
                background: '#f97316',      // Orange-500
                text: '#ffffff',
                mapLine: '#f97316'          // Orange-500
            },
            'default': {
                background: '#059669',      // Green-600
                text: '#ffffff',
                mapLine: '#10b981'          // Green-500
            }
        }
    },
    'KSRTC': {
        name: 'Kerala State Road Transport Corporation',
        colors: {
            'AC': {
                background: '#2563eb',      // Blue-600
                text: '#ffffff',
                mapLine: '#3b82f6'          // Blue-500
            },
            'Regular': {
                background: '#059669',      // Green-600
                text: '#ffffff', 
                mapLine: '#10b981'          // Green-500
            },
            'default': {
                background: '#059669',      // Green-600
                text: '#ffffff',
                mapLine: '#10b981'          // Green-500
            }
        }
    },
    'default': {
        name: 'Transit Agency',
        colors: {
            'Premium': {
                background: '#8b5cf6',      // Purple-500
                text: '#ffffff',
                mapLine: '#8b5cf6'          // Purple-500
            },
            'AC': {
                background: '#2563eb',      // Blue-600
                text: '#ffffff',
                mapLine: '#3b82f6'          // Blue-500
            },
            'Regular': {
                background: '#dc2626',      // Red-600
                text: '#ffffff', 
                mapLine: '#ef4444'          // Red-500
            },
            'Express': {
                background: '#f97316',      // Orange-500
                text: '#ffffff',
                mapLine: '#f97316'          // Orange-500
            },
            'default': {
                background: '#059669',      // Green-600
                text: '#ffffff',
                mapLine: '#10b981'          // Green-500
            }
        }
    }
};

// Transit Agency data class
export class TransitAgency {
    constructor(agencyName) {
        this.name = agencyName || 'default';
        this.config = AGENCY_STYLES[this.name] || AGENCY_STYLES['default'];
    }
    
    getRouteStyle(fareType = null, routeType = null) {
        // Determine the service type for styling
        let serviceType = 'default';
        
        if (fareType) {
            serviceType = fareType;
        } else if (routeType) {
            // Map route types to service types if needed
            serviceType = this.mapRouteTypeToService(routeType);
        }
        
        // Get colors for the service type, fallback to default
        const colors = this.config.colors[serviceType] || this.config.colors['default'];
        
        return {
            backgroundColor: colors.background,
            textColor: colors.text,
            mapLineColor: colors.mapLine,
            serviceType: serviceType
        };
    }
    
    mapRouteTypeToService(routeType) {
        // Map GTFS route types or custom route types to service types
        const routeTypeMap = {
            'AC': 'AC',
            'ac': 'AC',
            'Air Conditioned': 'AC',
            'Regular': 'Regular',
            'regular': 'Regular',
            'Ordinary': 'Regular',
            'Express': 'Regular',
            'Limited': 'Regular'
        };
        
        return routeTypeMap[routeType] || 'default';
    }
    
    getAllServiceTypes() {
        return Object.keys(this.config.colors);
    }
    
    getDisplayInfo() {
        return {
            name: this.config.name,
            shortName: this.name,
            serviceTypes: this.getAllServiceTypes()
        };
    }
}

// Bus Route data class
export class BusRoute {
    constructor(feature, schema = TILESET_SCHEMA.routes) {
        this.feature = feature;
        this.schema = schema;
        this.properties = feature.properties || {};
        
        // Map schema fields to properties
        this.id = this.getProperty('id');
        this.shortName = this.getProperty('shortName');
        this.longName = this.getProperty('longName');
        this.description = this.getProperty('description');
        this.color = this.getProperty('color');
        this.textColor = this.getProperty('textColor');
        this.isLive = this.getBooleanProperty('isLive');
        this.isPremium = this.getBooleanProperty('isPremium');
        this.agency = this.getProperty('agency');
        this.city = this.getProperty('city');
        this.routeType = this.getProperty('routeType');
        this.fareType = this.getProperty('fareType');
        this.acService = this.getBooleanProperty('acService');
        this.direction = this.getProperty('direction');
        
        // Route endpoints
        this.from = this.getProperty('firstStopName'); // Origin stop
        this.to = this.getProperty('lastStopName'); // Destination stop
        this.via = this.getProperty('via'); // Via stops/areas
        
        // Trip information
        this.tripHeadway = this.getNumericProperty('tripHeadway');
        this.tripDuration = this.getProperty('tripDuration');
        this.tripCount = this.getNumericProperty('tripCount');
        this.stopCount = this.getNumericProperty('stopCount');
        
        // Time-period specific headways
        this.morningTripHeadway = this.getNumericProperty('morningTripHeadway');
        this.afternoonTripHeadway = this.getNumericProperty('afternoonTripHeadway');
        this.eveningTripHeadway = this.getNumericProperty('eveningTripHeadway');
        this.nightTripHeadway = this.getNumericProperty('nightTripHeadway');
        
        // Time-period specific trip counts
        this.morningTripCount = this.getNumericProperty('morningTripCount');
        this.afternoonTripCount = this.getNumericProperty('afternoonTripCount');
        this.eveningTripCount = this.getNumericProperty('eveningTripCount');
        this.nightTripCount = this.getNumericProperty('nightTripCount');
        
        // Service information
        this.openingHours = this.getProperty('openingHours');
        this.reverseRouteId = this.getProperty('reverseRouteId');
        this.stopTimetable = this.getProperty('stopTimetable');
        
        // Computed properties
        this.displayName = this.shortName || this.longName || this.id;
        this.fullDescription = this.description || this.longName || '';
        
        // Initialize agency styling
        this.transitAgency = new TransitAgency(this.agency);
        this.styling = this.transitAgency.getRouteStyle(this.fareType, this.routeType);
    }
    
    getProperty(schemaKey) {
        const fieldName = this.schema.fields[schemaKey];
        return fieldName ? this.properties[fieldName] : null;
    }
    
    getBooleanProperty(schemaKey) {
        const value = this.getProperty(schemaKey);
        return value === true || value === 'true' || value === 1 || value === '1';
    }
    
    getNumericProperty(schemaKey) {
        const value = this.getProperty(schemaKey);
        return value !== null && value !== undefined ? parseFloat(value) : null;
    }
    
    getDisplayInfo() {
        return {
            name: this.displayName,
            description: this.fullDescription,
            status: this.isLive ? 'Live Tracking' : 'Scheduled',
            agency: this.agency,
            city: this.city,
            serviceType: this.styling.serviceType,
            styling: this.styling,
            // Route endpoints
            from: this.from,
            to: this.to,
            via: this.via,
            direction: this.direction,
            // Trip information
            tripHeadway: this.tripHeadway,
            tripDuration: this.tripDuration,
            tripCount: this.tripCount,
            stopCount: this.stopCount,
            // Service hours
            openingHours: this.openingHours,
            // Flags
            isAC: this.acService || this.fareType === 'AC',
            isPremium: this.isPremium
        };
    }
    
    getMapLineColor() {
        // Use agency styling if available, fallback to manual color or default
        return this.styling.mapLineColor || this.color || '#10b981';
    }
    
    getRouteHtml(size = 'normal') {
        const sizeClasses = {
            small: 'px-1.5 py-0.5 text-xs',
            normal: 'px-2 py-1 text-xs',
            large: 'px-3 py-1.5 text-sm'
        };
        
        const sizeClass = sizeClasses[size] || sizeClasses.normal;
        
        return `
            <span class="route-badge ${sizeClass} rounded font-bold" 
                  style="background-color: ${this.styling.backgroundColor}; color: ${this.styling.textColor};">
                <span class="route-badge-text">${this.displayName}</span>
                ${this.fareType === 'AC' ? '<span class="text-blue-200 text-xs ml-1">AC</span>' : ''}
            </span>
        `;
    }
}

// Bus Stop data class
export class BusStop {
    constructor(feature, schema = TILESET_SCHEMA.stops) {
        this.feature = feature;
        this.schema = schema;
        this.properties = feature.properties || {};
        
        // Map schema fields to properties
        this.id = this.getProperty('id');
        this.name = this.getProperty('name');
        this.description = this.getProperty('description');
        this.timetable = this.getProperty('timetable');
        this.routeList = this.getProperty('routeList');
        this.terminalRouteList = this.getProperty('terminalRouteList');
        this.tripCount = this.getNumericProperty('tripCount');
        this.terminalTripCount = this.getNumericProperty('terminalTripCount');
        this.avgWaitTime = this.getNumericProperty('avgWaitTime');
        this.minTripHeadway = this.getNumericProperty('minTripHeadway');
        this.towardsStop = this.getProperty('towardsStop');
        this.openingHours = this.getProperty('openingHours');
        
        // Extract coordinates from geometry (preferred) or properties
        const coords = this.extractCoordinates(feature.geometry);

        if (coords) {
            // Use geometry coordinates (correct Point geometry from Mapbox tileset)
            this.lon = coords[0];
            this.lat = coords[1];
            this.coordinates = coords;
        } else {
            // Fallback to properties if geometry is not available
            this.lon = this.getNumericProperty('lon');
            this.lat = this.getNumericProperty('lat');
            this.coordinates = this.lon && this.lat ? [this.lon, this.lat] : null;
        }
        
        this.routes = this.parseRouteList();
        this.hasLiveData = this.id && this.id.length > 0;
    }
    
    // Extract a representative point from various geometry types
    extractCoordinates(geometry) {
        if (!geometry || !geometry.coordinates) return null;
        
        const coords = geometry.coordinates;
        const type = geometry.type;
        
        switch (type) {
            case 'Point':
                // [lng, lat]
                return coords;
            case 'LineString':
                // [[lng, lat], [lng, lat], ...] - return midpoint for better representation
                if (coords.length > 0) {
                    const midIndex = Math.floor(coords.length / 2);
                    return coords[midIndex];
                }
                return null;
            case 'MultiLineString':
                // [[[lng, lat], ...], [[lng, lat], ...], ...] - return first point of first line
                if (coords.length > 0 && coords[0].length > 0) {
                    const firstLine = coords[0];
                    const midIndex = Math.floor(firstLine.length / 2);
                    return firstLine[midIndex];
                }
                return null;
            default:
                // Unknown type, try to extract first coordinate
                if (Array.isArray(coords) && coords.length >= 2) {
                    if (typeof coords[0] === 'number') {
                        return coords; // Already [lng, lat]
                    } else if (Array.isArray(coords[0])) {
                        return coords[0]; // First point
                    }
                }
                return null;
        }
    }
    
    getProperty(schemaKey) {
        const fieldName = this.schema.fields[schemaKey];
        
        // If no schema mapping exists, try direct property access
        if (!fieldName) {
            const directValue = this.properties[schemaKey];
            if (directValue !== undefined) {
                console.log(`🔍 Direct property access for ${schemaKey}: ${directValue}`);
                return directValue;
            }
            return null;
        }
        
        // Handle array of field names (try each one)
        if (Array.isArray(fieldName)) {
            for (const field of fieldName) {
                if (this.properties[field] !== undefined) {
                    return this.properties[field];
                }
            }
            return null;
        }
        
        // Handle single field name
        return fieldName ? this.properties[fieldName] : null;
    }
    
    getNumericProperty(schemaKey) {
        const value = this.getProperty(schemaKey);
        return value ? parseFloat(value) : null;
    }
    
    parseRouteList() {
        if (!this.routeList) return [];
        
        try {
            // Handle semicolon-separated route list (most common format)
            if (typeof this.routeList === 'string') {
                return this.routeList.split(/[;,]/).map(route => route.trim()).filter(Boolean);
            }
            return Array.isArray(this.routeList) ? this.routeList : [];
        } catch (error) {
            console.warn('Error parsing route list:', error);
            return [];
        }
    }
    
    getRoutesFromTimetable() {
        // Extract route information from timetable data
        const timetableData = this.parseTimetable();
        const routeMap = new Map();
        
        timetableData.forEach(routeInfo => {
            // Support both old schema (route_short_name/route_name) and new schema (route_short_name/name)
            const routeName = routeInfo.route_short_name || routeInfo.name || routeInfo.route_name;
            if (routeName) {
                // Extract destination: new schema uses 'to', old uses various fields
                const destination = routeInfo.to || this.extractDestination(routeInfo);
                const isAC = routeInfo.ac_service === true || routeInfo.ac_service === 'true';
                
                routeMap.set(routeName, {
                    name: routeName,
                    routeId: routeInfo.id,
                    reverseRouteId: routeInfo.reverse_id,
                    agency: routeInfo.agency_name || 'BEST',
                    fareType: isAC ? 'AC' : this.detectFareType(routeName),
                    isAC: isAC || this.isACRoute(routeName),
                    from: routeInfo.from,
                    destination: destination,
                    tripHeadway: routeInfo.trip_headway,
                    morningHeadway: routeInfo.morning_trip_headway,
                    afternoonHeadway: routeInfo.afternoon_trip_headway,
                    eveningHeadway: routeInfo.evening_trip_headway,
                    nightHeadway: routeInfo.night_trip_headway,
                    // Include timings for schedule display
                    timings: routeInfo.timings || routeInfo.stop_times || []
                });
            }
        });
        
        return Array.from(routeMap.values());
    }

    extractDestination(routeInfo) {
        // Try various possible destination fields in order of preference
        const destinationFields = [
            'last_stop_name',
            'trip_headsign', 
            'headsign',
            'towards_stop',
            'destination',
            'route_long_name',
            'route_desc'
        ];
        
        for (const field of destinationFields) {
            if (routeInfo[field] && routeInfo[field].trim()) {
                return routeInfo[field].trim();
            }
        }
        
        // Fallback to generic destination based on route name
        return this.generateFallbackDestination(routeInfo.route_short_name || routeInfo.route_name);
    }

    generateFallbackDestination(routeName) {
        // Generate plausible destinations based on route patterns
        const patterns = {
            // AC routes (starting with A)
            'A': ['Airport Terminal', 'Central Station', 'Business District'],
            // Limited routes (ending with LTD)
            'LTD': ['Express Terminal', 'Limited Stop', 'Fast Service'],
            // Circular routes (C prefix)
            'C': ['Circular Route', 'City Center', 'Loop Service']
        };
        
        // Check route name patterns
        const routeUpper = routeName.toUpperCase();
        for (const [pattern, destinations] of Object.entries(patterns)) {
            if (routeUpper.startsWith(pattern) || routeUpper.includes(pattern)) {
                return destinations[Math.floor(Math.random() * destinations.length)];
            }
        }
        
        // Default fallback
        return 'Main Terminal';
    }

    detectFareType(routeName) {
        const name = routeName.toLowerCase();
        if (name.includes('ac') || name.includes('a-') || name.includes('a/c')) {
            return 'AC';
        }
        return 'Regular';
    }

    isACRoute(routeName) {
        return this.detectFareType(routeName) === 'AC';
    }
    
    parseTimetable() {
        if (!this.timetable) return [];
        
        try {
            let timetableData = typeof this.timetable === 'string' ? 
                JSON.parse(this.timetable) : this.timetable;
            
            return Array.isArray(timetableData) ? timetableData : [];
        } catch (error) {
            console.warn('Error parsing timetable:', error);
            return [];
        }
    }
    
    getDistance(userLocation) {
        if (!userLocation || !this.coordinates) return null;
        
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(this.lat - userLocation.lat);
        const dLon = this.toRadians(this.lon - userLocation.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(userLocation.lat)) * Math.cos(this.toRadians(this.lat)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    getDisplayInfo(userLocation = null) {
        const distance = userLocation ? this.getDistance(userLocation) : null;
        
        // Format towards_stop field for display
        let toDestinations = null;
        
        // Use the towardsStop field directly (now pre-populated in schema)
        if (this.towardsStop && typeof this.towardsStop === 'string' && this.towardsStop.trim()) {
            // Split by semicolon and clean up each destination
            const destinations = this.towardsStop.split(';')
                .map(dest => dest.trim())
                .filter(dest => dest.length > 0);
            
            if (destinations.length > 0) {
                // Join with commas for natural formatting
                toDestinations = destinations.join(', ');
            }
        } else {
            // Fallback: try extracting from route timetable data
            const routesWithDestinations = this.getRoutesFromTimetable()
                .map(route => route.destination)
                .filter(dest => dest && dest !== 'Main Terminal')
                .slice(0, 3);
            
            if (routesWithDestinations.length > 0) {
                toDestinations = [...new Set(routesWithDestinations)].join(', ');
            }
        }
        
        return {
            name: this.name || 'Bus Stop',
            description: this.description,
            distance: distance ? `${(distance * 1000).toFixed(0)}m` : null,
            routeCount: this.routes.length,
            routes: this.routes.slice(0, 5), // Show first 5 routes
            moreRoutes: Math.max(0, this.routes.length - 5),
            tripCount: this.tripCount,
            terminalTripCount: this.terminalTripCount,
            avgWaitTime: this.avgWaitTime,
            minTripHeadway: this.minTripHeadway,
            hasLiveData: this.hasLiveData,
            coordinates: this.coordinates,
            to: toDestinations,
            openingHours: this.openingHours
        };
    }

    // New method to get upcoming departures for current time
    getUpcomingDepartures(currentTime, limit = 12) {
        const timetableData = this.parseTimetable();
        const allDepartures = [];
        
        timetableData.forEach(routeInfo => {
            // Support both old schema (stop_times) and new schema (timings)
            const stopTimes = routeInfo.timings || routeInfo.stop_times;
            if (!stopTimes || !Array.isArray(stopTimes)) {
                return;
            }
            
            const routeName = routeInfo.route_short_name || routeInfo.name;
            // Support both old schema (last_stop_name) and new schema (to)
            const destination = routeInfo.to || routeInfo.last_stop_name || 'Terminal';
            const agencyName = routeInfo.agency_name || 'BEST';
            const headway = routeInfo.trip_headway || 30;
            const isAC = routeInfo.ac_service === true || routeInfo.ac_service === 'true';
            
            // Process each scheduled time
            stopTimes.forEach(timeStr => {
                const departureTime = DataUtils.parseTimeString(timeStr, currentTime);
                if (departureTime) {
                    const timeDiffMinutes = (departureTime.getTime() - currentTime.getTime()) / (1000 * 60);
                    
                    // Include departures within next 3 hours or recently departed (last 5 minutes)
                    if (timeDiffMinutes >= -5 && timeDiffMinutes <= 180) {
                        allDepartures.push({
                            route: routeName,
                            routeId: routeInfo.id || `route_${routeName}`,
                            reverseRouteId: routeInfo.reverse_id,
                            reverseStopId: routeInfo.reverse_stop_id,
                            time: departureTime,
                            destination: destination,
                            from: routeInfo.from,
                            agencyName: agencyName,
                            headway: headway,
                            morningHeadway: routeInfo.morning_trip_headway,
                            afternoonHeadway: routeInfo.afternoon_trip_headway,
                            eveningHeadway: routeInfo.evening_trip_headway,
                            nightHeadway: routeInfo.night_trip_headway,
                            isLive: routeInfo.is_live === true || routeInfo.is_live === 'true',
                            isAC: isAC,
                            fareType: isAC ? 'AC' : this.detectFareType(routeName),
                            sortTime: departureTime.getTime()
                        });
                    }
                }
            });
        });
        
        // Sort by time and limit results
        return allDepartures
            .sort((a, b) => a.sortTime - b.sortTime)
            .slice(0, limit);
    }
}

// Utility functions for data parsing
export class DataUtils {
    static parseTimeString(timeStr, baseDate) {
        try {
            // Parse "HH:MM" format
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            if (isNaN(hours) || isNaN(minutes)) {
                return null;
            }

            const departure = new Date(baseDate);
            departure.setHours(hours, minutes, 0, 0);

            // Handle next day scenarios (for times after midnight)
            if (departure < baseDate) {
                departure.setDate(departure.getDate() + 1);
            }

            return departure;
        } catch (error) {
            return null;
        }
    }

    static isWithinNext60Minutes(departureTime, currentTime) {
        const timeDiff = departureTime - currentTime;
        // Within next 60 minutes (3.6 million milliseconds)
        return timeDiff >= 0 && timeDiff <= 60 * 60 * 1000;
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    static detectFareTypeFromRoute(routeName) {
        const name = routeName.toLowerCase();
        if (name.includes('ac') || name.includes('a-') || name.includes('a/c')) {
            return 'AC';
        }
        return 'Regular';
    }

    static getStyledRouteBadge(routeName, routeInfo = null, size = 'normal') {
        const sizeClasses = {
            small: 'px-1.5 py-0.5 text-xs',
            normal: 'px-2 py-1 text-xs',
            large: 'px-3 py-1.5 text-sm'
        };
        
        const sizeClass = sizeClasses[size] || sizeClasses.normal;
        
        // Intelligent fallback based on route name patterns
        let backgroundColor = '#059669'; // Default green
        let textColor = '#ffffff';
        let isAC = false;
        
        if (routeInfo) {
            const transitAgency = new TransitAgency(routeInfo.agency || 'BEST');
            const styling = transitAgency.getRouteStyle(routeInfo.fareType);
            backgroundColor = styling.backgroundColor;
            textColor = styling.textColor;
            isAC = routeInfo.fareType === 'AC';
        } else {
            // Detect AC routes from name patterns
            const routeNameLower = routeName.toLowerCase();
            if (routeNameLower.includes('a-') || 
                routeNameLower.includes('ac') || 
                routeNameLower.includes('a/c') ||
                routeNameLower.includes('air con')) {
                backgroundColor = '#2563eb'; // Blue for AC
                isAC = true;
            } else {
                // Assume Regular BEST service gets red
                backgroundColor = '#dc2626'; // Red for Regular
            }
        }
        
        const acIndicator = isAC ? '<span class="text-blue-200 text-xs ml-1">AC</span>' : '';
        
        return `<span class="route-badge ${sizeClass} rounded font-bold" style="background-color: ${backgroundColor}; color: ${textColor};">
                    <span class="route-badge-text">${routeName}</span>${acIndicator}
                </span>`;
    }
} 