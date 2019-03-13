"use strict";
const httpClientp = require('http-clientp');
const httpUtils = require('./lib/http_utils');
const debug = require('debug');

function BulldozerC() {
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
        console.warn('[clearTask] 关闭定时器失败. 因为没有启动的定时器.the global.TASK_SCHEDULE_IDS is null.');
    }
};
//----通用方法
global.TASK_SCHEDULE_ENABLE = true; //任务调度开关
global.TASK_SCHEDULE_STOP = true; //任务调度开关,停止不可恢复
global.TASK_SCHEDULE_ENABLE_LOG = true;   //任务日志


/////////////////////
BulldozerC.prototype.rpop = 'rpop';
BulldozerC.prototype.spop = 'spop';
BulldozerC.prototype.rpoplpush = 'rpoplpush';
BulldozerC.prototype.spopsadd = 'spopsadd';
/////////////////////
//operation = rpop | spop | rpoplpush | spopsadd
BulldozerC.prototype.runTask = function (collection, mainProgram, taskName, intervalTime, operation) {
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
                        console.error('[handle.%]-load data is [%s]', operation, body);
                    } else {
                        debug('[handle.%]-load data is [%s]', operation, body);
                    }
                    let handlerContext = null;
                    if (body != null) {
                        try {
                            let bodyObj = JSON.parse(body);
                            handlerContext = JSON.parse(bodyObj.result);
                        } catch (err) {
                            console.error('[handle.%s]-发生异常.%s', operation, err);
                            handlerContext = null;
                        }
                    }
                    if (handlerContext != null) {
                        handlerContext.mainProgram = mainProgram;
                        try {
                            self.startRequest(handlerContext);
                        } catch (e) {
                            console.error('定时器调用startRequest发生异常.%s', e);
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
        console.error('[taskStart]-- task start failed. the caller is null.');
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
    console.log('request url %s', handlerContext.request.options.path);
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
    console.log('response code %s, url %s', handlerContext.response.statusCode, handlerContext.request.options.path);
    let mainProgram = handlerContext.mainProgram;
    delete handlerContext.request.options.headers;
    delete handlerContext.request.options.agent;
    delete handlerContext.callback;
    //delete handlerContext.self;
    delete handlerContext.mainProgram;

    //TODO 可以存储 请求和返回的 信息
    if (handlerContext.response.error) {
        handlerContext.request.options.host = null;
        handlerContext.request.options.port = null;
    }
    let data = handlerContext.data;
    mainProgram.emit(data.next, handlerContext);
};

//优雅的暂停
BulldozerC.prototype.checkSuspend = function () {
    global.TASK_SCHEDULE_ENABLE = false;
};
BulldozerC.prototype.dbClient = require('./lib/db_client');
BulldozerC.prototype.cryptoUtils = require('./lib/crypto_utils');
BulldozerC.prototype.httpUtils = require('./lib/http_utils');
module.exports = BulldozerC;