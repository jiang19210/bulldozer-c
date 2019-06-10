"use strict";
const httpClientp = require('http-clientp');
const httpUtils = require('./lib/http_utils');
const dbClient = require('./lib/db_client');
const uuid = require('node-uuid');
const debug = require('debug');
const pmx = require('pmx');

var probe = pmx.probe();

function BulldozerC() {
    global.bulldozerc_new = this;
}

//定时器id
global.TASK_SCHEDULE_IDS = [];
//运行任务
BulldozerC.prototype.setTask = function (callback, taskName, time) {
    console.log('[runTask] - 设置任务调度. 名称是[' + taskName + ']. 时间隔时间是[' + time / 1000 + 's].');
    let id = setInterval(callback, time);
    global.TASK_SCHEDULE_IDS.push({'id': id, 'name': taskName});
};
//清空定时器 当任务处理完成 的时候
BulldozerC.prototype.clearTask = function (taskName) {
    console.log('[clearTask] - 关闭定时器');
    let taskSchedule = global.TASK_SCHEDULE_IDS;
    let length = taskSchedule.length;

    if (length > 0) {
        if (taskName) {
            for (let i = 0; i < length; i++) {
                if (taskName === taskSchedule[i].name) {
                    clearInterval(taskSchedule[i].id);
                    console.log('[closeTaskScheduleCount] 关闭定时器的名称是[' + taskSchedule[i].name + ']. global.TASK_SCHEDULE_IDS = [' + global.TASK_SCHEDULE_IDS.length + ']');
                }
            }
        } else {
            for (let i = 0; i < length; i++) {
                clearInterval(taskSchedule[i].id);
                console.log('[clearTask] 关闭定时器的名称是[' + taskSchedule[i].name + ']');
            }
            global.TASK_SCHEDULE_IDS = [];
        }
    } else {
        console.info('[clearTask] 关闭定时器失败. 因为没有启动的定时器.the global.TASK_SCHEDULE_IDS is null.');
    }
};
//----通用方法
global.TASK_SCHEDULE_ENABLE = true; //任务调度开关
global.TASK_SCHEDULE_STOP = true; //任务调度开关,停止不可恢复
global.TASK_SCHEDULE_ENABLE_LOG = true;   //任务日志
global.RUN_TASK_QUEUE_NAME = null;   //运行中的任务队列名称
global.metrics_counter_keys = {};

/////////////////////
BulldozerC.prototype.rpop = 'rpop';
BulldozerC.prototype.spop = 'spop';
BulldozerC.prototype.rpoplpush = 'rpoplpush';
BulldozerC.prototype.spopsadd = 'spopsadd';
/////////////////////
//operation = rpop | spop | rpoplpush | spopsadd
BulldozerC.prototype.runTask = function (collection, mainProgram, taskName, intervalTime, operation) {
    var name = collection.name;
    if (!name) {
        name = collection.name0;
    }
    if (name) {
        global.RUN_TASK_QUEUE_NAME = name;
    }
    let self = this;
    if (intervalTime) {
        intervalTime = intervalTime * 1000;
    } else {
        intervalTime = 1000;
    }
    self.setTask(function () {
            if (global.TASK_SCHEDULE_ENABLE && global.TASK_SCHEDULE_STOP) {
                let options = httpUtils.serverOptions('/worker/' + operation);
                httpClientp.request(options, function (err, body, res, httpcontext) {
                    if (err) {
                        console.info('[handle.%s]-load data is [%s]', operation, body);
                        return;
                    } else {
                        debug('[handle.%s]-load data is [%s]', operation, body);
                    }
                    let handlerContext = null;
                    if (body != null) {
                        try {
                            let bodyObj = JSON.parse(body);
                            handlerContext = JSON.parse(bodyObj.result);
                        } catch (err) {
                            console.info('[handle.%s]-发生异常.%s', operation, err);
                            handlerContext = null;
                        }
                    }
                    if (handlerContext != null) {
                        handlerContext.mainProgram = mainProgram;
                        try {
                            handlerContext.uuid = uuid();
                            handlerContext.operation = operation;
                            self.metrics(handlerContext, httpcontext);
                            self.startRequest(handlerContext);
                        } catch (e) {
                            console.info('定时器调用startRequest发生异常.%s', e);
                        }
                    }
                }, {'request': {'postdata': collection}});
                global.TASK_SCHEDULE_ENABLE_LOG = true;
            } else {
                if (global.TASK_SCHEDULE_ENABLE_LOG) {
                    console.log('任务暂停中.');
                    global.TASK_SCHEDULE_ENABLE_LOG = false;
                }
            }
        }, taskName, intervalTime
    );
};
//可以继承此方法给每个请求设置代理
BulldozerC.prototype.withProxy = function (callback, handlerContext) {
    callback(handlerContext);
};
global.HANDLER_CONTEXT_HEARDES = null;
//任务开始
BulldozerC.prototype.startRequest = function (handlerContext) {
    let self = this;
    this.taskPreProcess(handlerContext);
    let mainProgram = handlerContext.mainProgram;
    if (mainProgram == null) {
        console.info('[taskStart]-- task start failed. the caller is null.');
        return;
    }
    if (handlerContext.request.options == null || handlerContext.request.options.path == null) {
        handlerContext.weight = 1024;
        self.taskEnd(handlerContext);
        return;
    }
    handlerContext.callback = self.taskEnd;
    //handlerContext.self = self;
    if (global.HANDLER_CONTEXT_HEARDES) {
        handlerContext.request.options.headers = global.HANDLER_CONTEXT_HEARDES;
    }
    this.taskPostProcess(handlerContext);
    console.log('[%s] request url %s, postdata %s', handlerContext.uuid, handlerContext.request.options.path, handlerContext.request.postdata);
    httpClientp.request_select_proxy(handlerContext, function (callback) {
        self.withProxy(function (_handlerContext) {
            callback(_handlerContext);
        }, handlerContext);
    });
};
//任务开始对请求配置进行处理,默认忽略
BulldozerC.prototype.taskPreProcess = function (handlerContext) {
};
BulldozerC.prototype.taskPostProcess = function (handlerContext) {
};
BulldozerC.prototype.taskProProcess = function (handlerContext) {
};
BulldozerC.prototype.taskEnd = function (handlerContext) {
    console.log('[%s] response code %s', handlerContext.uuid, handlerContext.response.statusCode);
    if (global.bulldozerc_new.dataCheck(handlerContext)) {
        let mainProgram = handlerContext.mainProgram;
        delete handlerContext.request.options.headers;
        delete handlerContext.request.options.agent;
        delete handlerContext.callback;
        delete handlerContext.mainProgram;
        delete handlerContext.keyName;
        delete handlerContext.counterSucc;
        delete handlerContext.counterFail;
        delete handlerContext.queueName;
        delete handlerContext.operation;
        //TODO 可以存储 请求和返回的 信息
        if (handlerContext.response.error) {
            handlerContext.request.options.host = null;
            handlerContext.request.options.port = null;
        }
        let data = handlerContext.data;
        mainProgram.emit(data.next, handlerContext);
    }
};

BulldozerC.prototype.dataCheck = function (handlerContext) {
    if (200 === handlerContext.response.statusCode) {
        handlerContext.counterSucc.inc();
        return true;
    } else {
        handlerContext.counterFail.inc();
        this.retry(handlerContext);
        return false;
    }
};

BulldozerC.prototype.retry = function (handlerContext) {
    var newHandlerContext = httpUtils.copyHttpcontext(handlerContext);
    var collection = {'name': handlerContext.queueName, 'data': [newHandlerContext]};
    if (handlerContext.operation.indexOf('rpop') != -1) {
        dbClient.lpushs(collection);
    } else if (handlerContext.operation.indexOf('spop') != -1) {
        dbClient.sadds(collection);
    }
};

//优雅的暂停
BulldozerC.prototype.checkSuspend = function () {
    global.TASK_SCHEDULE_ENABLE = false;
};
BulldozerC.prototype.dbClient = require('./lib/db_client');
BulldozerC.prototype.cryptoUtils = require('./lib/crypto_utils');
BulldozerC.prototype.httpUtils = require('./lib/http_utils');

setInterval(function () {
    var queueName = global.RUN_TASK_QUEUE_NAME;
    console.log('检测任务状态 global.RUN_TASK_QUEUE_NAME = %s', queueName);
    if (!queueName) {
        return;
    }
    dbClient.getTaskState(queueName, function (err, result, res, httpcontext) {
        if (result.result === '0000') {
            global.TASK_SCHEDULE_STOP = false;
        } else {
            global.TASK_SCHEDULE_STOP = true;
        }
    });
}, 1000 * 30);

BulldozerC.prototype.metrics = function (handlerContext, httpContext) {
    var queueName = httpContext.request.postdata.name;
    handlerContext.queueName = queueName;
    var nextName = handlerContext.data.next;
    if (queueName && nextName) {
        var keyName = 'bulldozer_c.' + queueName + '.' + nextName;
        var counter = global.metrics_counter_keys[keyName];
        if (!counter) {
            counter = probe.counter({'name': keyName});
            global.metrics_counter_keys[keyName] = counter;
        }
        counter.inc();
        console.log('task_count:' + keyName + '=' + counter.val());
        handlerContext.keyName = keyName;

        var keyNameSucc = 'bulldozer_c.' + queueName + '.' + nextName + '.' + 'succ';
        var counterSucc = global.metrics_counter_keys[keyNameSucc];
        if (!counterSucc) {
            counterSucc = probe.counter({'name': keyNameSucc});
            global.metrics_counter_keys[keyNameSucc] = counterSucc;
        }
        handlerContext.counterSucc = counterSucc;

        var keyNameFail = 'bulldozer_c.' + queueName + '.' + nextName + '.' + 'fail';
        var counterFail = global.metrics_counter_keys[keyNameFail];
        if (!counterFail) {
            counterFail = probe.counter({'name': keyNameFail});
            global.metrics_counter_keys[keyNameFail] = counterFail;
        }
        handlerContext.counterFail = counterFail;
    }
};

module.exports = BulldozerC;
