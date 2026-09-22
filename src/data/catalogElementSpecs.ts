import type { PageElementSpec } from './pageElementSpec'

const SEARCH_PAGE = 'src/pages/SearchPage.tsx'
const ZONE_PAGE = 'src/pages/GameZonePage.tsx'
const DETAIL_PAGE = 'src/pages/ProductDetailPage.tsx'
const FAVORITES_PAGE = 'src/pages/FavoritesPage.tsx'
const FOOTPRINT_PAGE = 'src/pages/FootprintPage.tsx'
const FEEDBACK_PAGE = 'src/pages/FeedbackPage.tsx'

const zoneToolbar: PageElementSpec = {
  name: '专区筛选工具栏',
  component: 'catalog-top + CatalogQuickFilters + FilterDrawer',
  visual: '游戏信息区下方的排序与筛选工具栏：快捷筛选胶囊、已选条件标签与筛选抽屉入口。',
  dimensions: '工具行贴顶吸顶；筛选胶囊横向滚动。',
  typography: '胶囊 13px 左右；已选条件标签小号。',
  interaction: '快捷筛选即点即用；抽屉内应用筛选；筛选配置更新时提示重新应用；已选标签可单个移除。',
  ui: '黄黑品牌筛选样式；空结果展示空态引导。',
  dataSource: 'GameZonePage.tsx 与 catalogFilterModel.ts。',
  dataContent: '区服、价格、皮肤数等筛选条件与结果数。',
  evidence: [ZONE_PAGE, 'src/components/catalogFilterModel.ts'],
}

const zoneProducts: PageElementSpec = {
  name: '专区商品列表',
  component: 'catalog-products 商品流',
  visual: '商品卡双列或单列流：封面、标题块、标签与价格，支持排序（最新上架等）。',
  dimensions: '列表区占满剩余高度并滚动。',
  typography: '标题块由共享组件解析；价格价格色加粗。',
  interaction: '点击商品进入详情；分页加载更多。',
  ui: '底部共享主导航。',
  dataSource: 'GameZonePage.tsx 与本地商品 fixtures / 联调模式共享数据。',
  dataContent: '商品标题、价格与标签；演示数据不含真实库存。',
  evidence: [ZONE_PAGE, 'src/data/fixtures.ts'],
}

const searchIntent: PageElementSpec = {
  name: '搜索意图识别区',
  component: 'search-v2-top（SearchField + 条件标签）',
  visual: '顶部搜索框与“说出你要的号”入口；识别出的搜索条件以标签展示，可保留或移除。',
  dimensions: '顶部搜索区贴顶；条件标签换行排布。',
  typography: '条件标签小号加粗。',
  interaction: '关键词与语音入口生成搜索意图；保留条件可在多次搜索间恢复；无匹配时提示放宽条件。',
  ui: '识别条件与结果满意度提示联动（按满足度排序）。',
  dataSource: 'SearchPage.tsx 与 searchIntentModel.ts。',
  dataContent: '识别出的游戏、价格区间、皮肤数等条件标签。',
  evidence: [SEARCH_PAGE, 'src/components/searchIntentModel.ts'],
}

const searchResults: PageElementSpec = {
  name: '搜索结果列表',
  component: 'search-v2-results（工具栏 + 商品卡）',
  visual: '排序工具栏（最新上架、价格等）与结果商品卡列表；断网时展示网络异常。',
  dimensions: '结果区滚动加载。',
  typography: '商品标题与价格沿用商品卡规范。',
  interaction: '排序切换即时生效；点击进入详情；断网提供检查网络设置引导。',
  ui: '与专区列表共用商品卡视觉。',
  dataSource: 'SearchPage.tsx 与本地检索模型。',
  dataContent: '结果商品摘要与排序；演示检索不出真实服务。',
  evidence: [SEARCH_PAGE],
}

const detailPanels: PageElementSpec = {
  name: '商品详情内容面板',
  component: 'detail-overview / detail-shots / detail-assets-panel / detail-description-panel / detail-guarantee-panel',
  visual: '依次为概览（标题块、价格、验号报告）、实拍截图轮播、资产面板（两行预览可展开）、卖家描述与平台保障面板。',
  dimensions: '单列内容流；截图区横向滚动。',
  typography: '标题块由 product-presentation 解析；面板标题 section 级。',
  interaction: '资产面板展开收起；验号报告与保障说明可查看；包赔版/标准版差异在保障面板说明。',
  ui: '黄黑品牌面板卡；标准版提示需二次确认。',
  dataSource: 'ProductDetailPage.tsx 与 productDetailFixtures、product-presentation 共享包。',
  dataContent: '商品属性、实拍图、资产清单与保障范围；均为演示数据。',
  evidence: [DETAIL_PAGE, 'src/data/productDetailFixtures.ts'],
}

const detailBuyBar: PageElementSpec = {
  name: '商品购买栏',
  component: '底部购买栏（价格 + 确认购买）',
  visual: '贴底操作栏：左侧价格与标签，右侧“确认购买”黄底主按钮。',
  dimensions: '操作栏贴底含安全区；主按钮通栏或大按钮。',
  typography: '价格加大加粗；按钮 16px 加粗。',
  interaction: '未登录先进入登录并携带返回页；需二次确认的商品先弹确认说明；确认后创建待付款订单进入确认流程。',
  ui: '黄底主按钮与平台一致。',
  dataSource: 'ProductDetailPage.tsx 与 productDetailModel.ts 的 canPurchase/requiresSecondConfirmation。',
  dataContent: '商品价格与购买金额；不预填任何账号信息。',
  evidence: [DETAIL_PAGE, 'src/components/productDetailModel.ts'],
}

const favoritesFilters: PageElementSpec = {
  name: '收藏筛选与管理',
  component: 'favorites-header + favorites-filters + favorites-manage-bar',
  visual: '页头搜索与筛选 chips；管理模式下底部出现全选与批量删除操作栏。',
  dimensions: '筛选行横向滚动；管理栏贴底。',
  typography: '筛选 chips 13px 左右。',
  interaction: '筛选与搜索即时过滤；进入管理模式后卡片显示复选框，删除前弹确认。',
  ui: '与足迹页共用列表视觉。',
  dataSource: 'FavoritesPage.tsx 与 favoritesModel.ts、favoriteRepository。',
  dataContent: '收藏商品摘要与选中状态。',
  evidence: [FAVORITES_PAGE, 'src/components/favoritesModel.ts'],
}

const footprintList: PageElementSpec = {
  name: '足迹列表与筛选',
  component: 'footprint-d3-header + footprint-d3-filters + 足迹条目',
  visual: '按时间分组的足迹列表：缩略图、标题、价格与浏览时间；顶部搜索与时间/游戏筛选。',
  dimensions: '条目行沿用列表规范。',
  typography: '时间小号灰；标题加粗。',
  interaction: '筛选即时生效；条目可进入详情或加入收藏。',
  ui: '与收藏页一致的双页视觉。',
  dataSource: 'FootprintPage.tsx 与 footprintModel.ts。',
  dataContent: '浏览时间与商品摘要。',
  evidence: [FOOTPRINT_PAGE, 'src/components/footprintModel.ts'],
}

const feedbackForm: PageElementSpec = {
  name: '反馈表单与历史',
  component: 'FeedbackPage（类型多选 + 描述 + 截图 + 历史列表）',
  visual: '反馈类型多选 chips、描述与联系方式输入、最多 3 张截图；下方为历史反馈与官方回复。',
  dimensions: '表单区单列；截图网格小图。',
  typography: '选填标注小号；官方回复卡片加粗标识。',
  interaction: '提交为本地演示；提交成功展示结果并可“再提一条”；历史条目可展开官方回复。',
  ui: '黄黑表单视觉。',
  dataSource: 'FeedbackPage.tsx 与本地反馈数据。',
  dataContent: '反馈类型、描述与联系方式（演示脱敏手机号）。',
  evidence: [FEEDBACK_PAGE],
}

const gameSelectList: PageElementSpec = {
  name: '游戏选择搜索与索引列表',
  component: 'GameSelectPage（SearchField + 首字母分组列表）',
  visual: '顶部搜索框与按首字母分组的游戏列表，右侧提供索引导航；未找到时显示空态。',
  dimensions: '列表行沿用设置行规范；索引条窄列。',
  typography: '分组字母小号灰；游戏名 14px 左右。',
  interaction: '搜索实时过滤；选中游戏回传场景页并带出当前游戏。',
  ui: '复用同一组件服务买号与回收两个场景（scene 参数）。',
  dataSource: 'GameSelectPage.tsx 与 gameDirectory.ts。',
  dataContent: '游戏名称与首字母分组；选择结果写入 URL 参数。',
  evidence: ['src/pages/GameSelectPage.tsx', 'src/data/gameDirectory.ts'],
}

const byNode = new Map<string, PageElementSpec[]>([
  ['catalog:zone', [zoneToolbar, zoneProducts]],
  ['search:main', [searchIntent, searchResults]],
  ['3681:22777', [detailPanels, detailBuyBar]],
  ['orders:preview', [detailBuyBar]],
  ['4535:3844', [gameSelectList]],
  ['3681:36166', [favoritesFilters]],
  ['3681:36255', [favoritesFilters]],
  ['3681:28771', [footprintList]],
  ['feedback:main', [feedbackForm]],
])

export function getCatalogElementSpecs(nodeId: string): PageElementSpec[] | undefined {
  return byNode.get(nodeId)
}
