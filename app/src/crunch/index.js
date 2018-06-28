#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');
var tileReduce = require('@mapbox/tile-reduce');

var mbtilesPath = process.argv[2] || "osm.mbtiles",
    analyticsPath = process.argv[3] || '../../analytics.json',
    experiencesPath = process.argv[4] || '../../experiences.json',
    outputDir = process.argv[5] || './output',
    binningFactor = +process.argv[6] || 64;

var analytics = JSON.parse(fs.readFileSync(analyticsPath));

try {
    analytics.layers.forEach(function(layer) {
        fs.mkdirSync(outputDir + '/' + layer.name);
    })
} catch (error) {
    console.error("error: output directory should exist and be empty when calling the cruncher (it will be created automatically)");
    process.exit(1);
}

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
        outputDir: outputDir,
        binningFactor: binningFactor
    }
})
.on('reduce', function(d) {
})
.on('end', function() {
});
