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

export const products: Product[] = productsSeed.map((item, index) => ({
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

export const hotSearches = ['国标号', '荣耀水晶', '500以内', '1000以内', '金标号']
export const searchHot = ['光遇成品号', '火影成品号', '英雄联盟成品号', '三角洲高战号', '王者荣耀V10']
