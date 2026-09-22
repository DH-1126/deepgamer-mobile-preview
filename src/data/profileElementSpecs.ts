import type { PageElementSpec } from './pageElementSpec'

const PROFILE_PAGE = 'src/pages/ProfilePage.tsx'
const SETTINGS_PAGE = 'src/pages/ProfileSettingsPages.tsx'
const REALNAME_PAGE = 'src/pages/RealNamePage.tsx'
const WALLET_PAGE = 'src/pages/WalletPages.tsx'
const IDENTITY_PAGE = 'src/pages/ProfileIdentityPages.tsx'
const SELLER_PAGE = 'src/pages/SellerContractPages.tsx'
const FULFILLMENT_PAGE = 'src/pages/FulfillmentContractPage.tsx'
const REMINDER_PAGE = 'src/pages/ReminderPage.tsx'

const profileHeader: PageElementSpec = {
  name: '我的页头部',
  component: 'profile-v2-header / guest-header（头像 + 昵称 + 资料入口）',
  visual: '已登录：头像、昵称与账号资料入口，下方按卖家状态切换卖家卡（基础买家/签约中/审核中）；游客：品牌区与登录注册按钮。',
  dimensions: '头部沿用我的页高度；头像圆形大尺寸。',
  typography: '昵称加粗；说明小号灰。',
  interaction: '游客点击登录进入登录流程并携带返回页；已登录点击进入头像与昵称编辑。',
  ui: '黄黑品牌头部；卖家卡按状态换色。',
  dataSource: 'ProfilePage.tsx 与 useAuthStatus、useAccountSettings。',
  dataContent: '昵称与卖家状态；不展示真实手机号明文。',
  evidence: [PROFILE_PAGE, 'src/components/useAccountSettings.ts'],
}

const profileOrderHub: PageElementSpec = {
  name: '订单中心与待处理区',
  component: 'profile-v2-order-hub + profile-v2-pending',
  visual: '订单中心四状态入口（带数量角标）；有待处理订单时上方显示“待处理 N 件”黑底区块。',
  dimensions: '四入口等分；待处理区块圆角卡。',
  typography: '入口标签小号；数量加粗。',
  interaction: '点击进入订单列表对应状态；待处理条目可直达订单详情。',
  ui: '与订单页黑底摘要卡呼应。',
  dataSource: 'ProfilePage.tsx 与 orderRepository 统计。',
  dataContent: '各状态订单数与待处理订单摘要。',
  evidence: [PROFILE_PAGE],
}

const profileFeatureList: PageElementSpec = {
  name: '功能列表与服务号引导',
  component: 'ProfileFeatureList + 关注服务号 BottomSheet',
  visual: '分组功能列表（收藏、足迹、钱包、设置等）；关注服务号弹层展示二维码占位与保存按钮。',
  dimensions: '列表行沿用设置行规范；二维码区居中。',
  typography: '行标签 14px 左右。',
  interaction: '点击进入对应页面；保存二维码仅提示暂不可保存。',
  ui: '二维码为占位图，不伪造可保存图片。',
  dataSource: 'ProfilePage.tsx 与 ProfileFeatureList.tsx。',
  dataContent: '固定功能入口与占位文案。',
  evidence: [PROFILE_PAGE, 'src/components/ProfileFeatureList.tsx'],
}

const settingsGroups: PageElementSpec = {
  name: '设置分组列表',
  component: 'AccountSettingsPage 分组 Cell 列表',
  visual: '白底分组列表：通知、隐私与协议、账号与安全、关于与退出登录。',
  dimensions: '分组卡片圆角；行高沿用设置行规范。',
  typography: '行标签 14px 左右、右侧值小号灰。',
  interaction: '逐项进入对应页面；退出登录需二次确认。',
  ui: '复用共享 Cell 组件。',
  dataSource: 'ProfileSettingsPages.tsx 与 useAccountSettings。',
  dataContent: '各行当前状态（已设置/未设置）。',
  evidence: [SETTINGS_PAGE],
}

const passwordForm: PageElementSpec = {
  name: '密码表单与状态弹窗',
  component: 'PasswordSettingsPage（TextField 组 + 确认/忙碌/失败 Dialog）',
  visual: '新密码与确认密码输入、验证码输入与倒计时；确认、提交中与失败均为居中弹窗。',
  dimensions: '输入沿用 TextField 规范；弹窗复用 Dialog。',
  typography: '字段标签 13px；弹窗标题 dialog 级。',
  interaction: '密码 8–18 位含字母数字；两次一致；验证码 6 位；失败保留输入可重试。',
  ui: '校验错误行内红色提示。',
  dataSource: 'ProfileSettingsPages.tsx 与 accountSettingsRepository。',
  dataContent: '展示脱敏手机号；不回显密码内容。',
  evidence: [SETTINGS_PAGE],
}

const realnameForm: PageElementSpec = {
  name: '实名认证表单与结果',
  component: 'RealNamePage（表单卡 + 结果卡 + 失败弹窗）',
  visual: '填写态为姓名与身份证号表单卡；结果态为大图标结果卡（成功/审核中/未通过）与脱敏资料；失败为弹窗。',
  dimensions: '结果图标居中大尺寸；表单单列。',
  typography: '结果标题 result 级；脱敏值加粗。',
  interaction: '输入即时校验格式；提交失败保留信息可重试；未通过可重新认证。',
  ui: '三种结果态以图标与配色区分。',
  dataSource: 'RealNamePage.tsx 与 realNameModel.ts、accountSettingsRepository。',
  dataContent: '姓名与身份证号脱敏展示；说明为静态备注不回显输入。',
  evidence: [REALNAME_PAGE, 'src/components/realNameModel.ts'],
}

const walletOverview: PageElementSpec = {
  name: '钱包余额与资金记录',
  component: 'WalletOverviewPage（余额卡 + 记录筛选列表）',
  visual: '余额卡展示可用余额与申请提现入口；下方按类型筛选的资金记录列表，收支分色。',
  dimensions: '余额卡通栏；记录行紧凑。',
  typography: '余额大号价格色；记录金额分色。',
  interaction: '筛选切换记录范围；提现进入提现页。',
  ui: '黄黑钱包视觉。',
  dataSource: 'WalletPages.tsx 与 walletModel.ts、walletRepository。',
  dataContent: '余额、交易类型与金额；演示流水。',
  evidence: [WALLET_PAGE, 'src/components/walletModel.ts'],
}

const withdrawForm: PageElementSpec = {
  name: '提现表单',
  component: 'WalletWithdrawPage（金额输入 + 渠道 + 短信验证）',
  visual: '提现金额输入（占位 0.00）、支付宝渠道展示与短信验证码输入。',
  dimensions: '输入沿用 TextField；按钮通栏。',
  typography: '金额输入大号；说明小号。',
  interaction: '金额不超余额；验证码 6 位；提交结果以 Toast 与记录反馈。',
  ui: '渠道当前仅支付宝，展示实名认证状态说明。',
  dataSource: 'WalletPages.tsx 与 walletModel.ts 的 validateWithdrawal。',
  dataContent: '可提现余额与验证码倒计时；不回显验证码。',
  evidence: [WALLET_PAGE],
}

const identityForms: PageElementSpec = {
  name: '头像昵称与换绑手机表单',
  component: 'ProfileIdentityPages（头像选择 + 昵称 / 新手机号 + 验证码）',
  visual: '头像与昵称编辑页含默认头像选择；更换手机号页为新手机号与验证码输入及确认弹窗。',
  dimensions: '表单单列；头像区居中。',
  typography: '字段标签 13px；弹窗标题 dialog 级。',
  interaction: '昵称有长度与格式校验；换绑需 11 位手机号与 6 位验证码，确认弹窗展示脱敏号码。',
  ui: '复用共享表单组件。',
  dataSource: 'ProfileIdentityPages.tsx 与 accountSettingsRepository。',
  dataContent: '新手机号脱敏展示；说明为静态备注不回显输入。',
  evidence: [IDENTITY_PAGE],
}

const sellerContractForm: PageElementSpec = {
  name: '卖家签约分步表单',
  component: 'SellerContractPages（个人/企业资料分步表单 + 证件上传）',
  visual: '分步资料填写：个人含姓名、身份证、手机号与紧急联系人；企业含统一社会信用代码与联系人；附证件上传与协议勾选。',
  dimensions: '表单单列分步；上传区网格。',
  typography: '字段标签 13px；上传说明小号灰。',
  interaction: '分步校验后进入下一步；证件限 JPG/PNG ≤10MB；勾选协议说明后进入签署。',
  ui: '步骤指示与黄黑表单视觉。',
  dataSource: 'SellerContractPages.tsx 与本地签约仓库。',
  dataContent: '表单字段与上传文件名；说明为静态备注不回显输入。',
  evidence: [SELLER_PAGE],
}

const fulfillmentContract: PageElementSpec = {
  name: '履约合同查看与签署',
  component: 'FulfillmentContractPage（合同正文 + 演示签名输入）',
  visual: '展示《游戏账号回收协议》正文，底部为演示签名输入与确认按钮。',
  dimensions: '正文滚动区 + 贴底操作。',
  typography: '合同标题加粗；正文小号。',
  interaction: '输入姓名作为演示签名，确认后仅更新本地签署状态。',
  ui: '签署提示明确演示属性，不生成法律效力合同。',
  dataSource: 'FulfillmentContractPage.tsx 与 fulfillmentRepository。',
  dataContent: '合同标题与签署状态。',
  evidence: [FULFILLMENT_PAGE],
}

const reminderList: PageElementSpec = {
  name: '提醒列表',
  component: 'ReminderPage（通知行列表）',
  visual: '按时间排列的提醒行，未读带标记。',
  dimensions: '行沿用通知行规范。',
  typography: '标题加粗、时间小号灰。',
  interaction: '点击跳转对应业务页并清除未读。',
  ui: '复用消息视觉。',
  dataSource: 'ReminderPage.tsx 与 messageRepository。',
  dataContent: '提醒标题、时间与未读状态。',
  evidence: [REMINDER_PAGE],
}

const accountSecurityList: PageElementSpec = {
  name: '账号与安全列表',
  component: 'AccountSecurityPage（状态 Cell 列表）',
  visual: '白底分组列表：头像与昵称、更换手机号、设置密码、第三方绑定与注销账号，各行显示当前状态。',
  dimensions: '行沿用设置行规范。',
  typography: '行标签 14px、状态值小号灰。',
  interaction: '逐项进入对应页面。',
  ui: '复用共享 Cell；注销入口置底。',
  dataSource: 'ProfileSettingsPages.tsx 与 useAccountSettings。',
  dataContent: '各项设置状态（已设置/未设置）。',
  evidence: [SETTINGS_PAGE],
}

const profileElements = [profileHeader, profileOrderHub, profileFeatureList]
const settingsElements = [settingsGroups]
const passwordElements = [passwordForm]
const realnameElements = [realnameForm]
const walletElements = [walletOverview]
const withdrawElements = [withdrawForm]
const identityElements = [identityForms]
const sellerElements = [sellerContractForm]
const fulfillmentElements = [fulfillmentContract]
const reminderElements = [reminderList]
const accountSecurityElements = [accountSecurityList]

const securityPageNote = (title: string, note: string): PageElementSpec[] => [
  accountSecurityElements[0],
  {
    name: `${title}说明区`,
    component: `${title}页面主体`,
    visual: note,
    dimensions: '单列内容流，沿用设置类页面宽度。',
    typography: '标题与说明沿用设置页字号。',
    interaction: '返回上一级；表单操作见各表单元素说明。',
    ui: '与设置页一致的黄白卡片视觉。',
    dataSource: 'ProfileSettingsPages.tsx / ProfileIdentityPages.tsx 本地状态。',
    dataContent: '演示状态值，不包含真实凭据。',
    evidence: [SETTINGS_PAGE, IDENTITY_PAGE],
  },
]

const byNode = new Map<string, PageElementSpec[]>([
  ['3681:28976', profileElements],
  ['3681:37368', profileElements],
  ['4053:8997', settingsElements],
  ['4053:8561', passwordElements],
  ['account-security:home', accountSecurityElements],
  ['account-security:profile', identityElements],
  ['account-security:phone', identityElements],
  ['settings:bindings', securityPageNote('第三方绑定', '按渠道展示绑定状态；当前演示仅微信服务号绑定说明，QQ/Apple 等能力待核实。')],
  ['settings:cancellation', securityPageNote('注销账号', '注销前展示风险与数据清理说明，需短信验证确认；确认后清理本地会话。')],
  ['privacy:center', securityPageNote('隐私与协议中心', '以列表汇总平台协议入口，正文复用登录协议全文页。')],
  ['about:us', securityPageNote('关于我们', '展示品牌标识、版本号与运营主体信息；备案信息以正式配置为准。')],
  ['4053:8196', realnameElements],
  ['4053:8359', realnameElements],
  ['4053:8417', realnameElements],
  ['4053:8467', realnameElements],
  ['3681:28588', walletElements],
  ['wallet:withdraw', withdrawElements],
  ['seller:center', sellerElements],
  ['seller:contract-personal', sellerElements],
  ['seller:contract-business', sellerElements],
  ['fulfillment:contract', fulfillmentElements],
  ['reminders:main', reminderElements],
])

export function getProfileElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return byNode.get(nodeId)
}
