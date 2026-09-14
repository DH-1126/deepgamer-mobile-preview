import { assetPath } from '../components/assetPath'
import type { Conversation, ConversationMessage, ConversationStage } from '../types/message'
import type { OrderRecord } from '../types/order'

type TradeSample = {
  key: string
  gameCode: string
  gameName: string
  icon: string
  server: string
  productCode: string
  productTitle: string
  amountCents: number
  status: OrderRecord['status']
  phase: NonNullable<Conversation['workflowPhase']>
  role: OrderRecord['role']
  stage: ConversationStage
  minutesAgo?: number
  previousYear?: boolean
  unreadCount: number
  phaseCopy: string
  buyerCopy: string
  sellerCopy: string
  supportCopy: string
}

// Fictional prototype trades. Both repositories derive their linked records from this source.
const samples: TradeSample[] = [
  {
    key: 'materials-seller', gameCode: 'wzry', gameName: '王者荣耀', icon: 'wzry', server: '安卓QQ',
    productCode: 'WZ091401', productTitle: '王者荣耀 116英雄 320皮肤 贵族8', amountCents: 168_000,
    status: 'paid', phase: 'materials', role: 'seller', stage: 'need_action', minutesAgo: 3 * 24 * 60 + 133, unreadCount: 3,
    phaseCopy: '买家已付款，资金由平台托管，等待卖家同步资料。',
    buyerCopy: '已经付款了，麻烦同步一下账号资料。',
    sellerCopy: '收到，我正在整理，马上通过资料卡提交。',
    supportCopy: '买家已付款，请通过资料卡同步账号信息。',
  },
  {
    key: 'materials-buyer', gameCode: 'wzry', gameName: '王者荣耀', icon: 'wzry', server: '苹果微信',
    productCode: 'WZ091402', productTitle: '王者荣耀 荣耀王者 108英雄 268皮肤', amountCents: 98_000,
    status: 'paid', phase: 'materials', role: 'buyer', stage: 'in_progress', minutesAgo: 63, unreadCount: 1,
    phaseCopy: '付款成功，等待卖家提交账号资料。',
    buyerCopy: '我这边已经准备好验号，资料提交后提醒我一下。',
    sellerCopy: '好的，提交完成后会在群里通知。',
    supportCopy: '卖家正在整理资料，提交后即可开始验号。',
  },
  {
    key: 'inspection', gameCode: 'hpjy', gameName: '和平精英', icon: 'hpjy', server: '安卓QQ',
    productCode: 'HP091403', productTitle: '和平精英 王牌账号 多套稀有时装', amountCents: 236_000,
    status: 'verifying', phase: 'inspection', role: 'buyer', stage: 'need_action', minutesAgo: 21, unreadCount: 4,
    phaseCopy: '卖家已同步资料，交易进入验号阶段。',
    buyerCopy: '已经进入账号了，我再核对一下时装和枪皮。',
    sellerCopy: '可以，核对期间我不会登录或修改账号信息。',
    supportCopy: '请核对账号资产与描述，确认无误后点击验号完成。',
  },
  {
    key: 'binding', gameCode: 'sjzxd', gameName: '三角洲行动', icon: 'delta', server: 'QQ区',
    productCode: 'SJ091404', productTitle: '三角洲行动 典藏外观 高等级账号', amountCents: 328_000,
    status: 'binding', phase: 'binding', role: 'seller', stage: 'need_action', minutesAgo: 27 * 60 + 4, unreadCount: 2,
    phaseCopy: '买家验号完成，换绑信息已通过表单提交。',
    buyerCopy: '换绑信息已在表单里提交，麻烦按流程操作。',
    sellerCopy: '已收到，正在进行换绑，完成后会及时通知。',
    supportCopy: '换绑完成后请提交确认，买家核对后即可放款。',
  },
  {
    key: 'completed', gameCode: 'ys', gameName: '原神', icon: 'genshin', server: '天空岛服',
    productCode: 'YS091405', productTitle: '原神 多五星角色 探索毕业账号', amountCents: 126_000,
    status: 'completed', phase: 'completed', role: 'buyer', stage: 'closed', minutesAgo: 6 * 24 * 60 + 97, unreadCount: 1,
    phaseCopy: '买家已确认放款，本笔交易完成。',
    buyerCopy: '账号和绑定信息都核对好了，已经确认放款。',
    sellerCopy: '收到，感谢，祝你游戏愉快。',
    supportCopy: '交易已完成，资金已结算，有售后问题可以联系平台。',
  },
  {
    key: 'closed', gameCode: 'wzry', gameName: '王者荣耀', icon: 'wzry', server: '安卓微信',
    productCode: 'WZ091406', productTitle: '王者荣耀 王者段位 精品皮肤账号', amountCents: 65_000,
    status: 'closed', phase: 'closed', role: 'seller', stage: 'closed', previousYear: true, unreadCount: 0,
    phaseCopy: '双方协商终止交易，等待平台完成关闭处理。',
    buyerCopy: '这次先不买了，麻烦协助取消这笔交易。',
    sellerCopy: '已确认，同意按平台流程结束交易。',
    supportCopy: '本笔交易已关闭，处理结果可在订单中查看。',
  },
]

export function createTradeMessageSeed(now: number) {
  const minute = 60_000
  const orders: OrderRecord[] = []
  const conversations: Conversation[] = []
  const messages: ConversationMessage[] = []
  samples.forEach((sample, index) => {
    const id = `trade-sample-${sample.key}`
    const orderId = `OD-DEMO-0914-${String(index + 1).padStart(3, '0')}`
    const updatedAt = sample.previousYear
      ? new Date(new Date(now).getFullYear() - 1, 10, 26, 15, 16).getTime()
      : now - (sample.minutesAgo ?? 0) * minute
    const createdAt = updatedAt - 40 * minute
    orders.push({
      id: orderId, conversationId: id, role: sample.role, status: sample.status,
      productId: `demo-${sample.productCode.toLowerCase()}`, productTitle: sample.productTitle,
      gameName: sample.gameName, gameCode: sample.gameCode, server: sample.server,
      thumbnail: assetPath(`assets/games/${sample.icon}.png`),
      goodsAmountCents: sample.amountCents, totalAmountCents: sample.amountCents,
      serviceAmountCents: 0, insuranceAmountCents: 0, createdAt, updatedAt,
    })
    const dialogue: Array<Pick<ConversationMessage, 'sender' | 'senderName' | 'content' | 'kind'>> = [
      { sender: 'system', senderName: '平台', kind: 'system', content: `${sample.productCode} 的交易群已建立，买家、卖家与平台客服已加入。` },
      { sender: 'system', senderName: '平台', kind: 'system', content: sample.phaseCopy },
      { sender: 'buyer', senderName: `买家${index + 1}`, kind: 'text', content: sample.buyerCopy },
      { sender: 'seller', senderName: `卖家${index + 1}`, kind: 'text', content: sample.sellerCopy },
      { sender: 'support', senderName: '萌萌 · 平台客服', kind: 'text', content: sample.supportCopy },
    ]
    messages.push(...dialogue.map((message, offset) => ({
      ...message, id: `${id}-message-${offset + 1}`, conversationId: id,
      createdAt: updatedAt - (dialogue.length - 1 - offset) * minute, delivery: 'sent' as const,
    })))
    conversations.push({
      id, kind: 'trade_group', stage: sample.stage, gameCode: sample.gameCode,
      title: `${sample.gameName} ${sample.server}`, avatarText: sample.gameName.slice(0, 1),
      orderId, workflowOrderId: orderId, workflowPhase: sample.phase, viewerRole: sample.role,
      productCode: sample.productCode, orderAmount: sample.amountCents / 100,
      lastMessage: `萌萌：${sample.supportCopy}`, updatedAt, unreadCount: sample.unreadCount,
      closed: sample.status === 'closed',
    })
  })
  return { orders, conversations, messages }
}
