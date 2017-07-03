#!/usr/bin/env node
'use strict';
var tileReduce = require('@mapbox/tile-reduce');
var path = require('path');

var mbtilesPath = process.argv[2] || "osm.mbtiles";

var users = {};

tileReduce({
    map: path.join(__dirname, '/map.js'),
    sources: [{
        name: 'osm',
        mbtiles: mbtilesPath,
        raw: false
    }]
})
.on('reduce', function(d) {
    for (var u in d) {
        if (!users[u]) users[u] = { objects:0, highways: 0.0, waterways: 0.0, buildings: 0 };
        users[u].objects   += d[u].objects;
        users[u].highways  += d[u].highways;
        users[u].waterways  += d[u].waterways;
        users[u].buildings += d[u].buildings;
    }
})
.on('end', function() {
    process.stdout.write(JSON.stringify(users, null, 4));
});
