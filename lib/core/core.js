import path from 'path'
import os from 'os'
import querystring from 'querystring'
import url from 'url'
import crypto from 'crypto'
import http from 'http'
import https from 'https'
import WebSocket from 'ws'
import filter from './filter.js'
import {assert} from './filter.js'
import api from './api.js'
import {apply} from './api.js'

/**
 * @type {oicq.ConfBot}
 */
 const config = {};

/**
 * @type {WebSocket.Server}
 */
let wss;

/**
 * @type {Set<WebSocket>}
 */
let websockets = new Set();

let account = 0, passdir = "", wsrCreated = false;

/**
 * 启动
 */
 export default function startup(arg1, arg2) {
    account = arg1;
    Object.assign(config, arg2);
    config.data_dir = path.join(os.homedir(), ".oicq");
    passdir = path.join(os.homedir(), ".oicq", String(account));
    console.log("已加载配置文件：", config);
    if (config.enable_heartbeat && (config.use_ws || config.ws_reverse_url.length)) {
        setInterval(()=>{
            const json = JSON.stringify({
                self_id: account,
                time: parseInt(Date.now()/1000),
                post_type: "meta_event",
                meta_event_type: "heartbeat",
                interval: config.heartbeat_interval,
            })
            websockets.forEach((ws)=>{
                ws.send(json);
            });
            if (wss) {
                wss.clients.forEach((ws)=>{
                    ws.send(json);
                });
            }
        }, config.heartbeat_interval);
    }
    //filter(config.event_filter);
    createServer();
}

/**
 * 分发事件
 */
export function dipatch(event) {
    if (!assert(event))
        return;
    var cache = [];
    const json = JSON.stringify(event, function(key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return;
            }
            cache.push(value);
        }
        return value;
    });
    cache = null;	//释放cache
    
    console.log('core.js-70上报事件'+json)
    const options = {
        method: 'POST',
        timeout: config.post_timeout,
        headers: {
            'Content-Type': 'application/json',
            "X-Self-ID": String(account),
            "User-Agent": "OneBot"
        }
    }
    if (config.secret) {
        options.headers["X-Signature"] = "sha1=" + crypto.createHmac("sha1", config.secret.toString()).update(json).digest("hex");
    }
    for (let url of config.post_url) {
        const protocol = url.startsWith("https") ? https: http;
        try {
            const req = protocol.request(url, options, (res)=>{
                console.log(`POST(${url})上报事件: ` + json);
                onHttpRes(event, res);
            }).on("error", (e)=>{
                console.log(`POST(${url})上报失败：` + e.message);
            });
            req.end(json);
        } catch (e) {
            console.log(`POST(${url})上报失败：` + e.message);
        }
    }
    if (wss) {
        wss.clients.forEach((ws)=>{
            console.log(`正向WS上报事件: ` + json);
            ws.send(json);
        });
    }
    websockets.forEach((ws)=>{
        console.log(`反向WS(${ws.url})上报事件: ` + json)
        ws.send(json);
    });
}

/**
 * 创建http&ws服务器
 */
function createServer() {
    if (!config.use_http && !config.use_ws)
        return;
    const server = http.createServer((req, res)=>{
        if (!config.use_http)
            return res.writeHead(404).end();
        if (req.method === 'OPTIONS' && config.enable_cors) {
            return res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, authorization'
            }).end();
        }
        if (config.access_token) {
            if (!req.headers["authorization"]) {
                const access_token = querystring.parse(url.parse(req.url).query).access_token;
                if (access_token)
                    req.headers["authorization"] = access_token;
                else
                    return res.writeHead(401).end();
            }
            if (!req.headers["authorization"].includes(config.access_token))
                return res.writeHead(403).end();
        }
        onHttpReq(req, res);
    });
    if (config.use_ws) {
        wss = new WebSocket.Server({server});
        wss.on("error", ()=>{});
        wss.on("connection", (ws, req)=>{
            ws.on("error", ()=>{});
            if (config.access_token) {
                if (req.url) {
                    const url = new URL('http://www.example.com/' + req.url);
                    const accessToken = url.searchParams.get('access_token');
                    if (accessToken) {
                        req.headers["authorization"] = accessToken;
                    }
                }
                if (!req.headers["authorization"] || !req.headers["authorization"].includes(config.access_token))
                    return ws.close(1002);
            }
            console.Log('连接ws-148-core.js')
            onWSOpen(ws);
        });
    }
    server.listen(config.port, config.host, ()=>{
        console.log(`开启http服务器成功，监听${server.address().address}:${server.address().port}`);
    }).on("error", (e)=>{
        console.log(e.message);
        console.log("开启http服务器失败，进程退出。");
        process.exit(0);
    })
}

/**
 * ws连接建立
 * @param {WebSocket} ws 
 */
function onWSOpen(ws) {
    ws.on("message", (data)=>{
        onWSMessage(ws, data);
    });
    ws.send(JSON.stringify({
        self_id: account,
        time: parseInt(Date.now()/1000),
        post_type: "meta_event",
        meta_event_type: "lifecycle",
        sub_type: "connect",
    }));
    ws.send(JSON.stringify({
        self_id: account,
        time: parseInt(Date.now()/1000),
        post_type: "meta_event",
        meta_event_type: "lifecycle",
        sub_type: "enable",
    }));
}

/**
 * 创建反向ws
 */
export function createReverseWS() {
    wsrCreated = true;
    const headers = {
        "X-Self-ID": String(account),
        "X-Client-Role": "Universal",
        "User-Agent": "OneBot"
    };
    if (config.access_token)
        headers.Authorization = "Bearer " + config.access_token;
    for (let url of config.ws_reverse_url) {
        createWSClient(url, headers);
    }
}
function createWSClient(url, headers) {
    try {
        const ws = new WebSocket(url, {headers});
        ws.on("error", ()=>{});
        ws.on("open", ()=>{
            console.log(`反向ws连接(${url})连接成功。`);
            websockets.add(ws);
            onWSOpen(ws);
        });
        ws.on("close", (code)=>{
            websockets.delete(ws);
            if ((code === 1000 & config.ws_reverse_reconnect_on_code_1000 === false) || config.ws_reverse_reconnect_interval >= 0 === false)
                return console.log(`反向ws连接(${url})被关闭，关闭码${code}。不再重连。`);
            console.log(`反向ws连接(${url})被关闭，关闭码${code}，将在${config.ws_reverse_reconnect_interval}毫秒后尝试连接。`);
            setTimeout(()=>{
                createWSClient(url, headers);
            }, config.ws_reverse_reconnect_interval);
        });
    } catch (e) {
        console.log(e.message);
    }
}

/**
 * 收到http响应
 * @param {http.ServerResponse} res 
 */
function onHttpRes(event, res) {
    let data = [];
    res.on("data", (chunk)=>data.push(chunk));
    res.on("end", ()=>{
        data = Buffer.concat(data).toString();
        debug(`收到HTTP响应：${res.statusCode} ` + data);
        try {
            data = JSON.parse(data);
            api.quickOperate(event, data);
        } catch (e) {}
    })
}

/**
 * 收到http请求
 * @param {http.ClientRequest} req 
 * @param {http.ServerResponse} res 
 */
async function onHttpReq(req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (config.enable_cors)
        res.setHeader("Access-Control-Allow-Origin", "*");
    const qop = url.parse(req.url);
    const action = qop.pathname.replace(/\//g, "");
    if (req.method === "GET") {
        debug(`收到GET请求: ` + req.url);
        const params = querystring.parse(qop.query);
        try {
            const ret = await apply({action, params});
            res.end(ret);
        } catch (e) {
            res.writeHead(404).end();
        }
    } else if (req.method === "POST") {
        let data = [];
        req.on("data", (chunk)=>data.push(chunk));
        req.on("end", async()=>{
            try {
                data = Buffer.concat(data).toString();
                debug(`收到POST请求: ` + data);
                let params, ct = req.headers["content-type"];
                if (!ct || ct.includes("json"))
                    params = data ? JSON.parse(data) : {};
                else if (ct && ct.includes("x-www-form-urlencoded"))
                    params = querystring.parse(data);
                else
                    return res.writeHead(406).end();
                const ret = await apply({action, params});
                res.end(ret);
            } catch (e) {
                if (e instanceof api.NotFoundError)
                    res.writeHead(404).end();
                else
                    res.writeHead(400).end();
            }
        });
    } else {
        res.writeHead(405).end();
    }
}

/**
 * 收到ws消息
 * @param {WebSocket} ws 
 */
async function onWSMessage(ws, data) {
    debug(`收到WS消息: ` + data);
    try {
        data = JSON.parse(data);
        if (
            data.action === ".handle_quick_operation" ||
            data.action === ".handle_quick_operation_async" ||
            data.action === ".handle_quick_operation_rate_limited"
            ) {
            api.handleQuickOperation(data);
            var ret = JSON.stringify({
                retcode: 1,
                status: "async",
                data: null,
                echo: data.echo
            });
        } else {
            var ret = await apply(data)
            data = JSON.parse(ret);
            let newRet = {
                retcode: 0,
                status: "ok",
                data: {}
            };
            newRet.data = Object.assign(newRet.data, data);
            ret = JSON.stringify(newRet);
        }
        ws.send(ret);
    } catch (e) {
            var retcode = 1400;
        ws.send(JSON.stringify({
            retcode: retcode,
            status: "failed",
            data: null,
            echo: data.echo
        }));
    }
}

function debug(msg) {
        console.log('测试输出:'+msg);
}

function loop() {
    const help = `※你已成功登录，此控制台有简单的指令可用于调试。
※发言: send <target> <message>
※下线结束程序: bye
※执行任意代码: eval <code>`;
    console.log(help);
    process.stdin.on("data", async (input) => {
        input = input.toString().trim();
        if (!input) return;
        const cmd = input.split(" ")[0];
        const param = input.replace(cmd, "").trim();
        switch (cmd) {
        case "bye":
            bot.logout().then(process.exit);
            break;
        case "send":
            const abc = param.split(" ");
            const target = parseInt(abc[0]);
            if (bot.gl.has(target))
                bot.sendGroupMsg(target, abc[1]);
            else
                bot.sendPrivateMsg(target, abc[1]);
            break;
        case "eval":
            try {
                let res = await eval(param);
                console.log("Result:", res);
            } catch (e) {
                console.log(e);
            }
            break;
        default:
            console.log(help);
            break;
        }
    }).on("error", () => { });
}