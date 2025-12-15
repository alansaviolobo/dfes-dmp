export class MapExportControl {
    constructor() {
        this._map = null;
        this._container = null;
        this._exportPanel = null;
        this._selectedSize = 'A4';
        this._orientation = 'landscape';
        this._format = 'pdf';
        this._dpi = 96;
        this._frame = null;
        this._isExporting = false;
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'mapboxgl-ctrl-icon';
        exportBtn.type = 'button';
        exportBtn.ariaLabel = 'Export Map';
        exportBtn.innerHTML = '<span class="mapboxgl-ctrl-icon" aria-hidden="true" style="background-image: url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22black%22><path d=%22M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z%22/></svg>\'); background-size: 20px 20px; background-repeat: no-repeat; background-position: center;"></span>';
        exportBtn.onclick = () => this._togglePanel();

        this._container.appendChild(exportBtn);

        this._frame = new ExportFrame(map, this);
        this._createExportPanel();

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = null;
        if (this._frame) {
            this._frame.remove();
        }
    }

    _createExportPanel() {
        this._exportPanel = document.createElement('div');
        this._exportPanel.className = 'mapboxgl-ctrl-group export-panel hidden';


        // Format Selection
        this._exportPanel.appendChild(this._createLabel('Format'));
        const formatContainer = document.createElement('div');
        formatContainer.innerHTML = `
            <label><input type="radio" name="export-format" value="pdf" checked> PDF</label>
            <label><input type="radio" name="export-format" value="geojson"> GeoJSON</label>
        `;
        formatContainer.onchange = (e) => {
            this._format = e.target.value;
            this._updatePanelVisibility();
        };
        this._exportPanel.appendChild(formatContainer);

        // Size Selector
        this._sizeContainer = document.createElement('div');
        this._sizeContainer.appendChild(this._createLabel('Size & DPI'));

        const controlsRow = document.createElement('div');
        controlsRow.style.display = 'flex';
        controlsRow.style.gap = '5px';

        // Size Dropdown
        const sizeSelect = document.createElement('select');
        sizeSelect.style.flex = '2';
        ['A4', 'A3', 'A2', 'A1', 'A0', 'Custom'].forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.text = size;
            sizeSelect.appendChild(option);
        });
        sizeSelect.value = this._selectedSize;
        sizeSelect.onchange = (e) => this._onSizeChange(e.target.value);
        this._sizeSelect = sizeSelect; // Store ref
        controlsRow.appendChild(sizeSelect);

        // DPI Dropdown
        const dpiSelect = document.createElement('select');
        dpiSelect.style.flex = '1';
        [72, 96, 150, 300].forEach(dpi => {
            const option = document.createElement('option');
            option.value = dpi;
            option.text = dpi + ' dpi';
            if (dpi === 96) option.selected = true;
            dpiSelect.appendChild(option);
        });
        dpiSelect.onchange = (e) => { this._dpi = parseInt(e.target.value); };
        controlsRow.appendChild(dpiSelect);

        this._sizeContainer.appendChild(controlsRow);
        this._exportPanel.appendChild(this._sizeContainer);

        // Dimensions Inputs
        this._dimContainer = document.createElement('div');
        this._dimContainer.style.marginTop = '10px';
        this._widthInput = this._createInput('Width (mm)');
        this._heightInput = this._createInput('Height (mm)');

        // Add event listeners for direct input change
        this._widthInput.input.onchange = () => this._onDimensionsChange();
        this._heightInput.input.onchange = () => this._onDimensionsChange();

        this._dimContainer.appendChild(this._widthInput.container);
        this._dimContainer.appendChild(this._heightInput.container);
        this._exportPanel.appendChild(this._dimContainer);

        // Orientation
        this._orientationContainer = document.createElement('div');
        this._orientationContainer.style.marginTop = '10px';
        this._orientationContainer.innerHTML = `
            <label><input type="radio" name="orientation" value="landscape" checked> Landscape</label>
            <label><input type="radio" name="orientation" value="portrait"> Portrait</label>
        `;
        this._orientationContainer.onchange = (e) => this._onOrientationChange(e.target.value);
        this._exportPanel.appendChild(this._orientationContainer);

        // Export Button
        const doExportBtn = document.createElement('button');
        doExportBtn.textContent = 'Export';
        doExportBtn.style.cssText = `
            width: 100%;
            margin-top: 10px;
            padding: 5px;
            background: #333;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        `;
        doExportBtn.onclick = () => this._doExport();
        this._exportPanel.appendChild(doExportBtn);

        this._container.appendChild(this._exportPanel);

        // Initial values
        this._onSizeChange('A4');
    }

    _createLabel(text) {
        const label = document.createElement('div');
        label.textContent = text;
        label.style.fontWeight = 'bold';
        label.style.marginTop = '5px';
        return label;
    }

    _createInput(placeholder) {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.marginBottom = '5px';
        const label = document.createElement('span');
        label.textContent = placeholder;
        label.style.fontSize = '12px';
        const input = document.createElement('input');
        input.type = 'number';
        input.style.width = '70px';
        div.appendChild(label);
        div.appendChild(input);
        return { container: div, input: input };
    }

    _togglePanel() {
        this._exportPanel.classList.toggle('hidden');
        if (!this._exportPanel.classList.contains('hidden')) {
            if (this._format !== 'geojson') {
                this._frame.show();
                this._updateFrameFromInputs(); // Ensure frame matches current inputs
            }
        } else {
            this._frame.hide();
        }
    }

    _updatePanelVisibility() {
        if (this._format === 'geojson') {
            this._sizeContainer.style.display = 'none';
            this._dimContainer.style.display = 'none';
            this._orientationContainer.style.display = 'none';
            this._frame.hide();
        } else {
            this._sizeContainer.style.display = 'block';
            this._dimContainer.style.display = 'block';
            this._orientationContainer.style.display = 'block';
            this._frame.show();
            this._updateFrameFromInputs();
        }
    }

    _onSizeChange(size) {
        this._selectedSize = size;
        this._updateDimensions(); // Set W/H inputs based on Standard Size

        // Update Frame to match new dimensions
        this._updateFrameFromInputs();
    }

    _onOrientationChange(orientation) {
        this._orientation = orientation;
        this._updateDimensions();
        this._updateFrameFromInputs();
    }

    _onDimensionsChange() {
        // User manually typed dimensions
        this._sizeSelect.value = 'Custom';
        this._selectedSize = 'Custom';
        this._updateFrameFromInputs();
    }

    _updateDimensions() {
        if (this._selectedSize === 'Custom') return;

        const sizes = {
            'A0': [841, 1189],
            'A1': [594, 841],
            'A2': [420, 594],
            'A3': [297, 420],
            'A4': [210, 297]
        };

        let [width, height] = sizes[this._selectedSize];
        if (this._orientation === 'landscape') {
            [width, height] = [height, width];
        }

        this._widthInput.input.value = width;
        this._heightInput.input.value = height;
    }

    _updateFrameFromInputs() {
        const width = parseFloat(this._widthInput.input.value);
        const height = parseFloat(this._heightInput.input.value);
        if (width && height) {
            this._frame.setAspectRatio(width / height);
        }
    }

    // Called when frame is resized by user
    _onFrameChange(newAspectRatio) {
        // When frame changes, we act as if we are in "Custom" mode, 
        // OR we update the dimensions to match the new shape while trying to preserve scale?
        // User request: "moving the corners... will dynamically change dimensions"
        // Interpretation: We keep the Aspect Ratio of the inputs tied to the Frame.

        this._sizeSelect.value = 'Custom';
        this._selectedSize = 'Custom';

        // Current Input Dimensions
        let w = parseFloat(this._widthInput.input.value);
        let h = parseFloat(this._heightInput.input.value);

        // We need to decide which dimension to keep.
        // Let's keep the largest dimension fixed and scale the other to match ratio?
        // Or just update Height based on Width?
        if (w > h) {
            h = w / newAspectRatio;
        } else {
            w = h * newAspectRatio;
        }

        // Update inputs
        this._widthInput.input.value = Math.round(w);
        this._heightInput.input.value = Math.round(h);
    }

    async _doExport() {
        if (this._isExporting) return;
        this._isExporting = true;
        const btn = this._exportPanel.querySelector('button');
        const oldText = btn.textContent;
        btn.textContent = 'Processing...';

        try {
            if (this._format === 'geojson') {
                this._exportGeoJSON();
            } else {
                await this._exportPDF();
            }
        } catch (e) {
            console.error('Export failed', e);
            alert('Export failed: ' + e.message);
        } finally {
            this._isExporting = false;
            btn.textContent = oldText;
        }
    }

    _exportGeoJSON() {
        const features = this._map.queryRenderedFeatures();
        const geojson = {
            type: 'FeatureCollection',
            features: features
        };
        const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'map-export.geojson';
        a.click();
        URL.revokeObjectURL(url);
    }

    async _exportPDF() {
        const { jsPDF } = await import('jspdf');

        const widthMm = parseFloat(this._widthInput.input.value);
        const heightMm = parseFloat(this._heightInput.input.value);
        const dpi = this._dpi;

        // Calculate Target Pixels
        const targetWidth = Math.round((widthMm * dpi) / 25.4);
        const targetHeight = Math.round((heightMm * dpi) / 25.4);

        // Get Bounds from Frame (Geographic)
        const bounds = this._frame.getBounds();

        // Save current map state
        const originalStyle = this._map.getContainer().style.cssText;
        const originalCenter = this._map.getCenter();
        const originalZoom = this._map.getZoom();

        // 1. Hide Controls & Frame
        this._frame.hide();
        // Hide other controls might be good too, but `preserveDrawingBuffer` usually captures webgl canvas only?
        // map.getCanvas() is what we capture. Controls are DOM elements.

        // 2. Resize Map Container (Hidden/Background or just manipulate current?)
        // Manipulating current is easiest but visible.
        const container = this._map.getContainer();

        return new Promise((resolve, reject) => {

            // Function to capture after resize and move
            const capture = () => {
                try {
                    const canvas = this._map.getCanvas();
                    const imgData = canvas.toDataURL('image/png');

                    const doc = new jsPDF({
                        orientation: widthMm > heightMm ? 'l' : 'p',
                        unit: 'mm',
                        format: [widthMm, heightMm]
                    });

                    doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
                    doc.save('map-export.pdf');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };

            // Set new size
            Object.assign(container.style, {
                width: targetWidth + 'px',
                height: targetHeight + 'px',
                position: 'fixed', // Keep it in flow or fixed? Fixed top-left ensures it doesn't break layout too much
                top: '0',
                left: '0',
                zIndex: '-9999' // Hide behind everything
            });

            this._map.resize();

            // Fit bounds to the frame area
            this._map.fitBounds(bounds, { animate: false, padding: 0 });

            this._map.once('idle', () => {
                capture();

                // Restore
                container.style.cssText = originalStyle;
                this._map.resize();
                // Restore View (FitBounds changed it)
                this._map.jumpTo({ center: originalCenter, zoom: originalZoom });

                // Show Frame
                this._frame.show();
            });
        });
    }
}

class ExportFrame {
    constructor(map, control) {
        this._map = map;
        this._control = control;
        this._el = document.createElement('div');
        this._el.className = 'map-export-frame';

        // Handles
        ['nw', 'ne', 'se', 'sw'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `export-handle ${pos}`;
            handle.onmousedown = (e) => this._startResize(e, pos);
            this._el.appendChild(handle);
        });

        // Center Drag
        this._el.onmousedown = (e) => {
            if (e.target === this._el) this._startMove(e);
        };

        this._map.getContainer().appendChild(this._el);

        this._aspectRatio = 1.414; // A4 Landscape
        this._updatePosition();

        // Update on map move to keep geographic position?
        // Or is the frame "Sticky" to the screen or the map?
        // User: "export from this frame". Usually frame overlays are screen-space or map-space?
        // If map moves, frame usually stays on screen (like a viewport).
        // BUT user said "movable frame selector on top of the map".
        // If I Pan the map, does the frame move with it? 
        // Usually, these tools allow you to Pan the Map *under* the Frame to line up the shot.
        // So the Frame stays checking screen center.
        // BUT the user asked for a "movable frame".
        // Let's implement: Frame is an element on top of the map. It stays in screen coordinates.
        // Moving the map changes what's inside. Moving the frame changes the crop on screen.
        // This is flexible.
    }

    remove() {
        this._el.parentNode.removeChild(this._el);
    }

    show() {
        this._el.classList.add('active');
        this._updatePosition();
    }

    hide() {
        this._el.classList.remove('active');
    }

    setAspectRatio(ratio) {
        this._aspectRatio = ratio;
        this._updatePosition();
    }

    getBounds() {
        // Convert screen coordinates of frame to LngLatBounds
        const rect = this._el.getBoundingClientRect();
        const mapCanvas = this._map.getCanvas().getBoundingClientRect();

        // Relative to map container
        const p1 = this._map.unproject([
            rect.left - mapCanvas.left,
            rect.top - mapCanvas.top
        ]);
        const p2 = this._map.unproject([
            rect.right - mapCanvas.left,
            rect.bottom - mapCanvas.top
        ]);

        return new mapboxgl.LngLatBounds(p1, p2);
    }

    _updatePosition() {
        // Default size: 60% of map width, height based on ratio
        if (!this._el.style.width) {
            const mapW = this._map.getContainer().clientWidth;
            const w = mapW * 0.6;
            const h = w / this._aspectRatio;
            this._el.style.width = w + 'px';
            this._el.style.height = h + 'px';
        } else {
            // Maintain ratio if triggered by external ratio change, or just center?
            // If resize triggered from input update, we need to respect the new ratio.
            // Keep current width, update height.
            const w = parseFloat(this._el.style.width);
            const h = w / this._aspectRatio;
            this._el.style.height = h + 'px';
        }
    }

    _startMove(e) {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = this._el.getBoundingClientRect();
        const startLeft = this._el.offsetLeft;
        const startTop = this._el.offsetTop;

        const onMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            this._el.style.left = (startLeft + dx) + 'px'; // Wait, CSS uses transform translate(-50, -50)
            // But left/top are 50%.
            // My CSS: top: 50%; left: 50%; transform: translate(-50%, -50%);
            // This centers it. If I want to move it freely, I should probably switch to top/left absolute with no transform
            // or modify margins.
            // Let's switch to direct positioning on first move.
        };

        // Helper to switch to absolute positioning without transform if needed, 
        // but easier to just use top/left and remove transform?
        // Let's adjust styles inline.

        // Re-implementing move logic simply:
        this._el.style.transform = 'none';
        this._el.style.left = this._el.offsetLeft + 'px';
        this._el.style.top = this._el.offsetTop + 'px';

        // Need to capture initial after removing transform
        const finalStartLeft = this._el.offsetLeft;
        const finalStartTop = this._el.offsetTop;

        const performMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            this._el.style.left = (finalStartLeft + dx) + 'px';
            this._el.style.top = (finalStartTop + dy) + 'px';
        };

        const onUp = () => {
            document.removeEventListener('mousemove', performMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', performMove);
        document.addEventListener('mouseup', onUp);
    }

    _startResize(e, handle) {
        e.preventDefault();
        e.stopPropagation();

        // Ensure transform is gone
        if (getComputedStyle(this._el).transform !== 'none') {
            this._el.style.transform = 'none';
            this._el.style.left = this._el.offsetLeft + 'px';
            this._el.style.top = this._el.offsetTop + 'px';
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = this._el.offsetWidth;
        const startH = this._el.offsetHeight;
        const startL = this._el.offsetLeft;
        const startT = this._el.offsetTop;

        const onMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newW = startW;
            let newH = startH;
            let newL = startL;
            let newT = startT;

            if (handle.includes('e')) newW = startW + dx;
            if (handle.includes('w')) { newW = startW - dx; newL = startL + dx; }
            if (handle.includes('s')) newH = startH + dy;
            if (handle.includes('n')) { newH = startH - dy; newT = startT + dy; }

            if (newW < 50) newW = 50;
            if (newH < 50) newH = 50;

            this._el.style.width = newW + 'px';
            this._el.style.height = newH + 'px';
            this._el.style.left = newL + 'px';
            this._el.style.top = newT + 'px';

            // Update Control
            this._aspectRatio = newW / newH;
            this._control._onFrameChange(this._aspectRatio);
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
}
