
'use strict';

var mbtiles = require('@mapbox/tile-reduce/src/mbtiles.js'); // todo: hacky?
var mbtilesPromises = require('./mbtiles-promises');
var queue = require('queue-async');
var binarysplit = require('binary-split');
var turf = require('turf');
var sphericalmercator = new (require('sphericalmercator'))({size: 512});
var lodash = require('lodash');
var stats = require('simple-statistics');
var geojsonVt = require('geojson-vt');
var vtpbf = require('vt-pbf');
var zlib = require('zlib');
var MBTiles = require('mbtiles');

const intermediateDir = './intermediate/';

var binningFactor = global.mapOptions.binningFactor; // number of slices in each direction
var mbtilesPath = global.mapOptions.mbtilesPath;

var initQueue = queue();
var outMbtiles;

initQueue.defer(mbtiles, {
    name: 'osm',
    mbtiles: mbtilesPath,
    raw: false
});
initQueue.defer(function(cb) {
    mbtilesPromises.openRead(mbtilesPath)
    .then(function(dbHandle) {
        var tilesArray = [];
        var tileStream = dbHandle.createZXYStream()
            .pipe(binarysplit('\n'))
            .on('data', function(line) {
                var tile = line.toString().split('/');
                tilesArray.push([+tile[1], +tile[2], +tile[0]]);
             })
            .on('end', function() {
                cb(null, tilesArray);
            });
    }).catch(cb);
});
initQueue.defer(function(cb) {
    mbtilesPromises.openWrite(intermediateDir + 'out.tmp.'+process.pid+'.mbtiles')
    .then(function(dbHandle) {
        outMbtiles = dbHandle;
        cb();
    }).catch(cb);
})

var todoList = {},
    getVT,
    initalizationDone = false;

module.exports = function _(tileLayers, tile, writeData, done) {
    if (!initalizationDone) {
        // wait until initializations are completed
        initQueue.await(function(err, _getVT, tilesArray) {
            if (err) throw err;

            getVT = _getVT;
            // calculate list of 2x2 tiles to process while downscaling
            var originalZoom = tilesArray[0][2];
            tilesArray.forEach(function(tile) {
                var metaX = Math.floor(tile[0] / 2),
                    metaY = Math.floor(tile[1] / 2);
                var todoListIndex = metaX+'/'+metaY;
                todoList[todoListIndex] = [tile[0], tile[1]];
            });
            // re-start current tile-reduce job after initializations are complete
            initalizationDone = true;
            _(tileLayers, tile, writeData, done);
        });
        return;
    }

    var metaX = Math.floor(tile[0] / 2),
        metaY = Math.floor(tile[1] / 2);
    var todoListIndex = metaX+'/'+metaY;

    if (todoList[todoListIndex][0] === tile[0] && todoList[todoListIndex][1] === tile[1]) {
        processMeta([metaX, metaY, tile[2]-1], writeData, done);
    } else {
        done(); // ignore additional tiles in 2x2 meta tile
    }

}

function processMeta(tile, writeData, done) {
    var q = queue();
    // load all (zoom+1) VTs in this tile
    q.defer(getVT, [tile[0]*2  , tile[1]*2+1, tile[2]+1]);
    q.defer(getVT, [tile[0]*2+1, tile[1]*2+1, tile[2]+1]);
    q.defer(getVT, [tile[0]*2  , tile[1]*2  , tile[2]+1]);
    q.defer(getVT, [tile[0]*2+1, tile[1]*2  , tile[2]+1]);
    q.awaitAll(function(err, data) {
        if (err) throw err;
        // load all bins into 2d array
        var bins = Array(2*binningFactor);
        var refArea = turf.area(turf.bboxPolygon(sphericalmercator.bbox(tile[0],tile[1],tile[2])))/Math.pow(binningFactor,2)/4;
        data.forEach(function(tile, index) {
            if (!tile) return;
            tile = tile.osm;
            tile.features.forEach(function(feature) {
                var binArea = turf.area(feature);
                // with this exclude, highways doesn't generate levels 11, 10, etc.
                // if (binArea < refArea/3) return; // ignore degenerate slices

                var binX = feature.properties.binX + (index % 2)*binningFactor,
                    binY = feature.properties.binY + Math.floor(index / 2)*binningFactor;
                if (!bins[binX]) bins[binX] = Array(2*binningFactor);
                bins[binX][binY] = feature;
            });
        });
        // aggregate data
        var output = turf.featurecollection([]);
        output.properties = { tileX: tile[0], tileY: tile[1], tileZ: tile[2] }; // todo: drop eventually
        var tileBbox = sphericalmercator.bbox(tile[0],tile[1],tile[2]),
            bboxMinXY = sphericalmercator.px([tileBbox[0], tileBbox[1]], tile[2]),
            bboxMaxXY = sphericalmercator.px([tileBbox[2], tileBbox[3]], tile[2]),
            bboxWidth  = bboxMaxXY[0]-bboxMinXY[0],
            bboxHeight = bboxMaxXY[1]-bboxMinXY[1]; // todo: reduce code duplication with map.js
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
                var bin = turf.bboxPolygon([
                    binMinLL[0],
                    binMinLL[1],
                    binMaxLL[0],
                    binMaxLL[1],
                ]);
                var _bins = [
                    bins[j*2  ] && bins[j*2  ][i*2  ],
                    bins[j*2+1] && bins[j*2+1][i*2  ],
                    bins[j*2  ] && bins[j*2  ][i*2+1],
                    bins[j*2+1] && bins[j*2+1][i*2+1]
                ].filter(function(b) { return b; });
                bin.properties.binX = j;
                bin.properties.binY = i;
                bin.properties._count = _bins.reduce(function(prev, _bin) {
                    return prev + _bin.properties._count;
                }, 0);
                bin.properties._lineDistance = _bins.reduce(function(prev, _bin) {
                    return prev + _bin.properties._lineDistance;
                }, 0);
                bin.properties._timestamp = _bins.reduce(function(prev, _bin) {
                    return prev + _bin.properties._timestamp * _bin.properties._count;
                }, 0) / bin.properties._count; // todo: calc fom sampled timestamps
                bin.properties._userExperience = _bins.reduce(function(prev, _bin) {
                    return prev + _bin.properties._userExperience * _bin.properties._count;
                }, 0) / bin.properties._count; // todo: calc from sampled experiences

                //bin.properties.osm_way_ids = _bins.reduce(function(prev, _bin) {
                //    return prev.concat(_bin.properties.osm_way_ids.slice(0,100));
                //}, []);
                var maxBinCount = _bins.reduce(function(prev, _bin) {
                    return Math.max(prev, _bin.properties._count);
                }, -1);
                var timestamps = _bins.reduce(function(prev, _bin) {
                    var binTimestamps = _bin.properties._timestamps.split(';').map(Number);
                    return prev.concat(binTimestamps.slice(0, 16*Math.round(_bin.properties._count/maxBinCount)));
                }, []);
                bin.properties._timestampMin = stats.quantile(timestamps, 0.25);
                bin.properties._timestampMax = stats.quantile(timestamps, 0.75);
                bin.properties._timestamps = lodash.sampleSize(timestamps, 16).join(';');
                var experiences = _bins.reduce(function(prev, _bin) {
                    var binExperiences = _bin.properties._userExperiences.split(';').map(Number);
                    return prev.concat(binExperiences.slice(0, 16*Math.round(_bin.properties._count/maxBinCount)));
                }, []);
                bin.properties._userExperienceMin = stats.quantile(experiences, 0.25);
                bin.properties._userExperienceMax = stats.quantile(experiences, 0.75);
                bin.properties._userExperiences = lodash.sampleSize(experiences, 16).join(';');

                output.features.push(bin);
            }
        }
        output.features = output.features.filter(function(feature) {
            return feature.properties._count > 0;
        });

        // write to mbtiles output file
        var tileData = geojsonVt(output, {
            maxZoom: 11,
            buffer: 0,
            tolerance: 1, // todo: faster if >0? (default is 3)
            indexMaxZoom: 11
        }).getTile(tile[2], tile[0], tile[1]);
        if (tileData === null || tileData.features.length === 0) {
            done();
        } else {
            var pbfout = zlib.gzipSync(vtpbf.fromGeojsonVt({ 'osm': tileData }));
            // write to mbtiles file
            outMbtiles.putTile(tile[2], tile[0], tile[1], pbfout, done);
        }
    });
}



process.on('SIGHUP', function() {
    if (!outMbtiles) return process.exit(12);
    mbtilesPromises.closeWrite(outMbtiles)
    .then(function() {
        process.exit(0);
    }).catch(function(err) {
        console.error("error while closing db", err);
        process.exit(13);
    });
});
