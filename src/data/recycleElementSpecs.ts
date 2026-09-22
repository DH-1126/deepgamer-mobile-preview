import type { PageElementSpec } from './pageElementSpec'

const PAGE = 'src/pages/SellPages.tsx'
const MODEL = 'src/components/recycleModel.ts'
const RECYCLER_CARD = 'src/components/RecyclerCard.tsx'
const CONVERSATION_MODEL = 'src/components/recycleConversationModel.ts'
const CSS = 'src/styles/sell-v2.css'

const recycleHero: PageElementSpec = {
  name: '回收品牌区',
  component: 'header.sell-v2-recycle-hero（返回 + 标题 + 权益 + 吉祥物）',
  visual: '白底品牌区：左上返回按钮，“账号回收 · 秒拿钱”主标题（“秒拿钱”弱化），四项权益一行排布，右侧吉祥物 72×72px。',
  dimensions: '状态区高 44px、导航行高 40px；吉祥物 72×72px；内容左右内边距 16px。',
  typography: '主标题 hero 级；权益小号加粗；副标题 12px/700。',
  interaction: '返回优先历史回退，无历史回“我的”；纯展示区不响应点击。',
  ui: '回收商选择页共用“账号回收工作室”标题与同尺寸吉祥物，保持两页头部一致。',
  dataSource: 'SellPages.tsx 的 SellPage/AppraisalPage 与 public/assets/messages-draft3/support-mascot.png。',
  dataContent: '固定文案：高价回收、安全换绑、极速到账、0手续费。',
  evidence: [PAGE, CSS],
}

const recycleSearchEntry: PageElementSpec = {
  name: '回收游戏搜索入口',
  component: 'button.sell-v2-search-entry（Search 图标 + 占位文案）',
  visual: '浅色圆角搜索条，左侧搜索图标，占位“搜索游戏名称”。',
  dimensions: '高 42px、左右外边距 16px、圆角沿用搜索组件。',
  typography: '占位 14px 灰。',
  interaction: '点击进入游戏选择页（scene=sell 且开启搜索）。',
  ui: '与首页搜索入口一致的浮起样式。',
  dataSource: 'SellPages.tsx 与 gameSelectionModel.ts 的 buildGameSelectRoute。',
  dataContent: '固定占位文案，不发起搜索请求。',
  evidence: [PAGE, CSS],
}

const recycleGameGrid: PageElementSpec = {
  name: '回收游戏宫格',
  component: 'GameButton 网格（最近看过 / 热门回收 / 更多游戏）',
  visual: '两组宫格：每格为彩色底图标、游戏名与“N 家可咨询”；热门回收末位为“更多游戏 · 查看列表”入口卡。',
  dimensions: '宫格沿用回收页栅格；图标区彩色圆角；窄屏自动收缩。',
  typography: '游戏名加粗小号；咨询数说明更小。',
  interaction: '点击游戏进入回收商选择并保存选择；无回收商仅 Toast 提示；“更多游戏”进入游戏选择页。',
  ui: '按 2026-09-20 最新稿，“更多游戏”为宫格内独立入口卡片（含加号图标）。',
  dataSource: 'SellPages.tsx 与 sellFixtures.ts 的 sellGames（featured 区分最近看过）。',
  dataContent: '游戏名、可咨询回收商数；数据为本地演示配置。',
  evidence: [PAGE, 'src/data/sellFixtures.ts', CSS],
}

const recycleQuickFlow: PageElementSpec = {
  name: '快速回收流程',
  component: 'section.sell-v2-quick-flow（五步 ol）',
  visual: '白底卡内五步横向流程：图标在上、名称在下，步骤间右箭头。',
  dimensions: '五列等分、间距 8px；图标容器 36×36px 圆角。',
  typography: '步骤名小号（caption 级）、行高 18px。',
  interaction: '纯展示，不接收焦点。',
  ui: '图标浅黄底圆形容器，箭头浅灰。',
  dataSource: 'SellPages.tsx 的固定流程配置。',
  dataContent: '固定五步：提供信息、价格沟通、验号换绑、签署合同、极速到账。',
  evidence: [PAGE, CSS],
}

const recyclerCard: PageElementSpec = {
  name: '回收商卡片',
  component: 'RecyclerCard',
  visual: '回收工作室列表卡：标识、名称、接单状态与“立即咨询”入口；离线态置灰。',
  dimensions: '卡片纵向排列；操作按钮右置或通栏。',
  typography: '名称加粗；状态小号。',
  interaction: '在线回收商点击创建咨询并进入咨询详情；离线不可点击。',
  ui: '黄黑品牌按钮；空列表显示“暂无回收工作室”空态。',
  dataSource: 'RecyclerCard.tsx 与 sellModel.ts 的 availableRecyclers、recycleRepository.begin。',
  dataContent: '回收商名称、接单状态；列表数量与接单数显示在副标题。',
  evidence: [RECYCLER_CARD, PAGE, 'src/components/sellModel.ts'],
}

const recycleChatHeader: PageElementSpec = {
  name: '回收咨询头部',
  component: 'ChatHeader（返回 + 游戏标识 + 标题 + 刷新 + 更多）',
  visual: '白底头部：返回、彩色游戏图标、“游戏名 · 回收咨询”标题、对方名称与在线点、刷新与更多按钮。',
  dimensions: '头部高 58px、五列网格（38/34/1fr/34/30px）；图标 34×34px 圆角 10px。',
  typography: '标题 page 级单行省略；副行 11px，在线点 5×5px 绿色。',
  interaction: '返回回消息回收群；刷新同步本地数据；更多菜单提供卖家/回收商角色预览切换。',
  ui: '更多菜单为白底浮层（宽 164px、圆角 12px）。',
  dataSource: 'SellPages.tsx 的 ChatHeader 与 recycleConversationModel.ts。',
  dataContent: '游戏名、回收商名称与咨询状态；状态随阶段刷新。',
  evidence: [PAGE, CONVERSATION_MODEL, CSS],
}

const recycleOrderCard: PageElementSpec = {
  name: '回收单卡片',
  component: 'FlowCard → section.sell-v2-order-card（黑底卡）',
  visual: '黑底圆角卡：黄条头部（回收单状态 + 倒计时/角标）、大号金额与到手金额、明细行、注意事项块与操作按钮。',
  dimensions: '卡片内边距 14px、圆角 16px；头部高 37px 黄条；金额 27px/900；明细行高 39px；按钮高 46px。',
  typography: '头部 13.5px/900；金额 ¥17px+27px；明细 12-12.5px；注意块 12px/1.7。',
  interaction: '卖家确认/拒绝回收单；回收商修改回收单或去付款；按钮随阶段与角色切换。',
  ui: '黑底 #17170F 与黄条 #ffe62a 构成回收主视觉；确认注意块浅黄 #fff6c4。',
  dataSource: 'SellPages.tsx 的 FlowCard 与 recycleModel.ts 的阶段状态、getRecyclePayableCents。',
  dataContent: '报价、预计到手、登录账号、实名/贵族/防沉迷、截图数、回收单号与倒计时。',
  evidence: [PAGE, MODEL, CSS],
}

const draftSheet: PageElementSpec = {
  name: '发送/修改回收单弹层',
  component: 'DraftSheet（底部弹层 role=dialog）',
  visual: '底部抽屉：把手、“发送回收单”标题与关闭按钮，五个必填字段、截图网格与补充说明，底部取消/确认双按钮。',
  dimensions: '弹层贴底含把手；截图网格平铺；主按钮通栏。',
  typography: '字段标签 13px 左右；必填星号强调。',
  interaction: 'Esc 关闭（预览打开时先关预览）；报价输入自动过滤非数字；截图 ≤15 张、单张 ≤5MB；提交前逐项校验。',
  ui: '必填字段带强调样式；截图支持本地预览与删除。',
  dataSource: 'SellPages.tsx 的 DraftSheet 与 recycleModel.ts 的 validateRecycleOrderDraft。',
  dataContent: '登录账号、实名情况、贵族等级、防沉迷、报价与截图文件名；说明为静态备注不回显用户输入。',
  evidence: [PAGE, MODEL, CSS],
}

const recycleComposer: PageElementSpec = {
  name: '回收咨询输入区',
  component: 'footer.sell-v2-composer（输入框 + 发送/加号）',
  visual: '底部输入条：输入框与发送按钮；有内容时按钮为“发送”，无内容显示加号；咨询结束后替换为只读条。',
  dimensions: '输入条贴底；只读条整行置灰。',
  typography: '占位 14px 左右；只读文案居中灰。',
  interaction: 'Enter 发送；校验文本后写入本地咨询记录；失败行内提示。',
  ui: '黄黑输入条与交易群一致。',
  dataSource: 'SellPages.tsx 的 send 与 recycleRepository.sendMessage。',
  dataContent: '消息文本；咨询结束后记录仅供查看。',
  evidence: [PAGE, CSS],
}

const recycleCheckoutTotal: PageElementSpec = {
  name: '回收支付金额与明细',
  component: 'Checkout（sell-v2-pay-total + sell-v2-pay-detail）',
  visual: '金额卡显示“回收订单支付”与应付总额；黑底明细列出回收价、包赔费（10%）与应付合计。',
  dimensions: '金额卡内边距 18px、圆角 16px；总额 31px；明细行高 45px、合计行 53px。',
  typography: '总额价格色 31px；明细 12-15px，合计价格色 20px。',
  interaction: '倒计时按秒刷新；超时后不可付款。',
  ui: '黑底明细与回收单卡片呼应。',
  dataSource: 'SellPages.tsx 的 Checkout 与 recycleModel.ts 的 getRecyclePayableCents。',
  dataContent: '回收价、10% 包赔费与应付合计及回收单号。',
  evidence: [PAGE, MODEL, CSS],
}

const recycleCheckoutActions: PageElementSpec = {
  name: '回收支付操作',
  component: 'Checkout 底部（返回 + 确认支付）+ 支付方式展示',
  visual: '底部双按钮：白底“返回”与黄底“确认支付 ¥金额”；支付方式区固定展示支付宝与微信。',
  dimensions: '按钮网格 75px + 1fr；按钮沿用回收按钮规范。',
  typography: '按钮文字加粗 15px 左右。',
  interaction: '确认支付模拟付款：创建交易订单、完成回收单并建立交易群；失败可安全重试。',
  ui: '说明条提示本地演示不真实扣款。',
  dataSource: 'SellPages.tsx 的 pay 与 recycleRepository.completePayment、createRecycleConversation。',
  dataContent: '应付金额按钮文案；付款结果以 Toast 反馈。',
  evidence: [PAGE, MODEL, CSS],
}

const homeElements = [recycleHero, recycleSearchEntry, recycleGameGrid, recycleQuickFlow]
const recyclersElements = [recycleHero, recyclerCard]
const chatElements = [recycleChatHeader, recycleOrderCard, draftSheet, recycleComposer]
const checkoutElements = [recycleCheckoutTotal, recycleCheckoutActions]

const byNode = new Map<string, PageElementSpec[]>([
  ['recycle:home', homeElements],
  ['recycle:recyclers', recyclersElements],
  ['recycle:chat-consulting', chatElements],
  ['recycle:chat-formal', chatElements],
  ['recycle:chat-confirm', chatElements],
  ['recycle:chat-payable', chatElements],
  ['recycle:checkout', checkoutElements],
])

export function getRecycleElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return byNode.get(nodeId)
}
