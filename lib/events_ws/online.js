import EventListener from '../listener/listener_ws.js'
import core from '../core/core.js'
import {createReverseWS} from '../core/core.js'
import cfg from '../config/config.js'
import {dipatch} from '../core/core.js'

/**
 * 监听上线事件
 */
export default class onlineEvent extends EventListener {
  constructor () {
    super({
      event: 'system.online',
      once: true
    })
  }

  /** 默认方法 */
  async execute (e) {
    logger.mark('----^_^----')
    logger.mark(logger.green(`Yunzai-Bot ws魔改版载入成功~项目地址↓`))
    logger.mark(logger.green('https://github.com/Hoshinonyaruko/Yunzai-ws'))
    logger.mark(logger.green(`websocket问题&交流反馈↓`))
    logger.mark(logger.green('https://kook.top/SXvPv6'))
    // logger.mark('-----------')
    /** 加载插件 */
    //await this.plugins.load()
   /** ws握手和lifecycle包 */
   core(cfg.qq, cfg.bot)
   /** 创建反向ws */
   createReverseWS()
   dipatch({
    self_id: cfg.qq,
    time: parseInt(Date.now()/1000),
    post_type: "meta_event",
    meta_event_type: "lifecycle",
    sub_type: "enable",
});
  }
}
