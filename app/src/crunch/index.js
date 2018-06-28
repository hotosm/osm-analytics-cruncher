#!/usr/bin/env node
'use strict';
var tileReduce = require('@mapbox/tile-reduce');
var path = require('path');

var mbtilesPath = process.argv[2] || "osm.mbtiles",
    analyticsPath = process.argv[3] || '../../analytics.json',
    experiencesPath = process.argv[4] || '../../experiences.json',
    intermediateDir = process.argv[5] || './intermediate',
    binningFactor = +process.argv[6] || 64;

tileReduce({
    map: path.join(__dirname, '/map.js'),
    log: !false,
    sources: [{
        name: 'osmqatiles',
        mbtiles: mbtilesPath,
        raw: false
    }],
    mapOptions: {
        analyticsPath: analyticsPath,
        experiencesPath: experiencesPath,
        intermediateDir: intermediateDir,
        binningFactor: binningFactor
    }
})
.on('reduce', function(d) {
})
.on('end', function() {
});
