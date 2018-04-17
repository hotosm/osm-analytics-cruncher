const express = require('express');
const http = require('http');
const app = express();
const tilelive = require('tilelive');
require('mbtiles').registerProtocols(tilelive);

const mbtileFile = process.argv.length >= 2 ? process.argv[2] : null;

if (!mbtileFile) {
  console.error('Select the mbtile file!!');
  process.exit(1);
}
console.log('Openning', `mbtiles:///opt/osm-cruncher/app/results/${mbtileFile}.mbtiles`);
tilelive.load(`mbtiles:///opt/osm-cruncher/app/results/${mbtileFile}.mbtiles`, function(err, source) {
    if (err) {
        throw err;
    }
    app.set('port', 7778);

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    app.get(`/${mbtileFile}/:z/:x/:y.pbf`, function(req, res){

        var z = req.params.z;
        var x = req.params.x;
        var y = req.params.y;

        console.log('get tile %d, %d, %d', z, x, y);

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

    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express server listening on port ' + app.get('port'));
    });
});
