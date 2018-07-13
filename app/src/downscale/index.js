#!/usr/bin/env node
'use strict';
var tileReduce = require('@mapbox/tile-reduce');
var path = require('path');

var mbtilesPath = process.argv[2] || "osm.mbtiles";
var outputDir = process.argv[3] || './output';
var binningFactor = +process.argv[4] || 64;

var cpus = require('os').cpus().length;

tileReduce({
    map: path.join(__dirname, '/map.js'),
    log: !false,
    sources: [{
        name: 'osmqatiles',
        mbtiles: mbtilesPath,
        raw: true
    }],
    mapOptions: {
        mbtilesPath: mbtilesPath,
        outputDir: outputDir,
        binningFactor: binningFactor
    }
})
.on('reduce', function(d) {
})
.on('end', function() {
});
