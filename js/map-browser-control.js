/**
 * MapBrowserControl - Mapbox GL JS control for opening the layer drawer
 *
 * A compact control button that shows the current atlas name and opens
 * the layer drawer when clicked.
 */

import { DrawerStateManager } from './drawer-state-manager.js';

export class MapBrowserControl {
    constructor() {
        this._container = null;
        this._button = null;
        this._map = null;
        this.drawerStateManager = new DrawerStateManager();
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group map-browser-control';

        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-icon map-browser-btn map-control-dark';
        this._button.type = 'button';
        this._button.setAttribute('aria-label', 'Browse Maps');
        this._button.style.width = 'auto';
        this._button.style.padding = '10px';
        this._button.style.fontSize = '12pt';

        const currentAtlas = window.layerRegistry?._currentAtlas || 'index';
        const atlasMetadata = window.layerRegistry?.getAtlasMetadata(currentAtlas);
        const atlasName = atlasMetadata?.name || 'Browse Maps';

        this._button.innerHTML = `
            <sl-icon name="layers" style="font-size: 14px; margin-right: 6px;"></sl-icon>
            <span class="atlas-name">${atlasName}</span>
        `;

        this._button.addEventListener('click', () => {
            this.drawerStateManager.open();
        });

        this._container.appendChild(this._button);

        return this._container;
    }

    onRemove() {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
    }

    getDefaultPosition() {
        return 'top-left';
    }

    updateAtlasName(atlasName) {
        if (this._button) {
            const nameSpan = this._button.querySelector('.atlas-name');
            if (nameSpan) {
                nameSpan.textContent = atlasName;
            }
        }
    }
}
