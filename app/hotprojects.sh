#!/bin/bash -ex

node ./hotprojects.js --raw > hotprojects.raw.geojson
echo "Executing mapbox-tile-copy"
node ../node_modules/@mapbox/mapbox-tile-copy/bin/mapbox-tile-copy.js --minzoom=1 --maxzoom=9 hotprojects.raw.geojson s3://osma/tiles/{z}/{x}/{y}.pbf
rm hotprojects.raw.geojson

node ./hotprojects.js > hotprojects.geojson
gzip -9 hotprojects.geojson
aws s3 cp hotprojects.geojson.gz s3://osma/hotprojects.geojson --content-type="application/json" --content-encoding="gzip" --acl public-read-write
rm hotprojects.geojson.gz
