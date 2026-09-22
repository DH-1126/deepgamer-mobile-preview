import type { PageElementSpec } from './pageElementSpec'

const PAGE = 'src/pages/OrderPages.tsx'
const CARD = 'src/components/OrderListCard.tsx'
const MODEL = 'src/components/orderModel.ts'
const HUB = 'src/components/orderHubModel.ts'
const LIST_PRESENTATION = 'src/components/orderListPresentation.ts'
const CSS = 'src/styles/orders-v2.css'
const REPOSITORY = 'src/repository/orderRepository.ts'

const orderListHeader: PageElementSpec = {
  name: '订单列表页头',
  component: 'StatusBar + 返回按钮 + Heading + SearchField + 客服链接',
  visual: '白底页头：左侧返回与“订单”标题，中部浅灰圆角搜索框，右侧黑底黄字圆形客服按钮。',
  dimensions: '页头总高约 142px；标题行高 49px、左右内边距 12px；搜索框高 38px、圆角 12px；客服按钮 34×34px。',
  typography: '标题用页面级 Heading；搜索输入 12px，占位符 #aaa；客服图标 18px。',
  interaction: '返回调用 navigate(-1)；搜索需显式提交才更新 query 参数；客服进入平台客服会话。',
  ui: '搜索框 #f7f7f5 底、1px #EDEDEA 边框；客服按钮沿用品牌黑底黄图标。',
  dataSource: 'OrderPages.tsx 的 OrderListPage 与 useSearchParams；订单数据来自 orderRepository.list() 并按秒刷新倒计时。',
  dataContent: '搜索词、角色与状态参数保存在 URL；订单号、商品名、游戏与区服可被检索。',
  evidence: [PAGE, CSS],
}

const orderDomainTabs: PageElementSpec = {
  name: '角色域标签（买入/卖出/售后）',
  component: 'Tabs variant="underline"',
  visual: '下划线式三段标签：买入、卖出（带计数）、售后；选中项黑字加粗并显示黄色下划线。',
  dimensions: '高度 37px、左右内边距 16px、间距约 26px；选中下划线高 3px、圆角 2px。',
  typography: '标签 15px；计数为 Inter 12px/16px；未选中 #9a9a98，选中加粗。',
  interaction: '切换时导航到 /orders?role=buyer|seller 或 /aftersales，买卖计数实时统计。',
  ui: '底部 0.631px 分隔线与页面共同构成双层导航。',
  dataSource: 'OrderPages.tsx 的 OrderDomainTabs 与 orderHubModel.ts 的 countTradeOrders。',
  dataContent: '买入/卖出显示各自订单总数，售后显示工单数；数字来自本地订单仓库。',
  evidence: [PAGE, HUB, CSS],
}

const orderStatusTabs: PageElementSpec = {
  name: '订单状态筛选',
  component: 'Tabs（胶囊 chips，横向滚动）',
  visual: '灰底描边胶囊：全部、待付款、交易中、待确认、已完成、已取消等；选中态黑底白字。',
  dimensions: '行高 49px、内边距 8px 16px 9px、间距 8px；单个胶囊高 32px、圆角 999px、内边距 0 12px。',
  typography: '胶囊 13px；计数为 Inter 11px/15px，选中态计数 rgba(255,255,255,.62)。',
  interaction: '点击更新 status 查询参数（replace）；角色不同可选状态不同。',
  ui: '支持横向滚动，窄屏不换行；与上层层级形成两级筛选。',
  dataSource: 'OrderPages.tsx 的 OrderListPage 与 orderHubModel.ts 的 BUYER_ORDER_TABS/SELLER_ORDER_TABS。',
  dataContent: '每个胶囊带该状态订单数；全部 Tab 显示当前角色订单总数。',
  evidence: [PAGE, HUB, CSS],
}

const orderTaskSummary: PageElementSpec = {
  name: '待处理摘要卡',
  component: 'section.order-task-summary（黑底摘要）',
  visual: '黑底圆角卡片：左侧黄色圆点标题“需要你处理 · N 件”，下方灰色摘要行。',
  dimensions: '内边距 12px 14px、圆角 14px；圆点 6×6px；摘要行 11px/17px。',
  typography: '标题沿用区块标题层级；摘要 11px，#8c8c8a，首字母白色。',
  interaction: '仅“全部”Tab、无搜索词且有可操作订单时显示；摘要按秒刷新倒计时。',
  ui: '黑底 #17170F 与黄色圆点形成任务提醒对比。',
  dataSource: 'orderHubModel.ts 的 getActionableTradeOrders 与 orderModel.ts 的 formatOrderCountdown。',
  dataContent: '展示待付款/待确认倒计时或待换绑件数；不展示订单明细。',
  evidence: [PAGE, HUB, MODEL, CSS],
}

const orderListCard: PageElementSpec = {
  name: '订单卡片',
  component: 'OrderListCard（article.dg-order-list-card）',
  visual: '白底描边圆角卡片：头部订单号加状态徽章，中部缩略图、标题块、标签与金额，底部操作按钮组。',
  dimensions: '内边距 14px 16px 16px、圆角 14px；头部高 24px；缩略图按列表卡裁切；底部按钮网格 1fr 1fr、间距 8px、高约 44px。',
  typography: '订单号 12px；状态徽章 12px 加粗；标题用标题块组件；金额加粗右对齐。',
  interaction: '整卡商品区进入订单详情；底部按钮按状态展示（去支付、取消订单、进交易群、确认放款、查看打款明细等）。',
  ui: '状态色调：待付款/待确认浅黄，终态灰调；主按钮黄底、进交易群黑底、危险操作红字描边；回收订单带“回收”徽章。',
  dataSource: 'OrderListCard.tsx 与 orderListPresentation.ts 的 getOrderListPresentation；订单数据来自 orderRepository。',
  dataContent: '订单号、商品标题与标签、金额、剩余有效期倒计时、状态说明与操作；倒计时每秒刷新。',
  evidence: [CARD, LIST_PRESENTATION, PAGE, CSS],
}

const payoutDialog: PageElementSpec = {
  name: '打款明细弹窗',
  component: 'Dialog + dl.order-payout-details',
  visual: '居中弹窗列出打款金额、打款状态、订单号、打款时间与交易类型。',
  dimensions: '沿用共享 Dialog 尺寸；行距按 dl 间距排布。',
  typography: '金额行放大强调，其余 13px 左右。',
  interaction: '在已完成回收订单卡片点“查看打款明细”打开；“我知道了”关闭。',
  ui: '复用共享弹窗组件与按钮，不额外新增样式。',
  dataSource: 'OrderPages.tsx 的 payoutOrder 状态与 orderRepository 订单字段。',
  dataContent: '固定演示字段：交易类型“账号回收”、打款状态“已打款”；时间为订单更新时间。',
  evidence: [PAGE, REPOSITORY],
}

const orderHero: PageElementSpec = {
  name: '订单状态区（hero）',
  component: 'section.order-detail-hero（状态标题卡）',
  visual: '进行中状态为浅黄底状态卡：顶部“步骤 N / N + 该你了/等平台”标记、状态标题、说明与倒计时；终态切换为居中灰底图标布局。',
  dimensions: '按钮高 45px、圆角 14px；终态图标 52×52px 圆形；倒计时 time 行随状态显示。',
  typography: '状态标题用 hero 级标题；说明 13px 左右；步骤标记小字。',
  interaction: '按钮按状态切换：待付款为取消/继续支付；待放款为验号不符/确认放款（黑底）；中间态为申请客服介入/进交易群（黑底）。',
  ui: '主按钮黄底黑字，进交易群与确认放款用黑底白字，验号不符红字描边；终态不再提供重购按钮。',
  dataSource: 'OrderPages.tsx 的 OrderDetailPage 与 orderModel.ts 的 getOrderPrimaryMessage、getOrderWorkflowProgress、isOrderReleaseReady。',
  dataContent: '状态标题、等待对象、超时倒计时与按钮组合；不含买家隐私输入。',
  evidence: [PAGE, MODEL, CSS],
}

const orderEscrow: PageElementSpec = {
  name: '资金托管提示条',
  component: 'section.order-escrow（ShieldCheck + 文案）',
  visual: '浅绿底描边横条：盾牌图标加“¥金额 仍在平台托管，未支付给卖家”。',
  dimensions: '最小高 44px、内边距 10px 12px、圆角 10px；图标 15px。',
  typography: '文案 11px，绿色 #2f6a2b。',
  interaction: '纯展示；在已付款至待放款之间的状态显示。',
  ui: '绿色 #f3faf2 底与 #e2f0df 边框表达资金安全。',
  dataSource: 'OrderPages.tsx 的 OrderDetailPage 与 formatOrderMoney。',
  dataContent: '展示订单实付金额；金额来自本地订单数据。',
  evidence: [PAGE, CSS],
}

const orderProgress: PageElementSpec = {
  name: '交易进度时间轴',
  component: 'section.order-progress + ol 垂直时间轴',
  visual: '白底卡片内垂直时间轴：完成节点绿点、当前节点黄底黑描边大圆点、错误节点红点、未到灰点，节点间竖线连接。',
  dimensions: '卡片内边距 15px 16px、圆角 16px；每项最小高 50px；圆点 11px（当前/错误 14px）。',
  typography: '节点标题 14px/18px，当前步加粗；明细小字 Inter 10px/15px 灰。',
  interaction: '纯展示；步骤数量按是否购买包赔为 5 步或 7 步。',
  ui: '绿 #2c8c26、黄 #ffe62a、红 #ef4053 三色状态点。',
  dataSource: 'orderModel.ts 的 getOrderTimeline 与订单 insuranceAmountCents。',
  dataContent: '下单时间、各阶段名称与剩余时间；终态订单收敛为单节点。',
  evidence: [MODEL, PAGE, CSS],
}

const orderProductCard: PageElementSpec = {
  name: '订单信息卡（商品与金额）',
  component: 'section.order-detail-product（ProductRow + dl 明细 + 复制按钮）',
  visual: '白底卡片：商品行（缩略图、标题块、游戏区服、金额）、金额明细（商品价/包赔服务/实付）与订单号复制行。',
  dimensions: '内边距 14px 16px、圆角 16px；明细行最小高 28px；复制按钮高 32px、圆角 999px。',
  typography: '标签 12px #636362；明细值 Inter 11px/16px；实付行 14px 加粗，价格用价格色。',
  interaction: '“复制”把订单号写入剪贴板并以 Toast 反馈成功/失败。',
  ui: '分隔线 #f2f2ef；终态订单卡片透明度降至 0.78。',
  dataSource: 'OrderPages.tsx 的 OrderDetailPage 与 orderRepository；标题块由 product-presentation 解析。',
  dataContent: '商品标题、游戏与区服、三项金额与订单号；不包含账号资料。',
  evidence: [PAGE, CSS],
}

const orderHelp: PageElementSpec = {
  name: '遇到问题入口',
  component: 'Link.order-help',
  visual: '白底横条：左侧“遇到问题？”与常见问题说明，右侧箭头。',
  dimensions: '最小高 66px、内边距 13px 16px、圆角 16px。',
  typography: '标题 14px；说明 10px 灰。',
  interaction: '点击进入平台客服会话。',
  ui: '与订单信息卡同层级卡片样式。',
  dataSource: 'OrderPages.tsx 与 messageFixtures.ts 的 SUPPORT_CONVERSATION_ROUTE。',
  dataContent: '固定文案“卖家迟迟不换绑 · 收到的号与描述不符 · 其他”。',
  evidence: [PAGE, CSS],
}

const checkoutInsurance: PageElementSpec = {
  name: '包赔服务卡',
  component: 'section.insurance-card',
  visual: '白底卡片：头部保险合作标识，中部“包赔服务”说明与服务说明入口，下方“全倍包赔 推荐”选中行。',
  dimensions: '选中行含金额与对勾图标；推荐标签为黄色角标。',
  typography: '标题加粗；说明 12px 左右；赔付上限与保费金额右对齐。',
  interaction: '“服务说明”展示包赔详情；当前默认选中全倍包赔。',
  ui: '盾牌图标与黄黑品牌色表达保障。',
  dataSource: 'OrderPages.tsx 的 OrderCheckoutPage 与 orderRepository 的 insuranceAmountCents。',
  dataContent: '保费金额与最高赔付金额（等于商品价）来自本地订单。',
  evidence: [PAGE, CSS],
}

const checkoutFooter: PageElementSpec = {
  name: '订单确认底栏与风险弹窗',
  component: 'footer.checkout-footer + Dialog.order-risk-dialog',
  visual: '底栏左侧实付金额与明细入口，右侧黄底“立即支付”；确认时弹出找回风险提示弹窗。',
  dimensions: '主按钮通栏高度约 52px；弹窗内警示图标 44px 圆角块。',
  typography: '金额加大加粗；按钮 16px 加粗；弹窗正文 13px/22px。',
  interaction: '点击“立即支付”先弹风险提示；“我已知晓”进入收银台，“返回修改”留在本页。',
  ui: '弹窗内高亮块展示当前包赔方案与最高赔付。',
  dataSource: 'OrderPages.tsx 的 OrderCheckoutPage 与 orderRepository。',
  dataContent: '实付金额、包赔方案与赔付上限；不读取支付渠道信息。',
  evidence: [PAGE, CSS],
}

const cashierCountdown: PageElementSpec = {
  name: '收银台支付方式与倒计时',
  component: 'section.cashier-method-card + PaymentMethods',
  visual: '白底卡片：头部“支付方式”与右侧红色剩余时间；卡内支付宝/微信两个选项，选中项带对勾。',
  dimensions: '选项行沿用支付组件尺寸；头部小字时间右对齐。',
  typography: '渠道名 14px 左右；倒计时小号加粗。',
  interaction: '点选切换支付方式；倒计时按秒刷新，超时后确认按钮禁用。',
  ui: '支付宝蓝、微信绿圆形标识区分渠道。',
  dataSource: 'OrderPages.tsx 的 OrderCheckoutPage（paymentStage）与 formatOrderCountdown。',
  dataContent: '倒计时来自订单 expiresAt；支付方式仅保存在页面状态。',
  evidence: [PAGE, MODEL, CSS],
}

const paymentResultOverlay: PageElementSpec = {
  name: '支付结果浮层',
  component: 'PaymentResultOverlay（role=dialog 全屏浮层）',
  visual: '居中结果卡：成功为绿色对勾图标加金额明细，失败为叉形图标与提示。',
  dimensions: '图标 42-46px；自动跳转约 1 秒。',
  typography: '结果标题 hero 级；明细行小号。',
  interaction: '成功后约 1 秒自动跳转订单详情；失败点击“知道了”返回。',
  ui: '遮罩覆盖收银台，保留订单信息卡背景。',
  dataSource: 'OrderPages.tsx 的 result 参数与 orderRepository.pay 结果。',
  dataContent: '支付金额、订单号与支付时间；均为本地演示支付结果。',
  evidence: [PAGE, REPOSITORY],
}

const cancelReasonList: PageElementSpec = {
  name: '取消原因列表',
  component: 'div.cancel-reason-list（role=radiogroup）',
  visual: '白底圆角单选列表：每项左侧标题加说明，右侧选中对勾。',
  dimensions: '列表项整行可点；底部风险提示条显示“还有 12 人想要”。',
  typography: '标题加粗、说明小号灰色。',
  interaction: '单选切换原因；“确认取消”提交取消并进入取消结果态。',
  ui: '选中项高亮描边与对勾。',
  dataSource: 'OrderPages.tsx 的 PaymentCancelPage 与 orderRepository.cancel。',
  dataContent: '五个固定取消原因与说明；不记录用户额外输入。',
  evidence: [PAGE, CSS],
}

const orderEmpty: PageElementSpec = {
  name: '订单空态与异常',
  component: 'OrderEmpty / error 变体 section',
  visual: '居中“单”字圆形标识加标题说明，异常态为红底“!”并提供重新加载。',
  dimensions: '圆形标识居中；“去逛逛”按钮 112×42px、圆角 12px。',
  typography: '标题 result 级；说明小号灰字。',
  interaction: '“去逛逛”进入游戏专区；异常态“重新加载”清除 scenario 参数。',
  ui: '黄底按钮引导浏览，异常态红底警示。',
  dataSource: 'OrderPages.tsx 的 OrderEmpty 与 scenario 查询参数。',
  dataContent: '按是否存在搜索词区分“暂无订单/没有匹配的订单”。',
  evidence: [PAGE, CSS],
}

const detailElements = [orderHero, orderEscrow, orderProgress, orderProductCard, orderHelp, orderEmpty]
const listElements = [orderListHeader, orderDomainTabs, orderStatusTabs, orderTaskSummary, orderListCard, payoutDialog, orderEmpty]
const checkoutElements = [checkoutInsurance, checkoutFooter]
const cashierElements = [cashierCountdown, paymentResultOverlay]
const cancelElements = [cancelReasonList]
const resultElements = [paymentResultOverlay]

const byNode = new Map<string, PageElementSpec[]>([
  ['3977:3318', listElements],
  ['orders:detail-pending', detailElements],
  ['3964:663', detailElements],
  ['orders:detail-verifying', detailElements],
  ['orders:detail-trading', detailElements],
  ['3964:1179', detailElements],
  ['3964:1361', detailElements],
  ['3964:1522', detailElements],
  ['orders:detail-terminal', detailElements],
  ['orders:checkout', checkoutElements],
  ['orders:cashier', cashierElements],
  ['orders:cancel', cancelElements],
  ['orders:payment-result', resultElements],
])

export function getOrderElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return byNode.get(nodeId)
}
