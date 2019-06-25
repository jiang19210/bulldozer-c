"use strict";
const httpClientp = require('http-clientp');
const config = require('config');
const cryptoUtils = require('./crypto_utils');
const querystring = require('querystring');

exports.serverOptions = function (path) {
    let host = global.serverhost != null ? global.serverhost : config.get('server.host');
    let port = global.serverport != null ? global.serverport : config.get('server.port');
    let url = host + ':' + port + path;
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

exports.buildHttpcontext = function (options, data, postdata, timeout, proxy, charset) {
    let op = {};
    if (typeof options === 'string') {
        op.method = options;
        op.path = data.url;
    } else {
        op = options;
    }
    let md5str = op.path + '-' + op.method;
    if (postdata && typeof postdata === 'string') {
        md5str = md5str + '-' + postdata;
    } else if (postdata && typeof postdata === 'object'){
        md5str = md5str + '-' + querystring.stringify(postdata);
    }
    if (data.md5_extra_key) {
        md5str = md5str + '-' + data.md5_extra_key;
    }
    if (data.next) {
        md5str = md5str + '-' + data.next;
    }
    let md5 = cryptoUtils.MD5(md5str);
    let httpcontext =
        {
            'md5': md5,
            'request': {
                'proxy': proxy,
                'postdata': postdata,
                'options': op,
                'timeout': timeout
            },
            'response': {
                'charset': charset
            },
            'data': data
        };
    return httpcontext;
};

exports.copyHttpcontext = function (httpcontext) {
    return this.buildHttpcontext(httpcontext.request.options.method, httpcontext.data, httpcontext.request.postdata, httpcontext.request.timeout, null, httpcontext.response.charset);
};