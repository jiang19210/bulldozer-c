"use strict";
const httpClientp = require('http-clientp');
const config = require('config');
const cryptoUtils = require('./crypto_utils');

exports.serverOptions = function (path) {
    let url = config.get('server.host') + ':' + config.get('server.port') + path;
    return httpClientp.build_options('POST', url, {
        'content-type': 'application/json;charset=UTF-8'
    })
};

exports.buildOptions = function (options) {
    if (!options.cookie) {
        options.cookie = '';
    }
    if (!options.ContentType || options.ContentType.trim().length === 0) {
        options.ContentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    }
    return options;
};

exports.buildHandlerContext = function (method, data, postdata, headers) {
    let options = {
        'method': method.toLocaleUpperCase(),
        'path': data.url
    };
    if (headers && typeof headers === 'object') {
        options.headers = headers;
    } else {
        options.headers = {};
    }
    let handlerContext = {
        'data': data,
        'postdata': postdata,
        'options': options
    };
    return handlerContext;
};

exports.buildHttpcontext = function (options, data, postdate, timeout, proxy) {
    let op = {};
    if (typeof options === 'string') {
        op.method = options;
        op.path = data.url;
    } else {
        op = options;
    }
    let md5str = op.path + '-' + op.method;
    if (!postdate) {
        md5str = md5str + '-' + postdate;
    }
    if (!data.md5_extra_key) {
        md5str = md5str + '-' + data.md5_extra_key;
    }
    if (!data.next) {
        md5str = md5str + '-' + data.next;
    }
    let md5 = cryptoUtils.MD5(md5str);
    let httpcontext =
        {
            'md5': md5,
            'request': {
                'proxy': proxy,
                'postdata': postdate,
                'options': op,
                'timeout': timeout
            },
            'response': {},
            'data': data
        };
    return httpcontext;
};