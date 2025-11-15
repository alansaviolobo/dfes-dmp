# Map Configuration Guide

**🎯 Quick Start**: Want to create your own custom map? Just edit `config/index.atlas.json` - it's now super easy!

## What is this?

The Amche Goa map can be customized to show different layers and focus on different areas. You can create your own version by simply editing a configuration file.

## 📋 Easy Configuration with `index.atlas.json`

The main configuration file is `config/index.atlas.json`. Here's what it looks like:

```json
{
  "name": "My Custom Map",
  "areaOfInterest": "Goa, India", 
  "map": {
    "center": [73.8, 15.47],
    "zoom": 11.4
  },
  "layers": [
    {
      "id": "mapbox-streets",
      "title": "Street Map",
      "initiallyChecked": true
    },
    {
      "id": "village"
    },
    {
      "id": "forests"
    }
  ]
}
```

That's it! 🎉

## 🎯 How It Works (The Magic!)

1. **Layer Definitions**: Each atlas file (`*.atlas.json`) contains complete layer definitions
2. **Shared Layers**: Layers can be reused across multiple atlases by referencing them with prefixed IDs (e.g., `india-bhuvan-satellite`)
3. **Easy Customization**: Override properties like opacity and visibility when referencing layers

## 📝 Step-by-Step: Create Your Own Map

### 1. Choose Your Layers

Pick from these popular layer IDs:

**Basic Maps:**
- `mapbox-streets` - Street map
- `osm` - OpenStreetMap

**Boundaries:**
- `village` - Village boundaries  
- `pincode` - Pincode boundaries
- `local-body` - Panchayat/Municipal boundaries
- `assembly-constituencies` - MLA constituencies

**Environment:**
- `forests` - Forest areas
- `rivers` - Rivers and streams
- `water-bodies` - Lakes and ponds
- `wetland` - Wetlands and mangroves
- `mining` - Mining lease areas

**Land Use:**
- `plot` - Property/survey boundaries
- `landcover` - Satellite-based land cover
- `osm-landuse` - Detailed land use from OpenStreetMap

**Historical Maps:**
- `goa-soi-map` - Survey of India topographic maps
- `regional-plan` - Regional Development Plan 2021
- `1906-india-atlas` - Historical 1906 atlas

[See layers in each atlas file: `india.atlas.json`, `goa.atlas.json`, `osm.atlas.json`, etc.]

### 2. Edit Your Configuration

Copy `config/index.atlas.json` and modify it:

```json
{
  "name": "My Environmental Map",
  "map": {
    "center": [73.9, 15.4],
    "zoom": 12
  },
  "layers": [
    {
      "id": "mapbox-streets",
      "initiallyChecked": true
    },
    {
      "id": "forests",
      "title": "Protected Forests"
    },
    {
      "id": "rivers"
    },
    {
      "id": "mining",
      "title": "Mining Areas (⚠️ Environmental Impact)"
    }
  ]
}
```

### 3. Customize Individual Layers (Optional)

Want to change how a layer looks? Override specific properties:

```json
{
  "id": "forests",
  "title": "My Custom Forest Layer",
  "initiallyChecked": true,
  "style": {
    "fill-color": "darkgreen",
    "fill-opacity": 0.8
  }
}
```

### 4. Set Your Map Center and Zoom

```json
{
  "map": {
    "center": [73.8274, 15.4406],  // [longitude, latitude]
    "zoom": 11.4                   // Higher = more zoomed in
  }
}
```

**Finding Coordinates:**
1. Go to [amche.goa.in](https://amche.goa.in)
2. Navigate to your area of interest
3. Look at the URL: `#11.4/15.4406/73.8274` 
4. Use those numbers: `[73.8274, 15.4406]`

## 🚀 Testing Your Configuration

### Using the `?atlas=` URL Parameter

The map supports three different ways to load configurations via the URL parameter:

#### 1. **Local filename**: `?atlas=maphub`
- Loads `config/maphub.atlas.json` from the local server
- Example: `https://amche.goa.in/?atlas=maphub`
- Best for: Development and predefined configs

#### 2. **Remote URL**: `?atlas=https://...`
- Fetches configuration directly from any URL
- Example: `https://amche.goa.in/?atlas=https://gist.githubusercontent.com/user/abc123/raw/config.json`
- Best for: Sharing configs via GitHub Gists, external servers

#### 3. **Serialized JSON**: `?atlas={"name":"..."}`
- Parses the JSON configuration directly from the URL
- Example: `https://amche.in/?atlas={"name":"My Map","layers":[{"id":"mapbox-streets"}]}`
- Best for: Quick testing, embedding full configs in URLs
- Note: URL-encode the JSON for special characters

### Additional Testing Methods

### Method 1: GitHub Gist (Recommended for Sharing)
1. Save your config as a GitHub Gist
2. Get the "Raw" URL 
3. Test: `https://amche.goa.in/?atlas=YOUR_RAW_URL`

### Method 2: Replace the Main Config
1. Replace `config/index.atlas.json` with your version
2. Visit the map normally

### Method 3: Create Named Config
1. Save as `config/my-map.atlas.json`
2. Test: `https://amche.goa.in/?atlas=my-map`

## 💡 Pro Tips

### For Beginners:
- Start by copying `index.atlas.json` and just changing the layer list
- Remove layers you don't want, add layers you do want
- Only specify `id` for most layers - the system handles the rest!

### Common Customizations:
```json
{
  "id": "layer-name",
  "title": "Custom Title",
  "initiallyChecked": true,
  "description": "Custom description",
  "opacity": 0.7,
  "style": {
    "fill-color": "#ff0000",
    "fill-opacity": 0.5
  }
}
```

**Available for all layer types:**
- `id` (required) - Unique identifier
- `title` (optional) - Display name in UI
- `description` (optional) - Layer description (supports HTML)
- `headerImage` (optional) - Header image URL for layer card
- `attribution` (optional) - Data source attribution
- `initiallyChecked` (optional) - Show layer on load (default: false)
- `legendImage` (optional) - Legend image URL or PDF

**GeoJSON/CSV clustering:**
```json
{
  "id": "clustered-points",
  "type": "geojson",
  "clustered": true,
  "clusterMaxZoom": 14,
  "clusterRadius": 50,
  "clusterSeparateBy": "category",
  "clusterStyles": {
    "restaurant": { "color": "#ff0000" },
    "hotel": { "color": "#0000ff" }
  }
}
```

### Multiple Areas:
Create different configs for different regions:
- `config/north-goa.atlas.json` - Focus on North Goa
- `config/panaji.atlas.json` - Focus on Panaji city  
- `config/mining.atlas.json` - Mining-focused map

## 🔍 Example Configurations

### Environmental Focus:
```json
{
  "name": "Goa Environmental Map",
  "layers": [
    {"id": "mapbox-streets", "initiallyChecked": true},
    {"id": "forests"},
    {"id": "wetland"}, 
    {"id": "water-bodies"},
    {"id": "mining"},
    {"id": "esz"}
  ]
}
```

### Urban Planning:
```json
{
  "name": "Urban Planning Map", 
  "layers": [
    {"id": "mapbox-streets", "initiallyChecked": true},
    {"id": "plot"},
    {"id": "village"},
    {"id": "local-body"},
    {"id": "regional-plan"},
    {"id": "landuse-panjim"}
  ]
}
```

### Historical Research:
```json
{
  "name": "Historical Goa",
  "layers": [
    {"id": "1906-india-atlas", "initiallyChecked": true},
    {"id": "1855-geology"},
    {"id": "1814-lambton-survey"},
    {"id": "village"},
    {"id": "rivers"}
  ]
}
```

## ❓ FAQ

**Q: I want to add a completely new layer, not from the library**
A: You can still define custom layers with full properties. See the [Advanced Configuration](#advanced-configuration) section and [Available Layer Types](#-available-layer-types) for all supported layer types and their properties.

**Q: Can I change the styling of existing layers?**
A: Yes! Just add a `style` property to override the default styling. See [Style Properties Reference](#-style-properties-reference) for available options.

**Q: How do I validate my layer configuration?**
A: Use the built-in validation:
```bash
npm run lint  # Validates all JSON files in config/
```

For programmatic validation in the browser console or JavaScript:
```javascript
import { ConfigManager } from './js/config-manager.js';

// Validate a layer configuration
const config = {
  id: 'villages',
  type: 'vector',
  url: 'https://example.com/tiles/{z}/{x}/{y}.pbf',
  sourceLayer: 'villages'
};

const result = ConfigManager.validateLayerConfig(config);
if (!result.valid) {
  console.error('Errors:', result.errors);
  console.warn('Warnings:', result.warnings);
} else {
  console.log('Valid configuration!');
}

// Generate a template for a new layer
const template = ConfigManager.generateLayerTemplate('geojson');
console.log(JSON.stringify(template, null, 2));

// Get documentation for a layer type
const docs = ConfigManager.getLayerDocumentation('vector');
console.log('Required fields:', docs.required);
console.log('Optional fields:', docs.optional);
```

**Q: My JSON has an error**
A: Use a JSON validator like [jsonlint.com](https://jsonlint.com) to check for syntax errors, or run `npm run lint` to validate all config files.

**Q: The map doesn't load my config**
A: Check the browser console (F12) for errors. The map will fall back to the default config if yours has problems. Common issues:
- Invalid JSON syntax
- Missing required fields (e.g., `id`, `type`, `url`)
- Incorrect layer type
- CORS issues with remote URLs

**Q: How do I add time-based layers?**
A: Add `urlTimeParam` to layers that support temporal data (tms, wmts, wms, img). See [Time-Based Layers](#-time-based-layers) section.

**Q: Can I cluster my points by category?**
A: Yes! Use `clusterSeparateBy` with GeoJSON layers. See the [geojson layer type](#6-geojson---geojson-vector-layer) example.

## 🏗️ Advanced Configuration

If you need to define completely custom layers (not in the preset library), you can still use the full format:

```json
{
  "id": "my-custom-layer",
  "title": "My Custom Layer", 
  "type": "geojson",
  "url": "https://example.com/my-data.geojson",
  "style": {
    "line-color": "red",
    "line-width": 3
  },
  "inspect": {
    "title": "Feature Info",
    "label": "name"
  }
}
```

## 🎨 Available Layer Types

The map supports 10 different layer types. Each has specific configuration requirements and capabilities.

> **📘 Complete Specifications**: See [`js/config-manager.js`](../js/config-manager.js) for detailed schemas, properties, and examples for each layer type.

### Quick Reference

| Type | Description | Common Use |
|------|-------------|------------|
| `style` | Control existing base map layers | Toggle contours, labels, roads |
| `vector` | Vector tiles (.pbf/.mvt) | Boundaries, infrastructure |
| `tms` | Raster tiles (XYZ/TMS) | Satellite imagery, base maps |
| `wmts` | OGC WMTS standard | Government WMS services |
| `wms` | OGC WMS standard | Real-time data, weather |
| `geojson` | GeoJSON vector data | Points, lines, polygons |
| `csv` | Tabular data with lat/lng | Sensor data, locations |
| `img` | Single georeferenced image | Historic maps, overlays |
| `raster-style-layer` | Control base map rasters | Hillshade, satellite toggle |
| `layer-group` | Radio button group | Basemap switcher |

### Layer Type Details

#### 1. **style** - Style Layer Control
Controls visibility of layers already in the base Mapbox style.

```json
{
  "id": "contours",
  "type": "style",
  "title": "Contour Lines",
  "layers": [
    { "sourceLayer": "contour", "title": "Contours" },
    { "sourceLayer": "contour_index", "title": "Index Contours" }
  ]
}
```

**Key Properties:**
- `layers` (required) - Array of sublayers with `sourceLayer` names
- `style` (optional) - Paint/layout properties to apply when visible

---

#### 2. **vector** - Vector Tile Layer
Vector tiles with full styling control.

```json
{
  "id": "villages",
  "type": "vector",
  "title": "Village Boundaries",
  "url": "https://example.com/tiles/{z}/{x}/{y}.pbf",
  "sourceLayer": "villages",
  "style": {
    "fill-color": "#f0f0f0",
    "fill-opacity": 0.5,
    "line-color": "#333",
    "line-width": 2
  },
  "inspect": {
    "title": "Village Info",
    "label": "name",
    "fields": ["population", "area"]
  }
}
```

**Key Properties:**
- `url` (required) - Tile URL with `{z}/{x}/{y}` placeholders
- `sourceLayer` (required) - Source layer name within tiles
- `style` (optional) - Supports `fill-*`, `line-*`, `circle-*`, `text-*` properties
- `filter` (optional) - Mapbox GL filter expression
- `inspect` (optional) - Feature popup configuration
- `maxzoom` (optional, default: 22) - Maximum zoom level

---

#### 3. **tms** - Tile Map Service (Raster)
Raster tile service supporting XYZ or TMS schemes.

```json
{
  "id": "satellite",
  "type": "tms",
  "title": "Satellite Imagery",
  "url": "https://example.com/tiles/{z}/{x}/{y}.png",
  "opacity": 0.8,
  "scheme": "xyz",
  "maxzoom": 18
}
```

**Key Properties:**
- `url` (required) - Tile URL with `{z}/{x}/{y}` placeholders
- `opacity` (optional, default: 1) - Layer transparency
- `scheme` (optional, default: "xyz") - Coordinate scheme: "xyz" or "tms"
- `urlTimeParam` (optional) - Time parameter for temporal layers (e.g., `"TIME={time}"`)

---

#### 4. **wmts** - Web Map Tile Service
OGC WMTS standard with automatic conversion to Web Mercator.

```json
{
  "id": "nasa-viirs",
  "type": "wmts",
  "title": "NASA VIIRS",
  "url": "https://gibs.earthdata.nasa.gov/wmts/.../TileMatrix={z}/TileRow={y}/TileCol={x}.png",
  "urlTimeParam": "TIME={time}",
  "tileSize": 256,
  "opacity": 0.9
}
```

**Key Properties:**
- `url` (required) - WMTS GetTile URL (will convert TileMatrix/Row/Col to {z}/{x}/{y})
- `tileSize` (optional, default: 256) - Tile size in pixels
- `urlTimeParam` (optional) - Enables time-based layer updates
- `forceWebMercator` (optional) - Force EPSG:3857 conversion

**Time-Based Layers:** If `urlTimeParam` is set, the layer will update when the map's time control changes.

---

#### 5. **wms** - Web Map Service
OGC WMS standard converted to tiles.

```json
{
  "id": "weather-radar",
  "type": "wms",
  "title": "Weather Radar",
  "url": "https://example.com/wms?service=WMS&version=1.1.1&request=GetMap&layers=radar",
  "srs": "EPSG:3857",
  "tileSize": 256,
  "opacity": 0.7,
  "proxyUrl": "https://proxy.example.com",
  "urlTimeParam": "TIME={time}"
}
```

**Key Properties:**
- `url` (required) - WMS GetMap base URL with parameters
- `srs` (optional, default: "EPSG:3857") - Spatial reference system
- `tileSize` (optional, default: 256) - Tile size for requests
- `proxyUrl` (optional) - Proxy server for CORS issues
- `proxyReferer` (optional) - Referer header for proxy

---

#### 6. **geojson** - GeoJSON Vector Layer
GeoJSON data with clustering support.

```json
{
  "id": "poi",
  "type": "geojson",
  "title": "Points of Interest",
  "url": "https://example.com/data.geojson",
  "clustered": true,
  "clusterMaxZoom": 14,
  "clusterRadius": 50,
  "clusterSeparateBy": "category",
  "clusterStyles": {
    "restaurant": { "color": "#ff0000" },
    "hotel": { "color": "#0000ff" }
  },
  "style": {
    "circle-radius": 8,
    "circle-color": "#f00"
  }
}
```

**Key Properties:**
- `url` OR `data` (required) - Either URL to GeoJSON or inline data object
- `style` (optional) - Supports `fill-*`, `line-*`, `circle-*`, `text-*` properties
- `clustered` (optional, default: false) - Enable point clustering
- `clusterMaxZoom` (optional, default: 14) - Max zoom for clustering
- `clusterRadius` (optional, default: 50) - Cluster radius in pixels
- `clusterSeparateBy` (optional) - Property name to create separate colored clusters
- `clusterStyles` (optional) - Color mapping for categories when using `clusterSeparateBy`

**KML Support:** KML files are automatically converted to GeoJSON.

---

#### 7. **csv** - CSV Data Layer
Tabular data with latitude/longitude columns.

```json
{
  "id": "sensors",
  "type": "csv",
  "title": "Sensor Locations",
  "url": "https://example.com/sensors.csv",
  "refresh": 60000,
  "style": {
    "circle-radius": 6,
    "circle-color": "#00ff00"
  }
}
```

**Key Properties:**
- `url` OR `data` (required) - Either URL to CSV or inline CSV text
- `refresh` (optional) - Auto-refresh interval in milliseconds
- `csvParser` (optional) - Custom parsing function
- Default expects columns: `Latitude`, `Longitude` (or `lat`, `lng`)

---

#### 8. **img** - Image Overlay
Single georeferenced image overlay.

```json
{
  "id": "historic-map",
  "type": "img",
  "title": "Historic Map 1906",
  "url": "https://example.com/map.jpg",
  "bounds": [73.5, 15.0, 74.5, 16.0],
  "opacity": 0.7,
  "refresh": 300000,
  "urlTimeParam": "TIME={time}"
}
```

**Key Properties:**
- `url` (required) - Image URL
- `bounds` (required) - Bounding box `[west, south, east, north]`
- `opacity` (optional, default: 0.85) - Image transparency
- `refresh` (optional) - Auto-refresh interval in milliseconds
- `urlTimeParam` (optional) - Time parameter for temporal images

---

#### 9. **raster-style-layer** - Raster Style Control
Controls existing raster layers in the base map style.

```json
{
  "id": "hillshade-control",
  "type": "raster-style-layer",
  "title": "Hillshade",
  "styleLayer": "hillshade",
  "opacity": 0.5
}
```

**Key Properties:**
- `styleLayer` (required) - ID of style layer to control
- `opacity` (optional) - Layer opacity override
- `style` (optional) - Additional raster paint properties

---

#### 10. **layer-group** - Layer Group Toggle
Radio button group for mutually exclusive layers.

```json
{
  "id": "basemap-group",
  "type": "layer-group",
  "title": "Base Map",
  "groups": [
    { "id": "streets", "title": "Streets" },
    { "id": "satellite", "title": "Satellite" },
    { "id": "terrain", "title": "Terrain" }
  ]
}
```

**Key Properties:**
- `groups` (required) - Array of layer options with `id` and `title`
- Only one layer in the group can be visible at a time

---

### 🕐 Time-Based Layers

Certain layer types support temporal data that changes over time. Use `urlTimeParam` to enable time-based updates:

```json
{
  "id": "weather-satellite",
  "type": "wmts",
  "url": "https://gibs.earthdata.nasa.gov/wmts/.../default/{time}/GoogleMapsCompatible_Level9/...",
  "urlTimeParam": "TIME={time}"
}
```

**Supported layer types:**
- `tms` - Tile Map Service
- `wmts` - Web Map Tile Service
- `wms` - Web Map Service
- `img` - Image overlay

When the map's time control changes, layers with `urlTimeParam` will automatically update their URLs with the new time value. The time format is automatically converted based on the service (ISO 8601 for most, YYYY-MM-DD for NASA GIBS).

---

### 🎯 Feature Inspection

Vector layers (`vector`, `geojson`, `csv`) support interactive feature popups:

```json
{
  "inspect": {
    "id": "unique_id",
    "title": "Feature Information",
    "label": "name",
    "fields": ["population", "area", "district"]
  }
}
```

**Inspect Properties:**
- `id` (optional) - Property to use as feature ID for state management
- `title` (optional) - Popup header title
- `label` (optional) - Property to display as feature label
- `fields` (optional) - Array of property names to show in popup

**Disable inspection:**
```json
{
  "inspect": false
}
```

---

### 🎨 Style Properties Reference

The `style` property accepts Mapbox GL JS style specifications:

**Fill (Polygons):**
- `fill-color` - Fill color
- `fill-opacity` - Fill transparency (0-1)
- `fill-outline-color` - Outline color

**Line (Lines/Borders):**
- `line-color` - Line color
- `line-width` - Line width in pixels
- `line-opacity` - Line transparency (0-1)
- `line-dasharray` - Dash pattern `[dash, gap]`

**Circle (Points):**
- `circle-radius` - Radius in pixels
- `circle-color` - Fill color
- `circle-opacity` - Fill transparency (0-1)
- `circle-stroke-width` - Border width
- `circle-stroke-color` - Border color

**Text (Labels):**
- `text-field` - Property to display as text
- `text-color` - Text color
- `text-size` - Font size in pixels
- `text-halo-color` - Text outline color
- `text-halo-width` - Text outline width

**Raster (Images/Tiles):**
- `raster-opacity` - Image transparency (0-1)
- `raster-brightness-min` - Brightness minimum (-1 to 1)
- `raster-brightness-max` - Brightness maximum (-1 to 1)
- `raster-contrast` - Contrast adjustment (-1 to 1)
- `raster-saturation` - Saturation adjustment (-1 to 1)

For advanced styling with expressions, zoom functions, and data-driven properties, see the [Mapbox Style Specification](https://docs.mapbox.com/style-spec/).

## 📚 Resources

**Configuration:**
- [Config Manager](../js/config-manager.js) - Complete layer type specifications and schemas
- [Example Atlas Files](.) - Browse existing atlas configurations for layer examples
- [Default Styling](_defaults.json) - See the default style settings
- [Layer Registry](../js/layer-registry.js) - Central registry for managing layer presets

**Live Examples:**
- [Main Map](https://amche.in/) - Production map with full layer library
- [Development Map](https://amche.in/dev/) - Testing environment
- [Maphub Demo](https://amche.in/?atlas=maphub) - Example themed configuration

**Documentation:**
- [API Documentation](../docs/API.md) - URL parameters and API usage
- [Mapbox Style Specification](https://docs.mapbox.com/style-spec/) - Advanced styling reference
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/api/) - Map API reference

**Tools:**
- [JSON Validator](https://jsonlint.com) - Check your JSON syntax
- [GeoJSON.io](https://geojson.io/) - Create and edit GeoJSON data
- [Mapbox Studio](https://studio.mapbox.com/) - Design custom map styles

**Getting Help:**
- Open an issue on [GitHub](https://github.com/datameet/amche-goa/issues)
- Join the [Datameet Community](https://datameet.org/)
- Check existing [atlas configurations](.) for examples

Need help? Open an issue on GitHub! 🙋‍♀️