import { DRAFT3_FILE_KEY, type BusinessPageSpec } from './businessPageSpec'

const prototypeBoundary = {
  title: '原型边界',
  items: ['账号资料、认证与安全设置均为本地演示状态；真实资料变更、实名核验、注销与绑定能力以正式账号接口为准。'],
}

const localNote = '该页暂无独立新版设计稿画板；按 Design-Draft3-Pre 组件规范在本地实现。'

export const PROFILE_PAGE_SPECS: readonly BusinessPageSpec[] = [
  {
    nodeId: '3681:28976',
    screenName: '我的 · 游客',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '未登录的“我的”页：登录引导头部、订单中心占位与功能列表。',
    sections: [
      {
        title: '页面结构',
        items: ['头部为品牌区与登录/注册入口，点击进入登录流程并携带返回页。', '订单中心展示各状态占位入口；受保护功能点击先要求登录。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:37368',
    screenName: '我的 · 已登录',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '已登录“我的”页：资料头部、待处理区、订单中心、卖家卡与功能列表。',
    sections: [
      {
        title: '页面结构',
        items: ['头部展示头像、昵称与账号资料入口（3681:31035 基础买家卡、3681:31225 签约中卡、3681:31361 审核中卡按卖家状态切换）。', '有待处理订单时显示“待处理 N 件”区块（3681:31635），点击进入订单列表。', '订单中心四状态入口带数量；功能列表含收藏、足迹、钱包、设置等。'],
      },
      {
        title: '服务号引导',
        items: ['关注微信服务号弹层（3681:37558）展示二维码占位与保存操作，保存仅提示暂不可保存。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4053:8997',
    screenName: '设置',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '账号设置页：通知、隐私、协议与退出登录分组。',
    sections: [
      { title: '页面结构', items: ['分组展示通知设置、隐私与协议中心、账号与安全、关于我们等入口。', '退出登录需二次确认，退出后回到游客状态。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4053:8561',
    screenName: '设置 · 密码',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '设置/修改登录密码：新密码与确认密码校验、结果与异常状态。',
    sections: [
      {
        title: '状态节点',
        items: [
          '初始填写（4053:8561）、倒计时限制（4053:8649）、校验错误（4053:8751）与修改成功（4053:8924）共用一套表单结构。',
          '确认弹窗（4053:8858）展示脱敏手机号；提交中（4053:8894）与失败（4053:8964）为独立弹窗节点。',
        ],
      },
      { title: '校验规则', items: ['密码 8–18 位且包含字母和数字；两次输入一致；验证码 6 位。', '修改成功后清除会话并要求重新登录（与本地原型差异在文档中注明）。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'account-security:home',
    screenName: '账号与安全',
    summary: '账号安全汇总页：资料、手机号、密码、绑定与注销入口。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['列表含头像与昵称、更换手机号、设置密码、第三方绑定与注销账号。', '各项显示当前状态（已设置/未设置），点击进入对应页面。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'account-security:profile',
    screenName: '账号 · 头像与昵称',
    summary: '编辑头像与昵称：默认头像选择、昵称校验与保存。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['头像区支持默认头像选择与修改入口；昵称输入有长度与格式校验。', '保存成功后返回账号与安全页。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'account-security:phone',
    screenName: '账号 · 更换手机号',
    summary: '更换绑定手机号：新手机号与短信验证码校验、确认弹窗。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['输入新手机号与 6 位验证码；验证码带倒计时限制。', '确认更换弹窗展示脱敏新号码；成功后更新本地账号资料。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'settings:bindings',
    screenName: '设置 · 第三方绑定',
    summary: '第三方账号绑定列表：微信服务号等绑定状态与操作。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['按渠道展示绑定状态；当前演示仅提供微信服务号绑定说明。', 'QQ/Apple 等绑定能力待核实，不以演示状态代替。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'settings:cancellation',
    screenName: '设置 · 注销账号',
    summary: '注销账号流程：风险说明、短信验证与确认注销。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['注销前展示风险与数据清理说明。', '需短信验证码确认；确认后清理本地会话并回到游客状态。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'privacy:center',
    screenName: '隐私与协议中心',
    summary: '协议汇总页：用户协议、隐私政策与专项说明入口。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['以列表汇总平台协议入口，正文复用登录协议全文页。', '协议版本与生效日期以正式法务文本为准。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'about:us',
    screenName: '关于我们',
    summary: '关于平台页：品牌介绍、版本信息与运营主体备案说明。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['展示品牌标识、当前版本号与运营主体信息。', '备案与主体信息以正式配置为准，不使用演示值。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4053:8196',
    screenName: '实名认证 · 填写',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '实名认证填写页：姓名与身份证号校验、脱敏预览与提交。',
    sections: [
      { title: '页面结构', items: ['表单含真实姓名与 18 位身份证号，输入即时校验格式。', '提交中展示忙碌弹窗；失败弹窗（4053:8525）保留已填信息并可重试。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4053:8359',
    screenName: '实名认证 · 审核中',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '实名信息已提交、平台核验中的结果态，预计 1 个工作日完成。',
    sections: [
      { title: '状态区', items: ['结果卡显示“认证审核中”与提交时间；审核期间无需重复提交。', '资料区展示脱敏姓名与身份证号，当前状态为“审核中”。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4053:8417',
    screenName: '实名认证 · 结果',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '实名认证成功结果态：认证时间与脱敏资料。',
    sections: [
      { title: '状态区', items: ['结果卡显示“认证成功”，说明可安全交易并展示认证时间。', '认证信息仅展示脱敏结果，暂不支持自行修改。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4053:8467',
    screenName: '实名认证 · 未通过',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '实名认证未通过结果态：未通过原因与重新认证入口。',
    sections: [
      { title: '状态区', items: ['结果卡显示“认证未通过”；未通过原因区说明姓名或身份证号与权威数据源不一致。', '底部提供“返回”与“重新认证”；重新提交前需确认信息一致。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:28588',
    screenName: '钱包 · 总览',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '钱包总览：余额、提现入口与资金记录筛选。',
    sections: [
      { title: '页面结构', items: ['余额卡展示可用余额与“申请提现”入口。', '资金记录按类型与时间筛选，收入/支出分色展示。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'wallet:withdraw',
    screenName: '钱包 · 申请提现',
    summary: '提现页：金额输入、支付宝渠道与短信验证。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['提现金额输入带余额上限校验；当前演示仅支付宝渠道。', '需短信验证码确认；提交结果以 Toast 与记录更新反馈。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'seller:center',
    screenName: '卖家 · 中心',
    summary: '卖家中心：卖家权益、开通引导与在售管理入口。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['展示基础卖家权益与规则说明；未开通时提供个人/企业签约入口。', '开通后进入在售商品管理（原型中由回收与消息页承接）。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'seller:contract-personal',
    screenName: '卖家 · 个人签约',
    summary: '个人卖家签约流程：资料分步填写、证件上传与协议签署。',
    referenceNote: '设计参考：素材/页面Spec设计稿/实现参考/卖家签约.png；签约表单与上传规则在本地实现。',
    sections: [
      { title: '页面结构', items: ['分步填写姓名、身份证号、手机号与紧急联系人，地址按订单截图校正。', '证件图片限 JPG/PNG 且不超过 10MB；勾选协议说明后进入签署。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'seller:contract-business',
    screenName: '卖家 · 企业签约',
    summary: '企业卖家签约流程：企业信息、统一社会信用代码与联系人资料。',
    referenceNote: '与个人签约共用组件规范；企业字段与个体工商户选项在本地实现。',
    sections: [
      { title: '页面结构', items: ['填写企业名称、统一社会信用代码、联系人姓名与手机号。', '支持个体工商户身份选择；提交后进入协议签署。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'fulfillment:contract',
    screenName: '履约 · 合同',
    summary: '履约合同查看与签署页：合同正文、演示签名与确认。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['展示《游戏账号回收协议》正文与签署状态。', '输入本人姓名作为演示签名；签署结果仅更新本地状态。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'reminders:main',
    screenName: '我的 · 提醒',
    summary: '提醒消息列表：未读标记与业务跳转。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['按时间展示提醒，未读带标记，点击跳转对应业务页面。', '提醒数据来自本地消息仓库。'] },
      prototypeBoundary,
    ],
  },
]

const specByNodeId = new Map(PROFILE_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getProfilePageSpec(nodeId: string) {
  return specByNodeId.get(nodeId)
}

/** 我的页状态 → 页面说明节点。 */
export function resolveProfileReviewNodeId(authenticated: boolean): string {
  return authenticated ? '3681:37368' : '3681:28976'
}
