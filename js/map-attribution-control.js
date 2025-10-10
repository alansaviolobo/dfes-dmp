/**
 * MapAttributionControl - A Mapbox GL JS plugin that manages and formats attribution content
 * 
 * This plugin extends the default Mapbox attribution control to:
 * - Remove duplicate "Improve this map" links
 * - Format attribution content as layers change
 * - Provide a cleaner, more organized attribution display
 * 
 * Usage:
 * const attributionControl = new MapAttributionControl();
 * map.addControl(attributionControl, 'bottom-right');
 */

export class MapAttributionControl {
    constructor(options = {}) {
        this.options = {
            compact: false,
            customAttribution: '',
            ...options
        };
        
        this._map = null;
        this._container = null;
        this._innerContainer = null;
        this._observer = null;
        
        // Track known attributions to avoid duplicates
        this._knownAttributions = new Set();
        
        // Bind methods to preserve context
        this._updateAttribution = this._updateAttribution.bind(this);
        this._handleSourceChange = this._handleSourceChange.bind(this);
    }

    onAdd(map) {
        this._map = map;
        
        // Create the main container
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapboxgl-ctrl-attrib';
        
        // Create the inner container
        this._innerContainer = document.createElement('div');
        this._innerContainer.className = 'mapboxgl-ctrl-attrib-inner';
        this._container.appendChild(this._innerContainer);
        
        // Set up initial attribution
        this._updateAttribution();
        
        // Listen for source changes
        this._map.on('sourcedata', this._handleSourceChange);
        this._map.on('styledata', this._handleSourceChange);
        this._map.on('data', this._handleSourceChange);
        
        // Listen for layer visibility changes
        this._map.on('layer.add', this._updateAttribution);
        this._map.on('layer.remove', this._updateAttribution);
        
        // Set up mutation observer to watch for attribution changes
        this._setupMutationObserver();
        
        return this._container;
    }

    onRemove() {
        if (this._map) {
            this._map.off('sourcedata', this._handleSourceChange);
            this._map.off('styledata', this._handleSourceChange);
            this._map.off('data', this._handleSourceChange);
            this._map.off('layer.add', this._updateAttribution);
            this._map.off('layer.remove', this._updateAttribution);
        }
        
        if (this._observer) {
            this._observer.disconnect();
        }
        
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        
        this._map = null;
        this._container = null;
        this._innerContainer = null;
        this._observer = null;
    }

    /**
     * Set up mutation observer to watch for changes in attribution content
     */
    _setupMutationObserver() {
        if (!this._innerContainer) return;
        
        this._observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    shouldUpdate = true;
                }
            });
            
            if (shouldUpdate) {
                // Debounce the update to avoid excessive processing
                clearTimeout(this._updateTimeout);
                this._updateTimeout = setTimeout(() => {
                    this._formatAttributionContent();
                }, 100);
            }
        });
        
        this._observer.observe(this._innerContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    /**
     * Handle source data changes
     */
    _handleSourceChange(e) {
        // Only update on source or style load events
        if (e.sourceDataType === 'metadata' || e.type === 'styledata') {
            this._updateAttribution();
        }
    }

    /**
     * Update attribution content
     */
    _updateAttribution() {
        if (!this._map || !this._innerContainer) return;
        
        try {
            // Get all sources and their attributions
            const style = this._map.getStyle();
            if (!style || !style.sources) return;
            
            const attributions = new Set();
            
            // Add base map attributions
            this._addBaseMapAttributions(attributions);
            
            // Add source attributions
            Object.values(style.sources).forEach(source => {
                if (source.attribution) {
                    attributions.add(source.attribution);
                }
            });
            
            // Add custom attribution if provided
            if (this.options.customAttribution) {
                attributions.add(this.options.customAttribution);
            }

            // Add layer-specific attributions
            if (this._layerAttributions && this._layerAttributions.size > 0) {
                this._layerAttributions.forEach((attribution, layerId) => {
                    if (attribution && attribution.trim()) {
                        attributions.add(attribution);
                    }
                });
            }
            
            // Format and display attributions
            this._displayAttributions(Array.from(attributions));
            
        } catch (error) {
            console.warn('[MapAttributionControl] Error updating attribution:', error);
        }
    }

    /**
     * Add base map attributions (Mapbox, OpenStreetMap, etc.)
     */
    _addBaseMapAttributions(attributions) {
        // Standard Mapbox attribution
        attributions.add('© <a href="https://www.mapbox.com/about/maps/" target="_blank" title="Mapbox" aria-label="Mapbox">Mapbox</a>');
        
        // OpenStreetMap attribution
        attributions.add('© <a href="https://www.openstreetmap.org/copyright/" target="_blank" title="OpenStreetMap" aria-label="OpenStreetMap">OpenStreetMap</a>');
        
        // Add other common attributions if needed
        // This could be made configurable in the future
    }

    /**
     * Display formatted attributions
     */
    _displayAttributions(attributions) {
        if (!this._innerContainer) return;
        
        // Filter out empty attributions
        const validAttributions = attributions.filter(attr => attr && attr.trim());
        
        if (validAttributions.length === 0) {
            this._innerContainer.innerHTML = '';
            return;
        }
        
        // Process and deduplicate attributions
        const processedAttributions = this._processAttributions(validAttributions);
        
        // Join with separators
        const formattedAttribution = processedAttributions.join(' | ');
        
        // Update the inner container
        this._innerContainer.innerHTML = formattedAttribution;
        
        // Apply additional formatting
        this._formatAttributionContent();
    }

    /**
     * Process attributions to remove duplicates and format properly
     */
    _processAttributions(attributions) {
        const processed = [];
        const seenLinks = new Set();
        const seenTexts = new Set();
        
        attributions.forEach(attribution => {
            if (!attribution || !attribution.trim()) return;
            
            // Parse links from the attribution
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = attribution;
            
            const links = tempDiv.querySelectorAll('a');
            const hasLinks = links.length > 0;
            
            if (hasLinks) {
                // Process each link separately to avoid duplicates
                links.forEach(link => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    const linkKey = `${href}:${text}`;
                    
                    if (!seenLinks.has(linkKey)) {
                        seenLinks.add(linkKey);
                        processed.push(link.outerHTML);
                    }
                });
            } else {
                // Handle plain text attributions
                const trimmedText = attribution.trim();
                if (!seenTexts.has(trimmedText)) {
                    seenTexts.add(trimmedText);
                    processed.push(trimmedText);
                }
            }
        });
        
        return processed;
    }

    /**
     * Format attribution content after it's been set
     */
    _formatAttributionContent() {
        if (!this._innerContainer) return;
        
        try {
            // Apply consistent styling
            this._applyAttributionStyling();
            
        } catch (error) {
            console.warn('[MapAttributionControl] Error formatting attribution content:', error);
        }
    }

    /**
     * Apply consistent styling to attribution elements
     */
    _applyAttributionStyling() {
        // Ensure all links have proper attributes
        const links = this._innerContainer.querySelectorAll('a');
        links.forEach(link => {
            if (!link.hasAttribute('target')) {
                link.setAttribute('target', '_blank');
            }
            if (!link.hasAttribute('rel')) {
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }

    /**
     * Add custom attribution
     */
    addAttribution(attribution) {
        if (!attribution || !attribution.trim()) return;
        
        this.options.customAttribution = this.options.customAttribution ? 
            `${this.options.customAttribution} | ${attribution}` : 
            attribution;
        
        this._updateAttribution();
    }

    /**
     * Remove custom attribution
     */
    removeAttribution(attribution) {
        if (!this.options.customAttribution || !attribution) return;
        
        this.options.customAttribution = this.options.customAttribution
            .split(' | ')
            .filter(attr => attr !== attribution)
            .join(' | ');
        
        this._updateAttribution();
    }

    /**
     * Get the current attribution container for external access
     */
    getContainer() {
        return this._container;
    }

    /**
     * Get the inner attribution container for external access
     */
    getInnerContainer() {
        return this._innerContainer;
    }

    /**
     * Force update attribution (useful when called from layer controls)
     */
    forceUpdate() {
        this._updateAttribution();
    }

    /**
     * Add layer-specific attribution
     */
    addLayerAttribution(layerId, attribution) {
        if (!attribution || !attribution.trim()) return;
        
        // Store layer-specific attributions
        if (!this._layerAttributions) {
            this._layerAttributions = new Map();
        }
        
        this._layerAttributions.set(layerId, attribution);
        this._updateAttribution();
    }

    /**
     * Remove layer-specific attribution
     */
    removeLayerAttribution(layerId) {
        if (this._layerAttributions) {
            this._layerAttributions.delete(layerId);
            this._updateAttribution();
        }
    }
}

// Make the control available globally for backwards compatibility
if (typeof window !== 'undefined') {
    window.MapAttributionControl = MapAttributionControl;
}
