import type { PageElementSpec } from './pageElementSpec'

const PAGE = 'src/pages/AfterSalesPage.tsx'
const MODEL = 'src/components/afterSalesModel.ts'
const PICKER = 'src/components/AfterSaleMaterialPicker.tsx'
const CSS = 'src/styles/aftersales-v2.css'
const REPOSITORY = 'src/repository/afterSaleRepository.ts'

const listHeader: PageElementSpec = {
  name: '售后列表页头与筛选',
  component: 'StatusBar + PageHeader + SearchField + 两组 Tabs',
  visual: '与订单列表一致的页头：返回、“订单”标题与搜索；角色域 Tabs 固定选中“售后”，下方为售后状态筛选胶囊。',
  dimensions: '页头与订单列表同高；状态胶囊沿用订单筛选尺寸（高 32px、圆角 999px）。',
  typography: '标题与筛选字号与订单列表保持一致。',
  interaction: '角色域可切回买入/卖出订单；状态筛选更新 URL 参数；搜索需显式提交。',
  ui: '复用订单列表的双层导航视觉，保持两页切换的一致性。',
  dataSource: 'AfterSalesPage.tsx 与 afterSalesModel.ts 的 AFTERSALE_TABS/countAfterSales/filterAfterSales。',
  dataContent: '售后单数随状态筛选统计；搜索匹配售后单号、订单号、商品与游戏。',
  evidence: [PAGE, MODEL, CSS],
}

const afterSaleCard: PageElementSpec = {
  name: '售后工单卡片',
  component: 'AfterSaleCard（article.aftersales-v2-card）',
  visual: '白底圆角卡片：头部售后单号与状态徽章，商品行（缩略图、标题、游戏区服、订单号、退款金额），售后类型行与状态块，底部更新时间与操作。',
  dimensions: '卡片沿用列表卡间距与圆角；状态块（进度/提示/结果）整行展示。',
  typography: '单号与状态徽章小号加粗；商品标题加粗；金额右对齐强调。',
  interaction: '卡片主体进入售后详情；待审核提供“撤销申请”，待补充提供“补充材料”，其余为查看进度/详情。',
  ui: '状态色调：审核中黄调、已驳回红调、已处理/退款绿调、已撤销灰调；待补充显示浅色提示块。',
  dataSource: 'AfterSalesPage.tsx 的 AfterSaleCard 与 afterSaleRepository.list()。',
  dataContent: '售后单号、商品摘要、售后类型、状态进度（已提交申请 → 客服审核中 → 处理结果）与退款结果。',
  evidence: [PAGE, CSS, REPOSITORY],
}

const statusHero: PageElementSpec = {
  name: '售后状态区（hero）',
  component: 'AfterSaleHero（section.aftersales-status-hero）',
  visual: '状态卡顶部“售后处理中/售后结果”眉标与“等平台/该你了/已关闭/已完成”标记，下方状态标题、说明与三段进度条。',
  dimensions: 'hero 卡为详情页首卡；进度条三段等分，当前步高亮。',
  typography: '状态标题 hero 级；眉标与标记小号；说明 13px 左右。',
  interaction: '纯展示；进度条在待审核与平台处理中状态显示并推进。',
  ui: '按状态切换色调：处理中黄调、驳回红调、完成绿调、撤销灰调。',
  dataSource: 'AfterSalesPage.tsx 的 statusPresentation 与售后记录状态。',
  dataContent: '状态标题、处理说明与进度；不包含用户补充输入内容。',
  evidence: [PAGE, CSS],
}

const escrowNote: PageElementSpec = {
  name: '托管资金提示条',
  component: 'section.aftersales-escrow-note',
  visual: '浅绿底横条：盾牌图标加“¥金额 保持平台托管，不会自动放款”；退款完成后改为退款完成说明。',
  dimensions: '横条沿用订单托管条尺寸（最小高 44px 左右）。',
  typography: '说明 11px 绿调。',
  interaction: '纯展示；在处理中与已退款状态显示不同文案。',
  ui: '绿色安全色系与订单页一致。',
  dataSource: 'AfterSalesPage.tsx 与 formatOrderMoney。',
  dataContent: '退款金额来自售后记录 refundAmountCents。',
  evidence: [PAGE, CSS],
}

const supplementForm: PageElementSpec = {
  name: '补充材料表单',
  component: 'SupplementForm（结果卡 + TextAreaField + AfterSaleMaterialPicker）',
  visual: '“当前处理结果”卡展示客服补证要求，下方“更新售后材料”区含补充说明输入与截图上传网格。',
  dimensions: '说明输入最多 500 字带计数；截图上传网格与申请页一致。',
  typography: '区块标题 section 级；要求文案加粗。',
  interaction: '补充说明 ≥5 字且至少 1 张材料才可提交；上传中或失败禁止提交；提交前弹确认弹窗。',
  ui: '上传失败以行内错误提示，不吞掉失败。',
  dataSource: 'AfterSalesPage.tsx 的 SupplementForm 与 afterSaleRepository.supplement。',
  dataContent: '客服要求文本、用户补充说明与材料文件名；说明为静态备注不回显正文。',
  evidence: [PAGE, PICKER, REPOSITORY],
}

const applyKindField: PageElementSpec = {
  name: '售后类型选择',
  component: 'fieldset.aftersales-kind-field（radio 卡片组）',
  visual: '三张单选卡：协商退款、账号异常、找回申诉，选中卡描边高亮并显示圆形选中点。',
  dimensions: '卡片纵向排列；选中态带描边与内边距。',
  typography: '类型名加粗、说明小号灰。',
  interaction: '单选切换；已有进行中售后时整组禁用。',
  ui: '选中态黄色强调。',
  dataSource: 'AfterSalesPage.tsx 的 AFTERSALE_KINDS。',
  dataContent: '固定三种类型与说明文案。',
  evidence: [PAGE, CSS],
}

const materialPicker: PageElementSpec = {
  name: '售后材料上传',
  component: 'AfterSaleMaterialPicker',
  visual: '截图上传网格：已选项显示文件名与操作，末位为上传入口；失败时行内提示。',
  dimensions: '网格平铺；单个文件项含名称与移除按钮。',
  typography: '文件名小号；提示行内红色。',
  interaction: '选择文件后进入上传状态；失败可重试；上传中禁用提交。',
  ui: '上传状态以禁用与提示表达，不伪造成功。',
  dataSource: 'AfterSaleMaterialPicker.tsx 与页面 onStatusChange 回调。',
  dataContent: '材料文件名列表；演示上传不外传文件内容。',
  evidence: [PICKER, PAGE],
}

const detailActions: PageElementSpec = {
  name: '售后底部操作行',
  component: 'div.aftersales-detail-actions（按钮组）',
  visual: '详情底部双按钮：按状态组合“撤销申请/联系客服”“返回售后/联系客服”“联系客服/重新申请”。',
  dimensions: '双按钮等宽排布；主按钮黄色强调。',
  typography: '按钮 14-15px 加粗。',
  interaction: '撤销与重新申请调用本地仓库并在不可用时 Toast 提示；联系客服进入平台客服会话。',
  ui: '主次按钮沿用平台按钮规范。',
  dataSource: 'AfterSalesPage.tsx 的 AfterSaleDetailPage 与 afterSaleRepository.withdraw/reopen。',
  dataContent: '操作结果以 Toast 反馈；不修改订单履约状态。',
  evidence: [PAGE, REPOSITORY, CSS],
}

const relatedOrder: PageElementSpec = {
  name: '关联订单行',
  component: 'AfterSaleProduct / section.aftersales-related-order',
  visual: '白底行：缩略图、商品标题、游戏区服、订单号与退款金额，右侧箭头。',
  dimensions: '行高按商品行规范；金额右对齐。',
  typography: '标题加粗，单号小号灰。',
  interaction: '点击进入关联订单详情。',
  ui: '与订单卡片商品行保持一致。',
  dataSource: 'AfterSalesPage.tsx 与售后记录关联订单号。',
  dataContent: '商品摘要与订单号，来自售后记录快照。',
  evidence: [PAGE, CSS],
}

const listElements = [listHeader, afterSaleCard]
const applyElements = [applyKindField, materialPicker, relatedOrder]
const detailElements = [statusHero, escrowNote, supplementForm, detailActions, relatedOrder]

const byNode = new Map<string, PageElementSpec[]>([
  ['aftersales:list', listElements],
  ['aftersales:apply', applyElements],
  ['aftersales:detail-review', detailElements],
  ['aftersales:detail-supplement', detailElements],
  ['aftersales:detail-processing', detailElements],
  ['aftersales:detail-rejected', detailElements],
  ['aftersales:detail-refunding', detailElements],
  ['aftersales:detail-closed', detailElements],
])

export function getAftersalesElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return byNode.get(nodeId)
}
