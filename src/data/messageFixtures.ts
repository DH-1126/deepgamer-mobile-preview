import type { MessageStore } from '../types/message'
import { createNotificationSeed } from './notificationFixtures'
import { createTradeMessageSeed } from './tradeMessageFixtures'
import { createArchivedTradeSeed } from './archivedTradeFixtures'

export const MESSAGES_STORAGE_KEY = 'deepgamer.messages.v1'
export const SUPPORT_CONVERSATION_ID = 'support-mengmeng'
export const SUPPORT_CONVERSATION_ROUTE = `/im/${SUPPORT_CONVERSATION_ID}`
export const SUPPORT_RECOMMENDATION_ROUTE = `${SUPPORT_CONVERSATION_ROUTE}?scenario=select`

export function createMessageSeed(now: number): MessageStore {
  const minute = 60_000
  const conversations = [
    { id: 'trade-wzry', kind: 'trade_group', stage: 'need_action', tradeState: 'binding', workflowPhase: 'materials', workflowOrderId: 'OD20260821000000001', viewerRole: 'buyer', gameCode: 'wzry', title: '王者荣耀 QQ区', avatarText: '王', orderId: 'OD20260821000000001', productCode: 'WZ0001', orderAmount: 1536, progressLabel: '步骤 1 / 4 · 等卖家同步资料', elapsedLabel: '已 2分钟', lastMessage: '平台：资金已进入托管', updatedAt: now - 173 * minute, unreadCount: 0 },
    { id: 'trade-wzry-od03', kind: 'trade_group', stage: 'need_action', tradeState: 'confirmed', workflowPhase: 'release', workflowOrderId: 'OD20260821000000003', viewerRole: 'buyer', gameCode: 'wzry', title: '王者荣耀 QQ区', avatarText: '王', orderId: 'OD20260821000000003', productCode: 'WZ0003', orderAmount: 1280, progressLabel: '步骤 4 / 4 · 待确认收货', elapsedLabel: '已 41分钟', lastMessage: '卖家：已经换绑好了，你可以核对一下', updatedAt: now - 39 * minute, unreadCount: 0 },
    { id: 'trade-wzry-od05', kind: 'trade_group', stage: 'need_action', tradeState: 'binding', workflowPhase: 'binding', workflowOrderId: 'OD20260820000000005', viewerRole: 'seller', gameCode: 'wzry', title: '王者荣耀 QQ区', avatarText: '王', orderId: 'OD20260820000000005', productCode: 'WZ0005', orderAmount: 1280, progressLabel: '步骤 3 / 4 · 待卖家换绑', elapsedLabel: '已 22分钟', lastMessage: '平台：请按买家手机号完成换绑', updatedAt: now - 137 * minute, unreadCount: 0 },
    { id: 'trade-delta', kind: 'trade_group', stage: 'need_action', tradeState: 'binding', workflowPhase: 'inspection', workflowOrderId: 'OD20260820000000006', viewerRole: 'seller', gameCode: 'sjzxd', title: '三角洲 QQ区', avatarText: '△', orderId: 'OD20260820000000006', productCode: 'SJ11DG001', orderAmount: 3308, progressLabel: '步骤 2 / 4 · 等买家验号', elapsedLabel: '昨天', lastMessage: '平台：资料已同步，等待买家验号', updatedAt: now - (23 * 60 + 21) * minute, unreadCount: 0 },
    { id: 'trade-hpjy', kind: 'trade_group', stage: 'in_progress', tradeState: 'binding', workflowPhase: 'binding', workflowOrderId: 'OD20260821000000002', viewerRole: 'buyer', gameCode: 'hpjy', title: '和平精英 微信区', avatarText: '和', orderId: 'OD20260821000000002', productCode: 'HP0028', orderAmount: 860, progressLabel: '等卖家换绑 · 已 41分钟', elapsedLabel: '13:44', lastMessage: '萌萌：卖家正在进行账号换绑', updatedAt: now - 11 * minute, unreadCount: 2 },
    { id: 'trade-ys', kind: 'trade_group', stage: 'in_progress', tradeState: 'mismatch', workflowPhase: 'paused', pausedPhase: 'inspection', gameCode: 'ys', title: '原神 亚服', avatarText: '原', orderId: 'OD20260821000000004-legacy', productCode: 'YS0501', orderAmount: 520, progressLabel: '人工 · 客服处理中', elapsedLabel: '11:02', lastMessage: '萌萌：我看过这笔订单了，接下来由我跟进', updatedAt: now - (9 * 24 * 60 + 36) * minute, unreadCount: 0 },
    { id: 'trade-ys-closed', kind: 'trade_group', stage: 'closed', tradeState: 'closed', workflowPhase: 'completed', workflowOrderId: 'OD20260801000000004', viewerRole: 'buyer', gameCode: 'ys', title: '原神 亚服 · 五星4', avatarText: '原', orderId: 'OD20260801000000004', productCode: 'YS0404', orderAmount: 450, progressLabel: '交易完成', elapsedLabel: '08-01', lastMessage: '平台：交易已经完成，资金已结算', updatedAt: now - (19 * 24 * 60 + 38) * minute, unreadCount: 0, closed: true },
    { id: SUPPORT_CONVERSATION_ID, kind: 'support', stage: 'in_progress', title: '萌萌', avatarText: '萌', lastMessage: '有交易问题都可以来找我', updatedAt: now - 7 * minute, unreadCount: 0 },
    { id: 'system-notice', kind: 'notification', stage: 'in_progress', title: '系统通知', avatarText: '系', lastMessage: '你的回收账号已通过平台验收', updatedAt: now - (2 * 24 * 60 + 64) * minute, unreadCount: 1 },
  ] satisfies MessageStore['conversations']
  const messages = [
    { id: 'm1', conversationId: 'trade-wzry-od03', sender: 'system', senderName: '平台', content: '买家已付款 ¥1,280，资金进入平台托管', createdAt: now - 46 * minute, kind: 'system', delivery: 'sent' },
    { id: 'm2', conversationId: 'trade-wzry-od03', sender: 'system', senderName: '平台', content: '资料核对卡 · 卖家需提供账号密码与换绑手机号', createdAt: now - 42 * minute, kind: 'system', delivery: 'sent' },
    { id: 'm3', conversationId: 'trade-wzry-od03', sender: 'seller', senderName: '卖家', content: '卖家已完成换绑，请你核对', createdAt: now - 40 * minute, kind: 'system', delivery: 'sent' },
    { id: 'm4', conversationId: 'trade-wzry-od03', sender: 'support', senderName: '萌萌 · 平台客服', content: '换绑已完成，你的钱还在平台托管。核对无误后点确认放款即可。', createdAt: now - 39 * minute, kind: 'text', delivery: 'sent' },
    { id: 'support-welcome', conversationId: SUPPORT_CONVERSATION_ID, sender: 'support', senderName: '萌萌 · 平台客服', content: '你好，我是平台客服萌萌。交易流程、账号保障、售后规则等问题都可以在这里咨询。', createdAt: now - 7 * minute, kind: 'text', delivery: 'sent' },
  ] satisfies MessageStore['messages']
  const tradeSamples = createTradeMessageSeed(now)
  const archived = createArchivedTradeSeed(now)
  return { conversations: [...conversations, ...tradeSamples.conversations, archived.conversation], messages: [...messages, ...tradeSamples.messages, ...archived.messages], notifications: createNotificationSeed() }
}
