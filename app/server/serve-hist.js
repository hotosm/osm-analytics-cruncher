const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const tilelive = require('tilelive');
const queue = require('queue-async');
require('mbtiles').registerProtocols(tilelive);

const mbtilesDir = process.argv.length >= 2 ? process.argv[2] : null;
const port = process.argv.length >= 3 ? +process.argv[3] : 7780;

if (mbtilesDir === null) {
    console.error('Error: mbtiles directory not specified');
    process.exit(1);
}


var loadMbtilesQueue = queue();
var layers = fs.readdirSync(mbtilesDir)
.filter(function(subdir) {
    // ignore non-mbtiles files
    return subdir.match(/^([0-9]+)$/);
}).map(function(subdir) {
    return fs.readdirSync(mbtilesDir + '/' + subdir)
        .filter(function(file) {
            return file.match(/\.mbtiles$/);
        })
        .map(function(file) {
            return {
                file: subdir + '/' + file,
                name: file.replace('.mbtiles', ''),
                year: subdir
            };
        });
}).reduce(function(acc, x) { return acc.concat(x)}, []);
layers.forEach(function(layer) {
    console.log('Openning', `mbtiles://${mbtilesDir}/${layer.file}`);
    loadMbtilesQueue.defer(tilelive.load, `mbtiles://${mbtilesDir}/${layer.file}`);
})

loadMbtilesQueue.awaitAll(function(err, sources) {
    if (err) throw err;

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    sources.forEach(function(source, layerIndex) {
        app.get(`/${layers[layerIndex].year}/${layers[layerIndex].name}/:z/:x/:y.pbf`, function(req, res) {

            var z = req.params.z;
            var x = req.params.x;
            var y = req.params.y;

            console.log('get tile %s/%s/%d/%d/%d', layers[layerIndex].year, layers[layerIndex].name, z, x, y);

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
    app.get('/layers.json', function(req, res) {
      res.json(layers);
    });
    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express server listening on port ' + app.get('port'));
    });
});


