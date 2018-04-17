# oqt-user-experience

Uses [osm-qa-tiles](http://osmlab.github.io/osm-qa-tiles/) to calculate a few statistics related to *user experience* based on the latest-modifier field of OSM features.

Usage:

    node oqt-user-experience/index.js <path-to-osmqatiles.mbtiles> > userexperience.json

Output:

JSON with a set of properties for each user (uid), e.g.

    …
    "1234": {
        "objects": 123,
        "highways": 1.37,
        "waterways": 7.98,
        "buildings": 4
    },
   …
