import { designImageNote, type BusinessPageSpec } from './businessPageSpec'

const prototypeBoundary = {
  title: '原型边界',
  items: ['回收咨询、报价与付款均为本地演示流程：不发生真实扣款，回收单确认前不产生交易；真实报价、验号与结算以回收商接口为准。'],
}

export const RECYCLE_PAGE_SPECS: readonly BusinessPageSpec[] = [
  {
    nodeId: 'recycle:home',
    screenName: '回收 · 首页',
    summary: '账号回收首页：品牌区、搜索、最近看过与热门回收宫格、更多游戏和五步流程。',
    referenceNote: '设计依据：/Users/ttcc/工程文件/深度玩家/素材/业务流程改版/账号回收首页-更多游戏入口调整-v1.png 与 回收游戏选择-你最近看过-热门回收-v1.png（2026-09-20）。按最新稿，“更多游戏”为宫格内独立入口卡片。',
    sections: [
      {
        title: '品牌区',
        items: ['顶部白底品牌区：左上返回、“账号回收 · 秒拿钱”主标题与四项权益（高价回收、安全换绑、极速到账、0手续费），右侧吉祥物。', '品牌区下方为“搜索游戏名称”入口，进入游戏选择页的搜索场景。'],
      },
      {
        title: '游戏宫格',
        items: ['“最近看过”展示精选游戏；“热门回收”展示其余游戏，每格显示封面、名称与“N 家可咨询”。', '“更多游戏”以宫格内“+ 查看列表”卡片呈现，进入游戏选择页。', '无回收商的游戏置灰显示“暂无回收商”，点击仅提示。'],
      },
      { title: '流程与提示', items: ['五步流程：提供信息 → 价格沟通 → 验号换绑 → 签署合同 → 极速到账。', '底部提示咨询估价不等于成交，确认正式回收单前不产生交易。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'recycle:recyclers',
    screenName: '回收 · 回收商选择',
    summary: '选定游戏后的回收工作室列表：游戏切换、接单状态与咨询入口。',
    referenceNote: '新版设计图未包含独立回收商列表画板；本页沿用回收首页品牌结构（账号回收工作室 + 吉祥物），列表卡片按 Design-Draft3-Pre 规范实现。',
    sections: [
      { title: '页面结构', items: ['头部为“账号回收工作室”标题、当前游戏切换链接与吉祥物。', '副标题显示“N 家回收商 · M 家接单中”。'] },
      { title: '回收商卡片', items: ['每张卡片显示回收商标识、名称、接单状态与“立即咨询”入口。', '离线回收商不可咨询；无回收商时显示空态并可切换游戏。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'recycle:chat-consulting',
    screenName: '回收咨询 · 咨询中',
    summary: '回收咨询聊天初始阶段：尚未发送回收单，双方沟通账号概况。',
    referenceNote: designImageNote('14-回收咨询-未发送与待确认卡片.png', '本页对应未发送回收单状态；回收商视角可点“发送回收单”。'),
    sections: [
      {
        title: '聊天结构',
        items: ['头部为返回、游戏标识、“游戏名 · 回收咨询”标题、对方名称与在线状态、刷新与更多菜单（含角色预览切换）。', '安全条提醒勿发送密码、验证码、实名材料或站外联系方式。'],
      },
      { title: '回收单占位卡', items: ['“尚未发送回收单”卡片说明沟通账号概况；回收商视角显示“发送回收单”按钮。', '底部输入栏支持文字消息，Enter 发送。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'recycle:chat-formal',
    screenName: '回收咨询 · 回收单待确认',
    summary: '回收商已发送正式回收单：黑底报价卡、明细与卖家确认/拒绝。',
    referenceNote: designImageNote('15-回收咨询-发送与修改表单-校正版.png', '发送与修改回收单表单（登录账号、实名、贵族、防沉迷、报价、截图、说明）对应校正版画板。'),
    sections: [
      {
        title: '回收单卡片',
        items: ['黑底卡片头部黄条显示“回收单 · 待你确认 / 等待卖家确认”与倒计时。', '金额区展示报价与预计到手；明细包含登录账号、实名/贵族/防沉迷、补充截图数、补充说明与回收单号。', '卖家视角显示确认注意（此后不能以报价过低退单）与“拒绝 / 确认回收单”按钮；回收商视角为“修改回收单”。'],
      },
      { title: '发送/修改表单', items: ['底部弹层含登录账号、实名情况、贵族等级、防沉迷、回收报价五个必填项。', '补充截图最多 15 张（JPG/PNG/WebP、单张 ≤5MB），支持预览与删除；补充说明选填 200 字。', '提交前逐项校验；确认发送后回收单进入待确认状态。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'recycle:chat-confirm',
    screenName: '回收咨询 · 确认与拒绝',
    summary: '卖家确认回收单与双方拒绝的交互：确认弹窗、拒绝状态与客服说明。',
    referenceNote: designImageNote('16-回收咨询-确认拒绝弹窗与拒绝状态-校正版.png', '确认弹窗文案与双方已拒绝状态对应校正版画板。'),
    sections: [
      { title: '确认与拒绝', items: ['卖家点“确认回收单”后进入待回收商付款；点“拒绝”后咨询结束，未产生付款或交易。', '客服气泡说明确认只表示接受报价，回收商付款后才算成交。'] },
      { title: '结束后状态', items: ['咨询结束后底部输入栏替换为“咨询已结束，记录仅供查看”只读条。', '历史咨询可从消息列表进入，仅展示记录。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'recycle:chat-payable',
    screenName: '回收咨询 · 待付款与已成交',
    summary: '回收商付款视图与成交状态：应付金额、包赔费、付款入口与成交卡。',
    referenceNote: designImageNote('17-回收咨询-待付款与已成交卡片-校正版.png', '回收商视角“待你付款”（回收价 + 包赔费 10%）与卖家视角“待回收商付款”、已成交卡对应校正版画板。'),
    sections: [
      {
        title: '待付款（回收商）',
        items: ['黑底卡显示“回收单 · 待你付款”与倒计时；金额为回收价加 10% 包赔费。', '付款注意说明超时未付回收单自动关闭；“去付款”进入确认支付页。'],
      },
      { title: '待付款（卖家）', items: ['卖家视角显示“待回收商付款”，按钮置灰等待回收商操作。', '客服气泡演示回收商付款沟通。'],
      },
      { title: '已成交', items: ['成交卡显示对勾、“已成交”与到手金额，提供“进入交易群”继续履约。', '付款完成后自动建立交易群。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'recycle:checkout',
    screenName: '回收 · 确认支付',
    summary: '回收单确认支付页：订单金额、费用明细、支付方式与倒计时。',
    referenceNote: designImageNote('18-回收订单-确认支付页面.png', '顶部“确认支付”与剩余倒计时、金额区“回收订单支付”、明细（回收价、包赔费、应付）与支付方式对应该画板。'),
    sections: [
      { title: '页面结构', items: ['金额卡显示“回收订单支付”、应付总额与回收单号。', '黑底明细列出回收价、包赔费（10%）与应付合计；支付方式固定展示支付宝与微信。', '说明条提示本地演示不会真实扣款。'] },
      { title: '主要操作', items: ['“确认支付 ¥金额”模拟付款：创建交易订单、完成回收单并建立交易群。', '付款失败时提示可安全重试；“返回”回到咨询。'] },
      prototypeBoundary,
    ],
  },
]

const specByNodeId = new Map(RECYCLE_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getRecyclePageSpec(nodeId: string) {
  return specByNodeId.get(nodeId)
}

/** 回收咨询阶段 → 页面说明节点。 */
export function resolveRecycleChatNodeId(stage: string, role: 'seller' | 'recycler'): string {
  if (stage === 'consulting') return 'recycle:chat-consulting'
  if (stage === 'formal') return 'recycle:chat-formal'
  if (stage === 'submitted') return role === 'recycler' ? 'recycle:chat-payable' : 'recycle:chat-payable'
  if (stage === 'completed') return 'recycle:chat-payable'
  return 'recycle:chat-confirm'
}
