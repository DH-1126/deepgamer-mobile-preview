export type HomeGame = {
  name: string
  code: string
  image: string
}

export type HomeCopyCard = {
  title: string
  detail: string
}

import { assetPath } from '../components/assetPath'

const asset = (name: string) => assetPath(`assets/home-v2/${name}`)

export const recentGames = [
  { name: '王者荣耀', code: 'wzry', image: asset('game-wzry.png'), footprint: '看过 12 个 ·', reducedText: '3 个降价' },
  { name: '和平精英', code: 'hpjy', image: asset('game-hpjy.png'), footprint: '看过 3个', reducedText: '' },
] as const

export const homeGames: HomeGame[] = [
  { name: '王者荣耀', code: 'wzry', image: asset('game-wzry.png') },
  { name: '和平精英', code: 'hpjy', image: asset('game-hpjy.png') },
  { name: '三角洲', code: 'sjzxd', image: asset('game-delta.png') },
  { name: '原神', code: 'ys', image: asset('game-genshin.png') },
  { name: '第五人格', code: 'dwrg', image: asset('game-dwrg.png') },
  { name: '超自然行动组', code: 'czzxdz', image: asset('game-supernatural.png') },
  { name: '和平精英', code: 'hpjy', image: asset('game-hpjy-repeat.png') },
  { name: '英雄联盟', code: 'lol', image: asset('game-lol.png') },
]

export const principles: HomeCopyCard[] = [
  { title: '不割韭菜', detail: '不靠复杂规则和信息差，赚玩家看不懂的钱。' },
  { title: '站玩家这边', detail: '努力让利给买家和卖家，让真正提供价值的人得到更多。' },
  { title: '跟玩家一起做', detail: '玩家的吐槽和建议，不是客服工单，是产品下一版可能发生的事。' },
]

export const tradeFeatures: HomeCopyCard[] = [
  { title: '极速售后', detail: '有问题别等一天又一天。' },
  { title: '7×24 玩家客服', detail: '该找人的时候，真的有人。' },
  { title: '找回 / 人脸保障', detail: '把风险说清楚，也认真处理。' },
  { title: '更合理的手续费', detail: '平台赚钱，但不靠割玩家。' },
  { title: '帮买家压价', detail: '也帮卖家争取一个更好的价。' },
  { title: '打击黑号', detail: '干净的号，才值得被买卖。' },
]

export const coCreationServices: HomeCopyCard[] = [
  { title: '吐槽服务', detail: '不满意？欢迎说。' },
  { title: '产品建议', detail: '好点子被采纳，有机会得到奖励。' },
  { title: '社区共建', detail: '平台文化，玩家一起定义。' },
]
