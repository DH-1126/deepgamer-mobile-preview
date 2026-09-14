import type { RecycleHistoryCard, RecycleMessage, RecycleOrder } from '../types/recycle'

/** Two quote attempts in one fictional consultation; only the revised quote is paid. */
export function withRecycleHistory(order: RecycleOrder): RecycleOrder {
  const messages: RecycleMessage[] = []
  const startedAt = order.updatedAt - 40 * 60_000
  const previousId = `${order.id}-R1`
  const add = (sender: RecycleMessage['sender'], content: string, historyCard?: RecycleHistoryCard) => {
    messages.push({ id: `${order.id}-history-${messages.length + 1}`, sender, content, historyCard, createdAt: startedAt + messages.length * 60_000 })
  }
  const card = (state: RecycleHistoryCard['state'], role: RecycleHistoryCard['role'], quoteCents = 2200, orderId = order.id) => add('system', '回收单历史记录', { state, role, orderId, quoteCents })
  const event = (eventType: string, content: string, role: RecycleHistoryCard['role'], orderId = order.id, quoteCents = 2200) => add('system', content, { state: 'event', role, orderId, quoteCents, eventType })
  add('system', '回收咨询已建立，先沟通账号概况与报价。')
  add('recycler', '欢迎光临，说说账号情况，我先帮你估个价。')
  add('user', '王者荣耀 QQ区，段位和皮肤情况已整理，希望按实际情况报价。')
  card('unsent', 'recycler', 0)
  add('recycler', '根据目前描述，首次报价 ¥20.00，正式回收单已发送，请核对。')
  event('创建回收单', '首次回收单已创建，等待卖家确认。', 'recycler', previousId, 2000)
  card('pending', 'recycler', 2000, previousId)
  card('pending', 'seller', 2000, previousId)
  add('user', '这个报价暂不接受，我再补充一下账号情况。')
  card('rejected', 'seller', 2000, previousId)
  event('拒绝回收单', '首次报价已拒绝，未产生付款，可继续沟通。', 'seller', previousId, 2000)
  card('rejected', 'recycler', 2000, previousId)
  add('user', '已经补充账号资产截图，请重新评估。')
  add('recycler', '已核对补充内容，调整报价为 ¥22.00，重新发送一份回收单。')
  event('创建回收单', '新的回收单已创建，原报价保持已拒绝。', 'recycler')
  card('pending', 'recycler')
  card('pending', 'seller')
  add('support', '确认只表示接受报价，回收商付款后才算成交。')
  card('confirming', 'seller')
  event('确认回收单', '回收单已确认，等待回收商付款。', 'seller')
  const sellerConfirmedAt = messages.at(-1)!.createdAt
  card('awaiting_payment', 'seller')
  add('recycler', '我马上去付款，稍等两分钟。')
  add('support', '@回收商\n@卖家 请关注回收单付款进度。')
  card('preparing_payment', 'recycler')
  card('ready_payment', 'recycler')
  event('付款成功', '回收商实付 ¥24.20，其中回收价 ¥22.00、包赔费 ¥2.20。资金进入平台托管。', 'recycler')
  const paidAt = messages.at(-1)!.createdAt
  card('completed', 'seller')
  add('support', '回收单已成交，请进入交易群同步资料、验号、换绑和确认放款。')
  add('system', '咨询已结束，完整记录可查看；后续履约请进入交易群。')
  messages[messages.length - 1].createdAt = order.updatedAt
  return { ...order, historyPreview: true, stage: 'completed', quoteCents: 2200, protectionFeeCents: 220,
    rank: '账号资产与描述已确认', createdAt: startedAt, sellerConfirmedAt, paidAt, expiresAt: sellerConfirmedAt + 30 * 60_000,
    conversationId: `trade-recycle-${order.id}`, orderId: `OD-${order.id}`, messages }
}
