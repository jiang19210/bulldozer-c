# bulldozer-c

#### 项目介绍
超级简单的分布式爬虫系统。此项目为爬虫客户端，功能有：抓取、解析、存储、任务调度、任务监控等。抓取请求模板存储在redis中，利用redis的set和list集合作为存储爬取请求的队列；[点击跳转到服务端](https://github.com/jiang19210/bulldozer),此项目用到的[httpclientp](https://www.npmjs.com/package/http-clientp)
****
#### 软件架构
![avatar](https://github.com/jiang19210/data/blob/master/bulldozer.png?raw=true)
****
#### 参考例子
* [https://github.com/jiang19210/bulldozer-c-example](https://github.com/jiang19210/bulldozer-c-example)
*****
*****
*****
#### 细节介绍  
* 下面bc皆为 let bc = new BulldozerC, BulldozerC在同一进程中最好只new一次，new的对象会赋值给全局变量 global.bulldozerc_new。
****
* bulldozer-c中通用格式爬取请求模板
 ~~~~
  {
      "md5": "请求信息的md5,由path+method+postdata等组成，具体请看http_utils.buildHttpcontext",
      "request": {
          "postdata": "如果是post请求，请填写postbody参数,支持字符串和json格式；如果是get请求，可以为null",
          "options": {
              "method": "POST-请求方式",
              "path": "请求地址,如:https://www.baidu.com/"
          },
          "timeout": 超时时间ms，不填默认没有
      },
      "response": {},
      "data": {
          "next": "处理此次请求的方法名称,系统会通过事件去触发此方法执行",
          "url": "请求地址,如:https://www.baidu.com/",
          "属性1": "next方法需要用到的属性",
          "属性2": "next方法需要用到的属性",
          "属性n": "next方法需要用到的属性"
      },
      "charset":"返回内容编码,不填将默认取res头中的编码，如果是二级制，如：图片，pdf等，请填buffer"
  }
  此模板可以通过 bc.httpUtils.buildHttpcontext方法获构建,如：
  let httpcontext = bc.httpUtils.buildHttpcontext('post', {
      'next': 'textfunction',
      'url': 'https://www.baidu.com/',
      'prototype1': 'next方法需要用到的属性',
      'prototype2': 'next方法需要用到的属性',
      'prototypen': 'next方法需要用到的属性'
  }, 'a=1&b=2', 2000, null, 'gbk');
  console.log(httpcontext);
 ~~~~
* bulldozer-c中通用格式爬取请求返回结果模板
~~~~
  let httpcontext = {
      "md5": "请求信息的md5,由path+method+postdata等组成，具体请看http_utils.buildHttpcontext",
      "request": {
          "postdata": "如果是post请求，请填写postbody参数,支持字符串和json格式；如果是get请求，可以为null",
          "options": {
              "method": "POST-请求方式",
              "path": "请求地址,如:https://www.baidu.com/"
          },
          "timeout": 超时时间ms，不填默认没有
      },
      "response": {
        'statusCode': 请求返回的状态码,
        'body':'请求返回的内容,如果charset=buffer,此body为buffer对象'
      },
      "res": 请求返回的完整res对象
      "data": {
          "next": "处理此次请求的方法名称,系统会通过事件去触发此方法执行",
          "url": "请求地址,如:https://www.baidu.com/",
          "属性1": "next方法需要用到的属性",
          "属性2": "next方法需要用到的属性",
          "属性n": "next方法需要用到的属性"
      },
      "charset":"返回内容编码,不填将默认取res头中的编码，如果是二级制，如：图片，pdf等，请填buffer"
  }
  此模板可以通过 bc.httpUtils.buildHttpcontext方法获构建
  ~~~~
* 和服务端bulldozer进行交互.
~~~~
和服务端进行交互的数据格式为: let collection = {'name':'queueName|tableName', 'data':[{对象内容}], 'duplicate':['mysql表字段1','mysql表字段2']};,其中 duplicate为支持 mysql duplicate update 用法。如果是redis或者mongodb则不需要duplicate
1. 将请求模板存储在redis队列中
    (1).bc.dbClient.lpushs({'name':'queueName','data':[httpcontext]}); //支持数组和对象，将请求模板 httpcontext 存储在list队列queueName中
    (2).multilpush 同(1)，支持事物
    (3)sadds，支持数组  将请求模板 httpcontext 存储在set对了queueName中
    (4) multisadd，支持数组 同(3)，支持事物
    (5) saddDistinct,支持对象，此方法会过滤掉之前抓取过的请求连接，过滤原理:此方法会将请求加入到两个队列中,既:queueName和queueName:distinct。将请求模板 httpcontext 加入到 queueName,将请求模板 httpcontext 的md5加入到queueName:distinct中，加入之前会先加入queueName:distinct中，如果加入成功，在加入queueName中，否则说明已经抓取过了，不在加入
    (6)saddDistincts，同 (5) 支持数组。
    (7)rpop，同redis rpop命令
    (8)lpop，同redis lpop命令
    (9)spop，同redis spop命令
    (10)rpoplpush({'name0':'queueName0', 'name1':'queueName1'}), 同redis rpoplpush 命令,从queueName0取出val，返回并加入到queueName1队列中
    (11)spopsadd({'name0':'queueName0', 'name1':'queueName1'}),，set版本取出再插入，从queueName0取出val，返回并加入到queueName1队列中
    (12)setTaskState('queueName','0000') 优雅的暂停任务,设置为0000最多30s内会暂停任务，设置为不等于0000，最多30s内会恢复
    (13)getTaskState('queueName') 获取任务的状态，当值为0000的时候，任务会暂停；非0000，任务恢复
2. 将解析完成的数据存储到mysql中,假设表已经建好
  (1) 设置了UNIQUE KEY, 用到duplicate update，根据UNIQUE KEY去重
    let collection = {
            'name': 'tableName',                             //表名称
            'data': [{'a':1,'b':2,'c':3,'UNIQUE_KEY':'1'}],   //数据
            'duplicate': ['a', 'b', 'c']                 //唯一约束冲突后进行更新的字段
        };
    bc.mysql_save(collection);
  (2) 未设置UNIQUE KEY
    let collection = {
            'name': 'tableName',
            'data': [{'a':1,'b':2,'c':3}]
       };
    bc.mysql_save(collection);
  (3) update数据
    let collection = {
           'name': 'tableName',          //表名称
           'data': {'a':1,'b':2,'c':3}, //更新的值
           'query': {'UNIQUE_KEY': 1}   //更新条件
       };
    bc.mysql_update(collection);
~~~~

* 任务开始
~~~~
1. bc.runTask(collection, mainProgram, taskName, intervalTime, operation)
   (1) collection : 队列名称 {'name':'queueName'} (operation=rpop|spop), {'name0':'queueName0', 'name1':'queueName1'} (operation=rpoplpush|spopsadd)
   (2) mainProgram : 爬虫具体脚本对象
   (3) taskName : 爬虫名称
   (4) intervalTime : 定时从redis取爬取请求模板时间间隔
   (5) operation : spop，spopsadd从set中取出爬取请求模板；rpop，rpoplpush从list中取出爬取请求模板
2. bc.testDelayStartRequest(handlerContext, queueName, delay, operation); //单个请求测试入口   
~~~~
* 任务重试
~~~~
1. bc.retry(handlerContext);
  (1) 默认重试3次，重试3次失败后会打印日志，日志包含 retry_fail 或 request_fail_no_retry
  (2) 重试次数可以配置，配置参数 global.request_retry_count
~~~~
* 指标信息，指标是用pmx实现的，用pm2启动程序，执行命令pm2 show id可以看到相关指标信息:

~~~~
   Code metrics value
  ┌───────────────────────────────────────────────────────────────────────┬────────┐
  │ Loop delay                                                            │ 0.36ms │
  │ Active requests                                                       │ 0      │
  │ Active handles                                                        │ 4      │
  │ bulldozer_c{type="queueName",next="downloadLogo",event="total",}      │ 7204   │  //总数
  │ bulldozer_c{type="queueName",next="downloadLogo",event="succ",}       │ 7197   │  //成功次数
  │ bulldozer_c{type="queueName",next="downloadLogo",event="fail",}       │ 6      │
  │ bulldozer_c{type="queueName",next="downloadLogo",event="retry_fail",} │ 3      │ //重试3次失败总数
  │ bulldozer_c{type="queueName",next="downloadLogo",event="retry",}      │ 3      │ //重试次数
  │ bulldozer_c_http{type="queueName",statusCode="301",}                  │ 3      │ //http statusCode相关指标
  │ bulldozer_c_http{type="queueName",statusCode="405",}                  │ 2      │
  │ bulldozer_c_http{type="queueName",statusCode="404",}                  │ 1      │
  └───────────────────────────────────────────────────────────────────────┴────────┘
  以上是默认指标，也可以自定义指标
  bc.getCounter(keyName) 可以获得指标名称: 
     1. 如果keyName是字符串，将直接以字符串为指标名称
     2.如果指标为对象，将以key键值为指标名称，如:let retryFailkeyName = {'key': 'bulldozer_c', 'type': queueName, 'next': 'downloadLogo', 'event': 'total'}; 指标为: bulldozer_c{type="queueName",next="downloadLogo",event="total",}                     
~~~~

* 指标采集,采集服务[pm2-agent](https://github.com/jiang19210/pm2-agent)
~~~~
    采集例子:
    # HELP bulldozer_c HELP.
    # TYPE bulldozer_c gauge
    bulldozer_c{type="queueName",next="downloadLogo",event="total",nodeName="download_logo",pid="1218094",} 7281
    bulldozer_c{type="queueName",next="downloadLogo",event="succ",nodeName="download_logo",pid="1218094",} 7200
    bulldozer_c{type="queueName",next="downloadLogo",event="fail",nodeName="download_logo",pid="1218094",} 81
~~~~
