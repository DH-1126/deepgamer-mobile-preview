import type { NotificationItem } from '../types/message'

/** Notification content and read state share the message repository, not page-local counters. */
export function createNotificationSeed(): NotificationItem[] {
  return [
    { id: 'after-1', kind: 'aftersales', group: '需要处理', title: '待补充材料', body: '王者荣耀 QQ区的售后需要你补充退款协商记录，补充后平台继续核查。', time: '14:32', tag: '售后', unread: true, action: '补充材料', href: '/aftersales', icon: 'shield' },
    { id: 'trade-1', kind: 'trade', group: '需要处理', title: '订单待支付', body: '和平精英 微信区订单将在 18 分钟后自动取消。', time: '13:05', tag: '交易', unread: true, action: '去支付', href: '/orders?type=bought', icon: 'clock' },
    { id: 'trade-2', kind: 'trade', group: '今天', title: '交易已完成', body: '原神 亚服订单资金已经结算至余额。', time: '11:20', tag: '交易', icon: 'check' },
    { id: 'listing-1', kind: 'listing', group: '今天', title: '你关注的皮肤有新号', body: '含「倪克斯神谕」的账号新上架 3 个，¥1,190 起。', time: '10:04', tag: '上架提醒', unread: true, href: '/game?gameCode=wzry', icon: 'gem' },
    { id: 'match-1', kind: 'trade', group: '今天', title: '求购有新匹配', body: '客服为你的求购找到 6 个符合条件的账号。', time: '09:12', tag: '交易', unread: true, href: '/game?gameCode=wzry', icon: 'bell' },
    { id: 'system-1', kind: 'system', group: '更早', title: '保障规则更新', body: '换绑后自动确认收货时间调整为 72 小时，点击查看详情。', time: '08-30', tag: '系统', icon: 'info' },
    { id: 'system-2', kind: 'system', group: '更早', title: '提现已到账', body: '¥1,280 已到账至你的银行卡（尾号 8842）。', time: '08-28', tag: '系统', href: '/wallet', icon: 'wallet' },
  ]
}
