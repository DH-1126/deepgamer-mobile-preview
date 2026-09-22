import { DRAFT3_FILE_KEY, designImageNote, type BusinessPageSpec } from './businessPageSpec'

const prototypeBoundary = {
  title: '原型边界',
  items: ['会话与消息均为本地演示数据；真实未读、消息类型、成员权限与履约状态由 IM 服务与订单接口决定，发送失败时内容保留并可重试。'],
}

export const MESSAGE_PAGE_SPECS: readonly BusinessPageSpec[] = [
  {
    nodeId: '4041:3532',
    screenName: '消息 · 全部',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '消息中心默认 Tab：客服置顶，交易群与回收咨询按更新时间混排。',
    referenceNote: undefined,
    sections: [
      {
        title: '页面结构',
        items: ['页头为“消息”大标题与搜索框；下方式“全部 / 交易群 / 回收群”下划线 Tabs。', '平台客服会话固定置顶；点击客服行先弹出咨询方向选择弹层。'],
      },
      {
        title: '会话行',
        items: ['交易群行显示头像、标题、最后一条消息、相对时间与未读角标，可带订单状态标签。', '回收咨询行显示回收商名称、游戏、状态与最新消息；混排时额外显示类型徽章。'],
      },
      { title: '空与异常', items: ['加载中与加载失败分别显示状态行，失败可重试。', '搜索无匹配时显示“没有匹配的订单或商品消息”。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4041:3715',
    screenName: '消息 · 交易群',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '交易群会话 Tab：按需要我处理、进行中、已完成/已关闭分组排列。',
    sections: [
      {
        title: '分组规则',
        items: ['会话按待办状态分为“需要我处理”“进行中”“已完成/已关闭”三组。', '有历史预览的已关闭会话排在最前，其余按更新时间排列。'],
      },
      { title: '会话行', items: ['行内可展示关联订单的状态与金额；点击进入交易群履约界面。', '未读会话保留角标，进入群内自动清除。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4041:4068',
    screenName: '消息 · 回收群',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '回收咨询 Tab：集中展示回收咨询会话，支持从空态发起咨询。',
    referenceNote: designImageNote('10-消息列表-交易群与回收咨询.png', '本 Tab 对应回收咨询列表；回收会话行带回收标识与咨询状态。'),
    sections: [
      {
        title: '会话行',
        items: ['每行展示回收商、游戏、咨询状态（咨询中、待决定、待确认、已完成、已结束等）与最新消息。', '点击标记已读并进入回收咨询详情。'],
      },
      { title: '空态', items: ['无回收咨询时显示“暂无回收咨询”并提供“咨询回收商”入口跳转回收首页。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:127',
    screenName: '交易群 · 资料同步（卖家）',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '卖家视角资料同步阶段：填写账号与初始密码并提交，买家随后开始验号。',
    referenceNote: designImageNote('11-交易消息-资料同步与提交状态.png', '资料同步表单与提交确认弹层对应新版设计图的资料填写与等待同步状态。'),
    sections: [
      {
        title: '页面结构',
        items: ['顶部为返回、群标题与订单摘要条（缩略图、标题、订单号、金额），点击进入订单详情。', '进度条显示“步骤 N / 总数”与当前阶段名；消息区含托管到账系统提示与阶段任务卡。'],
      },
      {
        title: '阶段任务卡',
        items: ['卖家在任务卡内填写“账号 *”“初始密码 *”两个必填字段后触发“资料同步”。', '提交前弹出“确认提交资料”底部弹层；提示提交后买家开始验号。', '安全提示条要求群内禁止发送手机号，换绑手机号在换绑环节表单提交。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:578',
    screenName: '交易群 · 资料同步（买家）',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买家视角资料同步阶段：等待卖家同步资料，可催卖家与催客服。',
    sections: [
      { title: '阶段任务卡', items: ['任务卡标题“等卖家同步资料”，说明卖家正在填写账号与初始密码。', '买家无主操作按钮，底部提供“催卖家”“催客服”提醒（10 秒冷却）。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:242',
    screenName: '交易群 · 验号（卖家）',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '卖家视角验号阶段：资料已同步，等待买家核对账号。',
    sections: [
      { title: '阶段任务卡', items: ['任务卡提示“等买家验号”，说明验号期间不要登录或修改账号。', '客服气泡提醒卖家等待买家核对。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:684',
    screenName: '交易群 · 验号（买家）',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买家视角验号阶段：查看账号资料、登录核对并确认验号完成。',
    referenceNote: designImageNote('12-交易消息-验号与完成按钮状态.png', '资料卡与“验号完成”按钮状态对应新版设计图的验号与完成按钮状态。'),
    sections: [
      {
        title: '资料卡',
        items: ['“卖家提交的账号资料”卡内账号与初始密码默认掩码，点击“查看”逐项显示、再点“收起”。', '验号注意事项提醒可二次实名、交易中勿修改绑定信息。'],
      },
      {
        title: '阶段任务卡',
        items: ['买家核对完成后点击“验号完成”，确认弹层提示此后不能再以资产不符为由退单。', '确认后进入换绑阶段并弹出换绑手机号填写弹层；发现不符点“异常”反馈。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:366',
    screenName: '交易群 · 换绑（卖家）',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '卖家视角换绑阶段：按买家手机号完成换绑并点击“换绑完成”。',
    sections: [
      {
        title: '换绑手机号卡',
        items: ['展示买家提交的换绑手机号（脱敏），卖家可查看演示号码。', '提示换绑前先删除账号内人脸等身份信息，并按平台风控要求间隔操作。'],
      },
      { title: '阶段任务卡', items: ['卖家换绑完成后点击“换绑完成”，确认弹层提示不要在买家核对期间登录账号。', '绿色托管条说明买家货款在平台托管，确认后结算给卖家。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:807',
    screenName: '交易群 · 换绑（买家）',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买家视角换绑阶段：提交换绑手机号并等待卖家操作。',
    sections: [
      { title: '换绑手机号卡', items: ['买家未提交时显示“未填写”，点击“填写”在弹层输入 11 位手机号。', '提交后显示脱敏号码并可修改。'] },
      { title: '阶段任务卡', items: ['任务卡提示卖家正在按你的手机号换绑，完成后收到核对提醒。', '底部提供催卖家与催客服。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:916',
    screenName: '交易群 · 待放款',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买家确认放款阶段：交付核对清单、自动放款倒计时与确认放款。',
    referenceNote: designImageNote('12-交易消息-验号与完成按钮状态.png', '交付核对与确认放款按钮对应新版设计图的完成按钮状态。'),
    sections: [
      {
        title: '交付核对卡',
        items: ['核对项为账号资料一致、已换绑至你的手机号、资产与协商内容一致，前两项已完成。', '任务卡显示“72小时后系统自动确认”倒计时与托管金额提示。'],
      },
      {
        title: '主要操作',
        items: ['“确认放款”弹层展示放款金额，确认后资金立即结算给卖家且不可撤销。', '发现问题时点“验号不符”进入异常反馈，交易暂停由客服介入。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:1038',
    screenName: '交易群 · 已暂停',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '异常反馈后的暂停状态：履约按钮停用，等待平台客服处理。',
    referenceNote: designImageNote('20-聊天公共组件-提示气泡与只读状态.png', '暂停提示与只读状态对应新版设计图的聊天公共组件。'),
    sections: [
      { title: '状态区', items: ['暂停提示块显示“你已提交异常 · 交易已暂停”与问题类型。', '系统提示客服主管已接入，客服气泡说明由主管跟进。'] },
      { title: '操作约束', items: ['任务卡说明验号、换绑、放款按钮在处理完成前不可操作。', '可点击“查看异常”回看问题类型与描述；资金保持平台托管。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3993:475',
    screenName: '交易群 · 已完成/已关闭',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '交易完成或关闭的只读群：完成卡片与只读输入栏。',
    referenceNote: designImageNote('20-聊天公共组件-提示气泡与只读状态.png', '完成后保留群 7 天、底栏只读对应新版设计图只读状态。'),
    sections: [
      { title: '完成状态', items: ['完成卡片显示交易完成、结算金额、确认放款时间与售后有效期。', '客服气泡说明群保留 7 天，有问题可在群内咨询。'] },
      { title: '只读约束', items: ['输入栏置灰显示“会话已关闭”，不再允许发送消息或图片。', '已关闭会话从消息列表进入时顶部显示“会话已关闭 · 交易已完成”。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:27399',
    screenName: '客服 · 咨询选择',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '客服咨询入口选择页：FAQ、账号咨询与商品咨询三个方向。',
    sections: [
      { title: '页面结构', items: ['顶部为客服品牌区与搜索入口，下方为咨询方向大卡片。', '三个方向：FAQ 问答、王者荣耀账号咨询、商品咨询，分别携带上下文进入聊天。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:27585',
    screenName: '客服 · 会话',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '客服聊天页：会话头、消息流、快捷回复与设置入口。',
    sections: [
      { title: '页面结构', items: ['头部为返回、客服名称与设置入口；消息流展示双方消息与本地图片预览。', '底部输入栏支持文字与图片，遇到演示场景提供快捷回复。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'notifications:center',
    screenName: '通知中心',
    summary: '系统通知列表：未读标记、分类查看与跳转。',
    referenceNote: '新版设计图未包含通知中心画板；本页按 Design-Draft3-Pre 组件规范在本地实现。',
    sections: [
      { title: '页面结构', items: ['顶部标题“消息”与未读说明，通知按时间排列并标记未读。', '点击通知跳转对应业务页面并清除未读。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'notifications:settings',
    screenName: '通知设置',
    summary: '消息通知偏好设置：各类通知开关分组。',
    referenceNote: '新版设计图未包含通知设置画板；本页按 Design-Draft3-Pre 组件规范在本地实现。',
    sections: [
      { title: '页面结构', items: ['标题“通知设置”，按交易、系统等分组展示开关。', '开关仅保存本地偏好，不代表已取得系统通知权限。'] },
      prototypeBoundary,
    ],
  },
]

const specByNodeId = new Map(MESSAGE_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getMessagePageSpec(nodeId: string) {
  return specByNodeId.get(nodeId)
}

/** 交易群阶段与角色 → 页面说明节点，与 TradeChatPage 内嵌 data-node-id 一致。 */
export function resolveTradeChatNodeId(phase: string, role: 'buyer' | 'seller'): string {
  if (phase === 'materials') return role === 'seller' ? '3993:127' : '3993:578'
  if (phase === 'inspection') return role === 'seller' ? '3993:242' : '3993:684'
  if (phase === 'binding') return role === 'seller' ? '3993:366' : '3993:807'
  if (phase === 'release') return '3993:916'
  if (phase === 'paused') return '3993:1038'
  return '3993:475'
}
