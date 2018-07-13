#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');
var tileReduce = require('@mapbox/tile-reduce');

var mbtilesPath = process.argv[2] || "osm.mbtiles",
    analyticsPath = process.argv[3] || '../../analytics.json';

var users = {};

var analytics = JSON.parse(fs.readFileSync(analyticsPath));

tileReduce({
    map: path.join(__dirname, '/map.js'),
    sources: [{
        name: 'osm',
        mbtiles: mbtilesPath,
        raw: false
    }],
    mapOptions: {
        analyticsPath: analyticsPath
    }
})
.on('reduce', function(data) {
    for (var userId in data) {
        if (!users[userId]) {
            users[userId] = data[userId];
        } else {
            analytics.experienceFields.forEach(function(experience) {
                users[userId][experience.name] += data[userId][experience.name];
            });
        }
    }
})
.on('end', function() {
    process.stdout.write(JSON.stringify(users, null, 4));
});
