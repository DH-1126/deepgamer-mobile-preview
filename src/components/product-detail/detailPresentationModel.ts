import type { ProductDetail } from '../../types/productDetail'

/** Explicit local design specimen; never applies to linked goods or other game records. */
export function getDetailPresentation(detail: ProductDetail, linked = false) {
  const specimen = !linked && detail.id === '1' && detail.presentationSource === 'design_fixture'
  // Approved display state only; never rewrite the underlying goods record.
  const verified = true
  const loginMethod = linked
    ? String(detail.attributeValues?.loginMethod ?? '未提供')
    : /微信/.test(detail.platform) ? '微信' : /steam/i.test(detail.platform) ? 'Steam' : /QQ/.test(detail.platform) ? 'QQ' : '未提供'
  return {
    specimen,
    verified,
    publishedAt: specimen ? '2026-08-03' : '未提供',
    verifiedAt: specimen ? '08-03 14:22' : '平台已核验',
    shotsDate: specimen ? '08-03 验号时留存' : '验号时留存',
    priceDrop: detail.originalPrice ? Math.max(0, detail.originalPrice - detail.price) : specimen ? 120 : 0,
    metrics: specimen ? [{ label: '段位', value: '王者50★' }, { label: '英雄', value: String(detail.heroCount) }, { label: '皮肤', value: String(detail.skinCount) }] : detail.metrics,
    verificationSummary: [
      { label: '区服', value: detail.platform.replace(/区$/, '') },
      { label: '段位', value: specimen ? '王者50星' : detail.rank },
      { label: '等级', value: specimen ? '贵族8级' : detail.eliteLevel || '未提供' },
    ],
    tradeInfo: [
      { id: 'realname', label: '实名状态', value: specimen ? '可二次实名' : detail.realName, tone: specimen || detail.secondRealName ? 'success' as const : 'default' as const, hint: '实名状态及是否支持二次实名，以当前账号资料和验号报告为准。' },
      { id: 'binding', label: '换绑限制', value: specimen ? '当前无明显限制' : '以验号报告为准', hint: '请在平台交易群按客服指引完成换绑，不要在群外交换账号资料。' },
      { id: 'age', label: '防沉迷', value: specimen ? '成年实名' : '未提供' },
      { id: 'login', label: '登录方式', value: loginMethod },
      { id: 'restriction', label: '交易限制', value: specimen ? '无' : '以商品资料为准', hint: '购买前请核对交易条件；虚拟商品售后按适用的平台规则处理。' },
    ],
    extraInfo: [
      { id: 'negotiable', label: '议价状态', value: detail.negotiable ? '支持议价' : '不议价' },
      { id: 'inscription', label: '铭文等级', value: detail.inscriptionFull === undefined ? '未提供' : detail.inscriptionFull ? '满级' : '未满级' },
    ],
    sellerDescription: specimen ? ['主玩打野，李白 / 镜相关皮肤较完整，星元部件基本齐。铭文已满级，赛季末段位为王者 50 星。'] : detail.description,
    sellerByline: specimen ? '深海卖家 · 08-03 提交' : '卖家提交',
  }
}
