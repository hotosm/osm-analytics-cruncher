osm data analysis tool backend
=============================

Backend for an OSM data analysis tool. Uses [osm-qa-tiles](https://osmlab.github.io/osm-qa-tiles/) as input data.

Usage
-----

#### `./experiences.sh <path-to-osmqatiles.mbtiles>`

Generates a user experience file (`experiences.json`) to be used with `run.sh`.

#### `./crunch.sh <path-to-osmqatiles.mbtiles> <job> [<binningfactor>]`

Creates vector tiles for a specific feature type (e.g. buildings). Requires an experience data file (see above). A *job* is defined in the corresponding `<job>.json` file. See `building.json` for an example. The *binningfactor* determines how fine the grid at lower zoom levels should be calculated (default: 64).

Output is `<job>.mbtiles`.

#### `./hotprojects.sh`

Fetches the list of HOT projects outlines from the [tasking manager API](https://github.com/hotosm/osm-tasking-manager2/wiki/API). Generates vector tiles of the raw geometries and a geojson of simplified outlines (convex hulls limited to 40 vertices). Publishes the results on Amazon S3.

Serving
-------

The script in the `server` directory is an example for how to provide the data to the osm-analytics frontend over the web.

Updating
--------

See `run.sh` for an example invocation of the scripts above and integration with the example server.


Walkthrough
-----------

An overview of all steps required to implement an instance of osm-analytics can be found [here](https://gist.github.com/tyrasd/5f17d10a5b9ab1c8d2409238a5e0a54b) (work in progress)
