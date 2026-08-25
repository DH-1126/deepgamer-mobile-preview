import type { Recycler, SellGame } from '../types/sell'

export const sellGames: SellGame[] = [
  { code: 'wzry', name: '王者荣耀', mark: '王', consultationCount: 12, featured: true, color: 'linear-gradient(155deg,#2e3358,#0e1122)' },
  { code: 'peace', name: '和平精英', mark: '和', consultationCount: 8, featured: true, color: 'linear-gradient(155deg,#4a5a34,#131a0e)' },
  { code: 'genshin', name: '原神', mark: '原', consultationCount: 6, color: 'linear-gradient(155deg,#6e8fc9,#1f2e52)' },
  { code: 'delta', name: '三角洲', mark: '△', consultationCount: 0, color: 'linear-gradient(155deg,#5c5136,#1a1710)' },
  { code: 'identity', name: '第五人格', mark: '第', consultationCount: 4, color: 'linear-gradient(155deg,#7a3450,#22101a)' },
  { code: 'valorant', name: '无畏契约', mark: '无', consultationCount: 3, color: 'linear-gradient(155deg,#b34a4a,#2a1010)' },
  { code: 'egg', name: '蛋仔派对', mark: '蛋', consultationCount: 3, color: 'linear-gradient(155deg,#2f6b5e,#0e211d)' },
  { code: 'starrail', name: '崩坏星穹', mark: '崩', consultationCount: 2, color: 'linear-gradient(155deg,#3f4a7a,#131628)' },
  { code: 'naruto', name: '火影忍者', mark: '火', consultationCount: 2, color: 'linear-gradient(155deg,#8a6a2e,#241a08)' },
]

export const recyclerFixtures: Recycler[] = [
  { id: 'fun', name: '真趣十足', mark: '趣', availability: 'online', averageResponseMinutes: 3, serviceTime: '09:00–23:00', description: '主收王者荣耀 QQ区 / 微信区各段位账号', tags: ['QQ区 / 微信区', '当天打款', '资金托管'], supportedGames: ['wzry', 'peace', 'genshin', 'identity'] },
  { id: 'valley', name: '峡谷回收', mark: '峡', availability: 'online', averageResponseMinutes: 6, serviceTime: '10:00–24:00', description: '偏收星耀及以上、皮肤 100+ 的高价号', tags: ['QQ区', '高段位优先', '资金托管'], supportedGames: ['wzry'] },
  { id: 'steady', name: '稳收阁', mark: '稳', availability: 'online', averageResponseMinutes: 9, serviceTime: '09:00–21:00', description: '各段位都收，微信区当天验号当天打款', tags: ['微信区', '当天打款', '资金托管'], supportedGames: ['wzry', 'peace', 'valorant'] },
  { id: 'night', name: '夜猫回收', mark: '夜', availability: 'offline', serviceTime: '20:00–次日 04:00', description: '当前不在服务时间，请稍后再来咨询', tags: ['夜间服务'], supportedGames: ['wzry', 'genshin'] },
]

