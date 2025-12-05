/**
 * Navigates to the sound page.
 */
function navigateToSound(event) {
    event.preventDefault();
    const currentHash = window.location.hash;
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/sound/${currentHash}`;
}

/**
 * This will execute the google analytics script for the amche.in domain
 */
if (window.location.hostname === window.amche.DOMAIN_URL) {
    // Load Google Analytics
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + window.amche.GOOGLE_ANALYTICS;
    document.head.appendChild(gtagScript);
    window.dataLayer = window.dataLayer || [];

    function gtag() {
        dataLayer.push(arguments);
    }

    gtag('js', new Date());
    gtag('config', window.amche.GOOGLE_ANALYTICS);
}

/**
 * Activating the skeletonContainer element.
 */
// Add this after your existing scripts
const skeletonContainer = document.getElementById('skeleton-container');
const numberOfSkeletons = 15;

Array.from({length: numberOfSkeletons}).forEach(() => {
    const skeleton = document.createElement('sl-skeleton');
    skeleton.className = 'skeleton-map-controls';
    skeleton.setAttribute('effect', 'pulse');
    skeletonContainer.appendChild(skeleton);
});

/**
 * Initialize drawer functionality and navigation
 */
// Initialize drawer functionality after Shoelace components are ready
customElements.whenDefined('sl-drawer').then(() => {
    const drawer = document.querySelector('.drawer-placement-start');

    // Track if drawer was manually toggled
    let userToggledDrawer = false;

    // Function to handle drawer state based on screen size, respecting user toggles
    function handleDrawerState() {
        // Don't automatically change drawer state if the user manually toggled it
        if (userToggledDrawer) return;

        // Keep drawer closed by default on all screen sizes
        // Users can manually open it if needed
        drawer.hide();
    }

    // Initial state - with a delay to ensure components are fully initialized
    setTimeout(() => {
        handleDrawerState();
    }, 100);

    // Listen for window resize, but don't apply on touch devices
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) {
        window.addEventListener('resize', handleDrawerState);
    }

    // Listen for drawer events to track manual toggles
    // Use more specific event handlers to avoid conflicts with programmatic toggles
    drawer.addEventListener('sl-after-show', (event) => {
        // Only mark as user-toggled if it's a direct user interaction
        if (event.target === drawer) {
            userToggledDrawer = true;
            console.log('[HTML] Drawer manually opened by user');
        }
    });

    drawer.addEventListener('sl-after-hide', (event) => {
        // Only mark as user-toggled if it's a direct user interaction
        if (event.target === drawer) {
            userToggledDrawer = true;
            console.log('[HTML] Drawer manually closed by user');
        }
    });
});

// Handle navigation dropdown menu clicks
customElements.whenDefined('sl-menu-item').then(() => {
    // Handle help menu item click
    const helpMenuItem = document.getElementById('help-menu-item');
    if (helpMenuItem) {
        helpMenuItem.addEventListener('click', (event) => {
            event.preventDefault();
            // Create new IntroContentManager instance without auto-close
            new IntroContentManager({enableAutoClose: false});
        });
    }

    document.querySelectorAll('sl-menu-item[href]').forEach(item => {
        item.addEventListener('click', (event) => {
            const href = item.getAttribute('href');
            if (href && href.startsWith('http')) {
                // External links - open in new tab if target="_blank"
                if (item.getAttribute('target') === '_blank') {
                    event.preventDefault();
                    window.open(href, '_blank');
                }
            } else if (href) {
                // Internal navigation
                if (!item.hasAttribute('onclick')) {
                    event.preventDefault();
                    window.location.href = href;
                }
            }
        });
    });
});

/**
 * MapLinks and ShareLink controls initialization
 */
import {MapLinks} from './map-links.js';
import {ShareLink} from './share-link.js';

window.addEventListener('mapReady', (event) => {
    const map = event.detail.map;

    const mapLinks = new MapLinks();
    map.addControl(mapLinks, 'bottom-right');

    const shareLink = new ShareLink({
        url: () => window.location.href,
        showToast: true,
        qrCodeSize: 500
    });
    map.addControl(shareLink, 'bottom-right');
});

document.addEventListener('DOMContentLoaded', () => {
    const parentElement = document.getElementById('mapbox-search-box-container');
    var searchbox = document.createElement('mapbox-search-box');
    Object.assign(searchbox, {
        'access-token' : window.amche.MAPBOXGL_ACCESS_TOKEN,
        types : "place,locality,postcode,region,district,street,address,poi",
        country : "IN",
        language : "en",
        proximity : "73.87916,15.26032"
    });
    parentElement.appendChild(searchbox);
})