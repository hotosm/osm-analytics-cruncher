'use strict';
var fs = require('fs');
var turf = require('turf');
var applyFilter = require('../applyFilter.js');

var analytics = JSON.parse(fs.readFileSync(global.mapOptions.analyticsPath));
analytics.experienceFields.forEach(function(field) {
    field.filter = applyFilter(field.filter);
});

// Filter features touched by list of users defined by users.json
module.exports = function(tileLayers, tile, writeData, done) {
    var layer = tileLayers.osm.osm;
    var users = {};

    layer.features.forEach(function(val) {
        var userId = val.properties['@uid'];
        if (!users[userId]) {
            var emptyExperienceObject = { objects:0 };
            analytics.experienceFields.forEach(function(experience) {
                emptyExperienceObject[experience.name] = 0;
            });
            users[userId] = emptyExperienceObject;
        }
        users[userId].objects += 1;
        analytics.experienceFields.filter(function(field) {
            //console.error(field.filter(val), field, val)
            return field.filter(val);
        }).forEach(function(experience) {
            switch (experience.metric) {
                case "count":
                    users[userId][experience.name] += 1;
                    break;
                case "length":
                    if (val.geometry.type === "LineString" || val.geometry.type === "MultiLineString")
                        users[userId][experience.name] += turf.lineDistance(val, "kilometers");
                    break;
                case "area":
                    if (val.geometry.type === "Polygon" || val.geometry.type === "MultiPolygon")
                        users[userId][experience.name] += turf.area(val);
                    break;
            }
        });
    });

    done(null, users);
};
