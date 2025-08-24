export class Terrain3DControl {
    constructor(options = {}) {
        this.options = {
            initialExaggeration: 1.5,
            minExaggeration: 0,
            maxExaggeration: 100.0,
            step: 0.5,
            ...options
        };
        
        this._enabled = true; // Default to enabled
        this._exaggeration = this.options.initialExaggeration;
        this._animate = false; // Default to disabled
        this._showWireframe = false; // Default to disabled
        this._animationFrame = null; // For requestAnimationFrame
        this._panel = null;
        this._map = null;
    }

    onAdd(map) {
        this._map = map;
        
        // Create container with jQuery
        this._container = $('<div>', {
            class: 'mapboxgl-ctrl mapboxgl-ctrl-group'
        })[0];
        
        // Create button with jQuery
        const $button = $('<button>', {
            class: 'mapboxgl-ctrl-icon',
            type: 'button',
            'aria-label': '3D Controls',
            css: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#666'
            }
        });

        // Create 3D text
        const $text = $('<span>', {
            text: '3D',
            css: { 
                display: 'block',
                lineHeight: '1'
            }
        });

        // Add event handlers using jQuery
        $button
            .append($text)
            .on('click', () => {
                this._togglePanel();
            })
            .on('mouseenter', function() {
                $(this).css('backgroundColor', '#f0f0f0');
            })
            .on('mouseleave', function() {
                $(this).css('backgroundColor', '#ffffff');
            })
            .appendTo(this._container);

        // Create panel
        this._createPanel();

        return this._container;
    }

    onRemove() {
        // Stop animation if running
        this._stopAnimation();
        
        if (this._panel) {
            $(this._panel).remove();
        }
        $(this._container).remove();
        this._map = undefined;
    }

    _createPanel() {
        // Create panel container
        this._panel = $('<div>', {
            class: 'terrain-3d-panel',
            css: {
                position: 'absolute',
                top: '40px',
                right: '0',
                width: '250px',
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '15px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: '1000',
                display: 'none',
                fontSize: '14px'
            }
        });

        // Create panel content
        const $content = $('<div>');

        // Title
        const $title = $('<h3>', {
            text: '3D Controls',
            css: {
                margin: '0 0 15px 0',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#333'
            }
        });

        // Animation checkbox
        const $animateContainer = $('<div>', {
            css: {
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center'
            }
        });

        const $animateCheckbox = $('<input>', {
            type: 'checkbox',
            id: 'terrain-3d-animate',
            css: {
                marginRight: '8px'
            }
        });

        const $animateLabel = $('<label>', {
            text: 'Animate around location',
            'for': 'terrain-3d-animate',
            css: {
                cursor: 'pointer',
                fontWeight: '500'
            }
        });

        $animateContainer.append($animateCheckbox, $animateLabel);

        // Enable checkbox
        const $checkboxContainer = $('<div>', {
            css: {
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center'
            }
        });

        const $checkbox = $('<input>', {
            type: 'checkbox',
            id: 'terrain-3d-enabled',
            css: {
                marginRight: '8px'
            }
        });

        const $checkboxLabel = $('<label>', {
            text: 'Enable 3D Terrain',
            'for': 'terrain-3d-enabled',
            css: {
                cursor: 'pointer',
                fontWeight: '500'
            }
        });

        $checkboxContainer.append($checkbox, $checkboxLabel);

        // Exaggeration slider container (only shown when enabled)
        const $sliderContainer = $('<div>', {
            css: {
                marginBottom: '10px',
                display: this._enabled ? 'block' : 'none'
            }
        });

        const $sliderLabel = $('<label>', {
            text: 'Vertical Exaggeration',
            css: {
                display: 'block',
                marginBottom: '5px',
                fontWeight: '500'
            }
        });

        const $slider = $('<input>', {
            type: 'range',
            min: this.options.minExaggeration,
            max: this.options.maxExaggeration,
            step: this.options.step,
            value: this._exaggeration,
            css: {
                width: '100%',
                marginBottom: '5px'
            }
        });

        const $sliderValue = $('<span>', {
            text: this._exaggeration.toFixed(1),
            css: {
                fontSize: '12px',
                color: '#666',
                fontWeight: 'bold'
            }
        });

        // Wireframe checkbox (grouped with exaggeration controls)
        const $wireframeContainer = $('<div>', {
            css: {
                marginTop: '15px',
                display: 'flex',
                alignItems: 'center'
            }
        });

        const $wireframeCheckbox = $('<input>', {
            type: 'checkbox',
            id: 'terrain-3d-wireframe',
            css: {
                marginRight: '8px'
            }
        });

        const $wireframeLabel = $('<label>', {
            text: 'Show terrain mesh',
            'for': 'terrain-3d-wireframe',
            css: {
                cursor: 'pointer',
                fontWeight: '500'
            }
        });

        $wireframeContainer.append($wireframeCheckbox, $wireframeLabel);

        $sliderContainer.append($sliderLabel, $slider, $sliderValue, $wireframeContainer);

        // Close button
        const $closeButton = $('<button>', {
            text: '×',
            css: {
                position: 'absolute',
                top: '5px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#999',
                padding: '0',
                width: '20px',
                height: '20px',
                lineHeight: '1'
            }
        });

        // Assemble panel
        $content.append($title, $animateContainer, $checkboxContainer, $sliderContainer);
        this._panel.append($closeButton, $content);

        // Add event handlers
        $animateCheckbox.on('change', (e) => {
            this._animate = e.target.checked;
            this._updateAnimation();
        });

        $wireframeCheckbox.on('change', (e) => {
            this._showWireframe = e.target.checked;
            this._updateWireframe();
        });

        $checkbox.on('change', (e) => {
            this._enabled = e.target.checked;
            // Show/hide slider container (which includes wireframe checkbox) based on checkbox state
            $sliderContainer.css('display', this._enabled ? 'block' : 'none');
            this._updateTerrain();
        });

        $slider.on('input', (e) => {
            this._exaggeration = parseFloat(e.target.value);
            $sliderValue.text(this._exaggeration.toFixed(1));
            if (this._enabled) {
                this._updateTerrain();
            }
        });

        $closeButton.on('click', () => {
            this._hidePanel();
        });

        // Close panel when clicking outside
        $(document).on('click.terrain3d', (e) => {
            if (!$(e.target).closest('.terrain-3d-panel, .mapboxgl-ctrl-icon').length) {
                this._hidePanel();
            }
        });

        // Add panel to map container
        $(this._map.getContainer()).append(this._panel);
    }

    _togglePanel() {
        if (this._panel.css('display') === 'none') {
            this._showPanel();
        } else {
            this._hidePanel();
        }
    }

    _showPanel() {
        $(this._panel).show();
    }

    _hidePanel() {
        $(this._panel).hide();
    }

    _updateTerrain() {
        if (!this._map) return;

        if (this._enabled) {
            // Ensure DEM source exists
            if (!this._map.getSource('mapbox-dem')) {
                this._map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    'tileSize': 512,
                    'maxzoom': 14
                });
            }

            // Set terrain
            this._map.setTerrain({
                'source': 'mapbox-dem',
                'exaggeration': this._exaggeration
            });

            // Set fog for better 3D effect
            this._map.setFog({
                'color': 'white',
                'horizon-blend': 0.1,
                'high-color': '#add8e6',
                'star-intensity': 0.1
            });
        } else {
            // Disable terrain and fog
            this._map.setTerrain(null);
            this._map.setFog(null);
        }

        // Update URL parameter
        this._updateURLParameter();
    }

    _updateURLParameter() {
        // Use URL API if available, otherwise fall back to direct URL manipulation
        if (window.urlManager && window.urlManager.updateTerrainParam) {
            if (this._enabled) {
                window.urlManager.updateTerrainParam(this._exaggeration);
            } else {
                window.urlManager.updateTerrainParam(0);
            }
        } else {
            // Fallback to direct URL manipulation
            const url = new URL(window.location);
            if (this._enabled) {
                url.searchParams.set('terrain', this._exaggeration.toString());
            } else {
                url.searchParams.set('terrain', '0'); // Set to 0 when disabled
            }
            
            // Update URL without reloading the page
            window.history.replaceState({}, '', url);
        }
    }

    _updateAnimation() {
        if (this._animate) {
            this._startAnimation();
        } else {
            this._stopAnimation();
        }
        
        // Update URL parameter
        this._updateAnimationURLParameter();
    }

    _startAnimation() {
        if (!this._map || this._animationFrame) return;
        
        const rotateCamera = (timestamp) => {
            // clamp the rotation between 0 -360 degrees
            // Divide timestamp by 100 to slow rotation to ~10 degrees / sec
            this._map.rotateTo((timestamp / 100) % 360, { duration: 0 });
            // Request the next frame of the animation.
            this._animationFrame = requestAnimationFrame(rotateCamera);
        };
        
        // Start the animation
        this._animationFrame = requestAnimationFrame(rotateCamera);
    }

    _stopAnimation() {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
    }

    _updateAnimationURLParameter() {
        // Use URL API if available, otherwise fall back to direct URL manipulation
        if (window.urlManager && window.urlManager.updateAnimateParam) {
            window.urlManager.updateAnimateParam(this._animate);
        } else {
            // Fallback to direct URL manipulation
            const url = new URL(window.location);
            if (this._animate) {
                url.searchParams.set('animate', 'true');
            } else {
                url.searchParams.delete('animate');
            }
            
            // Update URL without reloading the page
            window.history.replaceState({}, '', url);
        }
    }

    _updateWireframe() {
        if (!this._map) return;
        
        // Toggle the terrain wireframe debug feature
        this._map.showTerrainWireframe = this._showWireframe;
        
        // Update URL parameter
        this._updateWireframeURLParameter();
    }

    _updateWireframeURLParameter() {
        // Use URL API if available, otherwise fall back to direct URL manipulation
        if (window.urlManager && window.urlManager.updateWireframeParam) {
            window.urlManager.updateWireframeParam(this._showWireframe);
        } else {
            // Fallback to direct URL manipulation
            const url = new URL(window.location);
            if (this._showWireframe) {
                url.searchParams.set('wireframe', 'true');
            } else {
                url.searchParams.delete('wireframe');
            }
            
            // Update URL without reloading the page
            window.history.replaceState({}, '', url);
        }
    }

    // Public methods for external control
    setEnabled(enabled) {
        this._enabled = enabled;
        $('#terrain-3d-enabled').prop('checked', enabled);
        // Show/hide slider container (which includes wireframe checkbox) based on enabled state
        $('.terrain-3d-panel input[type="range"]').closest('div').css('display', enabled ? 'block' : 'none');
        this._updateTerrain();
    }

    setExaggeration(exaggeration) {
        this._exaggeration = Math.max(this.options.minExaggeration, 
                                    Math.min(this.options.maxExaggeration, exaggeration));
        $('input[type="range"]', this._panel).val(this._exaggeration);
        $('.terrain-3d-panel span').text(this._exaggeration.toFixed(1));
        if (this._enabled) {
            this._updateTerrain();
        }
    }

    getEnabled() {
        return this._enabled;
    }

    getExaggeration() {
        return this._exaggeration;
    }

    setAnimate(animate) {
        this._animate = animate;
        $('#terrain-3d-animate').prop('checked', animate);
        this._updateAnimation();
    }

    getAnimate() {
        return this._animate;
    }

    setWireframe(wireframe) {
        this._showWireframe = wireframe;
        $('#terrain-3d-wireframe').prop('checked', wireframe);
        this._updateWireframe();
    }

    getWireframe() {
        return this._showWireframe;
    }

    // Method to initialize from URL parameter
    initializeFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const terrainParam = urlParams.get('terrain');
        const animateParam = urlParams.get('animate');
        const wireframeParam = urlParams.get('wireframe');
        
        console.log('[3D Control] Initializing from URL, terrain param:', terrainParam, 'animate param:', animateParam, 'wireframe param:', wireframeParam);
        
        if (terrainParam) {
            const exaggeration = parseFloat(terrainParam);
            if (!isNaN(exaggeration)) {
                if (exaggeration === 0) {
                    // Explicitly disabled
                    console.log('[3D Control] Setting disabled (terrain=0)');
                    this.setEnabled(false);
                } else if (exaggeration >= this.options.minExaggeration && 
                          exaggeration <= this.options.maxExaggeration) {
                    // Valid exaggeration value
                    console.log('[3D Control] Setting enabled with exaggeration:', exaggeration);
                    this.setExaggeration(exaggeration);
                    this.setEnabled(true);
                }
            }
        } else {
            // No terrain parameter - use default enabled state
            console.log('[3D Control] No terrain param, using default enabled state');
            this.setEnabled(true);
            this.setExaggeration(this.options.initialExaggeration);
        }

        // Handle animate parameter
        if (animateParam === 'true') {
            console.log('[3D Control] Setting animation enabled');
            this.setAnimate(true);
        } else {
            console.log('[3D Control] Setting animation disabled (default)');
            this.setAnimate(false);
        }

        // Handle wireframe parameter
        if (wireframeParam === 'true') {
            console.log('[3D Control] Setting wireframe enabled');
            this.setWireframe(true);
        } else {
            console.log('[3D Control] Setting wireframe disabled (default)');
            this.setWireframe(false);
        }
    }
}
