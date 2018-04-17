#!/usr/bin/env bash


# Usage:
#
# $ merge-mbtile dest source1 [source2 [source3 …]]
#
# merges all .mbtiles you give it.
# result will be stored in first one, rest removed after merging

DEST=$1
shift

while (( "$#" )); do

    ./patch.sh $1 $DEST
    rm $1
    #echo $1 $DEST
    shift

done
