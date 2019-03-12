"use strict";
const crypto = require('crypto');
exports.MD5 = function (str) {
    var md5 = crypto.createHash('md5');
    md5.update(str);
    return md5.digest('hex');
};
exports.HmacSHA1 = function (key, value, outputEncoding) {
    return crypto.createHmac('sha1', key).update(value).digest(outputEncoding).toString('base64');
};
exports.base64 = function (value) {
    return Buffer.from(value).toString("base64");
};

exports.randomUUID = function () {
    var buf = crypto.randomBytes(16);
    return buf.toString('hex');
};

exports.random = function (pre) {
    if (pre) {
        return pre + '-' + Math.round(Math.random() * 10000000000);
    } else {
        return Math.round(Math.random() * 10000000000);
    }
};