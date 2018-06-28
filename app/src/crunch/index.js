#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');
var tileReduce = require('@mapbox/tile-reduce');

var mbtilesPath = process.argv[2] || "osm.mbtiles",
    analyticsPath = process.argv[3] || '../../analytics.json',
    experiencesPath = process.argv[4] || '../../experiences.json',
    intermediateDir = process.argv[5] || './intermediate',
    binningFactor = +process.argv[6] || 64;


var analytics = JSON.parse(fs.readFileSync(analyticsPath));

try {
    fs.mkdirSync(intermediateDir);
} catch (error) {
    console.error("error: intermediate directory should not exist when calling the cruncher (it will be created automatically)");
    process.exit(1);
}
analytics.layers.forEach(function(layer) {
    fs.mkdirSync(intermediateDir + '/' + layer.name);
})

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
