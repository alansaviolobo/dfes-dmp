export class ButtonRssFeedManager {
    constructor() {
        this.options = {
            position: 'top-left',
            rssUrl: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' // Example RSS feed
        };

        this._map = null;
        this._container = null;
        this._panel = null;
        this._dragListeners = null;
    }

    onAdd(map) {
        this._map = map;
        this._createContainer();
        return this._container;
    }

    onRemove() {
        this._cleanup();
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
    }

    getDefaultPosition() {
        return this.options.position;
    }

    _createContainer() {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon rss-feed-control-btn';
        button.type = 'button';
        button.setAttribute('aria-label', 'RSS Feeds');

        // Use a suitable icon, e.g., Shoelace rss icon if available, or a generic one
        // For now, let's use a wifi icon which is close enough if rss isn't available, or just text/svg
        // Checking index.html, it uses bootstrap icons or shoelace icons. Shoelace likely has 'rss'.
        // If not, 'broadcast' or 'wifi'. Let's try 'rss' first, if not render, fallback.
        // Actually, let's use 'rss' if it exists in Shoelace, otherwise 'broadcast'.
        const icon = document.createElement('sl-icon');
        icon.name = 'rss';

        button.appendChild(icon);

        button.addEventListener('click', () => {
            this._togglePanel();
        });

        // Hover effects similar to other controls
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#f0f0f0';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#ffffff';
        });

        this._container.appendChild(button);

        this._createPanel();
    }

    _createPanel() {
        this._panel = document.createElement('div');
        this._panel.className = 'map-feature-panel rss-feed-panel';
        // We reuse 'map-feature-panel' class for basic styling (white bg, shadow, etc.) if it exists appropriately, 
        // or we adding our own specific styling. 
        // Based on map-feature-control.js, map-feature-panel likely defines the frame.

        // Default styles for the panel if class is not enough or to override
        this._panel.style.display = 'none';
        this._panel.style.width = '350px';
        this._panel.style.maxHeight = '80vh';
        this._panel.style.overflow = 'hidden';
        this._panel.style.flexDirection = 'column';
        // Position it absolute relative to map container
        this._panel.style.position = 'absolute';
        this._panel.style.top = '10px';
        this._panel.style.left = '50px'; // Offset from control group
        this._panel.style.zIndex = '1000';
        this._panel.style.backgroundColor = 'white';
        this._panel.style.borderRadius = '4px';
        this._panel.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';

        const header = document.createElement('div');
        header.className = 'map-feature-panel-header';
        header.style.padding = '10px';
        header.style.borderBottom = '1px solid #eee';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.cursor = 'move';
        header.innerHTML = '<span style="font-weight: bold;">RSS Feeds</span>';

        const closeBtn = document.createElement('sl-icon-button');
        closeBtn.name = 'x-lg';
        closeBtn.label = 'Close';
        closeBtn.addEventListener('click', () => this._hidePanel());
        header.appendChild(closeBtn);

        this._setupPanelDrag(header);

        const content = document.createElement('div');
        content.className = 'rss-feed-content';
        content.style.padding = '10px';
        content.style.overflowY = 'auto';
        content.style.flexGrow = '1';
        content.textContent = 'Loading feeds...';

        this._panel.appendChild(header);
        this._panel.appendChild(content);

        this._map.getContainer().appendChild(this._panel);
        this._contentDiv = content;
    }

    _loadFeeds() {
        // Use a CORS proxy if needed, or assume backend handles it. 
        // For a frontend-only app, we might run into CORS.
        // Let's try to fetch. If it fails, we might need a prozy.
        // For now, I'll use a placeholder or the provided URL.
        // Many public RSS feeds allow CORS or we might need a proxy like 'https://api.allorigins.win/get?url='

        const feedUrl = this.options.rssUrl;
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(feedUrl);

        fetch(proxyUrl)
            .then(response => {
                if (response.ok) return response.json();
                throw new Error('Network response was not ok.');
            })
            .then(data => {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(data.contents, "text/xml");
                const items = xmlDoc.querySelectorAll("item");

                if (items.length === 0) {
                    this._contentDiv.innerHTML = 'No items found.';
                    return;
                }

                let html = '<ul style="list-style: none; padding: 0;">';
                items.forEach(item => {
                    const title = item.querySelector("title")?.textContent || 'No Title';
                    const link = item.querySelector("link")?.textContent || '#';
                    const description = item.querySelector("description")?.textContent || '';

                    html += `
                        <li style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                            <a href="${link}" target="_blank" style="font-weight: bold; color: #007bff; text-decoration: none;">${title}</a>
                            <p style="margin: 5px 0 0; font-size: 0.9em; color: #555;">${description.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                        </li>
                    `;
                });
                html += '</ul>';
                this._contentDiv.innerHTML = html;
            })
            .catch(error => {
                console.error('Error fetching RSS feed:', error);
                this._contentDiv.innerHTML = `Error loading feeds: ${error.message}`;
            });
    }

    _togglePanel() {
        if (this._panel.style.display === 'none') {
            this._showPanel();
        } else {
            this._hidePanel();
        }
    }

    _showPanel() {
        this._panel.style.display = 'flex';
        if (this._contentDiv.textContent === 'Loading feeds...') {
            this._loadFeeds();
        }
    }

    _hidePanel() {
        this._panel.style.display = 'none';
    }

    _setupPanelDrag(dragHandle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const onMouseDown = (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = this._panel.getBoundingClientRect();
            // We need to calculate based on offsetParent (map container)
            const parentRect = this._map.getContainer().getBoundingClientRect();

            initialLeft = rect.left - parentRect.left;
            initialTop = rect.top - parentRect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            this._panel.style.left = `${initialLeft + dx}px`;
            this._panel.style.top = `${initialTop + dy}px`;
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        dragHandle.addEventListener('mousedown', onMouseDown);
    }

    _cleanup() {
        // Remove listeners if any global ones were added that persist
    }
}
