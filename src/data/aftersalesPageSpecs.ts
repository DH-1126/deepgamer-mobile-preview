import { designImageNote, type BusinessPageSpec } from './businessPageSpec'

const prototypeBoundary = {
  title: '原型边界',
  items: ['售后记录由本地 afterSaleRepository 提供，审核、驳回与退款结果均为演示流程；真实售后资格、时限与退款渠道以后台规则为准。'],
}

export const AFTERSALES_PAGE_SPECS: readonly BusinessPageSpec[] = [
  {
    nodeId: 'aftersales:list',
    screenName: '售后 · 工单列表',
    summary: '售后工单列表：与订单列表共用页头，按状态筛选售后单并展示审核进度卡片。',
    referenceNote: designImageNote('09-售后入口与工单列表卡片.png', '本页对应工单列表四态卡片（待客服审核、待补充说明、已驳回、已处理）；售后入口位于订单列表已完成卡片的“申请售后”按钮。'),
    sections: [
      {
        title: '页面结构',
        items: [
          '页头与订单列表一致：返回、“订单”标题、搜索框；角色域 Tabs 固定选中“售后”并显示工单数。',
          '状态筛选为“全部 / 审核中 / 待补充 / 已驳回 / 已完成”等 chips。',
        ],
      },
      {
        title: '工单卡片',
        items: [
          '卡片头部为售后单号与状态徽章（审核中黄调、已驳回红调、已处理绿调、已撤销灰调）。',
          '卡片中部为商品行（缩略图、标题、游戏区服、订单号、退款金额）与售后类型行。',
          '待补充状态显示“平台需要你补充协商记录”提示块；审核中显示三段进度（已提交申请 → 客服审核中 → 处理结果）。',
          '底部按状态提供“撤销申请”“补充材料”“查看进度 / 查看详情”操作。',
        ],
      },
      { title: '空与异常', items: ['无售后记录或无匹配时显示空态；scenario=error 演示加载失败并可重试。', '列表底部说明“售后 Tab 沿用同一订单号，最终状态以售后详情为准”。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:apply',
    screenName: '申请客服介入',
    summary: '从订单进入的售后申请页：异常提示、关联订单、售后类型、描述与材料上传。',
    referenceNote: '新版设计图未包含独立申请页画板；本页按售后详情交互与 Design-Draft3-Pre 组件规范在本地实现。',
    sections: [
      {
        title: '页面结构',
        items: [
          '顶部异常提示区说明当前问题（订单履约遇到问题 / 卖家已超时未换绑 / 已完成订单申请售后）与资金托管状态。',
          '关联订单卡可跳转订单详情；该订单已有进行中售后时整表单禁用并提供“查看现有申请”。',
          '售后类型为三选一：协商退款、账号异常、找回申诉。',
        ],
      },
      {
        title: '提交规则',
        items: [
          '问题描述至少 10 个字，最多 500 字并显示计数；材料至少上传 1 张。',
          '材料上传失败或进行中时禁止提交并提示；提交前弹出确认弹窗展示类型、材料数与订单号。',
        ],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:detail-review',
    screenName: '售后详情 · 待客服审核',
    summary: '售后申请已提交、等待客服审核的详情页，含三段进度与托管说明。',
    referenceNote: designImageNote('05-售后详情-审核与补充资料.png', '本页对应初次待客服审核与补充后再审状态；审核中详情页顶部为状态 hero 加进度条。'),
    sections: [
      {
        title: '状态区',
        items: ['状态 hero 显示“售后处理中 / 等平台 / 待客服审核”，补充材料再次提交后说明改为重新审核。', '进度条为“已提交 → 客服审核中 → 处理结果”，当前步高亮。'],
      },
      { title: '内容与操作', items: ['绿色托管条说明退款金额保持平台托管、不会自动放款。', '操作行为“撤销申请”与“联系客服”；撤销后进入已撤销终态。', '当前处理结果卡、售后类型、当前材料与关联订单依次展示。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:detail-supplement',
    screenName: '售后详情 · 待补充资料',
    summary: '客服要求补充材料的详情页：补证说明、补充说明输入与新材料上传。',
    referenceNote: designImageNote('05-售后详情-审核与补充资料.png', '本页对应“要求补证 / 待补充说明”状态，处理结果卡展示客服要求。'),
    sections: [
      {
        title: '状态区',
        items: ['状态 hero 显示“售后处理中 / 该你了 / 待补充资料”。', '处理结果卡展示“处理方案 · 要求补证”与客服说明、处理时间。'],
      },
      {
        title: '补充提交',
        items: ['补充说明至少 5 个字，材料至少 1 张，上传失败时禁止提交。', '提交前确认弹窗显示补充说明与材料数；提交后重新进入客服审核。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:detail-processing',
    screenName: '售后详情 · 平台处理中',
    summary: '审核通过后平台正在处理的过渡状态详情页。',
    referenceNote: designImageNote('05-售后详情-审核与补充资料.png', '平台处理中与审核态共用画板结构，进度条推进至“平台处理中”。'),
    sections: [
      { title: '状态区', items: ['状态 hero 显示“售后处理中 / 等平台 / 平台处理中”，进度条当前步为平台处理中。', '说明文案提示处理完成后会同步结果。'] },
      { title: '内容与操作', items: ['操作行为“返回售后”与“联系客服”，无撤销入口。', '托管条继续显示资金保持平台托管。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:detail-rejected',
    screenName: '售后详情 · 已驳回',
    summary: '售后申请被驳回的终态详情页，提供重新申请引导。',
    referenceNote: designImageNote('06-售后详情-已驳回与已处理.png', '本页对应已驳回状态；驳回结果卡与重新申请按钮保持原图交互。'),
    sections: [
      { title: '状态区', items: ['状态 hero 显示“售后结果 / 已关闭 / 已驳回”，说明客服已驳回本次申请。', '驳回提示建议补齐证明后再提交以提高通过率。'] },
      { title: '内容与操作', items: ['最终处理结果卡展示驳回结论、当前材料与关联订单。', '操作行为“联系客服”与“重新申请”；重新申请回到待客服审核。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:detail-refunding',
    screenName: '售后详情 · 已退款',
    summary: '售后退款完成的终态详情页，展示退款金额、方式与时间。',
    referenceNote: designImageNote('06-售后详情-已驳回与已处理.png', '本页对应已处理且发生退款的终态；退款卡展示金额与退款方式。'),
    sections: [
      { title: '状态区', items: ['状态 hero 显示“售后结果 / 已完成 / 已退款”。', '退款卡展示退款状态、金额、方式（默认原路退回）与退款时间；托管条说明资金已退回、卖家未收到货款。'] },
      { title: '内容与操作', items: ['操作行为“联系客服”与“重新申请”。', '列表卡片同步显示“已退款 ¥金额”结果块。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'aftersales:detail-closed',
    screenName: '售后详情 · 已处理与已撤销',
    summary: '售后处理完成或用户主动撤销的终态详情页。',
    referenceNote: designImageNote('06-售后详情-已驳回与已处理.png', '已处理不发生退款时展示处理结论；已撤销为本地补充状态，无独立画板。'),
    sections: [
      { title: '状态区', items: ['已处理：状态 hero 显示“售后结果 / 已完成 / 已处理”，结果卡展示处理结论。', '已撤销：状态 hero 显示“售后结果 / 已关闭 / 已撤销”，说明可重新申请。'] },
      { title: '内容与操作', items: ['操作行为“联系客服”与“重新申请”。', '关联订单与材料记录保留可查。'] },
      prototypeBoundary,
    ],
  },
]

const specByNodeId = new Map(AFTERSALES_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getAftersalesPageSpec(nodeId: string) {
  return specByNodeId.get(nodeId)
}

/** 售后记录状态 → 页面说明节点。 */
export function resolveAftersalesDetailNodeId(status: string, reviewStage?: string): string {
  if (status === 'pending_review') return 'aftersales:detail-review'
  if (status === 'supplement') return 'aftersales:detail-supplement'
  if (status === 'platform_processing') return 'aftersales:detail-processing'
  if (status === 'rejected') return 'aftersales:detail-rejected'
  if (status === 'refunding') return 'aftersales:detail-refunding'
  return 'aftersales:detail-closed'
}
