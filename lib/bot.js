import './config/init.js'
import ListenerLoader from './listener/loader.js'
import ListenerLoader_ws from './listener/loader_ws.js'
import { Client } from 'icqq'
import cfg from './config/config.js'
import api from './core/api.js'

export default class Yunzai extends Client {
  // eslint-disable-next-line no-useless-constructor
  constructor (uin, conf) {
    super(uin, conf)
  }

  /** 登录机器人 */
  static async run () {
    const bot = new Yunzai(cfg.bot)
    /** 加载oicq事件监听 */
    await ListenerLoader.load(bot)
    /** 加载oicq-ws事件监听 */
    await ListenerLoader_ws.load(bot)
    /** 把bot注入到api里 */
   api(bot, cfg.rate_limit_interval);
    await bot.login(cfg.qq, cfg.pwd)
    return bot
  }
}