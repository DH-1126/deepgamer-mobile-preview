import { DRAFT3_FILE_KEY, type BusinessPageSpec } from './businessPageSpec'

const prototypeBoundary = {
  title: '原型边界',
  items: ['商品、筛选与推荐均为本地演示数据；真实商品、筛选字段、排序与分页以正式接口为准。'],
}

const localNote = '该页暂无独立新版设计稿画板；按 Design-Draft3-Pre 组件规范与已确认的黄黑视觉在本地实现。'

export const CATALOG_PAGE_SPECS: readonly BusinessPageSpec[] = [
  {
    nodeId: 'catalog:zone',
    screenName: '商品 · 游戏专区',
    summary: '游戏专区商品列表：顶部游戏信息、快捷筛选、推荐筛选与商品流。',
    referenceNote: localNote,
    sections: [
      {
        title: '页面结构',
        items: ['顶部为游戏封面信息区与排序/筛选工具栏，支持最新上架等排序。', '快捷筛选 chips（区服、价格、皮肤数等）可展开筛选抽屉；已选条件以可移除标签展示。', '商品流按筛选结果分页展示，底部为共享主导航。'],
      },
      { title: '空与异常', items: ['筛选无结果时展示空态并引导调整条件；筛选配置更新时提示重新应用。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'search:main',
    screenName: '商品 · 搜索',
    summary: '搜索页：语音/关键词搜索意图识别、快捷游戏、保留条件与结果列表。',
    referenceNote: localNote,
    sections: [
      {
        title: '页面结构',
        items: ['顶部搜索框支持关键词与“说出你要的号”语音入口，识别结果以条件标签展示。', '未搜索时显示快捷游戏与按分类浏览；搜索后展示排序工具栏与结果列表。', '保留的搜索条件区可在多次搜索间恢复。'],
      },
      { title: '空与异常', items: ['无匹配时提示放宽条件并支持跳转专区；断网时展示网络异常与重试。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:22777',
    screenName: '商品 · 详情',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '商品详情：概览、实拍截图、资产面板、卖家描述与平台保障，底部购买栏。',
    sections: [
      {
        title: '页面结构',
        items: ['顶部概览区展示标题块、价格与验号报告入口；下方为商品实拍截图轮播。', '资产面板默认两行预览、可展开收起；描述面板含卖家一句话与补充说明。', '保障面板区分包赔版与标准版：包赔版包含找回包赔，标准版需二次确认。'],
      },
      {
        title: '购买操作',
        items: ['底部购买栏显示价格与“确认购买”；未登录先进入登录流程。', '需二次确认的商品（不含包赔）先弹确认说明，再进入订单确认。'],
      },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'orders:preview',
    screenName: '商品 · 确认购买预览',
    summary: '确认购买前的订单预览：商品摘要、价格与购买须知，确认后创建待付款订单。',
    referenceNote: '确认购买预览复用订单确认结构，在商品详情页内本地实现；正式下单以订单确认页为准。',
    sections: [
      { title: '页面结构', items: ['展示商品摘要、实付金额与购买须知勾选。', '确认后创建本地待付款订单并进入订单确认/收银台流程。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '4535:3844',
    screenName: '商品 · 游戏选择',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '买号场景的游戏选择页：搜索、首字母索引与全部游戏，供专区与搜索入口复用。',
    referenceNote: '该页与回收场景共用同一组件（scene 参数区分）；买号场景选中后进入对应游戏专区。',
    sections: [
      { title: '页面结构', items: ['搜索框按名称过滤；列表按首字母分组并提供索引导航。', '未找到相关游戏时显示空态并支持清空重搜。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:36166',
    screenName: '我的 · 收藏',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '收藏列表：筛选、商品卡片与进入管理模式。',
    sections: [
      { title: '页面结构', items: ['顶部为返回、标题与搜索；筛选行支持游戏与条件过滤。', '收藏卡片展示商品摘要并可进入详情；提供批量管理模式。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:36255',
    screenName: '我的 · 收藏管理',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '收藏批量管理模式：多选、全选与批量取消收藏。',
    sections: [
      { title: '管理模式', items: ['卡片显示复选框，底部操作栏提供全选与批量删除。', '删除前弹确认弹窗，操作结果以 Toast 反馈。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: '3681:28771',
    screenName: '我的 · 足迹',
    figmaFileKey: DRAFT3_FILE_KEY,
    summary: '浏览足迹页：按时间分组展示最近浏览的商品，支持筛选与清空。',
    sections: [
      { title: '页面结构', items: ['顶部搜索与筛选 chips（时间与游戏）。', '足迹条目展示缩略图、标题、价格与浏览时间，可进入详情或收藏。'] },
      prototypeBoundary,
    ],
  },
  {
    nodeId: 'feedback:main',
    screenName: '吐槽广场 · 意见反馈',
    summary: '意见反馈页：问题类型多选、描述与截图，含官方回复历史。',
    referenceNote: localNote,
    sections: [
      { title: '页面结构', items: ['反馈类型可多选；描述与联系方式选填，截图最多 3 张。', '提交成功后展示结果并提供“再提一条”；历史反馈可查看官方回复。'] },
      { title: '原型边界', items: ['当前为本地演示提交，不接入真实反馈接口；正式提交能力以后台配置为准。'] },
    ],
  },
]

const specByNodeId = new Map(CATALOG_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getCatalogPageSpec(nodeId: string) {
  return specByNodeId.get(nodeId)
}
