#!/usr/bin/env node
'use strict';
var tileReduce = require('@mapbox/tile-reduce');
var path = require('path');

var mbtilesPath = process.argv[2] || "osm.mbtiles",
    filterPath = process.argv[3] || './filter.json',
    binningFactor = +process.argv[4] || 64;

tileReduce({
    map: path.join(__dirname, '/map.js'),
    log: !false,
    sources: [{
        name: 'osmqatiles',
        mbtiles: mbtilesPath,
        raw: false
    }],
    mapOptions: {
        filterPath: filterPath,
        binningFactor: binningFactor
    }
})
.on('reduce', function(d) {
})
.on('end', function() {
});
