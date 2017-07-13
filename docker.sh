#!/bin/bash -ex

set -e

case "$1" in
    gen)
        echo "Running Cruncher"
        docker build -t osm-analytics-cruncher .
        docker run -i -t -v $(pwd)/results:/opt/osm-cruncher/app/results osm-analytics-cruncher gen
        ;;
    server)
        echo "Running tile server"
        docker build -t osm-analytics-cruncher .
        exec docker run -i -t -p 7778:7778 -v $(pwd)/results:/opt/osm-cruncher/app/results osm-analytics-cruncher server $2
        ;;
    *)
        exec "$@"
esac
