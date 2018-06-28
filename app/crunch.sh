#!/bin/bash -ex

INPUTFILE=$1
ANALYTICSFILE=$2
OUTPUTDIR=${3:-output}
BINNINGFACTOR=${4:-64}

# clean up procedure
trap cleanup ERR
function cleanup {
  rm -rf $OUTPUTDIR
}

mkdir -p $OUTPUTDIR/data/

# calculate user experience stats
node ./src/experience/index.js $INPUTFILE $ANALYTICSFILE > $OUTPUTDIR/experiences.json

# apply filter, merge with user experience data, aggregate to bins
# and create z13 tiles for raw data
node ./src/crunch/index.js $INPUTFILE $ANALYTICSFILE $OUTPUTDIR/experiences.json $OUTPUTDIR/data/ $BINNINGFACTOR

for d in $OUTPUTDIR/data/*; do
  layer=$(basename $d)
  cp empty.mbtiles $OUTPUTDIR/data/$layer/out.z13.mbtiles
  ./merge-mbtile.sh $OUTPUTDIR/data/$layer/out.z13.mbtiles $OUTPUTDIR/data/$layer/geom.*.z13.mbtiles
  cp empty.mbtiles $OUTPUTDIR/data/$layer/out.z12.mbtiles
  ./merge-mbtile.sh $OUTPUTDIR/data/$layer/out.12.mbtiles $OUTPUTDIR/data/$layer/aggr.*.z12.mbtiles

  # downscale bins to zoom levels 11 to 0
  for i in {11..0}; do
    node ./src/downscale/index.js $OUTPUTDIR/data/$layer/out.z$((i+1)).mbtiles $OUTPUTDIR/data/$layer $BINNINGFACTOR
    cp empty.mbtiles $OUTPUTDIR/data/$layer/out.z$i.mbtiles
    ./merge-mbtile.sh $OUTPUTDIR/data/$layer/out.z$i.mbtiles $OUTPUTDIR/data/$layer/downscaled.*.mbtiles
  done

  # merge in aggredate data zoom levels
  mv $OUTPUTDIR/data/$layer/out.z13.mbtiles $OUTPUTDIR/data/$layer/out.mbtiles
  ./merge-mbtile.sh $OUTPUTDIR/data/$layer/out.mbtiles $OUTPUTDIR/data/$layer/out.z*.mbtiles
  mv $OUTPUTDIR/data/$layer/out.mbtiles $OUTPUTDIR/$layer.mbtiles
  rmdir $OUTPUTDIR/data/$layer
done
rmdir $OUTPUTDIR/data
rm $OUTPUTDIR/experiences.json
