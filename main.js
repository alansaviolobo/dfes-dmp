const domain_name = 'dmpgoa.com';
const gtagid = 'G-FBVGZ4HJV0';

function getQueryParameters() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const params = {};

    // Iterate through all entries in the URLSearchParams object
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }

    return params;
}

(function() {

    mapboxgl.accessToken = 'pk.eyJ1IjoiYWxhbnNhdmlvbG9ibyIsImEiOiJjbTk4N25pOW8wMDRhMmpzNjI5MnJ2aW5sIn0.2yPbSm6kdzoJNv-vwbBjMg'; // Mapbox Token by OpenStreetMap India community via @alansaviolobo

    // Initialize the map
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/alansaviolobo/cm98a9rdn00fs01sk3qw91464',
        center: [73.9414, 15.4121],
        zoom: 9.99,
        hash: true,
        attributionControl: false
    });

    // Add attribution control
    map.addControl(new mapboxgl.AttributionControl({
        compact: true
    }), 'bottom-right');

    // Add the Mapbox Search control
    // https://docs.mapbox.com/mapbox-search-js/api/web/search/

    const script = document.getElementById('search-js');
    // wait for the Mapbox Search JS script to load before using it
    script.onload = function () {
        // select the MapboxSearchBox instance
        const searchBox = document.querySelector('mapbox-search-box')

        // set the options property
        searchBox.options = {
            language: 'en',
            country: 'IN',
            types: 'place,locality,postcode,region,district,street,address,poi',
            proximity: {
                lng: 73.87916,
                lat: 15.26032
            },
            bbox: [73.5, 14.8, 74.2, 15.8] // Bounding box for Goa
        }

        searchBox.addEventListener('input', (e) => {
            if (e.target !== e.currentTarget) return;
            const searchText = event.detail;

            // Update proximity with input map location
            const center = map.getCenter();

            searchBox.options.proximity = {
                lng: center.lng,
                lat: center.lat
            };

        });

        // set the mapboxgl library to use for markers and enable the marker functionality
        searchBox.mapboxgl = mapboxgl
        searchBox.marker = true

        // bind the search box instance to the map instance
        searchBox.bindMap(map)


        // Add 3D terrain
        map.on('load', () => {
            // Only add terrain if not already in style
            const style = map.getStyle();
            const hasTerrain = style.sources && style.sources['mapbox-dem'];

            if (!hasTerrain) {
                map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    'tileSize': 512,
                    'maxzoom': 14
                });

                map.setTerrain({
                    'source': 'mapbox-dem',
                    'exaggeration': 1.5
                });
            }

            // Initialize geolocation
            new GeolocationManager(map);

            // Add view control
            map.addControl(new ViewControl(), 'top-right');

            // Put Layers in a variable, we may want to move this to a separate file or so.
            let layersConfig = [
                {
                    id: 'streetmap',
                    title: 'Street Map',
                    description: 'Detailed street map',
                    type: 'style',
                    headerImage: 'assets/map-layer-streetmap.png',
                    initiallyChecked: true,
                    layers: [
                        { title: 'Places', sourceLayer: 'place_label' },
                        { title: 'Landmarks', sourceLayer: 'poi_label' },
                        { title: 'Buildings', sourceLayer: 'building' },
                        { title: 'Structures', sourceLayer: 'structure' },
                        { title: 'Roads', sourceLayer: 'road' },
                        { title: 'Hillshading', sourceLayer: 'hillshade' },
                        { title: 'Landcover', sourceLayer: 'landcover' },
                        { title: 'Landuse', sourceLayer: 'landuse' },
                        { title: 'Wetlands & National Parks', sourceLayer: 'landuse_overlay' },
                        { title: 'Waterways', sourceLayer: 'waterway' },
                        { title: 'Waterbodies', sourceLayer: 'water' },
                    ]
                },
                {
                    title: 'Community Pins',
                    description: 'Pin your notes on the map for the rest of the community to see',
                    headerImage: 'assets/map-layer-pins.png',
                    type: 'markers',
                    id: 'community-pins',
                    dataUrl: 'https://docs.google.com/spreadsheets/d/1Y0l4aSIdks8G3lmxSxSKxuzLoARL-FCiYbTL9a0b3O0/gviz/tq?tqx=out:json&tq&gid=0',
                    attribution: 'Collected by amche.in | <a href="https://docs.google.com/spreadsheets/d/1Y0l4aSIdks8G3lmxSxSKxuzLoARL-FCiYbTL9a0b3O0/edit?resourcekey=&gid=485622101#gid=485622101">View Source Spreadsheet</a>',
                    style: {
                        'circle-color': '#FF4136',
                        'circle-radius': 8
                    },
                    inspect: {
                        title: 'Pin Details',
                        label: 'name',
                        fields: ['Location Name', 'Additional Notes (optional)', 'Timestamp_ago'],
                        fieldTitles: ['Name', 'Notes', 'Added'],
                    }
                },

                {
                    id: 'osm',
                    title: 'OpenStreetMap',
                    description: 'OpenStreetMap Data',
                    headerImage: 'assets/map-layer-osm.png',
                    type: 'tms',
                    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    description: 'Map data contributed by the <a href="https://www.openstreetmap.in/">OpenStreetMap India Community.',
                    attribution: '© OpenStreetMap contributors'
                },
            ];

            // First, apply URL parameters to modify initiallyChecked
            const queryParams = getQueryParameters();
            if (queryParams.layers) {
                const activeLayers = queryParams.layers.split(',').map(s => s.trim());
                layersConfig = layersConfig.map(layer => {
                    // Handle both streetmap and other layers
                    if (layer.type === 'style') {
                        layer.initiallyChecked = activeLayers.includes('streetmap');
                    } else {
                        layer.initiallyChecked = activeLayers.includes(layer.id);
                    }
                    return layer;
                });
            }

            const layerControl = new MapLayerControl(layersConfig);

            const container = document.getElementById('layer-controls-container');

            // Hide loader and show controls
            document.getElementById('layer-controls-loader').classList.add('hidden');
            container.classList.remove('hidden');

            // Let MapLayerControl handle initial checkbox states based on initiallyChecked
            layerControl.renderToContainer(container, map);

            // Add navigation controls
            map.addControl(new mapboxgl.NavigationControl({
                showCompass: true,
                showZoom: true
            }));

            // Only set camera position if there's no hash in URL
            if (!window.location.hash) {
                setTimeout(() => {
                    map.flyTo({
                        center: [73.8274, 15.4406],
                        zoom: 9,
                        pitch: 28,
                        bearing: 0,
                        duration: 3000,
                        essential: true,
                        curve: 1.42,
                        speed: 0.6
                    });
                }, 2000);
            }
        });
    }
})();

(function() {
    // Initialize drawer functionality after Shoelace components are ready
    customElements.whenDefined('sl-drawer').then(() => {
        const drawer = document.querySelector('.drawer-placement-start');
        const openButton = document.querySelector('#open-drawer');

        // Function to handle drawer state based on screen size
        function handleDrawerState() {
            if (window.innerWidth > 768) { // Desktop
                drawer.show();
            } else { // Mobile
                drawer.hide();
            }
        }

        // Initial state
        handleDrawerState();

        // Listen for window resize
        window.addEventListener('resize', handleDrawerState);

        // Toggle drawer when button is clicked
        openButton.addEventListener('click', () => drawer.show());
    });
})();

(function() {
    if (window.location.hostname === domain_name) {
        // Load Google Analytics
        const gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + gtagid;
        document.head.appendChild(gtagScript);
        window.dataLayer = window.dataLayer || [];

        function gtag() {
            dataLayer.push(arguments);
        }

        gtag('js', new Date());
        gtag('config', gtagid);
    }
})();

(function(){
    // Add this after your existing scripts
    const skeletonContainer = document.getElementById('skeleton-container');
    const numberOfSkeletons = 15;

    Array.from({ length: numberOfSkeletons }).forEach(() => {
        const skeleton = document.createElement('sl-skeleton');
        skeleton.className = 'skeleton-map-controls';
        skeleton.setAttribute('effect', 'pulse');
        skeletonContainer.appendChild(skeleton);
    })
}())