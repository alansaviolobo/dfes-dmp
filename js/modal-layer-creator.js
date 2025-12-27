/**
 * Modal Layer Creator.
 */
import {MapUtils} from './map-utils.js';

export class ModalLayerCreator {

  /**
   * Opens the layer creator dialog
   */
  static openLayerCreatorDialog() {
    const configTextarea = $('#layer-config-json');
    configTextarea.val('');

    const urlInput = $('#layer-url');
    urlInput.val('');

    const presetDropdown = $('#layer-preset-dropdown');
    presetDropdown.children().remove();
    presetDropdown.append($("<sl-option>Duplicate existing layer...</sl-option>"));
    presetDropdown.off('change');
    this.getCurrentAtlasLayers().forEach(layer => {
      let option = $('<sl-option>', {
        value: layer.id,
        'data-config': JSON.stringify(layer.config),
      });
      option.append($(`<div class="flex justify-between items-center w-full">
                        <span class="flex-1 truncate">${layer.title}</span>
                        <span class="text-xs text-gray-500 ml-2 flex-shrink-0">${layer.format}</span>
                    </div>`));
      presetDropdown.append(option);
    });
    presetDropdown.on('sl-change', (e) => {
      const selectedOption = presetDropdown.find(`sl-option[value="${e.target.value}"]`);
      if (selectedOption && selectedOption.dataset.config) {
        configTextarea.value = JSON.stringify(JSON.parse(selectedOption.dataset.config), null, 2);
        urlInput.value = '';
      }
    });

    let lastUrl = '';
    urlInput.on('input', async (e) => {
      const url = e.target.value.trim();
      if (!url || url === lastUrl) return;
      lastUrl = url;
      presetDropdown.value = '';
      configTextarea.value = 'Loading...';
      const config = await this.handleUrlInput(url);
      configTextarea.value = JSON.stringify(config, null, 2);
    });

    const form = $('#layer-creator-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      let configJson = configTextarea.value.trim();
      if (!configJson) return;
      try {
        const configObj = JSON.parse(configJson);
        this.fitBoundsToMapwarperLayer(configObj);

        let url = new URL(this.getShareableUrl());
        let layers = url.searchParams.get('layers') || '';
        let jsonString = JSON.stringify(configObj).replace(/'/g, "\\'").replace(/"/g, "'");
        url.searchParams.set('layers', jsonString + (layers ? ',' + layers : ''));
        window.location.href = url.toString();
      } catch (err) {
        alert('Invalid JSON in config');
      }
    };

    const dialog = $('#layer-creator-dialog')[0];
    $('#cancel-layer-creator').on('click', () => dialog.hide());
    dialog.show();
  }

  /**
   * Get all layers from the current atlas configuration
   * @returns {Array} Array of layer objects
   */
  static getCurrentAtlasLayers() {
    if (!window.layerControl || !window.layerControl._state || !window.layerControl._state.groups) {
      return [];
    }

    const layers = [];
    window.layerControl._state.groups.forEach(group => {
      if (group.title && group.id) {
        layers.push({
          id: group.id,
          title: group.title,
          format: this.getLayerFormat(group),
          config: group
        });
      }
    });

    return layers;
  }

  /**
   * Determine the data format from layer configuration
   * @param {Object} layer - Layer configuration
   * @returns {string} Format name
   */
  static getLayerFormat(layer) {
    if (!layer.type && !layer.url) return 'unknown';

    switch (layer.type) {
      case 'vector':
        return 'pbf/mvt';
      case 'geojson':
        return 'geojson';
      case 'tms':
      case 'raster':
        return 'raster';
      case 'csv':
        return 'csv';
      case 'style':
        return 'style';
      case 'layer-group':
        return 'group';
      case 'terrain':
        return 'terrain';
      case 'atlas':
        return 'atlas';
      case 'img':
        return 'img';
      case 'raster-style-layer':
        return 'raster';
      case 'markers':
        return 'markers';
    }

    if (layer.url) {
      const url = layer.url.toLowerCase();
      if (url.includes('.geojson') || url.includes('geojson')) return 'geojson';
      if (url.includes('.pbf') || url.includes('.mvt') || url.includes('vector')) return 'pbf/mvt';
      if (url.includes('.png')) return 'png';
      if (url.includes('.jpg') || url.includes('.jpeg')) return 'jpg';
      if (url.includes('.tiff') || url.includes('.tif')) return 'tiff';
      if (url.includes('.csv')) return 'csv';
      if (url.includes('{z}') && (url.includes('.png') || url.includes('.jpg'))) return 'raster';
      if (url.includes('mapbox://')) return 'mapbox';
    }

    return 'unknown';
  }

  /**
   * Guesses the layer type from URL
   * @param {string} url - Data URL
   * @returns {string} Guessed type
   */
  static guessLayerType(url) {
    if (/\.geojson($|\?)/i.test(url)) return 'geojson';
    if (url.includes('{z}') && (url.includes('.pbf') || url.includes('.mvt') || url.includes('vector.openstreetmap.org') || url.includes('/vector/'))) return 'vector';
    if (url.includes('{z}') && (url.includes('.png') || url.includes('.jpg'))) return 'raster';
    if (/\.json($|\?)/i.test(url)) return 'atlas';
    return 'unknown';
  }

  /**
   * Processes a URL input to generate layer configuration
   * @param {string} url - Input URL
   * @returns {Promise<Object>} Layer configuration
   */
  static async handleUrlInput(url) {
    let actualUrl = url;
    let tilejson = null;
    let mapwarperMetadata = null;

    if (url.includes('mapwarper.net/maps/') || url.includes('warper.wmflabs.org/maps/')) {
      try {
        const mapIdMatch = url.match(/\/maps\/(\d+)/);
        if (mapIdMatch) {
          const mapId = mapIdMatch[1];
          let baseUrl = url.includes('mapwarper.net') ? 'https://mapwarper.net' : 'https://warper.wmflabs.org';

          if (baseUrl) {
            actualUrl = `${baseUrl}/maps/tile/${mapId}/{z}/{x}/{y}.png`;
            const sanitizedUrl = url.split('#')[0];
            try {
              const apiUrl = `${baseUrl}/api/v1/maps/${mapId}`;
              const response = await fetch(apiUrl);
              if (response.ok) {
                const apiResponse = await response.json();
                const mapData = apiResponse.data?.attributes || {};
                const links = apiResponse.data?.links || {};
                mapwarperMetadata = {
                  title: mapData.title || `MapWarper Map ${mapId}`,
                  description: mapData.description || '',
                  source: mapData.source_uri || '',
                  attribution: mapData.attribution || '',
                  date: mapData.date_depicted || '',
                  thumbnail: links.thumb ? `${baseUrl}${links.thumb}` : null,
                  baseUrl: baseUrl,
                  mapId: mapId,
                  originalUrl: sanitizedUrl,
                  bbox: mapData.bbox || null
                };
              }
            } catch (apiError) {
              console.warn('Failed to fetch MapWarper API data:', apiError);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to process MapWarper URL:', error);
      }
    } else if (url.includes('indianopenmaps.fly.dev') && url.includes('/view')) {
      try {
        const baseUrl = url.split('/view')[0];
        actualUrl = `${baseUrl}/{z}/{x}/{y}.pbf`;
        const tilejsonUrl = `${baseUrl}/tiles.json`;
        tilejson = await MapUtils.fetchTileJSON(tilejsonUrl);
      } catch (error) {
        console.warn('Failed to fetch TileJSON from indianopenmaps.fly.dev view URL:', error);
      }
    }

    const type = this.guessLayerType(actualUrl);
    if (type === 'vector') {
      if (!tilejson && actualUrl.includes('indianopenmaps.fly.dev') && actualUrl.includes('{z}')) {
        try {
          const tilejsonUrl = actualUrl.replace(/\{z\}\/\{x\}\/\{y\}\.pbf$/, 'tiles.json');
          tilejson = await MapUtils.fetchTileJSON(tilejsonUrl);
        } catch (error) {
          console.warn('Failed to fetch TileJSON from indianopenmaps.fly.dev:', error);
        }
      }
      if (!tilejson) {
        tilejson = await MapUtils.fetchTileJSON(actualUrl);
      }
    }

    let config = {};
    if (type === 'vector') {
      let attribution = tilejson?.attribution || '© OpenStreetMap contributors';
      let mapId = null;
      if (actualUrl.includes('api-main')) {
        const urlObj = new URL(actualUrl);
        mapId = urlObj.searchParams.get('map_id');
        if (mapId) {
          attribution = `© Original Creator - via <a href='https://www.maphub.co/map/${mapId}'>Maphub</a>`;
        }
      }

      if (attribution && typeof attribution === 'string') {
        attribution = attribution.replace(/"/g, "'");
      }

      config = {
        title: tilejson?.name || 'Vector Tile Layer',
        description: tilejson?.description || 'Vector tile layer from custom source',
        type: 'vector',
        id: (tilejson?.name || 'vector-layer').toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 8),
        url: (tilejson?.tiles && tilejson.tiles[0]) || actualUrl,
        sourceLayer: tilejson?.vector_layers?.[0]?.id || 'default',
        minzoom: tilejson?.minzoom || 0,
        maxzoom: tilejson?.maxzoom || 14,
        attribution: attribution,
        initiallyChecked: false,
        inspect: {
          id: tilejson?.vector_layers?.[0]?.fields?.gid ? "gid" : (tilejson?.vector_layers?.[0]?.fields?.id ? "id" : "gid"),
          title: tilejson?.vector_layers?.[0]?.fields?.mon_name ? "Monument Name" : "Name",
          label: tilejson?.vector_layers?.[0]?.fields?.mon_name ? "mon_name" : (tilejson?.vector_layers?.[0]?.fields?.name ? "name" : "mon_name"),
          fields: tilejson?.vector_layers?.[0]?.fields ?
            Object.keys(tilejson.vector_layers[0].fields).slice(0, 6) :
            ["id", "description", "class", "type"],
          fieldTitles: tilejson?.vector_layers?.[0]?.fields ?
            Object.keys(tilejson.vector_layers[0].fields).slice(0, 6).map(field =>
              field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            ) :
            ["ID", "Description", "Class", "Type"]
        }
      };
      if (actualUrl.includes('api-main')) {
        config.sourceLayer = 'vector';
        if (mapId) {
          config.headerImage = `https://api-main-432878571563.europe-west4.run.app/maps/${mapId}/thumbnail`;
        }
      }
    } else if (type === 'raster') {
      const cleanTitle = (title) => {
        if (!title) return 'Raster Layer';
        let cleaned = title;
        if (cleaned.startsWith('File:')) cleaned = cleaned.substring(5);
        cleaned = cleaned.replace(/\.(jpg|jpeg|png|gif|tiff|tif|pdf)$/i, '');
        return cleaned.trim();
      };

      const formatWikiLink = (url, text) => {
        if (url && url.includes('commons.wikimedia.org/wiki/File:')) {
          const fileName = url.split('/').pop();
          const displayText = text || fileName;
          return `<a href='${url}' target='_blank'>${displayText}</a>`;
        }
        return text || url;
      };

      const formatDescription = (description) => {
        if (!description) return undefined;
        const fromMatch = description.match(/From:\s*(https?:\/\/[^\s]+)/);
        if (fromMatch) {
          const url = fromMatch[1];
          if (url.includes('commons.wikimedia.org/wiki/File:')) {
            const fileName = url.split('/').pop();
            return `From: ${formatWikiLink(url, fileName)}`;
          }
        }
        return description;
      };

      const formatAttribution = (metadata) => {
        if (!metadata) return undefined;
        const source = metadata.source;
        const originalUrl = metadata.originalUrl;
        let attribution = '';

        // Use source if it exists
        if (source) {
          if (source.includes('commons.wikimedia.org/wiki/File:')) {
            // Format wikimedia commons URLs as links
            const fileName = source.split('/').pop();
            attribution += formatWikiLink(source, fileName);
          } else if (source.startsWith('http://') || source.startsWith('https://')) {
            // Format other URLs as links
            attribution += `<a href='${source}' target='_blank'>${source}</a>`;
          } else {
            // Plain text source
            attribution += source;
          }
        }
        if (originalUrl) {
          attribution += attribution ? ' via ' : '';
          attribution += `<a href='${originalUrl}' target='_blank'>MapWarper</a>`;
        }
        return attribution || undefined;
      };

      config = {
        title: mapwarperMetadata ? cleanTitle(mapwarperMetadata.title) : 'Raster Layer',
        description: mapwarperMetadata ? formatDescription(mapwarperMetadata.description) : undefined,
        date: mapwarperMetadata ? mapwarperMetadata.date : undefined,
        type: 'tms',
        id: mapwarperMetadata ? `mapwarper-${mapwarperMetadata.mapId}` : 'raster-' + Math.random().toString(36).slice(2, 8),
        url: actualUrl,
        style: {
          'raster-opacity': [
            'interpolate', ['linear'], ['zoom'], 6, 0.95, 18, 0.8, 19, 0.3
          ]
        },
        attribution: mapwarperMetadata ? formatAttribution(mapwarperMetadata) : undefined,
        headerImage: mapwarperMetadata ? mapwarperMetadata.thumbnail : undefined,
        bbox: mapwarperMetadata && mapwarperMetadata.bbox ? mapwarperMetadata.bbox : undefined,
        initiallyChecked: false
      };

      Object.keys(config).forEach(key => {
        if (config[key] === undefined) delete config[key];
      });
    } else if (type === 'geojson') {
      config = {
        title: 'GeoJSON Layer',
        type: 'geojson',
        id: 'geojson-' + Math.random().toString(36).slice(2, 8),
        url: actualUrl,
        initiallyChecked: false,
        inspect: {
          id: "id",
          title: "Name",
          label: "name",
          fields: ["id", "description", "class", "type"],
          fieldTitles: ["ID", "Description", "Class", "Type"]
        }
      };
    } else if (type === 'atlas') {
      config = {
        type: 'atlas',
        url: actualUrl,
        inspect: {
          id: "id",
          title: "Name",
          label: "name",
          fields: ["id", "description", "class", "type"],
          fieldTitles: ["ID", "Description", "Class", "Type"]
        }
      };
    } else {
      config = { url: actualUrl };
    }
    return config;
  }

  /**
   * Fit map bounds to layer bbox if available
   * @param {Object} layerConfig - Layer configuration
   */
  static fitBoundsToMapwarperLayer(layerConfig) {
    const bbox = layerConfig?.bbox || layerConfig?.metadata?.bbox;
    if (!bbox || !window.map || bbox === "0.0,0.0,0.0,0.0") return;

    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(parseFloat);
    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) return;

    window.map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: 50,
      maxZoom: 16,
      duration: 1000
    });
  }

  /**
   * Gets current shareable URL
   * @returns {string} URL
   */
  static getShareableUrl() {
    const shareBtn = document.getElementById('share-link');
    if (shareBtn && shareBtn.dataset && shareBtn.dataset.url) {
      return shareBtn.dataset.url;
    }
    return window.location.href;
  }
}
