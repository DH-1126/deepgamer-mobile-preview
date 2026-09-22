import type { PageElementSpec } from './pageElementSpec'

const PAGE = 'src/pages/MessagePage.tsx'
const TRADE_PAGE = 'src/pages/TradeChatPage.tsx'
const SUPPORT_PAGE = 'src/pages/SupportChatPage.tsx'
const ROW = 'src/components/ConversationRow.tsx'
const RECYCLE_ROW = 'src/components/RecycleConversationRow.tsx'
const MODEL = 'src/components/messageModel.ts'
const CSS = 'src/styles/messages-v2.css'
const DRAFT3_CSS = 'src/styles/messages-draft3.css'
const TRADE_CSS = 'src/styles/trade-chat-draft3.css'

const messageHeader: PageElementSpec = {
  name: '消息页头与分类标签',
  component: 'StatusBar + Heading“消息” + SearchField + Tabs(underline)',
  visual: '页头大标题“消息”与浅色搜索框；下方式“全部 / 交易群 / 回收群”下划线标签，选中项黄底下划线。',
  dimensions: '页头沿用消息页高度；标签行 size="lg"。',
  typography: '标题 display 级；搜索输入小号。',
  interaction: '搜索需显式提交；标签切换更新 tab 参数；未读不参与标签计数。',
  ui: '白底页头与内容区浅底形成层级。',
  dataSource: 'MessagePage.tsx 与 messageRepository.list()；tab 状态存于 URL。',
  dataContent: '搜索词匹配消息、订单或商品编号。',
  evidence: [PAGE, MODEL, CSS, DRAFT3_CSS],
}

const conversationRow: PageElementSpec = {
  name: '交易群会话行',
  component: 'ConversationRow',
  visual: '会话行：方形头像、群标题、最后一条消息摘要、相对时间与未读角标，可带订单状态标签。',
  dimensions: '行高按列表规范；未读角标圆点置顶。',
  typography: '标题加粗；摘要与时间小号灰。',
  interaction: '点击标记已读并进入交易群；未读保存失败时 Toast 提示。',
  ui: '交易群按“需要我处理/进行中/已完成已关闭”分组展示。',
  dataSource: 'ConversationRow.tsx 与 messageModel.ts 的 filterConversations/groupTradeConversations。',
  dataContent: '会话标题、最后消息、未读数与关联订单状态。',
  evidence: [ROW, MODEL, PAGE],
}

const recycleRow: PageElementSpec = {
  name: '回收咨询会话行',
  component: 'RecycleConversationRow',
  visual: '回收会话行：回收商与游戏信息、咨询状态徽标与最新消息；在“全部”Tab 额外显示类型徽章。',
  dimensions: '与交易群行同高；状态徽标右置。',
  typography: '状态文字小号；标题加粗。',
  interaction: '点击标记已读并进入回收咨询详情；未读失败 Toast 提示。',
  ui: '回收状态（咨询中、待决定、待确认、已完成、已结束）以徽标区分。',
  dataSource: 'RecycleConversationRow.tsx 与 recycleRepository.list()。',
  dataContent: '回收商名称、游戏、咨询状态与最新消息内容。',
  evidence: [RECYCLE_ROW, PAGE],
}

const supportEntrySheet: PageElementSpec = {
  name: '客服咨询方向弹层',
  component: 'BottomSheet + 三个咨询入口按钮',
  visual: '底部弹层“你想咨询哪方面”：FAQ 问答、账号咨询、商品咨询三个入口，首个为推荐样式。',
  dimensions: '弹层沿用共享 BottomSheet；入口行含图标与说明两行。',
  typography: '入口名加粗，说明小号灰。',
  interaction: '选择方向后关闭弹层并携带上下文进入对应客服会话。',
  ui: '图标圆形底衬托，推荐项强调。',
  dataSource: 'MessagePage.tsx 与 supportConsultationModel.ts 的 buildSupportEntryRoute。',
  dataContent: '固定三个咨询方向与说明。',
  evidence: [PAGE, 'src/components/supportConsultationModel.ts'],
}

const tradeHeader: PageElementSpec = {
  name: '交易群头部与订单摘要条',
  component: 'StatusBar + trade-d3-topbar + Link.trade-d3-order-summary',
  visual: '头部左侧返回，中间“交易群 · 游戏名 区服”标题；下方订单摘要条显示缩略图、商品标题、订单号与金额。',
  dimensions: '摘要条整行可点；缩略图小尺寸方形。',
  typography: '标题 page 级；订单号小号灰；金额加粗右对齐。',
  interaction: '标题打开交易群信息与预览弹层；摘要条进入订单详情。',
  ui: '黄黑品牌色；摘要条作为群与订单的联动入口。',
  dataSource: 'TradeChatPage.tsx 与 orderRepository/messageRepository。',
  dataContent: '游戏名、商品标题、订单号与金额；历史群显示已关闭标记。',
  evidence: [TRADE_PAGE, TRADE_CSS],
}

const tradeProgress: PageElementSpec = {
  name: '交易阶段进度条',
  component: 'section.trade-d3-progress（步骤条）',
  visual: '横向步骤条：当前步大圆点高亮，已完成置深色，未到置浅；左侧显示“步骤 N / N · 阶段名”与时间说明。',
  dimensions: '步骤圆点等距分布；文字行两行。',
  typography: '阶段名加粗；时间小号灰。',
  interaction: '纯展示；暂停态显示“已暂停”标记，已关闭群显示关闭说明。',
  ui: '黄黑进度配色；预览模式可从信息弹层切换阶段。',
  dataSource: 'TradeChatPage.tsx 与 tradeFlowModel.ts 的 getTradeProgress。',
  dataContent: '阶段序号、标题与剩余时间（待放款态显示倒计时）。',
  evidence: [TRADE_PAGE, 'src/components/tradeFlowModel.ts', TRADE_CSS],
}

const tradeTaskCard: PageElementSpec = {
  name: '阶段任务卡',
  component: 'section.trade-d3-card.trade-d3-task',
  visual: '消息流中的白底任务卡：阶段标题、说明、必要的输入字段（账号/密码）或核对清单，底部操作按钮组。',
  dimensions: '卡片圆角；底部双按钮（异常/验号不符 + 主操作）。',
  typography: '标题 section 级；警示文案加粗；倒计时行强调。',
  interaction: '卖家资料同步填写账号密码后确认提交；买家验号完成/确认放款走确认弹层；异常反馈进入暂停流程。',
  ui: '关键操作卡片加 critical 强调；绿色托管条穿插提示资金安全。',
  dataSource: 'TradeChatPage.tsx 的 applyAction 与 orderRepository.advance/confirmReceipt/pause。',
  dataContent: '阶段操作文案、托管金额与倒计时；账号与密码输入仅存在于页面会话内存。',
  evidence: [TRADE_PAGE, TRADE_CSS],
}

const tradeDataCard: PageElementSpec = {
  name: '账号资料与核对卡',
  component: 'section.trade-d3-card（资料/手机号/交付核对）',
  visual: '白底信息卡：标题加状态角标（已同步/已提交），下方键值行；账号与初始密码默认掩码，行内“查看/收起”切换。',
  dimensions: '键值行等高排布；操作按钮小号行内。',
  typography: '键名小号灰、值加粗。',
  interaction: '掩码切换逐项显示；换绑手机号按角色提供填写或查看；交付核对三项展示完成状态。',
  ui: '完成项绿色标记、待确认项黄色。',
  dataSource: 'TradeChatPage.tsx 的 dataValue 与页面状态。',
  dataContent: '演示账号与初始密码、脱敏手机号与核对结论；说明不回显用户真实输入。',
  evidence: [TRADE_PAGE, TRADE_CSS],
}

const tradeSheet: PageElementSpec = {
  name: '交易操作底部弹层',
  component: 'trade-d3-sheet-layer + section.trade-d3-sheet（role=dialog）',
  visual: '底部弹层按操作切换内容：确认提交资料、确认验号/换绑/放款、填写换绑手机号、反馈异常、异常结果与群信息预览。',
  dimensions: '弹层含把手；主按钮通栏。',
  typography: '弹层标题 dialog 级；警示文案小号。',
  interaction: 'Esc/遮罩关闭；Tab 循环聚焦在弹层内；放款弹层展示金额并提示不可撤销；异常表单含类型、描述与最多 6 张凭证。',
  ui: '确认类主按钮黄色；成功态显示对勾标记。',
  dataSource: 'TradeChatPage.tsx 的 sheet 状态与 applyAction/savePhone。',
  dataContent: '放款金额、问题类型与描述；上传凭证仅存本地内存。',
  evidence: [TRADE_PAGE, TRADE_CSS],
}

const tradeComposer: PageElementSpec = {
  name: '交易群输入区',
  component: 'footer.trade-d3-composer（加号 + 输入框 + 发送）',
  visual: '底部输入条：左侧加号入口，中间输入框，右侧黄色“发送”按钮；终态置灰显示“会话已关闭”。',
  dimensions: '输入条贴底并处理安全区；发送按钮黄底。',
  typography: '输入占位 14px 左右。',
  interaction: 'Enter 发送（含中文输入法组合判断）；图片 ≤10MB 本地预览；发送失败内容保留并 Toast 提示。',
  ui: '与回收咨询输入区一致的黄黑输入条。',
  dataSource: 'TradeChatPage.tsx 的 send 与 messageRepository.sendText。',
  dataContent: '消息文本与本地图片预览；不持久化失败消息。',
  evidence: [TRADE_PAGE, TRADE_CSS],
}

const supportSelectHero: PageElementSpec = {
  name: '客服选择页入口区',
  component: 'header.support-d3-select-hero + 咨询方向卡片',
  visual: '客服品牌区展示吉祥物与说明，下方为 FAQ、账号咨询、商品咨询入口卡片与全部游戏列表。',
  dimensions: '入口卡片纵向排列含图标与两行说明。',
  typography: '入口名加粗、说明小号。',
  interaction: '选择方向携带上下文进入客服聊天；搜索可过滤游戏。',
  ui: '黄黑品牌区与消息页客服弹层方向一致。',
  dataSource: 'SupportChatPage.tsx 与 homeData.ts。',
  dataContent: '固定咨询方向与游戏列表。',
  evidence: [SUPPORT_PAGE, 'src/styles/support-draft3.css'],
}

const supportChatHeader: PageElementSpec = {
  name: '客服会话头部与输入区',
  component: 'header.support-d3-chat-header + footer.support-d3-composer',
  visual: '头部为返回、客服名称与设置入口；底部输入条支持文字与加号扩展；会话内可出现推荐卡片与卖号入口。',
  dimensions: '头部沿用聊天页高度；输入区贴底。',
  typography: '客服名加粗；输入占位小号。',
  interaction: '发送走消息仓库；设置弹层提供会话开关；推荐卡片可跳转商品。',
  ui: '与交易群一致的聊天视觉语言。',
  dataSource: 'SupportChatPage.tsx 与 messageRepository。',
  dataContent: '演示客服消息与推荐内容。',
  evidence: [SUPPORT_PAGE],
}

const listElements = [messageHeader, conversationRow, recycleRow, supportEntrySheet]
const tradeElements = [tradeHeader, tradeProgress, tradeTaskCard, tradeDataCard, tradeSheet, tradeComposer]
const supportSelectElements = [supportSelectHero]
const supportChatElements = [supportChatHeader]
const notificationElements: PageElementSpec[] = [
  {
    name: '通知中心列表',
    component: 'NotificationCenterPage 列表',
    visual: '按时间排列的系统通知，未读带标记，顶部提供未读说明。',
    dimensions: '列表行沿用消息行规范。',
    typography: '标题加粗、时间小号灰。',
    interaction: '点击通知跳转业务页并清除未读。',
    ui: '复用消息页视觉。',
    dataSource: 'NotificationPages.tsx 与 messageRepository 通知数据。',
    dataContent: '通知标题、时间与未读状态。',
    evidence: ['src/pages/NotificationPages.tsx'],
  },
]
const notificationSettingsElements: PageElementSpec[] = [
  {
    name: '通知设置开关组',
    component: 'NotificationSettingsPage 开关列表',
    visual: '按通知类型分组的开关行。',
    dimensions: '行高沿用设置页规范。',
    typography: '标签 14px 左右、说明小号。',
    interaction: '开关仅保存本地偏好；不申请系统通知权限。',
    ui: '复用设置页 ToggleSwitch。',
    dataSource: 'NotificationPages.tsx 与本地偏好状态。',
    dataContent: '固定通知类型与开关状态。',
    evidence: ['src/pages/NotificationPages.tsx'],
  },
]

const byNode = new Map<string, PageElementSpec[]>([
  ['4041:3532', listElements],
  ['4041:3715', listElements],
  ['4041:4068', listElements],
  ['3993:127', tradeElements],
  ['3993:578', tradeElements],
  ['3993:242', tradeElements],
  ['3993:684', tradeElements],
  ['3993:366', tradeElements],
  ['3993:807', tradeElements],
  ['3993:916', tradeElements],
  ['3993:1038', tradeElements],
  ['3993:475', tradeElements],
  ['3681:27399', supportSelectElements],
  ['3681:27585', supportChatElements],
  ['notifications:center', notificationElements],
  ['notifications:settings', notificationSettingsElements],
])

export function getMessageElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return byNode.get(nodeId)
}
