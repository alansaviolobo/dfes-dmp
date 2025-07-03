import { localization } from './localization.js';
import { LayerSettingsModal } from './layer-settings.js';
import { MapboxAPI } from './mapbox-api.js';
import { deepMerge } from './map-utils.js';

/**
 * MapLayerControl - UI control for managing map layers using MapboxAPI abstraction
 * 
 * This refactored version delegates all Mapbox-specific operations to the MapboxAPI class,
 * keeping this class focused on UI management and configuration handling.
 */
export class MapLayerControl {
    constructor(options) {
        // Handle options structure for groups and configuration
        if (Array.isArray(options)) {
            this._state = { groups: options };
            this._config = {};
        } else if (options && options.groups) {
            this._state = { groups: options.groups };
            this._config = options;
        } else {
            this._state = { groups: [options] };
            this._config = {};
        }

        this._domCache = {};
        this._instanceId = (MapLayerControl.instances || 0) + 1;
        MapLayerControl.instances = this._instanceId;
        this._initialized = false;
        this._sourceControls = [];
        this._editMode = false;

        // Global click handler tracking
        this._globalClickHandlerAdded = false;

        // MapboxAPI instance will be initialized when map is available
        this._mapboxAPI = null;

        // Initialize default styles (will be populated by _loadDefaultStyles)
        this._defaultStyles = {};

        // Initialize UI components
        this._initializeEditMode();
        this._initializeShareLink();
        this._layerSettingsModal = null;
        this._stateManager = null;

        // Load default styles asynchronously
        this._loadDefaultStyles();
    }

    /**
     * Initialize the control with map and container
     */
    async renderToContainer(container, map) {
        this._container = container;
        this._map = map;

        // Make sure default styles are loaded BEFORE creating MapboxAPI
        await this._ensureDefaultStylesLoaded();

        // Initialize MapboxAPI with the map and atlas configuration
        this._mapboxAPI = new MapboxAPI(map, {
            styles: this._defaultStyles
        });

        // Initialize layer settings modal
        this._layerSettingsModal = new LayerSettingsModal(this);

        // Add global click handler early
        this._addGlobalClickHandler();

        // Initialize the control UI
        if (this._map.isStyleLoaded()) {
            this._initializeControl($(container));
            this._initializeFilterControls();
        } else {
            this._map.on('style.load', () => {
                this._initializeControl($(container));
                this._initializeFilterControls();
            });
        }

        $(container).append($('<div>', { class: 'layer-control' }));
    }

    /**
     * Load default styles configuration
     */
    async _loadDefaultStyles() {
        try {
            const defaultsResponse = await fetch('/config/_defaults.json');
            const configResponse = await fetch('/config/index.atlas.json');

            if (!defaultsResponse.ok || !configResponse.ok) {
                throw new Error('Failed to load configuration files');
            }

            const defaults = await defaultsResponse.json();
            const config = await configResponse.json();

            // Extract styles from defaults configuration
            if (defaults.layer && defaults.layer.style) {
                this._defaultStyles = defaults.layer.style || {};
            } else if (defaults.style) {
                this._defaultStyles = defaults.style || {};
            } else if (defaults.styles) {
                this._defaultStyles = defaults.styles || {};
            } else {
                console.warn('Could not find styles in defaults structure:', Object.keys(defaults));
                this._defaultStyles = {};
            }

            // Ensure _defaultStyles is never null or undefined
            if (!this._defaultStyles || typeof this._defaultStyles !== 'object') {
                this._defaultStyles = {};
            }

            // Merge with config overrides
            if (config.styles) {
                const merged = deepMerge(config.styles, this._defaultStyles);
                this._defaultStyles = merged || {};
            }

        } catch (error) {
            console.error('Error loading default styles:', error);
            this._defaultStyles = this._getFallbackStyles();
        }
    }

    /**
     * Get fallback default styles if loading fails
     */
    _getFallbackStyles() {
        return {
            vector: {
                fill: { 'fill-color': '#000000', 'fill-opacity': 0.5 },
                line: { 'line-color': '#000000', 'line-width': 1 },
                text: { 'text-color': '#000000', 'text-halo-width': 1 },
                circle: { 'circle-radius': 5, 'circle-color': '#000000' }
            },
            raster: { 'raster-opacity': 1 }
        };
    }

    /**
     * Ensure default styles are loaded
     */
    async _ensureDefaultStylesLoaded() {
        // Ensure _defaultStyles exists and has content
        if (this._defaultStyles && typeof this._defaultStyles === 'object' && Object.keys(this._defaultStyles).length > 0) {
            return;
        }
        await this._loadDefaultStyles();
    }

    /**
     * Update state with new configuration
     */
    _updateState(newState) {
        this._state = {
            ...this._state,
            groups: newState.groups.map(newGroup => {
                const existingGroup = this._state.groups.find(g => g.id === newGroup.id);
                return existingGroup ? { ...existingGroup, ...newGroup } : newGroup;
            })
        };

        this._cleanupLayers();
        this._rebuildUI();
    }

    /**
     * Clean up existing layers using MapboxAPI
     */
    _cleanupLayers() {
        if (!this._mapboxAPI) return;

        // Disable terrain first
        if (this._map.getTerrain()) {
            this._map.setTerrain(null);
        }

        // Remove all custom layers and sources using MapboxAPI
        this._state.groups.forEach(group => {
            this._mapboxAPI.removeLayerGroup(group.id, group);
        });
    }

    /**
     * Rebuild the UI
     */
    _rebuildUI() {
        if (this._container) {
            this._container.innerHTML = '';
            this._sourceControls = [];
            this._initializeControl($(this._container));
        }
    }

    /**
     * Load external configuration
     */
    async loadExternalConfig(url) {
        try {
            const response = await fetch(url);
            const configText = await response.text();

            let config;
            let fullConfig;

            // Handle JS or JSON format
            if (configText.trim().startsWith('let') || configText.trim().startsWith('const')) {
                const extractConfig = new Function(`
                    ${configText}
                    return layers;
                `);
                config = extractConfig();
            } else {
                fullConfig = JSON.parse(configText);
                config = fullConfig.layers && Array.isArray(fullConfig.layers) ? 
                    fullConfig.layers : fullConfig;
            }

            // Apply localization if available
            if (fullConfig) {
                localization.loadStrings(fullConfig);
                setTimeout(() => localization.forceUpdateUIElements(), 100);
            }

            this._updateState({ groups: config });

        } catch (error) {
            console.error('Error loading external config:', error);
            alert('Failed to load external configuration. Please check the console for details.');
            throw error;
        }
    }

    /**
     * Initialize the main control UI
     */
    _initializeControl($container) {
        this._state.groups.forEach((group, groupIndex) => {
            const $groupHeader = this._createGroupHeader(group, groupIndex);
            $container.append($groupHeader);
        });

        // Initialize all layers explicitly after UI is set up
        this._initializeAllLayers();

        if (!this._initialized) {
            this._initializeWithAnimation();
        }
    }

    /**
     * Initialize all layers to their proper visibility states
     */
    _initializeAllLayers() {
        this._state.groups.forEach((group, groupIndex) => {
            // Initialize the layer state using MapboxAPI
            // For all layers, explicitly set their initial visibility state
            if (group.initiallyChecked) {
                console.debug(`[LayerControl] Initializing layer ${group.id} as VISIBLE (initiallyChecked: true)`);
                requestAnimationFrame(() => {
                    this._toggleLayerGroup(groupIndex, true);
                });
            } else {
                // Explicitly hide layers that should not be visible initially
                // This is especially important for style layers which are visible by default
                console.debug(`[LayerControl] Initializing layer ${group.id} as HIDDEN (initiallyChecked: false/undefined)`);
                requestAnimationFrame(() => {
                    this._toggleLayerGroup(groupIndex, false);
                });
            }
        });
    }

    /**
     * Create group header UI element
     */
    _createGroupHeader(group, groupIndex) {
        const $groupHeader = $('<sl-details>', {
            class: 'group-header w-full map-controls-group',
            open: group.initiallyChecked || false
        });
        
        $groupHeader.attr('data-layer-id', group.id);
        this._sourceControls[groupIndex] = $groupHeader[0];

        // Create control buttons
        const $settingsButton = this._createSettingsButton(group);
        const $opacityButton = this._createOpacityButton(group, groupIndex);

        // Set up event handlers
        this._setupGroupHeaderEvents($groupHeader, group, groupIndex, $opacityButton, $settingsButton);

        // Create summary section
        const $summary = this._createGroupSummary(group, $settingsButton, $opacityButton);
        $groupHeader.append($summary);

        // Add description and attribution
        this._addGroupMetadata($groupHeader, group);

        // Add type-specific content
        this._addTypeSpecificContent($groupHeader, group, groupIndex);

        return $groupHeader;
    }

    /**
     * Create settings button
     */
    _createSettingsButton(group) {
        const $settingsButton = $('<sl-icon-button>', {
            name: 'gear-fill',
            class: 'settings-button ml-auto hidden',
            label: 'Layer Settings'
        });

        $settingsButton[0].addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._layerSettingsModal.show(group);
        });

        return $settingsButton;
    }

    /**
     * Create opacity button
     */
    _createOpacityButton(group, groupIndex) {
        if (!['tms', 'vector', 'geojson', 'layer-group', 'img', 'raster-style-layer'].includes(group.type)) {
            return $('<span>');
        }

        const $opacityButton = $('<sl-icon-button>', {
            class: 'opacity-toggle hidden',
            'data-opacity': '0.4',
            title: 'Toggle opacity',
            name: 'lightbulb-fill'
        });

        $opacityButton[0].addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._handleOpacityToggle(group, $opacityButton);
        });

        return $opacityButton;
    }

    /**
     * Handle opacity toggle using MapboxAPI
     */
    _handleOpacityToggle(group, $opacityButton) {
        const currentOpacity = parseFloat($opacityButton.attr('data-opacity'));
        const newOpacity = currentOpacity === 0.4 ? 0.9 : 0.4;
        
        $opacityButton.attr('data-opacity', newOpacity);
        $opacityButton.attr('name', newOpacity === 0.9 ? 'lightbulb-fill' : 'lightbulb');

        // Use MapboxAPI to update opacity
        this._mapboxAPI.updateLayerOpacity(group.id, group, newOpacity);
    }

    /**
     * Set up group header event handlers
     */
    _setupGroupHeaderEvents($groupHeader, group, groupIndex, $opacityButton, $settingsButton) {
        $groupHeader[0].addEventListener('sl-show', (event) => {
            this._handleGroupShow(event, group, groupIndex, $opacityButton, $settingsButton);
        });

        $groupHeader[0].addEventListener('sl-hide', (event) => {
            this._handleGroupHide(event, group, groupIndex, $opacityButton, $settingsButton);
        });
    }

    /**
     * Handle group show event
     */
    _handleGroupShow(event, group, groupIndex, $opacityButton, $settingsButton) {
        const toggleInput = event.target.querySelector('.toggle-switch input[type="checkbox"]');
        
        if (toggleInput && !toggleInput.checked) {
            toggleInput.checked = true;
        }

        // For style layers, sync sublayer states
        if (group.type === 'style' && group.layers) {
            this._syncStyleLayerSubToggles(event.target, group, true);
        }

        this._toggleLayerGroup(groupIndex, true);
        
        $opacityButton.toggleClass('hidden', false);
        $settingsButton.toggleClass('hidden', false);
        $(event.target).closest('.group-header').addClass('active');
    }

    /**
     * Handle group hide event
     */
    _handleGroupHide(event, group, groupIndex, $opacityButton, $settingsButton) {
        const toggleInput = event.target.querySelector('.toggle-switch input[type="checkbox"]');
        
        if (toggleInput && toggleInput.checked) {
            toggleInput.checked = false;
        }

        // For style layers, sync sublayer states
        if (group.type === 'style' && group.layers) {
            this._syncStyleLayerSubToggles(event.target, group, false);
        }

        this._toggleLayerGroup(groupIndex, false);
        
        $opacityButton.toggleClass('hidden', true);
        $settingsButton.toggleClass('hidden', true);
        $(event.target).closest('.group-header').removeClass('active');
    }

    /**
     * Sync sublayer toggle states for style layers
     */
    _syncStyleLayerSubToggles(groupElement, group, isVisible) {
        const $sublayerToggles = $(groupElement).find('.layer-controls .toggle-switch input[type="checkbox"]');
        
        if (isVisible) {
            // When showing, set sublayer toggles to match actual layer visibility
            $sublayerToggles.each((index, toggle) => {
                const layer = group.layers[index];
                if (layer) {
                    const actualVisibility = this._getStyleLayerVisibility(layer);
                    $(toggle).prop('checked', actualVisibility);
                }
            });
        } else {
            // When hiding, turn off all sublayer toggles and hide the layers
            $sublayerToggles.prop('checked', false);
            group.layers.forEach(layer => {
                this._handleStyleLayerToggle(layer, false);
            });
        }
    }

    /**
     * Toggle layer group visibility using MapboxAPI
     */
    async _toggleLayerGroup(groupIndex, visible) {
        const group = this._state.groups[groupIndex];
        
        if (!this._mapboxAPI) {
            console.warn('MapboxAPI not initialized');
            return;
        }

        try {
            if (visible) {
                // Create or show the layer group
                await this._mapboxAPI.createLayerGroup(group.id, group, { visible: true });
                
                // For style layers, ensure sublayers are properly synchronized
                if (group.type === 'style' && group.layers) {
                    // Find the group header element to sync sublayer toggles
                    const groupElement = this._container.querySelector(`[data-layer-id="${group.id}"]`);
                    if (groupElement) {
                        // Use a small delay to ensure the main layer is fully processed
                        setTimeout(() => {
                            this._syncStyleLayerSubToggles(groupElement, group, true);
                        }, 50);
                    }
                }
                
                // Register with state manager if available
                if (this._stateManager) {
                    this._registerLayerWithStateManager(group);
                }
            } else {
                // Hide the layer group
                this._mapboxAPI.updateLayerGroupVisibility(group.id, group, false);
                
                // Unregister with state manager if available
                if (this._stateManager) {
                    this._unregisterLayerWithStateManager(group.id);
                }
            }
        } catch (error) {
            console.error(`Error toggling layer group ${group.id}:`, error);
        }
    }

    /**
     * Create group summary section
     */
    _createGroupSummary(group, $settingsButton, $opacityButton) {
        const $summary = $('<div>', {
            slot: 'summary',
            class: 'flex items-center relative w-full h-12 bg-gray-800'
        });

        const $contentWrapper = $('<div>', {
            class: 'flex items-center gap-2 relative z-10 w-full p-2'
        });

        const $toggleTitleContainer = this._createToggleTitle(group);
        $contentWrapper.append($toggleTitleContainer, $settingsButton, $opacityButton);

        // Add header background if exists
        if (group.headerImage) {
            const $headerBg = $('<div>', {
                class: 'absolute top-0 left-0 right-0 w-full h-full bg-cover bg-center bg-no-repeat',
                style: `background-image: url('${group.headerImage}')`
            });

            const $headerOverlay = $('<div>', {
                class: 'absolute top-0 left-0 right-0 w-full h-full bg-black bg-opacity-40'
            });

            $summary.append($headerBg, $headerOverlay, $contentWrapper);
        } else {
            $summary.append($contentWrapper);
        }

        return $summary;
    }

    /**
     * Create toggle title section
     */
    _createToggleTitle(group) {
        const $toggleLabel = $('<label>', { class: 'toggle-switch' });
        const $toggleInput = $('<input>', {
            type: 'checkbox',
            checked: group.initiallyChecked || false
        });
        const $toggleSlider = $('<span>', { class: 'toggle-slider' });

        $toggleLabel.append($toggleInput, $toggleSlider);

        const $titleSpan = $('<span>', {
            text: group.title,
            class: 'control-title text-sm font-medium font-bold text-white'
        });

        const $toggleTitleContainer = $('<div>', {
            class: 'flex items-center gap-2 cursor-pointer'
        });
        
        $toggleTitleContainer.append($toggleLabel, $titleSpan);
        return $toggleTitleContainer;
    }

    /**
     * Add group metadata (description, attribution)
     */
    _addGroupMetadata($groupHeader, group) {
        if (group.description || group.attribution) {
            const $contentArea = $('<div>', { class: 'description-area' });

            if (group.description) {
                const $description = $('<div>', {
                    class: 'text-sm text-gray-600',
                    html: group.description
                });
                $contentArea.append($description);
            }

            if (group.attribution) {
                const $attribution = $('<div>', {
                    class: 'layer-attribution',
                    html: `Source: ${group.attribution.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')}`
                });
                $contentArea.append($attribution);
            }

            $groupHeader.append($contentArea);
        }
    }

    /**
     * Add type-specific content
     */
    _addTypeSpecificContent($groupHeader, group, groupIndex) {
        switch (group.type) {
            case 'layer-group':
                this._addLayerGroupContent($groupHeader, group);
                break;
            case 'style':
                this._addStyleLayerContent($groupHeader, group);
                break;
            case 'terrain':
                this._addTerrainContent($groupHeader, group);
                break;
            default:
                // Most layer types don't need special content
                break;
        }

        // Add legend if available
        if (group.legendImage) {
            $groupHeader.append(`
                <div class="legend-container">
                    ${this._renderLegendImage(group.legendImage)}
                </div>
            `);
        }
    }

    /**
     * Add layer group specific content
     */
    _addLayerGroupContent($groupHeader, group) {
        if (!group.groups) return;

        const $radioGroup = $('<div>', { class: 'radio-group mt-2' });
        
        group.groups.forEach((subGroup, index) => {
            const $radioLabel = this._createRadioOption(subGroup, group, index);
            $radioGroup.append($radioLabel);
        });

        const $contentArea = $('<div>');
        $contentArea.append($radioGroup);
        $groupHeader.append($contentArea);
    }

    /**
     * Create radio option for layer groups
     */
    _createRadioOption(subGroup, parentGroup, index) {
        const $radioLabel = $('<label>', { class: 'radio-label' });
        const $radio = $('<input>', {
            type: 'radio',
            name: `layer-group-${this._instanceId}-${parentGroup.id}`,
            value: subGroup.id,
            checked: index === 0
        });

        $radio.on('change', () => {
            this._handleLayerGroupChange(subGroup.id, parentGroup.groups);
        });

        $radioLabel.append(
            $radio,
            $('<span>', { text: subGroup.title })
        );

        // Add attribution and location links
        if (subGroup.attribution || subGroup.location) {
            const links = [];
            if (subGroup.attribution) {
                links.push(`<a href="${subGroup.attribution}" target="_blank" class="hover:underline">Source</a>`);
            }
            if (subGroup.location) {
                links.push(`<a href="#" class="hover:underline view-link" data-location="${subGroup.location}">View</a>`);
            }

            const $infoDiv = $('<div>', {
                class: 'layer-info text-xs pl-5 text-gray-600',
                html: links.join(' | ')
            });

            $infoDiv.find('.view-link').on('click', (e) => {
                e.preventDefault();
                this._flyToLocation(subGroup.location);
            });

            $radioLabel.append($infoDiv);
        }

        return $radioLabel;
    }

    /**
     * Handle layer group change using MapboxAPI
     */
    _handleLayerGroupChange(selectedId, groups) {
        if (!this._mapboxAPI) return;

        // Hide all layers in the group
        groups.forEach(group => {
            this._mapboxAPI.updateLayerGroupVisibility(group.id, group, false);
        });

        // Show selected layer
        const selectedGroup = groups.find(g => g.id === selectedId);
        if (selectedGroup) {
            this._mapboxAPI.updateLayerGroupVisibility(selectedGroup.id, selectedGroup, true);
        }
    }

    /**
     * Add style layer specific content
     */
    _addStyleLayerContent($groupHeader, group) {
        if (!group.layers) return;

        const $layerControls = $('<div>', { class: 'layer-controls mt-3' });

        group.layers.forEach((layer, index) => {
            const $layerControl = this._createStyleLayerControl(layer, group, index);
            $layerControls.append($layerControl);
        });

        $groupHeader.append($layerControls);
    }

    /**
     * Create style layer control
     */
    _createStyleLayerControl(layer, parentGroup, index) {
        const layerId = `sublayer-${parentGroup.id}-${index}`;
        const $layerControl = $('<div>', { class: 'flex items-center gap-2 text-black' });

        const $sublayerToggleLabel = $('<label>', { class: 'toggle-switch' });
        
        // Check actual layer visibility instead of just parentGroup.initiallyChecked
        const isLayerVisible = this._getStyleLayerVisibility(layer);
        
        const $sublayerToggleInput = $('<input>', {
            type: 'checkbox',
            id: layerId,
            checked: isLayerVisible
        });
        const $sublayerToggleSlider = $('<span>', { class: 'toggle-slider' });

        $sublayerToggleLabel.append($sublayerToggleInput, $sublayerToggleSlider);

        $sublayerToggleInput.on('change', (e) => {
            this._handleStyleLayerToggle(layer, e.target.checked);
        });

        const $label = $('<label>', {
            for: layerId,
            class: 'text-sm cursor-pointer flex-grow'
        }).text(layer.title);

        $layerControl.append($sublayerToggleLabel, $label);
        return $layerControl;
    }

    /**
     * Get the visibility state of a style layer
     */
    _getStyleLayerVisibility(layer) {
        if (!this._map || !layer.sourceLayer) return false;
        
        try {
            const styleLayers = this._map.getStyle().layers;
            const matchingLayers = styleLayers.filter(styleLayer => 
                styleLayer['source-layer'] === layer.sourceLayer
            );
            
            // If any matching layer is visible, consider the layer visible
            return matchingLayers.some(styleLayer => {
                const layerVisibility = this._map.getLayoutProperty(styleLayer.id, 'visibility');
                return layerVisibility !== 'none';
            });
        } catch (error) {
            console.warn('Error checking style layer visibility:', error);
            return false;
        }
    }

    /**
     * Handle style layer toggle
     */
    _handleStyleLayerToggle(layer, isChecked) {
        const styleLayers = this._map.getStyle().layers;
        const layersToToggle = styleLayers
            .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
            .map(styleLayer => styleLayer.id);

        layersToToggle.forEach(layerId => {
            if (this._map.getLayer(layerId)) {
                this._map.setLayoutProperty(
                    layerId,
                    'visibility',
                    isChecked ? 'visible' : 'none'
                );
            }
        });
    }

    /**
     * Add terrain specific content
     */
    _addTerrainContent($groupHeader, group) {
        const $sourceControl = $('<div>', { class: 'source-control mt-3 terrain-control-container' });
        
        // Add contours toggle
        const $contoursContainer = this._createContoursControl();
        $sourceControl.append($contoursContainer);
        
        // Add terrain controls
        const $terrainControls = this._createTerrainControls();
        $sourceControl.append($terrainControls);
        
        $groupHeader.append($sourceControl);
    }

    /**
     * Create contours control
     */
    _createContoursControl() {
        const $contoursContainer = $('<div>', { class: 'mb-4' });
        const $contoursLabel = $('<label>', { class: 'flex items-center' });
        
        const $contoursToggleLabel = $('<label>', { class: 'toggle-switch mr-2' });
        const $contoursToggleInput = $('<input>', { type: 'checkbox', checked: false });
        const $contoursToggleSlider = $('<span>', { class: 'toggle-slider' });
        
        $contoursToggleLabel.append($contoursToggleInput, $contoursToggleSlider);
        
        $contoursToggleInput.on('change', (e) => {
            const contourLayers = ['contour lines', 'contour labels'];
            contourLayers.forEach(layerId => {
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(
                        layerId,
                        'visibility',
                        e.target.checked ? 'visible' : 'none'
                    );
                }
            });
        });
        
        $contoursLabel.append(
            $contoursToggleLabel,
            $('<span>', { class: 'text-sm text-gray-700', text: 'Contours' })
        );
        
        $contoursContainer.append($contoursLabel);
        return $contoursContainer;
    }

    /**
     * Create terrain controls (simplified version)
     */
    _createTerrainControls() {
        const $controlsContainer = $('<div>', { class: 'terrain-controls' });
        
        // Add exaggeration slider
        const $exaggerationSlider = $('<input>', {
            type: 'range',
            min: '0',
            max: '10',
            step: '0.2',
            value: '1.5',
            class: 'w-full'
        });
        
        const $exaggerationValue = $('<span>', {
            class: 'text-sm text-gray-600 ml-2',
            text: '1.5x'
        });
        
        $exaggerationSlider.on('input', (e) => {
            const value = parseFloat(e.target.value);
            $exaggerationValue.text(`${value}x`);
            if (this._map.getTerrain()) {
                this._map.setTerrain({
                    'source': 'mapbox-dem',
                    'exaggeration': value
                });
            }
        });
        
        $controlsContainer.append(
            $('<label>', { class: 'block text-sm text-gray-700 mb-1', text: 'Terrain Exaggeration' }),
            $('<div>', { class: 'flex items-center' }).append($exaggerationSlider, $exaggerationValue)
        );
        
        return $controlsContainer;
    }

    /**
     * Render legend image (PDF or regular image)
     */
    _renderLegendImage(legendImageUrl) {
        if (!legendImageUrl) return '';

        if (legendImageUrl.toLowerCase().endsWith('.pdf')) {
            return `
                <div class="legend-pdf-container">
                    <a href="${legendImageUrl}" target="_blank" class="pdf-legend-link">
                        <sl-icon name="file-earmark-pdf" style="color: red; font-size: 1.5rem;"></sl-icon>
                        <span>View Legend PDF</span>
                    </a>
                </div>
            `;
        } else {
            return `<img src="${legendImageUrl}" alt="Legend" class="legend-image">`;
        }
    }

    /**
     * Initialize with animation
     */
    _initializeWithAnimation() {
        const allToggles = this._container.querySelectorAll('.group-header .toggle-switch input[type="checkbox"]');
        const groupHeaders = Array.from(allToggles).filter(toggle => 
            !toggle.closest('.layer-controls')
        );

        groupHeaders.forEach((toggleInput, index) => {
            const group = this._state.groups[index];
            const shouldBeChecked = group?.initiallyChecked ?? false;
            toggleInput.checked = shouldBeChecked;

            void toggleInput.offsetHeight;
            const toggleSlider = toggleInput.nextElementSibling;
            if (toggleSlider && toggleSlider.classList.contains('toggle-slider')) {
                void toggleSlider.offsetHeight;
            }

            toggleInput.dispatchEvent(new Event('change'));
        });

        if (!this._initialized) {
            this._container.classList.add('no-transition');
            void this._container.offsetWidth;
            this._container.classList.remove('no-transition');
            this._initialized = true;
        }

        requestAnimationFrame(() => {
            this._container.classList.add('collapsed');
        });
    }

    /**
     * Fly to location using geocoding
     */
    async _flyToLocation(location) {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxgl.accessToken}&country=in`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                this._map.flyTo({
                    center: [lng, lat],
                    zoom: 12,
                    duration: 2000
                });
            }
        } catch (error) {
            console.error('Error flying to location:', error);
        }
    }

    /**
     * Toggle control visibility
     */
    toggleControl() {
        requestAnimationFrame(() => {
            this._container.classList.toggle('collapsed');
        });
        this._toggleButton.classList.toggle('is-open');
    }

    /**
     * Set state manager reference
     */
    setStateManager(stateManager) {
        this._stateManager = stateManager;
        // Try immediate registration, but with intelligent retry
        this._registerAllActiveLayersWithRetry();
    }
    
    /**
     * Register all active layers with intelligent retry mechanism
     */
    _registerAllActiveLayersWithRetry(attempt = 0) {
        if (!this._stateManager) return;
        
        const maxAttempts = 5;
        const delay = 100 * (attempt + 1); // Progressive delay: 100ms, 200ms, 300ms, etc.
        
        let layersNeedingRetry = [];
        
        this._state.groups.forEach(group => {
            if (group.initiallyChecked) {
                // Check if layers actually exist before registering
                const mockMatchingIds = this._getLayerIdsForGroup(group);
                if (mockMatchingIds.length > 0) {
                    this._registerLayerWithStateManager(group);
                } else if (attempt < maxAttempts) {
                    layersNeedingRetry.push(group);
                }
            }
        });
        
        // If some layers need retry and we haven't exceeded max attempts
        if (layersNeedingRetry.length > 0 && attempt < maxAttempts) {
            console.debug(`[LayerControl] Retrying registration for ${layersNeedingRetry.length} layers (attempt ${attempt + 1})`);
            setTimeout(() => {
                this._registerSpecificLayersWithRetry(layersNeedingRetry, attempt + 1);
            }, delay);
        }
    }
    
    /**
     * Retry registration for specific layers
     */
    _registerSpecificLayersWithRetry(layers, attempt) {
        if (!this._stateManager) return;
        
        const maxAttempts = 5;
        const delay = 100 * (attempt + 1);
        
        let layersStillNeedingRetry = [];
        
        layers.forEach(group => {
            const mockMatchingIds = this._getLayerIdsForGroup(group);
            if (mockMatchingIds.length > 0) {
                this._registerLayerWithStateManager(group);
            } else if (attempt < maxAttempts) {
                layersStillNeedingRetry.push(group);
            }
        });
        
        if (layersStillNeedingRetry.length > 0 && attempt < maxAttempts) {
            console.debug(`[LayerControl] Retrying registration for ${layersStillNeedingRetry.length} layers (attempt ${attempt + 1})`);
            setTimeout(() => {
                this._registerSpecificLayersWithRetry(layersStillNeedingRetry, attempt + 1);
            }, delay);
        }
    }
    
    /**
     * Get layer IDs that would match for a group (similar to MapFeatureStateManager logic)
     */
    _getLayerIdsForGroup(group) {
        if (!this._mapboxAPI) return [];
        
        try {
            const style = this._mapboxAPI.getStyle();
            if (!style || !style.layers) return [];
            
            const layerId = group.id;
            const allMatches = [];
            
            // Check for direct matches
            const directMatches = style.layers.filter(l => l.id === layerId);
            allMatches.push(...directMatches);
            
            // Check for generated matches
            const generatedMatches = style.layers.filter(l => 
                l.id.startsWith(`vector-layer-${layerId}`) ||
                l.id.startsWith(`tms-layer-${layerId}`) ||
                l.id.startsWith(`geojson-${layerId}`) ||
                l.id.startsWith(`csv-${layerId}`) ||
                l.id.startsWith(`markers-${layerId}`) ||
                l.id.startsWith(layerId + '-') ||
                l.id.startsWith(layerId + ' ')
            );
            allMatches.push(...generatedMatches);
            
            // For style layers, check for source-layer matches
            if (group.type === 'style' && group.layers) {
                const sourceLayerMatches = style.layers.filter(l => {
                    return group.layers.some(sublayer => 
                        sublayer.sourceLayer && l['source-layer'] === sublayer.sourceLayer
                    );
                });
                allMatches.push(...sourceLayerMatches);
            }
            
            return allMatches.map(l => l.id);
        } catch (error) {
            console.warn('[LayerControl] Error checking layer existence:', error);
            return [];
        }
    }

    /**
     * Register all active layers with state manager
     */
    _registerAllActiveLayers() {
        if (!this._stateManager) return;
        
        this._state.groups.forEach(group => {
            if (group.initiallyChecked) {
                this._registerLayerWithStateManager(group);
            }
        });
    }

    /**
     * Register layer with state manager
     */
    _registerLayerWithStateManager(layerConfig) {
        if (!this._stateManager) return;
        
        // Skip terrain and style layers as they don't have their own sources/features
        if (layerConfig.type === 'terrain' || layerConfig.type === 'style') {
            if (layerConfig.type === 'style') {
                console.debug(`[LayerControl] Skipping state manager registration for style layer ${layerConfig.id} (uses base map sources)`);
            }
            return;
        }
        
        this._stateManager.registerLayer(layerConfig);
    }

    /**
     * Unregister layer with state manager
     */
    _unregisterLayerWithStateManager(layerId) {
        if (this._stateManager) {
            this._stateManager.unregisterLayer(layerId);
        }
    }

    /**
     * Save layer settings
     */
    _saveLayerSettingsInternal(newConfig) {
        try {
            const groupIndex = this._state.groups.findIndex(g => g.id === newConfig.id);
            if (groupIndex === -1) {
                throw new Error('Could not find layer configuration to update');
            }

            const newGroups = [...this._state.groups];
            newGroups[groupIndex] = newConfig;

            this._updateState({ groups: newGroups });
        } catch (error) {
            console.error('Error saving layer settings:', error);
            alert('Failed to save layer settings. Please check the console for details.');
        }
    }

    /**
     * Initialize edit mode
     */
    _initializeEditMode() {
        const editModeToggle = document.getElementById('edit-mode-toggle');
        if (editModeToggle) {
            editModeToggle.addEventListener('click', () => {
                this._editMode = !this._editMode;
                editModeToggle.classList.toggle('active');
                editModeToggle.style.backgroundColor = this._editMode ? '#006dff' : '';
            });
        }
    }

    /**
     * Initialize share link functionality
     */
    _initializeShareLink() {
        const shareButton = document.getElementById('share-link');
        if (!shareButton) return;

        shareButton.addEventListener('click', () => {
            const visibleLayers = this._getVisibleLayers();
            const url = new URL(window.location.href);

            if (visibleLayers.length > 0) {
                url.searchParams.set('layers', visibleLayers.join(','));
            } else {
                url.searchParams.delete('layers');
            }

            const prettyUrl = decodeURIComponent(url.toString()).replace(/\+/g, ' ');
            window.history.replaceState({}, '', prettyUrl);

            navigator.clipboard.writeText(prettyUrl).then(() => {
                this._showToast('Link copied to clipboard!');
                this._showQRCode(shareButton, prettyUrl);
            }).catch(err => {
                console.error('Failed to copy link:', err);
                this._showToast('Failed to copy link', 'error');
            });
        });
    }

    /**
     * Get visible layers
     */
    _getVisibleLayers() {
        const visibleLayers = [];

        this._sourceControls.forEach((groupHeader, index) => {
            const group = this._state.groups[index];
            const toggleInput = groupHeader?.querySelector('.toggle-switch input[type="checkbox"]');

            if (toggleInput && toggleInput.checked) {
                if (group.type === 'layer-group') {
                    const radioGroup = groupHeader?.querySelector('.radio-group');
                    const selectedRadio = radioGroup?.querySelector('input[type="radio"]:checked');
                    if (selectedRadio) {
                        visibleLayers.push(selectedRadio.value);
                    }
                } else {
                    visibleLayers.push(group._originalJson || group.id);
                }
            }
        });

        return visibleLayers;
    }

    /**
     * Show toast notification
     */
    _showToast(message, type = 'success', duration = 3000) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.backgroundColor = type === 'success' ? '#4CAF50' :
            type === 'error' ? '#f44336' : '#2196F3';

        requestAnimationFrame(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        });
    }

    /**
     * Show QR code for sharing
     */
    _showQRCode(shareButton, url) {
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`;
        const qrCode = document.createElement('img');
        qrCode.src = qrCodeUrl;
        qrCode.alt = 'QR Code';
        qrCode.style.cssText = 'width: 30px; height: 30px; cursor: pointer;';

        const originalContent = shareButton.innerHTML;
        shareButton.innerHTML = '';
        shareButton.appendChild(qrCode);

        qrCode.addEventListener('click', (e) => {
            e.stopPropagation();
            shareButton.innerHTML = originalContent;
            this._showFullScreenQR(qrCodeUrl);
        });

        setTimeout(() => {
            if (shareButton.contains(qrCode)) {
                shareButton.innerHTML = originalContent;
            }
        }, 30000);
    }

    /**
     * Show full screen QR code
     */
    _showFullScreenQR(qrCodeUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.9); display: flex;
            justify-content: center; align-items: center; z-index: 9999;
            cursor: pointer; padding: 10px;
        `;

        const largeQRCode = document.createElement('img');
        largeQRCode.src = qrCodeUrl;
        largeQRCode.alt = 'QR Code';
        largeQRCode.style.cssText = `
            width: auto; height: auto; max-width: min(500px, 90vw);
            max-height: 90vh; object-fit: contain;
        `;

        overlay.addEventListener('click', () => document.body.removeChild(overlay));
        overlay.appendChild(largeQRCode);
        document.body.appendChild(overlay);
    }

    /**
     * Add global click handler
     */
    _addGlobalClickHandler() {
        if (this._globalClickHandlerAdded) return;

        this._map.on('click', (e) => {
            setTimeout(() => {
                const features = this._map.queryRenderedFeatures(e.point);
                const customFeatures = features.filter(feature => {
                    const layerId = feature.layer?.id;
                    return layerId && (
                        layerId.includes('vector-layer-') ||
                        layerId.includes('geojson-') ||
                        layerId.includes('csv-') ||
                        layerId.includes('tms-layer-') ||
                        layerId.includes('markers-')
                    );
                });

                if (customFeatures.length === 0) {
                    if (this._stateManager) {
                        this._stateManager.clearAllSelections();
                    }

                    this._map.getCanvas().style.cursor = '';
                    const popups = document.querySelectorAll('.mapboxgl-popup');
                    popups.forEach(popup => {
                        const popupInstance = popup._popup;
                        if (popupInstance) {
                            popupInstance.remove();
                        }
                    });
                }
            }, 0);
        });

        this._globalClickHandlerAdded = true;
    }

    /**
     * Initialize filter controls
     */
    _initializeFilterControls() {
        setTimeout(() => {
            const searchInput = document.getElementById('layer-search-input');
            const hideInactiveSwitch = document.getElementById('hide-inactive-switch');
            
            if (searchInput) {
                searchInput.addEventListener('sl-input', (e) => {
                    this._applyAllFilters();
                });
                searchInput.addEventListener('sl-clear', () => {
                    this._applyAllFilters();
                });
            }
            
            if (hideInactiveSwitch) {
                hideInactiveSwitch.addEventListener('sl-change', (e) => {
                    this._applyAllFilters();
                });
            }
        }, 100);
    }

    /**
     * Apply all filters (search and hide inactive)
     */
    _applyAllFilters() {
        try {
            if (!this._container) return;
            
            const searchInput = document.getElementById('layer-search-input');
            const hideInactiveSwitch = document.getElementById('hide-inactive-switch');
            
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const hideInactive = hideInactiveSwitch ? hideInactiveSwitch.checked : false;
            
            const layerGroups = this._container.querySelectorAll('.group-header');
        
            layerGroups.forEach(groupElement => {
                const groupId = groupElement.getAttribute('data-layer-id');
                if (!groupId) return;
                
                const groupData = this._state.groups.find(group => group.id === groupId);
                if (!groupData) return;
                
                const searchMatches = !searchTerm || 
                    (groupData.id && groupData.id.toLowerCase().includes(searchTerm)) ||
                    (groupData.name && groupData.name.toLowerCase().includes(searchTerm)) ||
                    (groupData.title && groupData.title.toLowerCase().includes(searchTerm)) ||
                    (groupData.description && groupData.description.toLowerCase().includes(searchTerm)) ||
                    (groupData.tags && Array.isArray(groupData.tags) && 
                     groupData.tags.some(tag => tag && tag.toLowerCase().includes(searchTerm)));
                
                const toggleInput = groupElement.querySelector('.toggle-switch input[type="checkbox"]');
                const isActive = toggleInput && toggleInput.checked;
                const activeMatches = !hideInactive || isActive;
                
                groupElement.style.display = (searchMatches && activeMatches) ? '' : 'none';
            });
        } catch (error) {
            console.error('[Filter] Error applying filters:', error);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this._mapboxAPI) {
            this._mapboxAPI.cleanup();
        }
    }
}

// Make available globally for backwards compatibility
if (typeof window !== 'undefined') {
    window.MapLayerControl = MapLayerControl;
} 