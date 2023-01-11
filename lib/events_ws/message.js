import EventListener from '../listener/listener_ws.js'
import {dipatch} from '../core/core.js'

/**
 * 监听群聊消息
 */
export default class messageEvent extends EventListener {
  constructor () {
    super({ event: 'message' })
  }
  async execute (e) {
    //console.log('message13-'+Object.keys(e))
    //console.log('message13-'+e)
    dipatch(e)
  }
}
