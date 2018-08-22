const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const tilelive = require('tilelive');
const queue = require('queue-async');
require('mbtiles').registerProtocols(tilelive);

const mbtilesDir = process.argv.length >= 2 ? process.argv[2] : null;
const analyticsFile = process.argv.length >= 3 ? process.argv[3] : null;
const port = process.argv.length >= 4 ? +process.argv[4] : 7779;

if (mbtilesDir === null) {
    console.error('Error: mbtiles directory not specified');
    process.exit(1);
}
if (analyticsFile === null) {
    console.error('Error: analytics definition file not specified');
    process.exit(1);
}

const analytics = JSON.parse(fs.readFileSync(analyticsFile));

var loadMbtilesQueue = queue();
analytics.layers.forEach(function(layer) {
    console.log('Openning', `mbtiles://${mbtilesDir}/${layer.name}.mbtiles`);
    loadMbtilesQueue.defer(tilelive.load, `mbtiles://${mbtilesDir}/${layer.name}.mbtiles`);
})

loadMbtilesQueue.awaitAll(function(err, sources) {
    if (err) throw err;

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    sources.forEach(function(source, layerIndex) {
        app.get(`/${analytics.layers[layerIndex].name}/:z/:x/:y.pbf`, function(req, res) {

            var z = req.params.z;
            var x = req.params.x;
            var y = req.params.y;

            console.log('get tile %s/%d/%d/%d', analytics.layers[layerIndex].name, z, x, y);

            source.getTile(z, x, y, function(err, tile, headers) {
                if (err) {
                    res.status(404)
                    res.send(err.message);
                    console.log(err.message);
                } else {
                  res.set(headers);
                  res.send(tile);
                }
            });
        });
    });

    app.set('port', port);
    app.get('/analytics.json', function(req, res) {
      res.json(analytics);
    });
    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express server listening on port ' + app.get('port'));
    });
});
