/**
 * Permalink Handler
 * Handles resolution of permalink shortcuts to full URLs
 */

export class PermalinkManager {
    constructor(links = 'config/permalinks.json') {
        this.links = links;
    }

    /**
     * Check if current URL has a permalink parameter and resolve it
     * @returns {Object|null} Resolved permalink parameters or null
     */
    async detectAndRedirect() {

        const urlParams = new URLSearchParams(window.location.search);
        const permalinkId = urlParams.get('permalink') || urlParams.get('p');
        if (!permalinkId) {
            return;
        }

        const response = await fetch(this.links);
        const data = await response.json();
        if (!(permalinkId in data.permalinks)) {
            return;
        }

        const permalinkUrl = data.permalinks[permalinkId].url;
        const originalHash = window.location.hash;

        if (originalHash) {
            const url = new URL(permalinkUrl);
            const newUrl = `${url.origin}${url.pathname}${url.search}${originalHash}`;
            window.location.replace(newUrl);
        } else {
            window.location.replace(permalinkUrl);
        }
    }
}