import { products } from './fixtures'
import type { ProductDetail } from '../types/productDetail'
import { assetPath } from '../components/assetPath'

const detailAsset = (name: string) => assetPath(`assets/product-detail-v2/${name}`)

const deltaGalleryNames = [
  '780e9aff187347c08953458a0bf6a05e_14eb650cb7bd93500176731970015440.jpg',
  'd24bca1b077d4338911ee642a44a25fa_3eedd391e8d3f2489755269523381776.jpg',
  'b3ed68d953bb4571bfb2b20c744d83f9_cb8af735c7bf44247065452758053304.jpg',
  '28b8c399cbc948b496bfb39c11e2d8d4_4ac39c9552a523239268087738230124.jpg',
  '955fb756146e4262af9be13788242cdf_d0523216433b92908789403172823574.jpg',
  '5e280bcb1df64267a52378dd3c7838a9_dad9393d8d4c62040807798091315097.jpg',
  'fd2fb5a38c4b4b36be25b8ab1ee4b194_4f89cd01b356f5695159479479101236.jpg',
  '40a7eff8f96443b8a8b77cf1bf4085ff_9bf3a01ee07422708735003768684674.jpg',
  'c6864b5cd5d74e2dbe16f17010912d8a_7385379620ad58634798009986751000.jpg',
  '3d5ce0b479d648929f79d2db8c3693ad_c07202eb8ba823736240223501851168.jpg',
  '2c9861a14c51484abc12de6da8911e7f_b81f8fea357073255882811602950684.jpg',
  '0fb8cf7e080b4ce3a24d536f4f16cf1a_d1b15d5a771657976949296400109502.jpg',
  'b2374a209ec0499a99e8c03364671168_4b8bf7e3daeae5207710660537791705.jpg',
  'cd1cd84343614381b4933b634c66e4d3_03ecf4ea4e3964766727285094658812.jpg',
  '0524e1f9781349b6af26d063995c175f_b592bc48cf89b371805352362957634.jpg',
  '5b2425726809467990c3ad01486cea79_5e188358352161554429593251142729.jpg',
  'd745b1b7612742d093b252a5bee087bf_11ca7a12a78162623088444155057268.jpg',
  'fa0efa805d74499dbf5b6c61e85ff277_7dc7ff2cce1ae321895772019146440.jpg',
  'ed32ff867978432682059593ed87480b_e0472e39a15059049586621976514097.jpg',
  'd6cbb3ff7e6e4540a16e5bf52b54ff2c_d7d5ae0fc2724717195489023891989.jpg',
  '6e813de308c8446b900f55192fbf7c02_ae1642d3926782589219859957968964.jpg',
  '5a6617801b614fb68466cc7f4abe89d2_195296ae868513821286440956573490.jpg',
  '548611573d234ee2955fa2517d5d1bcc_51c2cd994ffd49111785868774725980.jpg',
  '1c218aa9ff9e4abaacc1138df6d7b885_b31507f9d85572510573890498207334.jpg',
  '6a2525ac33224325a907c2923c011eb9_11fd36822b2e06662600011403503915.jpg',
  'e388f2a03afb4a7ba4c937811bda727f_8cc8a37017acd3921889412933673339.jpg',
  '9e2c8bb9059842748fa63bf2ba792a9f_b7d22eeec6f876484100624711882755.jpg',
  '91065dea17c44ccfad912f7b2a3a9d52_fdee7d80a48f94265321354962960788.jpg',
  '6b2a608ade9a4ad680c80ee8f4631848_39e119498417b8648619150986429669.jpg',
  '4be1587b876a41a388ae4337fc993898_472a4584108347160149126520490500.jpg',
  'dfcfac5ced3f4749b00adaa7166661a3_5ff1a30f007926203508147462956463.jpg',
  '20a79520dbee4894b2b30f96f692194e_0ec13fec26016580850743286766022.jpg',
  '8788c8b7ebe54066aabc6b2755aa732b_760024cb853ee4586425625918835693.jpg',
  'bf29e38ecbde4825a81a445421072a91_36b108f6f49666417195888754480036.jpg',
] as const

export const deltaGallery = deltaGalleryNames.map(detailAsset)

const deltaWeaponSkins = 'MK47悠然茶歇、MK47暗星、腾龙万金泪冠、UZI悠然茶歇、Vector阿萨拉文明、M700百步穿杨、M700蝮蛇、M700哈夫克警备、MP5竞技风、MP5深海恐惧、MP5战术竞备、MP7六套之力、勇士工业狂潮、VSS丛影谍踪、勇士能天使午夜邮差、勇士丛影谍踪、SG552深海恐惧、SG552运动员、SMG45阿萨拉特攻、Vector百步穿杨、腾龙捞点薯条、腾龙马年祥瑞、腾龙无垢、勇士万金泪冠、Vector狩猎时刻、MP7无垢、MP7守护者、P90紧急戒备、PKM通用机枪蝮蛇、PKM通用机枪荒野求生、QJB201旧日审判、P90清算时刻、UZI港口艺术家、QJB201炽焰、SV-98清算时刻、AS Val战术甲胄、PKM阿萨拉特攻、PSG-1港口艺术家、KC17旧日审判、MK4旧日审判、SR-3M暗金属骑士、M249港口艺术家、杠杆式步枪清算时刻、QBZ95-1战术甲胄、MP5墨冰、SR-25墨冰、M14蛮荒、AKM古墓丽影、AUG西装暴徒、M870墨冰、K437墨冰、腾龙旷野牧歌、PSG1无垢、M7百步穿杨、QCQ171北极星、QJB201OldHabits、S12K曙光、M249丛影谍踪、M16A4狩猎时刻、M16A4竞赛选手、AUG悠然茶歇、K416行动记录、M4A1阿米娅、AWM无极限、AWM万金泪冠、K416阿萨拉特攻、CAR15阿米娅、黑鹰、G3流沙送葬、G18马年祥瑞、G3哈夫克警备、AWM捞点薯条、AWM流沙送葬、G3狩猎时刻、SR3M暗星、SVD荒野求生、SVD阿萨拉工艺、SV98囚徒、AKM林中猎手、SCARH启航、SCARH囚徒、SR3M荒野求生、SR3M开工大吉、SR3M战术竞备、SV98猎鳄行动、SV98林中猎手、KC17电锯惊魂、K437守护者、K437丛影谍踪、K437北极星、M1014林中猎手、K416冬日风情、K416腊梅、725双管送葬人无题密令、ASh12无极限、ASVal百步穿杨、ASVal典狱官、93R捞点薯条'.split('、')

export const deltaProductDetail: ProductDetail = {
  id: '2114872829163482747', aliases: ['SJ11DG001'], productCode: 'SJ11DG001', gameCode: 'sjzxd', gameName: '三角洲行动', gameIcon: assetPath('assets/games/delta.png'),
  title: '【SJ11DG001】 总资产547M/哈夫币11621万/传说近战数6/干员外观数10/典藏外观数3/传说枪皮数41/战场等级37/行动等级60/安全箱等时效性道具以游戏内数据为准，详情请看图/露娜-黑·天际线/蜂医-送葬人·无题密令/深蓝-不破誓约/红狼-电锯惊魂/露娜-金牌射手/乌鲁鲁-荒原猎手/银翼-未结卷宗/疾风-西部往事/无名-守夜人/蜂医-医生/近战武器-挽歌/近战-暗星/近战-北极星/近战-信条/近战',
  price: 3308, originalPrice: 3735, status: 'on_sale', platform: '安卓QQ', rank: '行动等级60', heroCount: 0, skinCount: 41,
  realName: '已实名-不可改实名', secondRealName: false, negotiable: false, verified: false, gallery: deltaGallery,
  metrics: [{ label: '总资产', value: '547M' }, { label: '哈夫币', value: '116210' }, { label: '传说枪皮', value: '41' }],
  summary: [{ label: '传说近战', value: '6' }, { label: '干员外观', value: '10' }, { label: '典藏外观', value: '3' }],
  assetCategories: [
    { name: '近战武器', count: 6, items: ['处刑者', '影锋', '信条', '黑鹰', '北极星', '暗星'] },
    { name: '武器皮肤', count: 98, items: deltaWeaponSkins },
    { name: '传说武器皮肤', count: 3, items: ['AS Val-悬赏令', 'KC17-造物纪元', '腾龙-气象感应'] },
    { name: '干员皮肤', count: 7, items: ['红狼-电锯惊魂', '蜂医-送葬人·无题密令', '露娜-黑·天际线', '深蓝-不破誓约'] },
    { name: '典藏枪械', count: 3, items: ['AS Val-悬赏令', 'KC17-造物纪元', '腾龙-气象感应'] },
  ],
  description: ['安全箱等时效性道具以游戏内数据为准，购买前请结合全部截图核对。', '账号已实名且不可改实名，不支持二次实名。'],
  groupName: '深度玩家三角洲行动 QQ 群', groupNumber: '1054858153',
  guaranteeCovered: ['找回问题按包赔规则处理', '资金由平台托管', '付款后开放订单交易群', '专属客服全程跟进'],
  guaranteeExcluded: ['未按流程私下交易', '买家自行泄露密码', '非质量问题无理由退款'],
  tips: ['购买前请仔细核实账号信息。', '交易完成后请及时修改密码和绑定信息。', '如遇找回问题，请在 7 天内联系客服申请包赔。', '虚拟商品一经售出，非质量问题不支持无理由退款。', '未成年人禁止下单或参与账号交易。'],
}

export const catalogProductDetails: ProductDetail[] = products.map((product) => ({
  id: product.id, aliases: [], productCode: `WZ${product.id.padStart(4, '0')}`, gameCode: product.gameCode, gameName: '王者荣耀', gameIcon: assetPath('assets/games/wzry.png'),
  title: product.title, price: product.price, status: 'on_sale', platform: product.platform, rank: product.rank, heroCount: product.heroCount ?? 0, skinCount: product.skinCount,
  realName: product.realName, secondRealName: product.secondRealName, negotiable: Boolean(product.negotiable), verified: true, wantCount: product.wantCount,
  gallery: [product.image, detailAsset('screen-1.png'), detailAsset('screen-2.png'), detailAsset('screen-3.png')],
  metrics: [{ label: '段位', value: product.rank }, { label: '英雄', value: String(product.heroCount ?? 0) }, { label: '皮肤', value: String(product.skinCount) }],
  summary: [{ label: '贵族等级', value: product.eliteLevel }, { label: '铭文', value: product.inscriptionFull ? '满级' : '未满' }, { label: '想要人数', value: String(product.wantCount ?? 0) }],
  assetCategories: [{ name: '英雄', count: product.heroCount ?? 0, items: ['白起', '亚瑟', '荆轲', '妲己'] }, { name: '皮肤', count: product.skinCount, items: product.tags.slice(1) }, { name: '星元', count: Math.max(1, Math.round(product.skinCount / 25)), items: ['稀有星元部件'] }],
  description: ['商品资料来自卖家发布与平台核验记录，请以下单前展示的数据为准。', product.title], groupName: '深度玩家王者荣耀 QQ 群', groupNumber: '11223344',
  guaranteeCovered: ['资金托管至确认收货', '换绑全程协助', '描述不符可申诉退款', '客服介入'], guaranteeExcluded: ['泄露密码', '交易完成后私下转让', '超出规则期限'],
  tips: ['购买前请核对账号资料。', '付款后按订单交易群步骤完成验号和换绑。'],
}))
