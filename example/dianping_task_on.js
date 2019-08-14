/****
 *   *****抓取大众点评数据，并存储入库mysql和mongodb，主要数据：店铺id，店铺url，店铺所在城市，店铺名称*****
 *  注意：大众点评有可能会中风控，此例子并没有处理大众点评的风控，假设一切正常访问
 * （1）抓取http://www.dianping.com/hangzhou/ch10/r1665页面所有的链接地址、星级，将数据作为模板数据存储在redis中
 * （2）从redis中读取模板数据并进行抓取详情页面的店铺名称、店铺id并存储在数据库中
 * */
const queue_url = 'dianping_test_queue';
const BulldozerC = require('../index');
//请求前 设置header 信息
BulldozerC.prototype.taskPreProcess = function (handlerContext) {
    handlerContext.request.options.headers = {};
    handlerContext.request.options.headers.Cookie = '_lxsdk_cuid=165c2328d62c8-010e3c20d9b791-34677908-fa000-165c2328d62c8; _lxsdk=165c2328d62c8-010e3c20d9b791-34677908-fa000-165c2328d62c8; _hc.v=cadff491-f222-0e57-9ff6-6f6349f10eb4.1536561418; aburl=1; s_ViewType=10; Hm_lvt_e6f449471d3527d58c46e24efb4c343e=1558333474; _lxsdk_s=16c8ae1ae18-7ab-3f6-19d%7C%7C41'; //访问官网拿cookie，不然被风控
};

//任务初始化
BulldozerC.prototype.taskInit = function () {
    console.log('初始化操作，将初始请求模板加入到队列中');
    const handlerContext = {
        "request": {
            "options": {
                "method": "GET",
                "path": "http://www.dianping.com/hangzhou/ch10/r1665"
            },
            "timeout": 1000
        },
        "response": {},
        "data": {//请求带过去的数据都放在data里面
            "url": "http://www.dianping.com/hangzhou/ch10/r1665",
            "city": "北京",
            "next": "detailUrl"    //处理此次返回结果的函数事件，
        }
    };
    bc.dbClient.lpushs({'name': queue_url, 'data': [handlerContext]});
};
const bc = new BulldozerC();
bc.setProxy('127.0.0.1', 8888);
bc.setTaskInitInterval(60 * 24, 0.1); // taskInit执行策略(60*24既每天执行一次，第一次在1分钟后执行)


let crawl = bc.newCrawl(); //新建一个抓取对象，用 on 监听并解析存储

crawl.on('detailUrl', function (prehandlerContext) {
    let body = prehandlerContext.response.body;//请求返回内容
    let $ = bc.$(body);
    let lis = $('#shop-all-list > ul > li');

    let dataUrl = [];
    for (let i = 0; i < lis.length; i++) {
        let li = $(lis[i]);
        let star = li.find('.sml-rank-stars').attr('title');
        let href = li.find('a').attr('href');
        let handlerContext = bc.httpUtils.buildHttpcontext('GET', {
            'next': 'detailInfo',
            'url': href,
            'star': star,
            'cityName': '北京',
        }, undefined, 1000);
        //handlerContext  待访问url的模板数据
        dataUrl.push(handlerContext);
    }
    let collection = {'name': queue_url, 'data': dataUrl};
    bc.dbClient.lpushs(collection);//会在redis生成两个key，dianping_test_queue(存放url模板数据的key)，dianping_test_queue:distinct(存放url模板数据md5的key，主要用于url去重)
});

crawl.on('detailInfo', function (prehandlerContext) {
    let data = prehandlerContext.data;//上一个请求带过来的数据
    let shopId = data.url.match(/\d+/)[0];
    let body = prehandlerContext.response.body;//请求返回内容
    let $ = bc.$(body);
    let shopName = $('.shop-name').text().trim().split(' ')[0];
    console.log('shopName==' + shopName);
    let result = {
        'Url': data.url,
        'CityName': data.cityName,
        'ShopName': shopName,
        'ShopId': shopId
    };
    let collection = {'name': 'dianping_test_table', data: [result]};
    //bc.dbClient.save(collection);//保存在mongodb
    let duplicate = ['CityName', 'ShopName'];
    collection.duplicate = duplicate;
    collection.columns = ['Url', 'CityName', 'ShopName', 'ShopId'];
    bc.dbClient.mysql_save(collection);//保存在mysql(需要先建表),支持ON DUPLICATE KEY UPDATE语法
    //也可以通过 httpClient 将数据保存在自己的数据服务中
});

bc.runTask({'name': queue_url}, crawl, '大众点评测试', 3, bc.rpop, 2000);  //时间间隔2s一次去redis set队列dianping_test_queue取爬取请求模板进行抓取
