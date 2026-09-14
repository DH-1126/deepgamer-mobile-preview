import { assetPath } from '../components/assetPath'
import type { Conversation, ConversationMessage, TradeHistoryCard } from '../types/message'
import type { OrderRecord } from '../types/order'

export const ARCHIVED_TRADE_ID = 'trade-history-complete'
const ORDER_ID = 'OD-DEMO-HISTORY-001'
const phoneNotice = { title: '禁止提供手机号', paragraphs: ['验号阶段禁止提供 QQ 绑定的手机号，防止被恶意解绑。'] }
const adultNotice = { title: '温馨提示', paragraphs: ['本群仅限成年人交易，未满18周岁的未成年人禁止下单，请勿冒用成年人身份或由他人代下单。'] }
const verifyNotice = { title: '验号温馨提示', paragraphs: ['1、可二次实名账号，交易中请勿修改，请交易完成后修改，避免被删实名。', '2、交易过程中，请勿擅自对游戏账号进行任何操作与修改，否则需承担相应责任并协商赔偿。'] }
const bindingNotice = { title: 'QQ 账号风控须知', paragraphs: ['1、由于腾讯风控，换绑后有概率登录被限制，请买家换绑完成 24 小时后再登录 QQ，7 日后修改密码。', '2、近期腾讯人脸验证异常频繁，请勿随便扫码或共享账号。', '3、若因频繁操作无法换绑，可协商更换换绑时间。', '4、若可二次实名账号修改入口不显示，可能与腾讯风控有关，交易完成后可连续登录账号 7–15 天，加速恢复显示。'] }

/** Fictional archived trade; design states are chronological, never executable. */
export function createArchivedTradeSeed(now: number) {
  const minute = 60_000
  const startedAt = now - (10 * 24 * 60 + 27) * minute
  const messages: ConversationMessage[] = []
  const add = (sender: ConversationMessage['sender'], content: string, tradeCard?: TradeHistoryCard) => {
    messages.push({ id: `${ARCHIVED_TRADE_ID}-${messages.length + 1}`, conversationId: ARCHIVED_TRADE_ID,
      sender, senderName: ({ buyer: '买家', seller: '卖家', support: '萌萌 · 平台客服', system: '平台' })[sender],
      content, kind: tradeCard ? 'trade_card' : sender === 'system' ? 'system' : 'text', tradeCard,
      createdAt: startedAt + messages.length * minute, delivery: 'sent' })
  }
  const card = (data: TradeHistoryCard) => add('system', data.title ?? '验号环节已完成', data)
  add('system', '交易群已建立，买家、卖家与平台客服已加入。')
  add('system', '买家已付款 ¥1,280，资金进入平台托管。')
  card({ key: 'product', title: '王者荣耀 QQ区 王者50星 108英雄', variant: 'product' })
  add('buyer', '已经付款了，麻烦同步一下账号资料。')
  card({ key: 'materials-empty', actionTones: ['default', 'primary'], title: '资料同步', audience: '卖家', body: '填写 QQ 号及密码。验号阶段禁止提供 QQ 绑定的手机号，防止被恶意解绑。', fields: 'empty', notices: [phoneNotice, adultNotice], actions: ['资料同步', '异常'] })
  card({ key: 'materials-waiting', actionTones: ['default'], title: '等待卖家同步资料', audience: '买家', body: '等待卖家同步资料，请稍等。', notices: [phoneNotice, adultNotice], actions: ['异常'] })
  add('support', '@买家\n@卖家 请关注！')
  add('seller', '资料已经通过资料卡提交，请查收。')
  card({ key: 'materials-submitted', title: '资料同步', audience: '卖家', body: '填写 QQ 号及密码。验号阶段禁止提供 QQ 绑定的手机号，防止被恶意解绑。', statuses: [{ text: '当前环节已更新', tone: 'updated' }, { text: '资料已提交', tone: 'submitted' }], notices: [phoneNotice, adultNotice], actions: ['异常（已过期）'] })
  card({ key: 'credentials', title: '资料同步', fields: 'credentials' })
  add('system', '资料同步 · 已完成')
  card({ key: 'inspection-waiting', actionTones: ['default'], title: '等待买家开始验号', audience: '卖家', body: '等待买家开始验号。', notices: [verifyNotice], actions: ['异常'] })
  card({ key: 'inspection', actionTones: ['disabled', 'primary'], title: '买家开始验号', audience: '买家', variant: 'critical', body: '请根据账号资料进行验号，若需要验证码或扫码登录请联系卖家或客服。', notices: [verifyNotice], actions: ['验号完成', '异常'] })
  add('support', '资产和描述不一致就点「异常」，不要先点验号完成。')
  add('buyer', '暂时无法登录账号，已通过异常反馈提交说明。')
  card({ key: 'issue', title: '异常已提交 · 交易已暂停', variant: 'paused', body: '问题类型：无法登录 · 等待平台核实', safe: '处理期间 ¥1,280 保持平台托管，不会自动放款', actions: ['查看异常（已处理）', '等待客服处理（已结束）'] })
  add('system', '客服主管已接入，将由主管继续处理。')
  add('support', '我看了下这笔订单的记录，接下来由我跟进。')
  add('seller', '已配合完成登录验证，请重新核对。')
  add('buyer', '现在可以登录了，账号资产和描述一致。')
  add('support', '登录问题已解决，交易恢复验号流程。请买家核对无误后确认验号完成。')
  card({ key: 'issue-resolved', title: '异常详情', body: '问题类型：无法登录。双方已确认问题解决，平台恢复验号流程。', statuses: [{ text: '异常已处理 · 流程已恢复', tone: 'submitted' }] })
  card({ key: 'inspection-terminal', actions: ['验号完成（已完成）', '异常（已过期）'] })
  add('system', '买家验号完成 · 已进入换绑')
  add('support', '@买家\n@卖家 请关注！')
  card({ key: 'binding-buyer', actionTones: ['disabled', 'primary'], title: '买家提供手机号，等待卖家换绑', audience: '买家', body: '请通过换绑表单提供手机号，让卖家进行操作换绑，请注意接收验证码，以便完成换绑流程。', notices: [bindingNotice], actions: ['换绑完成', '异常提醒'] })
  card({ key: 'phone', title: '买家提交的换绑手机号', fields: 'phone', statuses: [{ text: '已提交', tone: 'submitted' }] })
  card({ key: 'binding-seller', actionTones: ['default'], title: '卖家操作换绑', audience: '卖家', variant: 'critical', body: '请将账号内 QQ 人脸等删除，同时将账号换绑至买方手机号。等待买家通过表单提交手机号后进行换绑流程。', notices: [bindingNotice], safe: '买家的 ¥1,280 在平台托管，换绑完成并确认后结算给卖家', actions: ['异常提醒'] })
  add('seller', '已经换绑好了，你可以核对一下。')
  add('system', '验号完成 · 换绑完成 · 等待买家确认放款')
  card({ key: 'delivery', title: '交付核对', fields: 'delivery' })
  card({ key: 'release', actionTones: ['default', 'primary'], title: '卖家已完成换绑，请你核对', audience: '买家', variant: 'critical', body: '确认放款后 ¥1,280 将结算给卖家，此操作不可撤销。', countdown: '72小时后系统自动确认 · 已于时限内确认', safe: '确认前，¥1,280 一直由平台托管', actions: ['验号不符', '确认放款'] })
  add('buyer', '账号和绑定信息都核对好了，已经确认放款。')
  card({ key: 'completed', title: '交易完成', variant: 'completed', body: '账号已交付，¥1,280 已结算给卖家。' })
  add('support', '这笔交易已完成，群会保留 7 天。有问题可以在这里找我。')
  add('seller', '收到，感谢，祝你游戏愉快。')
  const completedAt = messages.find(message => message.tradeCard?.key === 'completed')!.createdAt
  const archivedAt = completedAt + 7 * 24 * 60 * minute
  add('system', '交易完成已满 7 天，会话已关闭，历史记录保留供查阅。')
  messages[messages.length - 1].createdAt = archivedAt
  card({ key: 'closed', title: '会话已关闭', variant: 'completed', body: '交易已完成，本群不再有待办操作。历史卡片仅供查看，无法发送消息或再次提交。' })
  messages[messages.length - 1].createdAt = archivedAt
  const conversation: Conversation = { id: ARCHIVED_TRADE_ID, kind: 'trade_group', stage: 'closed', closed: true, historyPreview: true,
    workflowPhase: 'completed', orderId: ORDER_ID, workflowOrderId: ORDER_ID, viewerRole: 'buyer', gameCode: 'wzry',
    title: '王者荣耀 QQ区', avatarText: '王', productCode: 'WZ-HISTORY-001', orderAmount: 1280,
    lastMessage: '平台：会话已关闭，完整交易记录可查看', updatedAt: archivedAt, unreadCount: 0 }
  const order: OrderRecord = { id: ORDER_ID, conversationId: ARCHIVED_TRADE_ID, role: 'buyer', status: 'completed',
    productId: 'demo-wz-history-001', productTitle: '王者荣耀 QQ区 王者50星 108英雄', gameName: '王者荣耀', gameCode: 'wzry', server: '安卓QQ',
    thumbnail: assetPath('assets/games/wzry.png'), goodsAmountCents: 128000, totalAmountCents: 128000, serviceAmountCents: 0, insuranceAmountCents: 0,
    createdAt: startedAt, updatedAt: completedAt }
  return { conversation, order, messages }
}
