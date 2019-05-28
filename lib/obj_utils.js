exports.delSpaceVal = function (obj) {
    try {
        var keys = [];
        for (var key in obj) {
            if (obj[key] == null || obj[key].length == 0) {
                keys.push(key);
            }
        }
        for (var i = 0; i < keys.length; i++) {
            delete obj[keys[i]];
        }
        return obj;
    } catch (e) {
        console.info('delete space val error', e);
    }
};

exports.isEmptyObject = function (e) {
    var t;
    for (t in e)
        return !1;
    return !0
};

exports.addDuplicate = function (duplicate, val, field) {
    if (val) {
        duplicate.push(field);
    }
};