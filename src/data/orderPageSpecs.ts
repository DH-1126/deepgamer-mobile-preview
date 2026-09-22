import { DRAFT3_FILE_KEY, designImageNote, type BusinessPageSpec } from './businessPageSpec'

const prototypeBoundary = {
  title: '原型边界',
  items: ['订单、倒计时与支付结果均来自本地 orderRepository 演示数据；真实订单状态、扣款与超时规则以正式业务接口为准，原型不会连接支付机构。'],
}

const designSource = {
  title: '设计对照',
  items: ['订单详情整体框架对照 Figma Design-Draft3-Pre 对应画板；状态文案、按钮组合与金额样式按 2026-09-07 新版设计图与 2026-09-18 订单按钮状态差异清单核对。'],
}

export const ORDER_PAGE_SPECS: readonly BusinessPageSpec[] = [
  {
    nodeId: '3977:3318',
    screenName: '订单 · 列表',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买卖订单的统一列表：角色域切换、状态筛选、订单搜索、待处理摘要与十态订单卡片。',
    sections: [
      {
        title: '页面结构',
        items: [
          '顶部一行为返回按钮、“订单”标题、订单搜索框与平台客服圆形入口。',
          '第二层“买入 / 卖出 / 售后”角色域 Tabs：买入与卖出显示订单数，售后跳转售后列表。',
          '第三层状态筛选 chips 按角色不同（买家：全部、待付款、交易中、待确认、已完成、已取消；卖家：全部、待换绑、交易中、待确认、已完成、已关闭），选中态为黑底白字。',
        ],
      },
      {
        title: '订单卡片',
        items: [
          '卡片头部为订单号与状态徽章；中部为缩略图、商品标题（标题块）、标签与金额；底部按状态展示一或两颗操作按钮。',
          '待付款卡片显示剩余有效期倒计时；待确认卡片显示未确认自动放款倒计时；倒计时按秒刷新。',
          '回收类订单卡片带“回收”徽章，已完成时可打开“打款明细”弹窗。',
          '卡片十态样式以 2026-09-07 新版设计图 07/08 为准，优先于 Figma 旧简版卡片。',
        ],
      },
      {
        title: '待处理摘要',
        items: [
          '“全部”Tab 且无搜索词时，顶部显示黑底“需要你处理 · N 件”摘要卡。',
          '买家摘要列出待付款与待确认倒计时；卖家摘要列出待换绑订单。',
        ],
      },
      {
        title: '空与异常',
        items: [
          '无订单或无匹配时展示“暂无订单 / 没有匹配的订单”空态，并提供“去逛逛”入口。',
          'scenario=error 演示订单加载失败，可点击“重新加载”恢复。',
        ],
      },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: 'orders:detail-pending',
    screenName: '订单详情 · 待付款',
    summary: '买家下单未付款的订单详情：黄底状态区、支付倒计时与取消/继续支付操作。',
    referenceNote: designImageNote('01-订单详情-待支付与待资料同步.png', '本页对应左屏待付款状态；状态区文案“待支付”与超时自动取消提示保持原图。'),
    sections: [
      {
        title: '状态区',
        items: [
          '黄底状态区显示“待支付”标题与“超时未付将自动取消订单并释放该商品”说明。',
          '下方 time 行按秒显示“还剩 HH:MM:SS”支付倒计时。',
        ],
      },
      {
        title: '主要操作',
        items: ['操作行提供“取消订单”（白底）与“继续支付”（黄底主按钮）。', '取消进入原因选择页；继续支付进入订单确认页。'],
      },
      { title: '交易进度与信息', items: ['时间轴首步“已下单 · 等待付款”为当前步，后续步骤置灰。', '订单信息卡展示商品价、包赔服务、实付与订单号复制。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: '3964:663',
    screenName: '订单详情 · 待资料同步',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买家已付款、等待卖家同步账号资料的订单详情，买卖双方文案随角色变化。',
    sections: [
      {
        title: '状态区',
        items: [
          '状态区显示“步骤 1 / N”与“等平台”标记（卖家视角为资料同步提示）。',
          '标题“待资料同步”；买家视角说明卖家正在同步资料，卖家视角提示按交易群指引同步账号资料。',
        ],
      },
      {
        title: '主要操作',
        items: ['该状态下操作行为“申请客服介入”（白底）与“进交易群”（黑底白字）。', '点击“进交易群”携带订单号与角色进入交易群履约流程。'],
      },
      { title: '资金与进度', items: ['绿色资金托管条显示订单金额仍在平台托管，未支付给卖家。', '时间轴按是否购买包赔展示 5 步或 7 步流程。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: 'orders:detail-verifying',
    screenName: '订单详情 · 待买家验号',
    summary: '卖家资料已同步、买家核对账号资料的订单详情，验号完成后进入换绑。',
    referenceNote: designImageNote('02-订单详情-验号中与待确认完成.png', '本页对应左屏验号中状态；验号操作主入口在交易群，详情页提供进群与客服入口。'),
    sections: [
      {
        title: '状态区',
        items: ['标题买家视角为“请核对账号资料”，卖家视角为“等待买家验号”。', '买家标记“该你了”，卖家标记“等平台”。'],
      },
      { title: '主要操作', items: ['操作行为“申请客服介入”与“进交易群”，验号动作在交易群内完成。', '买家在交易群确认验号完成后订单进入换绑阶段。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: 'orders:detail-trading',
    screenName: '订单详情 · 换绑与投保中',
    summary: '换绑中、签署完成、投保中等中间履约状态的订单详情，操作以进交易群为主。',
    referenceNote: '新版设计图未单独交付换绑中画板；本组状态复用详情页框架，具体动作在交易群（对应 2026-09-07 新版设计图 11-13 交易消息）。卖家视角换绑中显示“完成换绑”主按钮。',
    sections: [
      {
        title: '状态区',
        items: ['换绑中：卖家标题“该你换绑”并显示换绑资料倒计时；买家标题“等卖家换绑”。', '签署完成、投保中、投保成功按时间轴逐步推进，操作行保持“申请客服介入 + 进交易群”。'],
      },
      { title: '主要操作', items: ['卖家换绑中可点击“完成换绑”推进订单。', '订单被售后暂停时操作按钮不可用，状态区显示暂停说明。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: '3964:1179',
    screenName: '订单详情 · 待放款',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '换绑与保障流程完成、等待买家确认放款的订单详情，含自动放款倒计时。',
    sections: [
      {
        title: '状态区',
        items: ['买家标题“待你确认放款”，显示“未确认将自动放款”倒计时；卖家标题“等买家确认放款”。', '买家标记“该你了”。'],
      },
      {
        title: '主要操作',
        items: [
          '按 2026-09-18 差异清单 D01：操作行为白底“进交易群”＋黑底白字“确认放款”；左侧另有红字描边“验号不符”进入售后申请。',
          '“确认放款”成功后订单完成并同步交易群；交易暂停时提示不可放款。',
        ],
      },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: '3964:1361',
    screenName: '订单详情 · 已完成',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '交易完成的终态订单详情：浅绿完成态状态区与小尺寸联系客服入口。',
    sections: [
      {
        title: '状态区',
        items: ['按差异清单 D02：完成态使用独立的完成样式，不再显示“等平台”等待提示。', '标题“交易完成”，说明平台交易流程已完成。'],
      },
      { title: '主要操作', items: ['按差异清单 D03：操作行为小尺寸白底“联系客服”，不再提供通栏黄色返回按钮。', '时间轴全部置为完成态。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: '3964:1522',
    screenName: '订单详情 · 已关闭',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '交易关闭的终态订单详情：灰色终态信息区，无重购按钮。',
    sections: [
      {
        title: '状态区',
        items: ['按差异清单 D04：灰色终态样式显示“交易已关闭”，不复用支付失败或重新购买布局，也不提供“看看相似商品 / 重新购买”。', '关闭原因与资金处理规则在说明文案中给出。'],
      },
      { title: '信息展示', items: ['商品信息卡降低透明度，时间轴收敛为终态错误节点。', '仍保留联系客服入口。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: 'orders:detail-terminal',
    screenName: '订单详情 · 支付超时与已取消',
    summary: '支付超时或买家主动取消的终态订单详情，居中图标与终态说明。',
    referenceNote: designImageNote('04-订单详情-超时与取消.png', '本页对应超时与取消两态；按差异清单 D04 要求，关闭态不加重购按钮。'),
    sections: [
      {
        title: '状态区',
        items: ['支付超时显示“支付超时，订单已关闭”，说明未产生费用、商品已重新开放购买。', '已取消显示“订单已取消”，说明取消已完成、不会扣款。'],
      },
      { title: '信息展示', items: ['终态状态区居中展示图标与标题，商品信息卡降低透明度。', '时间轴收敛为单个错误节点。'] },
      prototypeBoundary,
      designSource,
    ],
  },
  {
    nodeId: 'orders:checkout',
    screenName: '订单确认',
    summary: '下单后的订单确认页：商品摘要、包赔服务选择、优惠券与支付协议。',
    referenceNote: '新版设计图未包含独立订单确认画板；本页按 Design-Draft3-Pre 组件规范在本地实现，包赔卡与风险弹窗沿用平台黄黑视觉。',
    sections: [
      {
        title: '页面结构',
        items: ['顶部为商品摘要卡（缩略图、标题块、金额）与“还有 12 人想要”提示。', '包赔服务卡展示“全倍包赔 推荐”及最高赔付金额，默认选中。', '优惠券行为“暂无可用优惠券”；底部为协议勾选说明与实付金额。'],
      },
      {
        title: '主要操作',
        items: ['底部主按钮“立即支付”先触发“风险提示”弹窗（找回风险与赔付方案）。', '弹窗确认“我已知晓”后进入收银台；订单非待付款时按钮显示当前状态并禁用。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'orders:cashier',
    screenName: '收银台',
    summary: '确认支付页：订单信息、支付倒计时、支付方式与本地演示支付结果。',
    referenceNote: '新版设计图未包含交易订单收银台画板；布局对齐回收确认支付页（新版设计图 18），支付结果浮层为本地演示。',
    sections: [
      {
        title: '页面结构',
        items: ['订单信息卡显示“交易订单支付”、实付金额与订单号。', '支付方式卡头部按秒显示“剩余 HH:MM:SS”倒计时，卡内可选支付宝或微信。', '支付说明明确当前为本地安全演示，不会连接支付机构。'],
      },
      {
        title: '主要操作',
        items: ['底部“返回”回到订单确认，“确认支付 ¥金额”完成本地支付。', '支付成功显示全屏成功浮层并在约 1 秒后跳转订单详情；订单超时显示过期浮层。', '订单状态变化时页面内提示“订单状态已变化，请返回订单列表确认”。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'orders:cancel',
    screenName: '取消订单',
    summary: '取消订单的原因选择与取消结果页，保留商品摘要与风险提示。',
    referenceNote: '新版设计图未包含取消原因画板；本页按 Design-Draft3-Pre 组件规范在本地实现。',
    sections: [
      {
        title: '原因选择',
        items: ['radiogroup 列出五个取消原因（找到更合适的号、价格太高了、账号信息与描述不符、担心交易风险、不想买了 / 其他）。', '底部提示“还有 12 人想要，该商品可能随时被其他买家买走”。'],
      },
      { title: '结果与操作', items: ['确认取消后标题切换为“取消结果”，显示“订单已取消”且不会扣款。', '结果页提供“返回订单”与“继续逛逛”；未取消前提供“确认取消”与“继续支付”。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'orders:payment-result',
    screenName: '支付结果',
    summary: '支付回流结果页：按订单状态展示支付成功、失败或未完成。',
    referenceNote: '新版设计图未包含支付回流画板；结果判定逻辑与文案在本地实现，正式结果应由支付回流核实。',
    sections: [
      {
        title: '状态判定',
        items: ['订单进入已支付及后续状态时展示支付成功浮层并跳转订单详情。', '订单支付超时展示支付失败浮层；其他状态显示“支付未完成”并给出当前订单状态。'],
      },
      { title: '原型边界', items: ['本页仅按本地订单状态渲染结果，不代表真实支付渠道回调；正式实现必须以支付回流核实结果。'] },
    ],
  },
]

const specByNodeId = new Map(ORDER_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getOrderPageSpec(nodeId: string) {
  return specByNodeId.get(nodeId)
}

/** 订单详情状态 → 页面说明节点。Figma 节点仅使用已核实画板，其余回落本地说明。 */
export function resolveOrderDetailNodeId(status: string): string {
  if (status === 'pending') return 'orders:detail-pending'
  if (status === 'paid') return '3964:663'
  if (status === 'verifying') return 'orders:detail-verifying'
  if (['binding', 'signed', 'insuring', 'insured'].includes(status)) return 'orders:detail-trading'
  if (status === 'bind_success') return '3964:1179'
  if (status === 'completed') return '3964:1361'
  if (status === 'closed') return '3964:1522'
  return 'orders:detail-terminal'
}
