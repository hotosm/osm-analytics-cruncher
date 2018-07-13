'use strict';

// returns a function that filters features by the given filter
module.exports = function(filter) {
    filter = Object.assign({}, filter);
    return function(feature) {
        if (filter.tagKey && !hasTagKey(feature, filter.tagKey))
            return false;
        if (filter.tagKey && filter.tagValue && !hasTagKeyValue(feature, filter.tagKey, filter.tagValue))
            return false;
        if (filter.geometryType && !hasGeometry(feature, filter.geometryType))
            return false;
        return true;
    }
};

function hasGeometry(feature, geometry) {
    return typeof geometry == "string"
        ? feature.geometry.type === geometry || feature.geometry.type === 'Multi'+geometry
        : geometry.includes(feature.geometry.type);
}
function hasTagKey(feature, key) {
    return feature.properties[key] && feature.properties[key] !== 'no';
}
function hasTagKeyValue(feature, key, value) {
    return feature.properties[key] && feature.properties[key] == value;
}
