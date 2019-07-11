"use strict";
const httpClientp = require('http-clientp');
const httpUtils = require('./lib/http_utils');
const dbClient = require('./lib/db_client');
const uuid = require('node-uuid');
const debug = require('debug');
const pmx = require('pmx');

const probe = pmx.probe();

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
global.RUN_TASK_QUEUE_NAME = [];   //运行中的任务队列名称
global.metrics_counter_keys = {};
global.loadHrTime = {};
global.request_retry_count = 3;

/////////////////////
BulldozerC.prototype.rpop = 'rpop';
BulldozerC.prototype.spop = 'spop';
BulldozerC.prototype.rpoplpush = 'rpoplpush';
BulldozerC.prototype.spopsadd = 'spopsadd';
/////////////////////
//operation = rpop | spop | rpoplpush | spopsadd
BulldozerC.prototype.runTask = function (collection, mainProgram, taskName, intervalTime, operation) {
    let name = collection.name;
    if (!name) {
        name = collection.name0;
    }
    if (name) {
        global.RUN_TASK_QUEUE_NAME.push(name);
        global.loadHrTime[name] = process.hrtime();
        global.loadHrTime['default'] = global.loadHrTime[name];
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
                        global.loadHrTime[httpcontext.request.postdata.name] = process.hrtime();
                        global.loadHrTime['default'] = global.loadHrTime[httpcontext.request.postdata.name];

                        handlerContext.mainProgram = mainProgram;
                        try {
                            handlerContext.uuid = uuid();
                            handlerContext.operation = operation;
                            self.metrics(handlerContext, httpcontext);
                            self.startRequest(handlerContext);
                        } catch (e) {
                            console.warn('[%s] 定时器调用startRequest发生异常.%s', handlerContext.uuid, e);
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
        console.warn('[taskStart]-- task start failed. the caller is null.');
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
    console.log('[%s] request url %s, postdata %s, retry %s', handlerContext.uuid, handlerContext.request.options.path, JSON.stringify(handlerContext.request.postdata), handlerContext.retry);
    httpClientp.request_select_proxy(handlerContext, function (callback) {
        self.withProxy(function (_handlerContext) {
            callback(_handlerContext);
        }, handlerContext);
    });
};
//单个请求链路测试入口
BulldozerC.prototype.testDelayStartRequest = function (handlerContext, queueName, delay, operation) {
    handlerContext.uuid = uuid();
    if (!operation) {
        operation = 'rpop';
    }
    handlerContext.operation = operation;
    let self = this;
    this.metrics(handlerContext, {'request': {'postdata': {'name': queueName}}});
    setTimeout(function () {
        self.startRequest(handlerContext);
    }, delay);
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
    if (global.bulldozerc_new._dataCheck(handlerContext)) {
        let mainProgram = handlerContext.mainProgram;
        delete handlerContext.request.options.headers;
        delete handlerContext.request.options.agent;
        delete handlerContext.callback;
        delete handlerContext.mainProgram;
        //TODO 可以存储 请求和返回的 信息
        if (handlerContext.response.error) {
            handlerContext.request.options.host = null;
            handlerContext.request.options.port = null;
        }
        let data = handlerContext.data;
        mainProgram.emit(data.next, handlerContext);
    } else {
        console.info('[%s] task is fail', handlerContext.uuid);
    }
};

BulldozerC.prototype._dataCheck = function (handlerContext) {
    let statusCode = handlerContext.response.statusCode;
    if (!statusCode || !this.dataCheck(handlerContext) || handlerContext.response.statusCode !== 200) {
        if (statusCode === 404) {
            handlerContext.retry = 404;
        }
        if (!statusCode) {
            statusCode = 152;
        }
        this.getCounter({
            'key': 'bulldozer_c_http',
            'type': handlerContext.queueName + '_' + handlerContext.data.next,
            'statusCode': statusCode
        }).inc();
        handlerContext.nextFailCounter.inc();
        this.retry(handlerContext);
        return false;
    } else {
        handlerContext.nextSuccCounter.inc();
        return true;
    }
};

BulldozerC.prototype.dataCheck = function (handlerContext) {
    return true;
};

BulldozerC.prototype.retry = function (handlerContext) {
    if (!handlerContext.retry) {
        handlerContext.retry = 1;
    } else {
        ++handlerContext.retry;
    }
    if (handlerContext.retry > global.request_retry_count) {
        let newHandlerContext = httpUtils.copyHttpcontext(handlerContext);
        this.retryFail(handlerContext);
        if (handlerContext.retry < 100) {
            console.error('[%s] %s_retry_fail_%s:%s', handlerContext.uuid, handlerContext.response.statusCode, handlerContext.retry, JSON.stringify(newHandlerContext));
        } else {
            console.error('[%s] %s_request_fail_no_retry_%s:%s', handlerContext.uuid, handlerContext.response.statusCode, handlerContext.retry, JSON.stringify(newHandlerContext));
        }
        handlerContext.retryFailCounter.inc();
    } else {
        let newHandlerContext = httpUtils.copyHttpcontext(handlerContext);
        newHandlerContext.retry = handlerContext.retry;
        let collection = {'name': handlerContext.queueName, 'data': [newHandlerContext]};
        if (handlerContext.operation.indexOf('rpop') != -1) {
            dbClient.lpushs(collection);
        } else if (handlerContext.operation.indexOf('spop') != -1) {
            dbClient.sadds(collection);
        }
        handlerContext.retryCounter.inc();
    }
};
BulldozerC.prototype.retryFail = function (handlerContext) {
};
//优雅的暂停
BulldozerC.prototype.checkSuspend = function () {
    global.TASK_SCHEDULE_ENABLE = false;
};
BulldozerC.prototype.dbClient = require('./lib/db_client');
BulldozerC.prototype.cryptoUtils = require('./lib/crypto_utils');
BulldozerC.prototype.httpUtils = require('./lib/http_utils');

setInterval(function () {
    for (let i = 0; i < global.RUN_TASK_QUEUE_NAME.length; i++) {
        let queueName = global.RUN_TASK_QUEUE_NAME[i];
        dbClient.getTaskState(queueName, function (err, result, res, httpcontext) {
            if (result.result === '0000') {
                console.log('任务队列 [%s] 暂停', queueName);
                global.TASK_SCHEDULE_STOP = false;
            } else {
                global.TASK_SCHEDULE_STOP = true;
            }
        });
    }
}, 1000 * 30);

BulldozerC.prototype.metrics = function (handlerContext, httpContext) {
    let queueName = httpContext.request.postdata.name;
    handlerContext.queueName = queueName;
    let nextName = handlerContext.data.next;
    if (queueName && nextName) {
        let nextKeyName = {'key': 'bulldozer_c', 'type': queueName, 'next': nextName, 'event': 'total'};
        let nextCounter = this.getCounter(nextKeyName);
        nextCounter.inc();

        let nextSuccKeyName = {'key': 'bulldozer_c', 'type': queueName, 'next': nextName, 'event': 'succ'};
        let nextSuccCounter = this.getCounter(nextSuccKeyName);
        handlerContext.nextSuccCounter = nextSuccCounter;

        let nextFailkeyName = {'key': 'bulldozer_c', 'type': queueName, 'next': nextName, 'event': 'fail'};
        let nextFailCounter = this.getCounter(nextFailkeyName);
        handlerContext.nextFailCounter = nextFailCounter;

        let retryFailkeyName = {'key': 'bulldozer_c', 'type': queueName, 'next': nextName, 'event': 'retry_fail'};
        let retryFailCounter = this.getCounter(retryFailkeyName);
        handlerContext.retryFailCounter = retryFailCounter;

        let retrykeyName = {'key': 'bulldozer_c', 'type': queueName, 'next': nextName, 'event': 'retry'};
        let retryCounter = this.getCounter(retrykeyName);
        handlerContext.retryCounter = retryCounter;
    }
};

BulldozerC.prototype.getCounter = function (keyName) {
    if (typeof keyName === 'object') {
        keyName = this.formatMetricsKeyName(keyName);
    }
    let counter = global.metrics_counter_keys[keyName];
    if (!counter) {
        counter = probe.counter({'name': keyName});
        global.metrics_counter_keys[keyName] = counter;
    }
    return counter;
};

BulldozerC.prototype.formatMetricsKeyName = function (keyName) {
    let _key = keyName.key;
    delete keyName.key;
    let result = '{';
    for (let key in keyName) {
        if (keyName.hasOwnProperty(key)) {
            result += key + '="' + keyName[key] + '",';
        }
    }
    result += '}';
    return _key + result;
};

/**
 *   判断任务是否停止 stopedMin 分钟
 * stopedMin 任务已经停止时间  默认5分钟
 * keyName 对应 keyName
 * */
BulldozerC.prototype.taskIsStop = function (stopedMin, queueName) {
    if (!stopedMin) {
        stopedMin = 5;
    }
    let hrtime = global.loadHrTime[queueName];
    if (!hrtime) {
        hrtime = global.loadHrTime['default'];
        console.warn('queueName [%s] is wrong. use [default]', queueName);
    }
    let intervalTime = process.hrtime(hrtime);
    if (intervalTime[0] >= stopedMin * 60) {
        return true;
    } else {
        return false;
    }
};
/**
 * intervalMin 重复初始化时间间隔，分钟；为空，则不重复初始化
 * 间隔intervalMin分钟后重新初始化任务，初始化的时候首先会判定任务是否已经停止，如果没有停止，则不进行初始化
 * firstInitMin 第一次初始化在firstInitMin分钟后;为空，则第一次不初始化
 * */
BulldozerC.prototype.setTaskInitInterval = function (intervalMin, firstInitMin, stopedMin, queueName) {
    if (!queueName) {
        queueName = 'default';
    }
    let seft = this;
    if (firstInitMin) {
        setTimeout(function () {
            seft.taskInit();
            seft.getCounter({'key': 'bulldozer_c_init', 'type': queueName}).inc();
        }, 1000 * 60 * firstInitMin)
    }
    if (intervalMin) {
        setInterval(function () {
            if (seft.taskIsStop(stopedMin, queueName)) {
                seft.taskInit();
                seft.getCounter({'key': 'bulldozer_c_init', 'type': queueName}).inc();
            }
        }, 1000 * 60 * intervalMin);
    }


};
/***
 * 任务初始化接口
 * */
BulldozerC.prototype.taskInit = function () {
};

module.exports = BulldozerC;
