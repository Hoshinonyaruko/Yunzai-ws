import EventListener from '../listener/listener_ws.js'
import {dipatch} from '../core/core.js'

/**
 * 监听请求消息
 */
export default class requestEvent extends EventListener {
  constructor () {
    super({ event: 'request' })
  }
  async execute (e) {
    dipatch(e)
  }
  }
