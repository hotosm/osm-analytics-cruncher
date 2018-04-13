osm data analysis tool backend
==============================

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


## Running the cruncher using a cron task

The cruncher alternates between periods of heavy processing and no load at all after that. Due to this, it is worth considering an execution environment
that does not rely on an always-on server, but rather on a job-based approach. This can be achieved using Google Cloud and the following command:

`gcloud compute --project "osma-174310" instances create "osma-cruncher" --zone "us-central1-c" --machine-type "custom-16-30720" --subnet "default" --maintenance-policy "MIGRATE" --service-account <your google data> --scopes "https://www.googleapis.com/auth/cloud-platform" --image "osma-cruncher-v2" --image-project "osma-174310" --boot-disk-size "100" --boot-disk-type "pd-ssd" --boot-disk-device-name "osma-cruncher"`

Its worth noting that this is not a requirement of the cruncher, nor a dependency on Google Cloud. A similar approach can be achieved
with different hosting services with no code changes, and the cruncher can be set up periodically on a "traditional", always-on server.

## Hardware profile

The crunching process is a resource-intensive task, requiring significant CPU, memory and storage to execute. 
To the date of these tests, the cruncher required 16 processing cores, 30GB of RAM and 100GB of storage to process the data in around 6h.

The necessary storage space depends on the amount of data input and output, so it may need to vary if the OSM tiles grow in size, or if more features need to be processed.

CPU and RAM are linearly correlated, and mostly dictate the time it takes to process the whole data.

# Walkthrough

An overview of all steps required to implement an instance of osm-analytics can be found [here](https://gist.github.com/tyrasd/5f17d10a5b9ab1c8d2409238a5e0a54b) (work in progress)
