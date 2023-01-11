# Yunzai-ws
onebotv11 websocket for yunzai base on oicq/js

需要新增的配置位于:Yunzai-Bot\config\config\qq.yaml
"ws://127.0.0.1:20007"是需要添加的ws后端，可以本地可以云端，可以是onebotv11标准的任意后端，比如nb2、早苗、獭獭...
```
use_ws: false
use_http: false
ws_reverse_url: ["ws://127.0.0.1:20007",]
post_url: ["",]
enable_heartbeat: true
rate_limit_interval: 500
heartbeat_interval: 15000
ws_reverse_reconnect_interval: 3000
```
修改的文件列表:
\lib\events_ws 
新增，\events_ws监听事件后发给ws

\lib\listener\listener_ws.js 
新增，ws监听器，在bot.js和云崽监听器一起载入

\lib\listener\loader_ws.js 
新增，用于载入events_ws下面的监听事件js

\lib\core 
新增ws的core，负责反向ws的收发

\lib\bot.js 
修改，新增一个监听器，和将bot示例传入core内

\lib\config\config.js 
修改，新增与ws相关的配置，须在config内的qq.yaml手动配置
