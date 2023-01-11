import EventListener from '../listener/listener_ws.js'
import {dipatch} from '../core/core.js'
import cfg from '../config/config.js'
/**
 * 监听下线事件
 */
export default class onlineEvent extends EventListener {
  constructor () {
    super({ event: 'system.offline' })
  }

  /** 默认方法 */
  async execute (e) {
    logger.mark('掉线了')
    dipatch({
      self_id: cfg.qq,
      time: parseInt(Date.now()/1000),
      post_type: "meta_event",
      meta_event_type: "lifecycle",
      sub_type: "disable",
  });
  }
}
