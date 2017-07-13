#!/bin/bash
set -e

case "$1" in
    gen)
        echo "Running Cruncher"
        exec ./run.sh
        ;;
    server)
        echo "Running tile server"
        ls results
        exec node server/serve.js $2
        ;;
    *)
        exec "$@"
esac
