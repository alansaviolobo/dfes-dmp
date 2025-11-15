#!/bin/bash

cd ../assets/map-layers/dfes-dmp/
convert \
  map-layer-ambulances.png \
  map-layer-civil-supplies-godowns.png \
  map-layer-cyclone-shelters.png \
  map-layer-dam-levels.png \
  map-layer-fire-appliances.png \
  map-layer-fire-stations.png \
  map-layer-gas-pipelines.png \
  map-layer-heavy-machinery.png \
  map-layer-hospitals.png \
  map-layer-mask.png \
  map-layer-mha-units.png \
  map-layer-mutual-aid-agencies.png \
  map-layer-police-stations.png \
  map-layer-river-flooding-gauges.png \
  map-layer-schools.png \
  map-layer-streetmap.png \
  map-layer-tree-cutters.png \
  map-layer-village-panchayats.png \
  map-layer-water-resources.png \
  -append all-image-sprite.png