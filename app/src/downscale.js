#!/usr/bin/env node
'use strict';
var tileReduce = require('@mapbox/tile-reduce');
var path = require('path');

var mbtilesPath = process.argv[2] || "osm.mbtiles";
var binningFactor = +process.argv[3] || 64;

var cpus = require('os').cpus().length;

tileReduce({
    map: path.join(__dirname, '/mapDownscale.js'),
    log: false,
    sources: [{
        name: 'osmqatiles',
        mbtiles: mbtilesPath,
        raw: true
    }],
    mapOptions: {
        mbtilesPath: mbtilesPath,
        binningFactor: binningFactor
    }
})
.on('reduce', function(d) {
})
.on('end', function() {
});
