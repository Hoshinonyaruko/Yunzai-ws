import{ segment } from 'oicq'
import { hashString } from './core.js'
let bot;
class NotFoundError extends Error {}

const available_actions = [
    "sendPrivateMsg", "sendprivatemsg",
    "sendGroupMsg", "sendgroupmsg",
    "sendDiscussMsg", "senddiscussmsg",
    "sendMsg", "sendmsg",
    "deleteMsg", "deletemsg",
    "getMsg", "getmsg",
    "getForwardMsg", "getforwardmsg",
    "sendLike", "sendlike",
    "setGroupKick", "setgroupkick",
    "setGroupBan", "setgroupban",
    "setGroupAnonymousBan", "setgroupanonymousban",
    "setGroupWholeBan", "setgroupwholeban",
    "setGroupAdmin", "setgroupadmin",
    "setGroupAnonymous", "setgroupanonymous",
    "setGroupCard", "setgroupcard",
    "setGroupName", "setgroupname",
    "setGroupLeave", "setgroupleave",
    "sendGroupNotice", "sendgroupnotice",
    "setGroupSpecialTitle", "setgroupspecialtitle",
    "setFriendAddRequest", "setfriendaddrequest",
    "setGroupAddRequest", "setgroupaddrequest",
    "getLoginInfo", "getlogininfo",
    "getStrangerInfo", "getstrangerinfo",
    "getFriendList", "getfriendlist",
    "getStrangerList", "getstrangerlist",
    "getGroupInfo", "getgroupinfo",
    "getGroupList", "getgrouplist",
    "getGroupMemberInfo", "getgroupmemberinfo",
    "getGroupMemberList", "getgroupmemberlist",
    // "getGroupHonorInfo", "getgrouphonorinfo", //暂无实现计划
    "getCookies", "getcookies",
    "getCsrfToken", "getcsrftoken",
    // "getCredentials", "getcredentials", //暂无实现计划
    // "getRecord", "getrecord", //暂无实现计划
    // "getImage", "getimage", //暂无实现计划
    "canSendImage", "cansendimage",
    "canSendRecord", "cansendrecord",
    "getStatus", "getstatus",
    "getVersionInfo", "getversioninfo",
    // "setRestart", "setrestart", //todo
    "cleanCache", "cleancache",
    //enhancement
    "setOnlineStatus", "setonlinestatus",
    "sendGroupPoke", "sendgrouppoke",
    "addGroup", "addgroup",
    "addFriend", "addfriend",
    "deleteFriend", "deletefriend",
    "inviteFriend", "invitefriend",
    "sendLike", "sendlike",
    "setNickname", "setnickname",
    "setDescription", "setdescription",
    "setGender", "setgender",
    "setBirthday", "setbirthday",
    "setSignature", "setsignature",
    "setPortrait", "setportrait",
    "setGroupPortrait", "setgroupportrait",
    "getSystemMsg", "getsystemmsg",
    "getChatHistory", "getchathistory",
    "sendTempMsg", "sendtempmsg"
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
    if(JSON.stringify(req.params.message).includes('{')){
    req.params.message = JSON.parse(decodeURIComponent(JSON.stringify(req.params.message)))
    var text = ''
    var at = 0
    var piclink = ''
    for (const item of req.params.message){
        if (item.type === 'at') {
           at = item.data.qq;
        } else if (item.type === 'text') {
           text += item.data.text;
        } else if (item.type === 'image') {
           piclink = item.data.image;
        }
      }
      let message = [text];
      if (piclink !== '') {
          message.push(segment.image(piclink.replace(/\\/g, "/")));
      }
      if (at !== 0) {
          message.push(segment.at(parseInt(at)));
      }
      return message;
    } else{
        const piclink = getParenthesesStr(req.params.message,'\\[CQ:image,file=','\\]');
        const at = getParenthesesStr(req.params.message,'\\[CQ:at,qq=','\\]');
        req.params.message = req.params.message.replace(`[CQ:image,file=${piclink}]`,'').replace(`[CQ:at,qq=${at}]`,'');
        let message = [req.params.message];
        if (piclink) {
            message.push(segment.image(piclink.replace(/\\/g, "/")));
        }
        if (at) {
            message.push(segment.at(parseInt(at)));
        }
        return message;
    }
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
        if (["private", "group", "discuss"].includes(params.message_type)){
            action = "send_" + params.message_type + "_msg";}
        else if (params.user_id)
            action = "send_private_msg";
        else if (params.group_id)
            action = "send_group_msg";
        else if (params.discuss_id)
            action = "send_discuss_msg";
    }
    action = toHump(action);
    action = action.toLowerCase(action); 
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
            if (action === 'sendprivatemsg'){
                ret =  bot.sendPrivateMsg(req.params.user_id, sendMessage(req));
            }else if (action === 'sendgroupmsg'){
                ret =  bot.sendGroupMsg(req.params.group_id, sendMessage(req));
            }else if(action === 'setgroupban'){
                ret =  bot.setGroupBan(req.params.group_id,req.params.user_id,req.params.duration)
            }else if(action === 'setgroupleave'){
                ret =  bot.setGroupLeave(req.params.group_id)
            }else if(action === 'getgroupinfo'){
                ret =  bot.getGroupInfo(req.params.group_id)
            }else if(action === 'getgroupmemberlist'){
                ret =  bot.getGroupMemberList(req.params.group_id)
            }else if(action === 'getgrouplist'){
                ret =  bot.getGroupList()
            }else if(action === 'setgroupcard'){
                ret =  bot.setGroupCard(req.params.group_id,req.params.user_id,req.params.card)
            }else if(action === 'deletemsg'){
                req.params.message_id = hashString(req.params.message_id)
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