import type { Game, Product } from '../types/catalog'
import { assetPath } from '../components/assetPath'

export const games: Game[] = [
  { code: 'sjzxd', name: '三角洲行动', description: '高战号 / 安全箱 / 近战', image: assetPath('assets/games/delta.png'), saleCount: 16382 },
  { code: 'wzry', name: '王者荣耀', description: '皮肤 / 贵族 / 全英雄', image: assetPath('assets/games/wzry.png'), saleCount: 28546 },
  { code: 'hpjy', name: '和平精英', description: '载具 / 热力 / 战神', image: assetPath('assets/games/hpjy.png'), saleCount: 12880 },
  { code: 'lol', name: '英雄联盟', description: '全英雄 / 稀有皮肤', image: assetPath('assets/games/lol.png'), saleCount: 9860 },
  { code: 'ys', name: '原神', description: '五星角色 / 满命武器', image: assetPath('assets/games/genshin.png'), saleCount: 7350 },
  { code: 'valorant', name: '无畏契约', description: '限定套装 / 高段位', image: assetPath('assets/games/valorant.png'), saleCount: 11240 },
]

const imageNames = ['p01.jpg', 'p03.jpg', 'p05.jpg', 'p07.jpg', 'p08.jpg', 'p06.jpg', 'p02.jpg', 'p10.jpg', 'p04.jpg', 'p09.jpg']

const productsSeed = [
  ['【9636】【极品v10女神号·全皮瑶+星传说·金标/万战武则天·金标/万战嫦娥·金标/万战女娲·3典藏·1珍品无双·4无双·6珍品·28质量传说··幻舞叠翠·', 1280, ['V10', '倪克斯神谕', '时之魔女'], 312, '安卓QQ', '荣耀王者'],
  ['【WZBHC5367】贵族等级11/荣耀典藏数量9/传说皮肤数量148/史诗皮肤数量276/皮肤数量785/英雄数量131/段位最强王者/廉颇全皮/赵云全皮/墨', 1890, ['V8', '荣耀典藏×2'], 201, 'iOS QQ', '最强王者'],
  ['【WZAHC7169】贵族等级10/荣耀典藏数量5/传说皮肤数量64/史诗皮肤数量189/皮肤数量571/英雄数量130/段位最强王者/嬴政全皮/高渐离全皮/元', 4370, ['V10', '孙悟空全息碎影', '小乔天鹅之梦'], 571, '安卓微信', '最强王者'],
  ['【WZAHC7171】贵族等级10/荣耀典藏数量9/传说皮肤数量63/史诗皮肤数量181/皮肤数量547/英雄数量132/段位至尊星耀/马可波罗全皮/娜可露露全', 4025, ['V10', '孙悟空全息碎影', '夏侯惇无限飓风号'], 547, '安卓QQ', '至尊星耀'],
  ['【WZAHC7115】贵族等级9/荣耀典藏数量2/传说皮肤数量38/史诗皮肤数量131/皮肤数量408/英雄数量131/段位永恒钻石/大禹全皮/李信全皮/马超全', 1840, ['V9', '花木兰九霄神辉', '御风骁将'], 408, 'iOS 微信', '永恒钻石'],
  ['【WZAHC5746】贵族等级10/荣耀典藏数量6/传说皮肤数量51/史诗皮肤数量150/皮肤数量485/英雄数量130/段位至尊星耀/李白全皮/英雄全皮_孙权', 4600, ['V10', '貂蝉幻阙歌', '孙悟空全息碎影'], 485, '安卓QQ', '至尊星耀'],
  ['【WZAHC5067】贵族等级12/荣耀典藏数量6/传说皮肤数量71/史诗皮肤数量197/皮肤数量565/英雄数量129/段位最强王者/元歌全皮/李白全皮/英雄', 4600, ['V12', '蔷薇恋人', '花木兰九霄神辉'], 565, '安卓微信', '最强王者'],
  ['【WZAHC3810】贵族等级7/荣耀典藏数量1/传说皮肤数量11/史诗皮肤数量87/皮肤数量278/英雄数量129/段位最强王者/小国标高渐离/英雄全皮_戈娅', 1035, ['V7', '诸葛亮星域神启', '朱雀志'], 278, 'iOS QQ', '最强王者'],
  ['【WZAHC1605】贵族等级8/荣耀典藏数量1/传说皮肤数量22/史诗皮肤数量94/皮肤数量345/英雄数量128/段位最强王者/刘邦全皮/英雄全皮_孙权全皮', 700, ['V8', '蔷薇恋人', '诸葛亮星域神启'], 345, '安卓QQ', '最强王者'],
  ['【WZAHC1652】贵族等级10/荣耀典藏数量6/传说皮肤数量79/史诗皮肤数量210/皮肤数量606/英雄数量128/段位最强王者/小国标白起/小国标刘邦/', 4945, ['V10', '蔷薇恋人', '铠银白咏叹调'], 606, 'iOS 微信', '最强王者'],
] as const

const wzryProducts: Product[] = productsSeed.map((item, index) => ({
  id: String(index + 1),
  gameCode: 'wzry',
  title: item[0],
  price: item[1],
  tags: [...item[2]],
  eliteLevel: item[2][0],
  skinCount: item[3],
  platform: item[4],
  rank: item[5],
  image: index === 0 ? assetPath('assets/catalog-v2/product-featured-1.png') : index === 1 ? assetPath('assets/catalog-v2/product-featured-2.png') : assetPath(`assets/products/${imageNames[index]}`),
  realName: index % 3 === 0 ? '已实名-不可改实名' : index % 2 === 0 ? '已实名-可改实名' : '未实名',
  secondRealName: index % 2 === 0,
  faceCompensation: index % 3 !== 0,
  listedAt: 1700000000000 + index * 86400000,
  heroCount: [108, 121, 130, 132, 131, 130, 129, 129, 128, 128][index],
  negotiable: index % 3 !== 1,
  wantCount: [12, 4, 18, 9, 6, 14, 8, 11, 20, 7][index],
  publishedLabel: ['3小时内', '1小时内', '5小时内', '今天', '今天', '1天前', '1天前', '2天前', '2天前', '3天前'][index],
  inscriptionFull: index !== 3 && index !== 6,
  displayTitle: index === 0 ? '王者50 · 108英雄 · 312皮肤' : index === 1 ? '王者12 · 121英雄 · 201皮肤' : undefined,
}))

const multiGameProducts: Product[] = [
  { id: 'wz-search-1', gameCode: 'wzry', title: '王者荣耀 全皮肤 贵族15 典藏高配账号', price: 4200, image: assetPath('assets/products/p09.jpg'), tags: ['全皮肤', 'V15', '荣耀典藏'], eliteLevel: 'V15', skinCount: 785, platform: '安卓QQ', rank: '最强王者', realName: '已实名-可改实名', secondRealName: true, faceCompensation: true, listedAt: 1701550000000, heroCount: 132, negotiable: true, wantCount: 31, publishedLabel: '刚刚', inscriptionFull: true },
  { id: 'wz-search-2', gameCode: 'wzry', title: '王者荣耀 贵族15 高性价比皮肤账号', price: 480, image: assetPath('assets/products/p02.jpg'), tags: ['V15', '高性价比', '限定皮肤'], eliteLevel: 'V15', skinCount: 420, platform: '安卓微信', rank: '最强王者', realName: '未实名', secondRealName: true, faceCompensation: true, listedAt: 1701540000000, heroCount: 131, negotiable: true, wantCount: 26, publishedLabel: '1小时内', inscriptionFull: true },
  { id: 'wz-search-3', gameCode: 'wzry', title: '王者荣耀 全皮肤 贵族10 低预算账号', price: 450, image: assetPath('assets/products/p10.jpg'), tags: ['全皮肤', 'V10', '低预算'], eliteLevel: 'V10', skinCount: 720, platform: 'iOS QQ', rank: '最强王者', realName: '已实名-不可改实名', secondRealName: false, faceCompensation: true, listedAt: 1701530000000, heroCount: 130, negotiable: false, wantCount: 23, publishedLabel: '2小时内', inscriptionFull: true },
  { id: 'hpjy-1', gameCode: 'hpjy', title: '和平精英 微信区 满级 精品衣服号 载具皮肤齐全', price: 860, image: assetPath('assets/products/p03.jpg'), tags: ['满级', '载具皮肤', '热力值'], eliteLevel: 'V7', skinCount: 186, platform: '安卓微信', rank: '超级王牌', realName: '已实名-可改实名', secondRealName: true, faceCompensation: true, listedAt: 1701000000000, negotiable: true, wantCount: 18, publishedLabel: '1小时内', inscriptionFull: true },
  { id: 'hpjy-2', gameCode: 'hpjy', title: '和平精英 QQ区 无敌战神 稀有军需多载具号', price: 2480, image: assetPath('assets/products/p06.jpg'), tags: ['无敌战神', '稀有军需', '特斯拉'], eliteLevel: 'V9', skinCount: 328, platform: '安卓QQ', rank: '无敌战神', realName: '已实名-不可改实名', secondRealName: false, faceCompensation: true, listedAt: 1701100000000, negotiable: false, wantCount: 9, publishedLabel: '3小时内', inscriptionFull: true },
  { id: '2114872829163482747', gameCode: 'sjzxd', title: '三角洲行动 总资产547M 传说近战6 安全箱高战号', price: 3308, image: assetPath('assets/product-detail-v2/780e9aff187347c08953458a0bf6a05e_14eb650cb7bd93500176731970015440.jpg'), tags: ['547M资产', '传说近战6', '安全箱'], eliteLevel: '行动60', skinCount: 98, platform: '安卓QQ', rank: '行动等级60', realName: '已实名-不可改实名', secondRealName: false, faceCompensation: true, listedAt: 1701200000000, negotiable: false, wantCount: 27, publishedLabel: '刚刚', inscriptionFull: true },
  { id: 'sjzxd-2', gameCode: 'sjzxd', title: '三角洲行动 Steam区 典藏枪皮 高价值仓库号', price: 1680, image: assetPath('assets/product-detail-v2/d24bca1b077d4338911ee642a44a25fa_3eedd391e8d3f2489755269523381776.jpg'), tags: ['Steam', '典藏枪皮', '仓库号'], eliteLevel: '行动52', skinCount: 63, platform: 'Steam', rank: '行动等级52', realName: '未实名', secondRealName: true, faceCompensation: true, listedAt: 1701150000000, negotiable: true, wantCount: 14, publishedLabel: '2小时内', inscriptionFull: true },
  { id: 'ys-1', gameCode: 'ys', title: '原神 亚服 五星6 满级冒险等级 成品号', price: 520, image: assetPath('assets/products/p07.jpg'), tags: ['五星6', '满级', '成品号'], eliteLevel: '冒险60', skinCount: 42, platform: '安卓QQ', rank: '冒险等级60', realName: '未实名', secondRealName: true, faceCompensation: true, listedAt: 1701300000000, negotiable: true, wantCount: 22, publishedLabel: '30分钟内', inscriptionFull: true },
  { id: 'ys-2', gameCode: 'ys', title: '原神 国服 满命角色 专武齐全 高练度账号', price: 2860, image: assetPath('assets/products/p08.jpg'), tags: ['满命角色', '专武', '高练度'], eliteLevel: '冒险60', skinCount: 78, platform: '安卓微信', rank: '冒险等级60', realName: '已实名-可改实名', secondRealName: true, faceCompensation: true, listedAt: 1701250000000, negotiable: false, wantCount: 11, publishedLabel: '今天', inscriptionFull: true },
  { id: 'lol-1', gameCode: 'lol', title: '英雄联盟 电一 全英雄 稀有皮肤 高段位账号', price: 680, image: assetPath('assets/products/p04.jpg'), tags: ['全英雄', '稀有皮肤', '电一'], eliteLevel: 'V6', skinCount: 286, platform: '安卓QQ', rank: '钻石', realName: '未实名', secondRealName: true, faceCompensation: false, listedAt: 1701400000000, heroCount: 171, negotiable: true, wantCount: 17, publishedLabel: '1小时内', inscriptionFull: true },
  { id: 'lol-2', gameCode: 'lol', title: '英雄联盟 黑色玫瑰 典藏皮肤 大师段位号', price: 1380, image: assetPath('assets/products/p02.jpg'), tags: ['典藏皮肤', '大师', '黑色玫瑰'], eliteLevel: 'V8', skinCount: 403, platform: 'iOS QQ', rank: '大师', realName: '已实名-不可改实名', secondRealName: false, faceCompensation: true, listedAt: 1701350000000, heroCount: 168, negotiable: false, wantCount: 8, publishedLabel: '4小时内', inscriptionFull: true },
  { id: 'valorant-1', gameCode: 'valorant', title: '无畏契约 国服 高段位 限定套装成品号', price: 980, image: assetPath('assets/products/p05.jpg'), tags: ['限定套装', '高段位', '成品号'], eliteLevel: '通行证8', skinCount: 76, platform: '安卓QQ', rank: '钻石', realName: '未实名', secondRealName: true, faceCompensation: true, listedAt: 1701500000000, negotiable: true, wantCount: 13, publishedLabel: '2小时内', inscriptionFull: true },
  { id: 'valorant-2', gameCode: 'valorant', title: '无畏契约 港服 稀有刀皮 神话套装账号', price: 2150, image: assetPath('assets/products/p10.jpg'), tags: ['稀有刀皮', '神话套装', '港服'], eliteLevel: '通行证10', skinCount: 129, platform: 'Steam', rank: '超凡', realName: '已实名-可改实名', secondRealName: true, faceCompensation: true, listedAt: 1701450000000, negotiable: false, wantCount: 19, publishedLabel: '今天', inscriptionFull: true },
]

export const products: Product[] = [...wzryProducts, ...multiGameProducts]

export const hotSearches = ['国标号', '荣耀水晶', '500以内', '1000以内', '金标号']
export const searchHot = ['光遇成品号', '火影成品号', '英雄联盟成品号', '三角洲高战号', '王者荣耀V10']
