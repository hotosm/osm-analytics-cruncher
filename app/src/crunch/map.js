'use strict';
var fs = require('fs');

var geojsonVt = require('geojson-vt');
var vtpbf = require('vt-pbf');
var zlib = require('zlib');
var mbtilesPromises = require('../mbtiles-promises');
var queue = require('queue-async');
var turf = require('turf');
var lineclip = require('lineclip');
var sphericalmercator = new (require('sphericalmercator'))({size: 512});
var rbush = require('rbush');
var lodash = require('lodash');
var stats = require('simple-statistics');
var applyFilter = require('../applyFilter.js');

var outputDir = global.mapOptions.outputDir + '/';
var binningFactor = global.mapOptions.binningFactor; // number of slices in each direction

var analytics = JSON.parse(fs.readFileSync(global.mapOptions.analyticsPath));
analytics.layers.forEach(function(layer) {
    layer.filterKey = layer.filter.tagKey;
    layer.filter = applyFilter(layer.filter);
});

var geomTiles = [];
var aggrTiles = [];
var initialized = false;

var users = {};
if (global.mapOptions.experiencesPath)
    users = JSON.parse(fs.readFileSync(global.mapOptions.experiencesPath));


// Filter features touched by list of users defined by users.json
module.exports = function _(tileLayers, tile, writeData, done) {
    if (!initialized) {
        var handles = [];
        analytics.layers.forEach(function(layer) {
            handles.push(mbtilesPromises.openWrite(outputDir + layer.name + '/geom.' + process.pid + '.z13.mbtiles'));
            handles.push(mbtilesPromises.openWrite(outputDir + layer.name + '/aggr.' + process.pid + '.z12.mbtiles'));
        })
        Promise.all(handles).then(function(dbHandles) {
            analytics.layers.forEach(function(layer, index) {
                geomTiles[index] = dbHandles[index * 2];
                aggrTiles[index] = dbHandles[index * 2 + 1];
            });
            initialized = true;
            _(tileLayers, tile, writeData, done); // restart process after initialization
        }).catch(function(err) {
            console.error("error while opening mbtiles db", err);
        });
        return;
    }

    var filteredData = analytics.layers.map(function() { return []; });

    tileLayers.osmqatiles.osm.features.forEach(function(feature) {
        analytics.layers.forEach(function(layer, layerIndex) {
            if (layer.filter(feature)) {
                filteredData[layerIndex].push(feature);
            }
        });
    });

    if (filteredData.map(function(features) { return features.length; }).reduce(function(a,b) { return a+b; }) === 0)
        return done();

    // enhance with user experience data
    filteredData = filteredData.map(function(features, layerIndex) {
        return features.map(function(feature) {
            var output = Object.assign({}, feature);
            var user = feature.properties['@uid'];
            output.properties = {
              _uid: user,
              _timestamp: feature.properties['@timestamp'],
              _tagValue: feature.properties[analytics.layers[layerIndex].filterKey]
            }
            output.properties._userExperience = users[user][analytics.layers[layerIndex].experienceField];
            if (analytics.layers[layerIndex].processing &&
                analytics.layers[layerIndex].processing.indexOf("geometry:calculate_centroid") !== -1) {
              output.geometry = turf.centroid(feature).geometry;
            }
            return output;
        });
    });

    var resultQueue = queue();
    filteredData.forEach(function(features, layerIndex) {
        var tilesIndex = geojsonVt(turf.featurecollection(features), {
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
                geomTiles[layerIndex].putTile(z, x, y, pbfout, done);
            }
        }
        var putTileQueue = queue(1);
        putTileQueue.defer(putTile, tile[2]+1, tile[0]*2,   tile[1]*2);
        putTileQueue.defer(putTile, tile[2]+1, tile[0]*2,   tile[1]*2+1);
        putTileQueue.defer(putTile, tile[2]+1, tile[0]*2+1, tile[1]*2+1);
        putTileQueue.defer(putTile, tile[2]+1, tile[0]*2+1, tile[1]*2);
        resultQueue.defer(putTileQueue.awaitAll);
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

        features.forEach(function(feature) {
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
                    _userExperience: feature.properties._userExperience,
                    _uid: feature.properties._uid,
                    _tagValue: feature.properties._tagValue
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
            var sampleIndices = lodash.sampleSize(Array.apply(null, {length: timestamps.length}).map(Number.call, Number), 16);
            feature.properties._timestampMin = stats.quantile(timestamps, 0.25);
            feature.properties._timestampMax = stats.quantile(timestamps, 0.75);
            feature.properties._timestamps = sampleIndices.map(function(idx) { return timestamps[idx]; }).join(';');
            var experiences = lodash.map(binObjects[index], '_userExperience');
            feature.properties._userExperienceMin = stats.quantile(experiences, 0.25);
            feature.properties._userExperienceMax = stats.quantile(experiences, 0.75);
            feature.properties._userExperiences = sampleIndices.map(function(idx) { return experiences[idx]; }).join(';');
            var uids = lodash.map(binObjects[index], '_uid');
            feature.properties._uids = sampleIndices.map(function(idx) { return uids[idx]; }).join(';');
            var tagValues = lodash.map(binObjects[index], '_tagValue');
            feature.properties._tagValues = sampleIndices.map(function(idx) { return tagValues[idx]; }).join(';');
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
        if (tileData !== null && tileData.features.length > 0) {
            var pbfout = zlib.gzipSync(vtpbf.fromGeojsonVt({ 'osm': tileData }));
            resultQueue.defer(function(done) {
                aggrTiles[layerIndex].putTile(tile[2], tile[0], tile[1], pbfout, done);
            });
        }
    });
    resultQueue.await(function(err) {
        if (err) console.error(err);
        done();
    });

};


process.on('SIGHUP', function() {
    Promise.all([]
        .concat(
            geomTiles.map(function(geomTiles) { return mbtilesPromises.closeWrite(geomTiles); })
        ).concat(
            aggrTiles.map(function(aggrTiles) { return mbtilesPromises.closeWrite(aggrTiles); })
        )
    ).then(function() {
        process.exit(0);
    }).catch(function(err) {
        console.error("error while closing db", err);
        process.exit(13);
    });
});
