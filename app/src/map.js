'use strict';
var fs = require('fs');

var geojsonVt = require('geojson-vt');
var vtpbf = require('vt-pbf');
var zlib = require('zlib');
var mbtilesPromises = require('./mbtiles-promises');
var queue = require('queue-async');
var turf = require('turf');
var lineclip = require('lineclip');
var sphericalmercator = new (require('sphericalmercator'))({size: 512});
var rbush = require('rbush');
var lodash = require('lodash');
var stats = require('simple-statistics');

const intermediateDir = './intermediate/';

var binningFactor = global.mapOptions.binningFactor; // number of slices in each direction

var filter = JSON.parse(fs.readFileSync(global.mapOptions.filterPath));

var geomTiles, aggrTiles;
var initialized = false;

var users = {};
if (filter.experience.file)
    users = JSON.parse(fs.readFileSync(filter.experience.file));


// Filter features touched by list of users defined by users.json
module.exports = function _(tileLayers, tile, writeData, done) {
    if (!initialized) {
        Promise.all([
            mbtilesPromises.openWrite(intermediateDir + (filter.id || filter.experience.field)+'.geom.'+process.pid+'.mbtiles'),
            mbtilesPromises.openWrite(intermediateDir + (filter.id || filter.experience.field)+'.aggr.'+process.pid+'.mbtiles')
        ]).then(function(dbHandles) {
            geomTiles = dbHandles[0];
            aggrTiles = dbHandles[1];
            initialized = true;
            _(tileLayers, tile, writeData, done); // restart process after initialization
        }).catch(function(err) {
            console.error("error while opening db", err);
        });
        return;
    }

    var layer = tileLayers.osmqatiles.osm;

    // filter
    function hasGeometry(feature, geometry) {
        return typeof geometry == "string"
            ? geometry === feature.geometry.type
	    : geometry.includes(feature.geometry.type);
    }
    function hasTag(feature, tag) {
        return typeof tag == "string"
	    ? feature.properties[tag] && feature.properties[tag] !== 'no'
	    : tag.some(tag => feature.properties[tag.key] === tag.value);
    }
    layer.features = layer.features.filter(function(feature) {
        return hasGeometry(feature, filter.geometry) && hasTag(feature, filter.tag);
    });

    // enhance with user experience data
    layer.features.forEach(function(feature) {
        var props = feature.properties;
        var user = props['@uid'];
        feature.properties = {
            _uid : user,
            _timestamp: props['@timestamp']
        };
        if (typeof filter.tag == "string") {
          feature.properties[filter.tag] = props[filter.tag];
        } else {
          filter.tag.forEach(tag => {
            if (props[tag.key])
              feature.properties[tag.key] = props[tag.key];
          });
        }
        if (users[user] && users[user][filter.experience.field])
            feature.properties._userExperience = users[user][filter.experience.field]; // todo: include all/generic experience data?
    });

    if (layer.features.length === 0)
        return done();

    var tilesIndex = geojsonVt(layer, {
        maxZoom: 13,
        buffer: 0,
        tolerance: 1, // todo: faster if >0? (default is 3)
        indexMaxZoom: 13
    });
    function putTile(z,x,y, done) {
        var tileData = tilesIndex.getTile(z, x, y);
        if (tileData === null || tileData.features.length === 0) {
            done();
        } else {
            var pbfout = zlib.gzipSync(vtpbf.fromGeojsonVt({ 'osm': tileData }));
            geomTiles.putTile(z, x, y, pbfout, done);
        }
    }
    var putTileQueue = queue(1);
    putTileQueue.defer(putTile, tile[2]+1, tile[0]*2,   tile[1]*2);
    putTileQueue.defer(putTile, tile[2]+1, tile[0]*2,   tile[1]*2+1);
    putTileQueue.defer(putTile, tile[2]+1, tile[0]*2+1, tile[1]*2+1);
    putTileQueue.defer(putTile, tile[2]+1, tile[0]*2+1, tile[1]*2);
    var resultQueue = queue();
    resultQueue.defer(putTileQueue.awaitAll);
    resultQueue.defer(function(done) {
        var tileBbox = sphericalmercator.bbox(tile[0],tile[1],tile[2]);

        var bins = [],
            bboxMinXY = sphericalmercator.px([tileBbox[0], tileBbox[1]], tile[2]),
            bboxMaxXY = sphericalmercator.px([tileBbox[2], tileBbox[3]], tile[2]),
            bboxWidth  = bboxMaxXY[0]-bboxMinXY[0],
            bboxHeight = bboxMaxXY[1]-bboxMinXY[1];
        for (var i=0; i<binningFactor; i++) {
            for (var j=0; j<binningFactor; j++) {
                var binMinXY = [
                    bboxMinXY[0] + bboxWidth /binningFactor*j,
                    bboxMinXY[1] + bboxHeight/binningFactor*i
                ], binMaxXY = [
                    bboxMinXY[0] + bboxWidth /binningFactor*(j+1),
                    bboxMinXY[1] + bboxHeight/binningFactor*(i+1)
                ];
                var binMinLL = sphericalmercator.ll(binMinXY, tile[2]),
                    binMaxLL = sphericalmercator.ll(binMaxXY, tile[2]);
                bins.push([
                    binMinLL[0],
                    binMinLL[1],
                    binMaxLL[0],
                    binMaxLL[1],
                    i*binningFactor + j
                ]);
            }
        }
        var binCounts = Array(bins.length+1).join(0).split('').map(Number); // initialize with zeros
        var binDistances = Array(bins.length+1).join(0).split('').map(Number); // initialize with zeros
        var binObjects = Array(bins.length);
        var binTree = rbush();
        binTree.load(bins);

        layer.features.forEach(function(feature) {
            var clipper,
                geometry = feature.geometry.coordinates;
            if (feature.geometry.type === 'Point') {
                clipper = (coords, bbox) =>
                    coords[0] > bbox[0] && coords[0] < bbox[2] && coords[1] > bbox[1] && coords[1] < bbox[3];
            } else if (feature.geometry.type === 'LineString') {
                clipper = lineclip.polyline;
            } else if (feature.geometry.type === 'Polygon' && geometry.length === 1) {
                clipper = lineclip.polygon;
                geometry = geometry[0];
            } else return;
            // todo: handle polygons with holes (aka multipolygons)
            // todo: support more geometry types

            var featureBbox = turf.extent(feature);
            var featureBins = binTree.search(featureBbox).filter(function(bin) {
                var clipped = clipper(geometry, bin);
                return clipped === true || clipped.length > 0;
            });
            featureBins.forEach(function(bin) {
                var index = bin[4];
                binCounts[index] += 1/featureBins.length;
                if (feature.geometry.type === 'LineString') {
                    clipper(geometry, bin).forEach(function(coords) {
                        binDistances[index] += turf.lineDistance(turf.linestring(coords), 'kilometers');
                    });
                }
                if (!binObjects[index]) binObjects[index] = [];
                binObjects[index].push({
                    //id: feature.properties._osm_way_id, // todo: rels??
                    _timestamp: feature.properties._timestamp,
                    _userExperience: feature.properties._userExperience
                });
            });
        });

        var output = turf.featurecollection(bins.map(turf.bboxPolygon));
        output.features.forEach(function(feature, index) {
            feature.properties.binX = index % binningFactor;
            feature.properties.binY = Math.floor(index / binningFactor);
            feature.properties._count = binCounts[index];
            feature.properties._lineDistance = binDistances[index];
            if (!(binCounts[index] > 0)) return;
            feature.properties._timestamp = lodash.meanBy(binObjects[index], '_timestamp'); // todo: don't hardcode properties to average?
            feature.properties._userExperience = lodash.meanBy(binObjects[index], '_userExperience');
            //feature.properties.osm_way_ids = binObjects[index].map(function(o) { return o.id; }).join(';');
            // ^ todo: do only partial counts for objects spanning between multiple bins?
            var timestamps = lodash.map(binObjects[index], '_timestamp');
            feature.properties._timestampMin = stats.quantile(timestamps, 0.25);
            feature.properties._timestampMax = stats.quantile(timestamps, 0.75);
            feature.properties._timestamps = lodash.sampleSize(timestamps, 16).join(';');
            var experiences = lodash.map(binObjects[index], '_userExperience');
            feature.properties._userExperienceMin = stats.quantile(experiences, 0.25);
            feature.properties._userExperienceMax = stats.quantile(experiences, 0.75);
            feature.properties._userExperiences = lodash.sampleSize(experiences, 16).join(';');
        });
        output.features = output.features.filter(function(feature) {
            return feature.properties._count > 0;
        });
        //output.properties = { tileX: tile[0], tileY: tile[1], tileZ: tile[2] };

        var tileData = geojsonVt(output, {
            maxZoom: 12,
            buffer: 0,
            tolerance: 1, // todo: faster if >0? (default is 3)
            indexMaxZoom: 12
        }).getTile(tile[2], tile[0], tile[1]);
        if (tileData === null || tileData.features.length === 0) {
            done();
        } else {
            var pbfout = zlib.gzipSync(vtpbf.fromGeojsonVt({ 'osm': tileData }));
            aggrTiles.putTile(tile[2], tile[0], tile[1], pbfout, done);
        }
    });
    resultQueue.await(function(err) {
        if (err) console.error(err);
        done();
    });

};


process.on('SIGHUP', function() {
    Promise.all([
        mbtilesPromises.closeWrite(geomTiles),
        mbtilesPromises.closeWrite(aggrTiles)
    ]).then(function() {
        process.exit(0);
    }).catch(function(err) {
        console.error("error while closing db", err);
        process.exit(13);
    });
});
