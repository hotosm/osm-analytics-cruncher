#!/bin/bash -ex

BINNINGFACTOR=${3:-64}

# clean up procedure
trap cleanup EXIT
function cleanup {
  rm -rf ./intermediate
}

# make temporary directory for intermediate results
mkdir -p intermediate

# apply filter, merge with user experience data, aggregate to bins
# and create z13-z14 tiles for raw data
node ./src/index.js $1 $2.json $BINNINGFACTOR
cp empty.mbtiles intermediate/out.mbtiles
./merge-mbtile.sh intermediate/out.mbtiles intermediate/$2.geom.*.mbtiles
cp empty.mbtiles intermediate/out.12.mbtiles
./merge-mbtile.sh intermediate/out.12.mbtiles intermediate/$2.aggr.*.mbtiles

# downscale bins to zoom levels 11 to 0
for i in {11..0}; do
    node ./src/downscale.js intermediate/out.$((i+1)).mbtiles $BINNINGFACTOR
    cp empty.mbtiles intermediate/out.$i.mbtiles
    ./merge-mbtile.sh intermediate/out.$i.mbtiles intermediate/out.tmp.*.mbtiles
done

# merge in aggredate data zoom levels
./merge-mbtile.sh intermediate/out.mbtiles intermediate/out.*.mbtiles
mv intermediate/out.mbtiles $2.mbtiles
