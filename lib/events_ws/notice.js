import EventListener from '../listener/listener_ws.js'
import {dipatch} from '../core/core.js'

/**
 * 监听提示消息
 */
export default class noticeEvent extends EventListener {
  constructor () {
    super({ event: 'notice' })
  }

  async execute (e) {
    dipatch(e)
  }
}
