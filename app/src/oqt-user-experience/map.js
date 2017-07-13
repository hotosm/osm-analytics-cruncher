'use strict';
var turf = require('turf');

// Filter features touched by list of users defined by users.json
module.exports = function(tileLayers, tile, writeData, done) {
    var layer = tileLayers.osm.osm;
    var users = {};

    layer.features.forEach(function(val) {
        var user = val.properties['@uid'];
        if (!users[user])
            users[user] = { objects:0, highways: 0.0, waterways: 0.0, buildings: 0 };
        users[user].objects += 1;
        if (val.properties.highway && val.geometry.type === "LineString")
            users[user].highways += turf.lineDistance(val, "kilometers");
        if (val.properties.waterway && val.geometry.type === "LineString")
            users[user].waterways += turf.lineDistance(val, "kilometers");
        if (val.properties.building && val.geometry.type !== "Point")
            users[user].buildings += 1;
    });

    done(null, users);
};
