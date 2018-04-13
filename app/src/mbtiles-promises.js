var MBTiles = require('mbtiles');

function openRead(filename) {
    return new Promise(function(resolve, reject) {
        var dbHandle = new MBTiles(filename, function(err) {
            if (err) return reject(err);
            resolve(dbHandle);
        });
    });
}

function openWrite(filename) {
    return new Promise(function(resolve, reject) {
        var dbHandle = new MBTiles(filename, function(err) {
            if (err) return reject(err);
            dbHandle.startWriting(function(err) {
                if (err) return reject(err);
                resolve(dbHandle);
            });
        });
    });
}

function closeWrite(dbHandle) {
    return new Promise(function(resolve, reject) {
        dbHandle.stopWriting(function(err) {
            if (err) return reject(err);
            dbHandle.close(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
    });
}

module.exports = {
    openRead,
    openWrite,
    closeWrite
}
