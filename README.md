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

## Data generation

Invoking `app/run.sh` (or `./docker.sh gen` command in a docker environment) starts the process to re-generate osm-analytics data. It will automatically download a fresh osm-qa-tiles planet file, crunch the data and stores the results in a supplied directory.

### Environment Variables

The data generation can be configured by setting the following shell environment variables:

* `ANALYTICS_FILE` – file defining analytics job (e.g. what layers to crunch), see example-analytics.json for an example
* `WORKING_DIR` – working directory where intermediate data is stored
* `RESULTS_DIR` – directory where resulting .mbtiles files are stored
* `OSMQATILES_SOURCE` – URL to fetch osmqatiles from

### `analytics.json`

The data generation process is controlled via a single *"analytics definition file"*, which specifies which parts of the OpenStreetMap data has to be processed in which way and how the result should be interpreted. An example can be found at [`app/example-analytics.json`](app/example-analytics.json). Further details about this file can be found in the [specification document](https://github.com/hotosm/osm-analytics-config/blob/master/analytics-json.md).

## Serving data

### Natively

The `app/server/serve.js` script is an example for how to provide the data to the osm-analytics frontend over the web. It expects the directory where the result of the crunching step is stored and the analytics definition json file as parameters.

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

# Documentation

An overview of all steps required to implement an instance of osm-analytics can be found [here](https://gist.github.com/tyrasd/5f17d10a5b9ab1c8d2409238a5e0a54b) (work in progress).

A schematic diagram of the different components of the cruncher are found in the [documentation directory](https://github.com/hotosm/osm-analytics-cruncher/tree/master/documentation).
