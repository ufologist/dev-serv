/**
 * dev-server - 开发时使用的专属服务器
 */

// 开发时使用的服务器需要具备哪些功能
// * 静态文件服务器
// * 静态文件修改后浏览器自动刷新
// * Mock API Server
// * 代理后端真实接口(最好 Mock API Server 能够灵活切换到真实接口或者使用 Mock 接口)
//
// 即需要集 static server + mock server + proxy server + live-reload 于一身
//
// 实现方案
// * 使用 expres 来做静态文件服务器                      -> 正式环境为 nginx
// * 使用 puer-mock 来做 API Server(代理后端的真实接口)  -> 方便切换 mock 接口或者真实接口
// * 使用 http-proxy-middleware 来代理 API Server       -> 正式环境为 nginx 反向代理(或者跨域调用)
// * 使用 puer 中间件来做静态文件修改后浏览器自动刷新      -> 方便开发
//
// 即形成下面的结构
// --------------------
// [Static Server(express)] ==http-proxy-middleware==> Mock API Server(puer-mock) ==proxy==> API Server(Backend)
//          +
// [Auto Reload(puer-connect-middleware)]
var path = require('path');
var fs = require('fs');
var http = require('http');
var os = require('os');
var exec = require('child_process').exec;

var express = require('express');
var puer = require('puer');
// openBrowser, merge
var puerHelper = require('puer/lib/helper');
var proxy = require('http-proxy-middleware');
var serveIndex = require('serve-index');

function getDevServConfig() {
    var devServConfig = {};
    try {
        // 读取开发服务器的配置, 没有配置文件也可以
        var json = fs.readFileSync(path.join(process.cwd(), devServConfigFile));
        devServConfig = JSON.parse(json);
    } catch (error) {
        console.error('getDevServConfig: ' + error);
    }
    return devServConfig;
}

// 使用 puer-mock 来做 API Server(代理后端的真实接口)
// puer -p 8001 -a _mockserver.js -t http://localhost:18520
function startMockServer() {
    puer({
        port: devServConfig.mockServer.port,
        addon: path.join(devServConfig.staticServer.dir, devServConfig.mockServer.addon),
        proxy: devServConfig.mockServer.backend,
        launch: false
    });
}

// 使用 http-proxy-middleware 来代理 API Server
function proxyMockServer() {
    // 代理后端接口(这里通过 puer-mock 来控制是使用 mock 接口还是真实接口)
    // 当然了, 你也可以分别在不同的 route 路径上使用不同的代理
    // 例如 app.use('/api', proxy({target: 'http://localhost:18520'}); // 真实接口
    //      app.use('/mock', proxy({target: 'http://localhost:8001'}); // mock接口
    app.use(proxy(devServConfig.staticServer.apiPath, {
        target: 'http://localhost:' + devServConfig.mockServer.port,
        changeOrigin: true,
        // https://webpack.js.org/configuration/dev-server/#devserver-proxy
        // If you don't want /api to be passed along, we need to rewrite the path:
        // {'^/api/': ''}
        pathRewrite: devServConfig.staticServer.pathRewrite
    }));
}

// 使用 puer 中间件来做文件修改后浏览器自动刷新
function liveReload() {
    app.use(puer.connect(app, server, {
        dir: devServConfig.staticServer.dir,
        ignored: /(\/|^)\..*|node_modules/
    }));
}

// 使用 expres 来做静态文件服务器
function static() {
    app.use(express.static(devServConfig.staticServer.dir));
    // Serve directory listings
    app.use(serveIndex(devServConfig.staticServer.dir, {
        icons: true
    }));
}

var app = express();
var server = http.createServer(app);
var devServConfig = {};
var devServConfigFile = '_dev-serv.json';

var DEV_SERV_CONFIG = {
    staticServer: {
        dir: process.cwd(), // 静态资源文件的根目录(默认为命令执行的目录)
        port: 8000,         // 静态服务器的端口
        apiPath: '/api/'    // 后端接口的根路径, 注意以斜杠结尾, 否则会匹配到 /api123 这样的路径
    },
    mockServer: {
        port: 8001,         // mock 服务器的端口
        addon: '_mockserver.js', // puer 的 mock 功能
        backend: 'http://localhost:18520' // puer 的 proxy 功能, 代理真实的后端接口, 方便切换
    }
}

function initDevServConfig() {
    devServConfig = puerHelper.merge(getDevServConfig(), DEV_SERV_CONFIG);
    devServConfig.staticServer.pathRewrite = {};
    devServConfig.staticServer.pathRewrite['^' + devServConfig.staticServer.apiPath] = '';
}

function startDevServer() {
    initDevServConfig();
    startMockServer();
    proxyMockServer();
    liveReload();
    static();

    server.listen(devServConfig.staticServer.port, function() {
        console.log('-------------------------------------------------');
        console.log('static server start at localhost:' + server.address().port);
        puerHelper.openBrowser('http://localhost:' + server.address().port, function(err) {
            return console.log(err || 'launch your default browser');
        });
    });
}

module.exports = {
    startDevServer: startDevServer
}