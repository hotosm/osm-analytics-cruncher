#!/bin/bash -ex

# calculate user experience stats
node ./src/oqt-user-experience/index.js $1 > experiences.json
