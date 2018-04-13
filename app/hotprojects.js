#!/usr/bin/env node

var fs = require('fs');
var sa = require('superagent');
var turf = require('turf');

var fetched = {};

var raw = process.argv[2] !== undefined;

function getPage(page, callback) {
  console.error('fetching page', page);
  sa.get(
    'http://tasks.hotosm.org/projects.json?show_archived=on&page='+page,
    function(err,res) {
      callback(err, res.body.features);
  });
}

function fetchAllPages(page) {
  getPage(page, function(err, res) {
    if (err) throw err;
    if (res.length === 0 || fetched[res[0].id]) {
      // no more results or already fetched project (apparently that's what the tasking manager api resturns if there are no more pages…)
      console.error('done?', res.length, res[0].id)
      done();
    } else {
      res.forEach(function(project) {
        fetched[project.id] = project;
      });
      fetchAllPages(page+1);
    }
  });
}
fetchAllPages(1);

function done() {
  var allProjects = turf.featurecollection(
    Object.keys(fetched).sort(function(a,b) { return a-b; }).map(function(id) {
      return fetched[id];
    })
  );
  console.error('got '+allProjects.features.length+' hot projects');

  allProjects.features.forEach(function(feature) {
    feature.properties.id = feature.id;
  });

  if (raw) {
    process.stdout.write(JSON.stringify(allProjects, null, 0));
    return;
  }

  var maxNodeCount = 40;
  var allProjectsSimplified = turf.featurecollection(
    allProjects.features.map(function(f) {
      var coords = turf.convex(turf.explode(f)).geometry.coordinates[0];
      var simplifiedFeature;
      for (var simpl = 0.00001; simpl<100; simpl*=1.4) {
        simplifiedFeature = turf.simplify(turf.polygon([coords]), simpl);
        if (simplifiedFeature.geometry.coordinates[0].length <= maxNodeCount) {
          coords = simplifiedFeature.geometry.coordinates[0];
          break;
        }
      }

      return {
        type: "Feature",
        id: f.id,
        geometry: simplifiedFeature.geometry,
        properties: {
          name:f.properties.name
        }
      };
    })
  );

  fs.writeFileSync('hotprojects.geojson', JSON.stringify(allProjectsSimplified, null, 2))
}
