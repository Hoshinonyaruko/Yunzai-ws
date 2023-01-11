import{ segment } from 'oicq'
let bot;
class NotFoundError extends Error {}

const available_actions = [
    "sendPrivateMsg",
    "sendGroupMsg",
    "sendDiscussMsg",
    "sendMsg",
    "deleteMsg",
    "getMsg",
    "getForwardMsg",
    "sendLike",
    "setGroupKick",
    "setGroupBan",
    "setGroupAnonymousBan",
    "setGroupWholeBan",
    "setGroupAdmin",
    "setGroupAnonymous",
    "setGroupCard",
    "setGroupName",
    "setGroupLeave",
    "sendGroupNotice",
    "setGroupSpecialTitle",
    "setFriendAddRequest",
    "setGroupAddRequest",
    "getLoginInfo",
    "getStrangerInfo",
    "getFriendList",
    "getStrangerList",
    "getGroupInfo",
    "getGroupList",
    "getGroupMemberInfo",
    "getGroupMemberList",
    // "getGroupHonorInfo", //暂无实现计划
    "getCookies",
    "getCsrfToken",
    // "getCredentials", //暂无实现计划
    // "getRecord", //暂无实现计划
    // "getImage", //暂无实现计划
    "canSendImage",
    "canSendRecord",
    "getStatus",
    "getVersionInfo",
    // "setRestart", //todo
    "cleanCache",

    //enhancement
    "setOnlineStatus",
    "sendGroupPoke",
    "addGroup",
    "addFriend",
    "deleteFriend",
    "inviteFriend",
    "sendLike",
    "setNickname",
    "setDescription",
    "setGender",
    "setBirthday",
    "setSignature",
    "setPortrait",
    "setGroupPortrait",

    "getSystemMsg",
    "getChatHistory",
    "sendTempMsg",
];

const queue = [];
let queue_running = false;
let rate_limit_interval = 500;
async function runQueue() {
    if (queue_running) return;
    while (queue.length > 0) {
        queue_running = true;
        const task = queue.shift();
        const {action, param_arr} = task;
        bot[action].apply(bot, param_arr);
        await new Promise((resolve)=>{
            setTimeout(resolve, rate_limit_interval);
        });
        queue_running = false;
    }
}

const fn_signs = {};

/**
 * @param {{import("../").Client}} client 
 * @param {number} rli rate_limit_interval
 */
export default function setBot(client, rli) {
    bot = client
    rli = parseInt(rli);
    if (isNaN(rli) || rli < 0)
        rli = 500;
    rate_limit_interval = rli;
    for (let fn of available_actions) {
        if (bot[fn]) {
            fn_signs[fn] = bot[fn].toString().match(/\(.*\)/)[0].replace("(","").replace(")","").split(",");
            fn_signs[fn].forEach((v, i, arr)=>{
                arr[i] = v.replace(/=.+/, "").trim();
            });
        }
    }
}

function toHump(action) {
    return action.replace(/_[\w]/g, (s)=>{
        return s[1].toUpperCase();
    })
}

export function quickOperate(event, res) {
    if (event.post_type === "message" && res.reply) {
        const action = event.message_type === "private" ? "sendPrivateMsg" : "sendGroupMsg";
        const id = event.message_type === "private" ? event.user_id : event.group_id;
        bot[action](id, res.reply, res.auto_escape);
        if (event.group_id) {
            if (res.delete)
                bot.deleteMsg(event.message_id);
            if (res.kick && !event.anonymous)
                bot.setGroupKick(event.group_id, event.user_id, res.reject_add_request);
            if (res.ban)
                bot.setGroupBan(event.group_id, event.user_id, res.ban_duration?res.ban_duration:1800);
        }
    }
    if (event.post_type === "request" && res.hasOwnProperty("approve")) {
        const action = event.request_type === "friend" ? "setFriendAddRequest" : "setGroupAddRequest";
        bot[action](event.flag, res.approve, res.reason?res.reason:"", res.block?true:false);
    }
}

export function handleQuickOperation(data) {
    const event = data.params.context, res = data.params.operation;
    quickOperate(event, res);
}

const bool_fields = ["no_cache", "auto_escape", "as_long", "enable", "reject_add_request", "is_dismiss", "approve", "block"];
function toBool(v) {
    if (v === "0" || v === "false")
        v = false;
    return Boolean(v);
}
function sendMessage(req) {
    const piclink = getParenthesesStr(req.params.message,'\\[CQ:image,file=','\\]');
    const at = getParenthesesStr(req.params.message,'\\[CQ:at,qq=','\\]');
    const newpiclink = piclink.replace(/\\/g, "\/");
    let str = req.params.message;
    req.params.message = str.replace('\[CQ:image,file='+piclink+'\]','');
    str = req.params.message;
    req.params.message = str.replace('\[CQ:at,qq='+at+'\]','');
    let message = [req.params.message];
    if (piclink) {
        message.push(segment.image(newpiclink));
    }
    if (at) {
        message.push(segment.at(parseInt(at)));
    }
    return message;
}
/***
* start和end 有特殊字符需要双斜杠
*/
function getParenthesesStr(text,start,end) {
    let result = ''
//字符串拼接 正则表达式文本
    let regex = `/${start}(.+?)${end}/g`;
//把字符串转换成js代码
regex = eval(regex);
    let regResult = text.match(regex);
    if (regResult) {
        let item = regResult[0]
//去除反斜杠
start = start.replace(/\\/g,"")
end = end.replace(/\\/g,"")
        if (item) {
            result = item.substring(start.length, item.length-end.length)
        }
    }
    return result
}

export async function apply(req) {
    let {action, params, echo} = req;
    let is_async = action.includes("_async");
    if (is_async)
        action = action.replace("_async", "");
    let is_queue = action.includes("_rate_limited");
    if (is_queue)
        action = action.replace("_rate_limited", "");
    if (action === "send_msg") {
        if (["private", "group", "discuss"].includes(params.message_type))
            action = "send_" + params.message_type + "_msg";
        else if (params.user_id)
            action = "send_private_msg";
        else if (params.group_id)
            action = "send_group_msg";
        else if (params.discuss_id)
            action = "send_discuss_msg";      
    }
    action = toHump(action);
    if (available_actions.includes(action)) {
        const param_arr = [];
        let ret;
        if (is_queue) {
            queue.push({action, param_arr});
            runQueue();
            ret = {
                retcode: 1,
                status: "async",
                data: null
            }
        } else {
            if (req.action === 'send_private_msg'){
                ret =  bot.sendPrivateMsg(req.params.user_id, sendMessage(req));
            }else if (req.action === 'send_group_msg'){
                ret =  bot.sendGroupMsg(req.params.group_id, sendMessage(req));
            }else if(req.action === 'set_group_ban'){
                ret =  bot.setGroupBan(req.params.group_id,req.params.user_id,req.params.duration)
            }else if(req.action === 'set_group_leave'){
                ret =  bot.setGroupLeave(req.params.group_id)
            }else if(req.action === 'get_group_info'){
                ret =  bot.getGroupInfo(req.params.group_id)
            }else if(req.action === 'get_group_member_list'){
                ret =  bot.getGroupMemberList(req.params.group_id)
            }else if(req.action === 'get_group_list'){
                ret =  bot.getGroupList()
            }else if(req.action === 'set_group_card'){
                ret =  bot.setGroupCard(req.params.group_id,req.params.user_id,req.params.card)
            }else if(req.action === 'delete_msg'){
                ret =  bot.deleteMsg(req.params.message_id)
            }
            if (ret instanceof Promise) {
                if (is_async)
                    ret = {
                        retcode: 1,
                        status: "async",
                        data: null
                    }
                else
                    ret = await ret;
            }
        }
        if (ret instanceof Map){
            ret = [...ret.values()];
        }
        if (echo)
            ret.echo = echo;
        return JSON.stringify(ret);
    } else {
        throw new NotFoundError();
    }
}