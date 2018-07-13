#!/bin/bash -ex

# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
# this is an example script for how to invoke  osm-analytics-cruncher to
# regenerate vector tiles for osm-analytics from osm-qa-tiles
#
# config parameters (can be customized by setting shell environment variables):
#
# * ANALYTICS_FILE - file defining analytics job (e.g. what layers to crunch),
#                    see example-analytics.json for an example
# * WORKING_DIR - working directory where intermediate data is stored
#                 (requires at least around ~200 GB for planet wide crunches)
# * RESULTS_DIR - directory where resulting .mbtiles files are put (existing
#                 result mbtiles files in that directory are replaced)
# * OSMQATILES_SOURCE - URL to fetch osmqatiles from
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

# configs
ANALYTICS_FILE=${ANALYTICS_FILE:-"analytics.json"}
WORKING_DIR=${WORKING_DIR:-"./data"}
RESULTS_DIR=${RESULTS_DIR:-"./results"}
OSMQATILES_SOURCE=${OSMQATILES_SOURCE:-"https://s3.amazonaws.com/mapbox/osm-qa-tiles-production/latest.planet.mbtiles.gz"}

# clean up
trap cleanup EXIT
function cleanup {
  rm -rf $WORKING_DIR/planet.mbtiles $WORKING_DIR/cruncher/
}

mkdir -p $WORKING_DIR/cruncher/

# download latest planet from osm-qa-tiles
curl $OSMQATILES_SOURCE --silent | gzip -d > $WORKING_DIR/planet.mbtiles

# crunch osm-analytics data
./crunch.sh $WORKING_DIR/planet.mbtiles $ANALYTICS_FILE $WORKING_DIR/cruncher/
for f in $WORKING_DIR/cruncher/*.mbtiles; do
  mv $f $RESULTS_DIR/$(basename $f).tmp
  rm $RESULTS_DIR/$(basename $f) -f
  mv $RESULTS_DIR/$(basename $f).tmp $RESULTS_DIR/$(basename $f)
done
