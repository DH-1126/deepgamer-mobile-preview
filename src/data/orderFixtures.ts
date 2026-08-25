import type { OrderRecord } from '../types/order'
import { assetPath } from '../components/assetPath'

export const ORDERS_STORAGE_KEY = 'deepgamer.orders.v1'

type SeedInput = Omit<OrderRecord, 'createdAt' | 'updatedAt'> & { createdOffset: number }

export function createOrderSeed(now: number): OrderRecord[] {
  const hour = 60 * 60_000
  const seeds: SeedInput[] = [
    {
      id: 'OD20260821000000001', role: 'buyer', status: 'pending', productId: 'p01',
      productTitle: '王者50★ 108英雄 312皮肤 倪克斯神谕', gameName: '王者荣耀', gameCode: 'wzry', server: '安卓QQ',
      thumbnail: assetPath('assets/games/wzry.png'), goodsAmountCents: 128_000, serviceAmountCents: 0, insuranceAmountCents: 25_600,
      totalAmountCents: 153_600, expiresAt: now + 30 * 60_000, conversationId: 'trade-wzry', createdOffset: -10_000,
    },
    {
      id: 'OD20260821000000002', role: 'buyer', status: 'binding', productId: 'p02',
      productTitle: '和平精英 微信区 满级 精品衣服号', gameName: '和平精英', gameCode: 'hpjy', server: '微信区',
      thumbnail: assetPath('assets/games/hpjy.png'), goodsAmountCents: 86_000, serviceAmountCents: 0, insuranceAmountCents: 0,
      totalAmountCents: 86_000, conversationId: 'trade-hpjy', createdOffset: -41 * 60_000,
    },
    {
      id: 'OD20260821000000003', role: 'buyer', status: 'bind_success', productId: 'p03',
      productTitle: '王者荣耀 QQ区 王者50星 108英雄', gameName: '王者荣耀', gameCode: 'wzry', server: '安卓QQ',
      thumbnail: assetPath('assets/games/wzry.png'), goodsAmountCents: 128_000, serviceAmountCents: 0, insuranceAmountCents: 0,
      totalAmountCents: 128_000, actionExpiresAt: now + 61 * hour + 4 * 60_000 + 22_000, conversationId: 'trade-wzry', createdOffset: -3 * hour,
    },
    {
      id: 'OD20260801000000004', role: 'buyer', status: 'completed', productId: 'p04',
      productTitle: '原神 亚服 五星4', gameName: '原神', gameCode: 'ys', server: '亚服',
      thumbnail: assetPath('assets/games/genshin.png'), goodsAmountCents: 45_000, serviceAmountCents: 0, insuranceAmountCents: 0,
      totalAmountCents: 45_000, conversationId: 'trade-ys-closed', createdOffset: -20 * 24 * hour,
    },
    {
      id: 'OD20260820000000005', role: 'seller', status: 'binding', productId: 'p05',
      productTitle: '王者荣耀 QQ区 王者50星 108英雄', gameName: '王者荣耀', gameCode: 'wzry', server: '安卓QQ',
      thumbnail: assetPath('assets/games/wzry.png'), goodsAmountCents: 128_000, serviceAmountCents: 0, insuranceAmountCents: 0,
      totalAmountCents: 128_000, actionExpiresAt: now + 5 * hour + 42 * 60_000, conversationId: 'trade-wzry', createdOffset: -18 * hour,
    },
    {
      id: 'OD20260820000000006', role: 'seller', status: 'verifying', productId: 'p06',
      productTitle: '三角洲行动 QQ区 稀有典藏账号', gameName: '三角洲行动', gameCode: 'sjzxd', server: 'QQ区',
      thumbnail: assetPath('assets/games/delta.png'), goodsAmountCents: 330_800, serviceAmountCents: 0, insuranceAmountCents: 0,
      totalAmountCents: 330_800, conversationId: 'trade-delta', createdOffset: -24 * hour,
    },
  ]
  return seeds.map(({ createdOffset, ...record }) => ({ ...record, createdAt: now + createdOffset, updatedAt: now + createdOffset }))
}
