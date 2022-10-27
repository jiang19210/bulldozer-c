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
    if (!op.path) {
        console.log('op.path不可以为空')
        return null;
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
    let op = {
        'method': httpcontext.request.options.method,
        'path': httpcontext.request.options.path,
        'headers': httpcontext.request.options.headers,
    }
    if (op.headers){
        delete op.headers.cookie;
    }
    return this.buildHttpcontext(op, httpcontext.data, httpcontext.request.postdata, httpcontext.request.timeout, null, httpcontext.response.charset);
};