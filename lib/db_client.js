"use strict";
const httpUtils = require('./http_utils');
const httpClientp = require('http-clientp');
const debug = require('debug')('bulldozer-c:db:client');

function handlerResult(err, body, callback, res, httpcontext, m) {
    try {
        let name = 'collection-name-null';
        try {
            name = httpcontext.request.postdata.name;
            if (!name) {
                name = httpcontext.request.postdata.name0;
            }
        } catch (e) {
            console.error('获取name发生异常.', e);
        }
        if (err) {
            console.error('[%s]-发生异常.', m);
        } else {
            let result = JSON.parse(body);
            if (result.is_success && result.result == '0') {
                console.warn('[数据保存失败，影响行数为0][%s##%s][%s]', m, name, JSON.stringify(httpcontext));
            } else if (result.is_success) {
                debug('[数据保存成功][%s##%s], result:%s', m, name, JSON.stringify(result.result));
            } else {
                if (m.indexOf('mysql.') != -1) {
                    delete result.result.sql;
                }
                console.error('[数据保存发生异常][%s##%s] %s, result:%s', m, name, result.taskid, JSON.stringify(result.result));
            }
        }
        if (callback) {
            callback(err, result, res, httpcontext);
        }
    } catch (e) {
        console.error('handlerResult发生异常.%s. %s', body, e);
    }
}

//mongodb
//查询并更改
exports.findAndModify = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/findAndModify');
    httpClientp.request(options, callback, {'request': {'postdata': collection}});
};

//保存或更改 批量
exports.saveOrUpdateAll = function (collection) {
    let options = httpUtils.serverOptions('/worker/saveOrUpdateAll');
    httpClientp.request(options, function (err, body) {
        console.log('saveOrUpdateAll result [' + body + ']');
    }, {'request': {'postdata': collection}});
};
//保存或更改 单个
exports.saveOrUpdate = function (collection) {
    let options = httpUtils.serverOptions('/worker/saveOrUpdate');
    httpClientp.request(options, function (err, body) {
        console.log('saveOrUpdate result [' + body + ']');
    }, {'request': {'postdata': collection}});
};
exports.remove = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/remove');
    httpClientp.request(options, callback, {'request': {'postdata': collection}});
};
//查询
exports.find = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/find');
    httpClientp.request(options, callback, {'request': {'postdata': collection}});
};
exports.findField = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/findField');
    httpClientp.request(options, callback, {'request': {'postdata': collection}});
};
//保存
exports.save = function (collection) {
    let options = httpUtils.serverOptions('/worker/save');
    httpClientp.request(options, function (err, body) {
        console.log('save result [' + body + ']');
    }, {'request': {'postdata': collection}});
};
//更改
exports.update = function (collection) {
    let options = httpUtils.serverOptions('/worker/update');
    httpClientp.request(options, function (err, body) {
        console.log('update result [' + body + ']');
    }, {'request': {'postdata': collection}});
};
//删除集合(表)
exports.dropCollection = function (collection) {
    let options = httpUtils.serverOptions('/worker/dropCollection');
    httpClientp.request(options, function (err, body) {
        console.log('dropCollection result [' + body + ']');
    }, {'request': {'postdata': collection}});
};
//重命名集合(表)
exports.renameCollection = function (collection) {
    let options = httpUtils.serverOptions('/worker/renameCollection');
    httpClientp.request(options, function (err, body) {
        console.log('renameCollection result [' + body + ']');
    }, {'request': {'postdata': collection}});
};
//redis
exports.lpushs = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/lpushs');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.lpushs');
    }, {'request': {'postdata': collection}});
};
exports.saddDistinct = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/saddDistinct');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.saddDistinct');
    }, {'request': {'postdata': collection}});
};
exports.saddDistincts = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/saddDistincts');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.saddDistincts');
    }, {'request': {'postdata': collection}});
};
exports.multisadd = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/multisadd');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.multisadd');
    }, {'request': {'postdata': collection}});
};
exports.sadds = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/sadds');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.sadds');
    }, {'request': {'postdata': collection}});
};
exports.multilpush = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/multilpush');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.multilpush');
    }, {'request': {'postdata': collection}});
};
exports.rpop = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/rpop');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.rpop');
    }, {'request': {'postdata': collection}});
};
exports.lpop = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/lpop');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.lpop');
    }, {'request': {'postdata': collection}});
};
exports.spop = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/spop');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.spop');
    }, {'request': {'postdata': collection}});
};
exports.multisaddOrBak = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/multisaddOrBak');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.multisaddOrBak');
    }, {'request': {'postdata': collection}});
};
//重命名key
exports.renamenx = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/renamenx');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.renamenx');
    }, {'request': {'postdata': collection}});
};
//删除key 和 keyBak
exports.delOrBak = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/delOrBak');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.delOrBak');
    }, {'request': {'postdata': collection}});
};
exports.del = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/del');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.del');
    }, {'request': {'postdata': collection}});
};
//重命名 将值从一个key 取出并移动到另外一个key
exports.rpoplpush = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/rpoplpush');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.rpoplpush');
    }, {'request': {'postdata': collection}});
};
exports.exists = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/exists');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.exists');
    }, {'request': {'postdata': collection}});
};
exports.incr = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/incr');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.incr');
    }, {'request': {'postdata': collection}});
};
exports.set = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/set');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.set');
    }, {'request': {'postdata': collection}});
};
exports.get = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/get');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'redis.get');
    }, {'request': {'postdata': collection}});
};
//mysql
exports.mysql_save = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/mysql_save');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'mysql.mysql_save');
    }, {'request': {'postdata': collection}});
};
exports.mysql_update = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/mysql_update');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'mysql.mysql_update');
    }, {'request': {'postdata': collection}});
};
exports.mysql_select = function (collection, callback) {
    let options = httpUtils.serverOptions('/worker/mysql_select');
    httpClientp.request(options, function (err, body, res, httpcontext) {
        handlerResult(err, body, callback, res, httpcontext, 'mysql.mysql_select');
    }, {'request': {'postdata': collection}});
};