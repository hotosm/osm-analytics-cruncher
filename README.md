OSM data analysis tool backend
=============================

Backend for an OSM data analysis tool. Uses [osm-qa-tiles](https://osmlab.github.io/osm-qa-tiles/) as input data.

### Requirements

If you want to use the cruncher natively, you'll need:
- NodeJS
- NPM

Be sure to run `npm install` before running the commands bellow

Alternatively, you can install and use `docker` and `docker-compose`.

# Usage

The tool is split in two parts: data generation and serving.

## Data generation - Main commands

The data generation is handled by multiple commands, each responsible for a subset of the whole data. 
Some convenience commands are provided, which run all tasks at once. Feel free to fine-tune them to your needs.

### Natively

See `app/run.sh` for an example invocation of all the data generation scripts.

### Docker

The `./docker.sh gen` command will run the above `app/run.sh` command in a docker environment.

Note: there is curently a [known issue](https://github.com/GFDRR/osm-analytics-cruncher/issues/14) with hot project data generation (geojson + tileset) in docker environment.  

## Data generation - Command breakdown

There are multiple commands that generate different parts of the data:

### `app/experiences.sh <path-to-osmqatiles.mbtiles>`

Generates a user experience file (`experiences.json`) to be used with `run.sh`.

### `app/crunch.sh <path-to-osmqatiles.mbtiles> <job> [<binningfactor>]`

Creates vector tiles for a specific feature type (e.g. buildings). Requires an experience data file (see above). A *job* is defined in the corresponding `<job>.json` file. See `building.json` for an example. The *binningfactor* determines how fine the grid at lower zoom levels should be calculated (default: 64).

Output is `<job>.mbtiles`.

### `app/hotprojects.sh`

Fetches the list of HOT projects outlines from the [tasking manager API](https://github.com/hotosm/osm-tasking-manager2/wiki/API). Generates vector tiles of the raw geometries and a geojson of simplified outlines (convex hulls limited to 40 vertices). Publishes the results on Amazon S3.

## Serving data

### Natively

The `app/server/serve.js` script is an example for how to provide the data to the osm-analytics frontend over the web.

### With docker

You can use the `./docker server buildings.mbtile` command to serve a pre-computed `mbtile` file. The `mbtile` file must be available in the `./results` local folder.

# Walkthrough

An overview of all steps required to implement an instance of osm-analytics can be found [here](https://gist.github.com/tyrasd/5f17d10a5b9ab1c8d2409238a5e0a54b) (work in progress)
