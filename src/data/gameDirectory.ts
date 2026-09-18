export type GamePlatform = 'pc' | 'mobile'
export type GameDirectoryEntry = {
  code: string
  name: string
  initial: string
  platforms: GamePlatform[]
  image?: string
  insetImage?: boolean
  buyCode?: string
  sellCode?: string
  recommended?: boolean
  keywords?: string
}

// Figma 4535:3844 directory presentation. Availability comes from each scene's data.
export const gameDirectory: GameDirectoryEntry[] = [
  { code: 'wzry', name: '王者荣耀', initial: 'W', platforms: ['mobile'], image: 'assets/game-list-v3/wzry.png', insetImage: true, buyCode: 'wzry', sellCode: 'wzry', recommended: true, keywords: 'wangzherongyao wzry' },
  { code: 'hpjy', name: '和平精英', initial: 'H', platforms: ['mobile'], image: 'assets/game-list-v3/hpjy.png', buyCode: 'hpjy', sellCode: 'peace', recommended: true, keywords: 'hepingjingying hpjy peace' },
  { code: 'sjzxd', name: '三角洲行动', initial: 'S', platforms: ['pc', 'mobile'], image: 'assets/game-list-v3/delta.png', buyCode: 'sjzxd', sellCode: 'delta', recommended: true, keywords: 'sanjiaozhou sjz delta' },
  { code: 'luoke', name: '洛克王国', initial: 'L', platforms: ['mobile'], image: 'assets/game-list-v3/luoke.png', buyCode: 'luoke', recommended: true, keywords: 'luokewangguo lkwg' },
  { code: 'lol', name: '英雄联盟', initial: 'Y', platforms: ['pc'], image: 'assets/game-list-v3/lol.png', buyCode: 'lol', recommended: true, keywords: 'yingxionglianmeng yxlm lol' },
  { code: 'nsh', name: '逆水寒手游', initial: 'N', platforms: ['mobile'], recommended: true },
  { code: 'gmzz', name: '诡秘之主', initial: 'G', platforms: ['pc', 'mobile'], recommended: true },
  { code: 'yysls', name: '燕云十六声', initial: 'Y', platforms: ['pc', 'mobile'], recommended: true },
  { code: 'naruto', name: '火影忍者', initial: 'H', platforms: ['mobile'], sellCode: 'naruto', recommended: true },
  { code: 'mingchao', name: '鸣潮', initial: 'M', platforms: ['pc', 'mobile'], recommended: true },
  { code: 'aqtw', name: '暗区突围', initial: 'A', platforms: ['mobile'] },
  { code: 'aqtw-infinite', name: '暗区突围：无限', initial: 'A', platforms: ['pc'] },
  { code: 'aqcs', name: '奥奇传说手游', initial: 'A', platforms: ['mobile'] },
  { code: 'apex', name: 'Apex 英雄', initial: 'A', platforms: ['pc'] },
  { code: 'blct', name: '部落冲突', initial: 'B', platforms: ['mobile'] },
  { code: 'bjhl', name: '白荆回廊', initial: 'B', platforms: ['mobile'] },
  { code: 'ys', name: '原神', initial: 'Y', platforms: ['pc', 'mobile'], buyCode: 'ys', sellCode: 'genshin', image: 'assets/games/genshin.png', keywords: 'yuanshen ys genshin' },
  { code: 'valorant', name: '无畏契约', initial: 'W', platforms: ['pc'], buyCode: 'valorant', sellCode: 'valorant', image: 'assets/games/valorant.png' },
  { code: 'identity', name: '第五人格', initial: 'D', platforms: ['mobile'], sellCode: 'identity', image: 'assets/home-v2/game-dwrg.png' },
  { code: 'egg', name: '蛋仔派对', initial: 'D', platforms: ['mobile'], sellCode: 'egg' },
  { code: 'starrail', name: '崩坏：星穹铁道', initial: 'B', platforms: ['pc', 'mobile'], sellCode: 'starrail' },
]

export const gameIndexLetters = 'ABCDEFGHJKLMNPQRSTWXYZ'.split('')
