# Architecture

## Nomenclature

**Thematic map layer**

The amche-atlas is an organized collection of thematic maps, each composed of one or more symbolized data sources.

eg. Satellite Basemap, Street Map, Infrastructure, Natural Hazards, Boundaries, Protected Lands, Drainage, Forests, Building Footprints, Landuse and Landcover, Regulatory Plans..


```js
{
"maps": [
  {
    "id": "street",
    "title": "Street Details",
    "layers": ["mapbox-streets","mapbox-traffic"]
    "tags": ["basemap", "mapbox", "openstreetmap"]
  },
  {
    "id": "cadastre",
    "title": "Cadastral Surveys",
    "layers": ["plot", "notified-wetlands","notified-wetlands","private-forest","communidade-bhunaksha","communidade-saligao"]
    "tags": ["basemap", "mapbox", "openstreetmap"]
  }
}

```

**Data layer**

Every data source is symbolized on the map using cartographic rules. These rules help render every data feature on the map using one or more overlapping style layers.


- Thematic map layer: is a collection of one or more map data layers that belong to a single theme. eg. Satellite Basemap, Street Map, Infrastructure, Natural Hazards, Boundaries, Protected Lands, Drainage, Forests, Building Footprints, Landuse and Landcover, Regulatory Plans..
  - Data layer: A data source that is visualized using one or mor style layers . eg. roads, wetlands, forests. 
    - Style layer: Individual map style layers with data defined symbology. eg fill, line, text

### Sample atlas.json configuration




## Interaction Patterns

**Primary Interface**

- Web GL Map

**Secondary Interfaces**

- App Navigation menu
- Map controls
  - Map Layer Control: Select theme and data layers
  - Feature Inspector: Inspect details from selected data layers

**Tertiary Interfaces**
