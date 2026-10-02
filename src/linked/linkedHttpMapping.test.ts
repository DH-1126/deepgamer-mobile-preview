import { describe, expect, it } from 'vitest'
import { flattenSections, toLinkedGames, toLinkedGoods, type AdminGameRow, type AdminGoodsDetail } from './linkedHttpMapping'

describe('linked http mapping', () => {
  it('maps admin games and skips unsupported game codes', () => {
    const rows: AdminGameRow[] = [
      { id: 'game_wzry', code: 'wzry', name: '王者荣耀', status: 'ACTIVE', rowVersion: 1, sortOrder: 1 },
      { id: 'game_hpjy', code: 'hpjy', name: '和平精英', status: 'ACTIVE', rowVersion: 1, sortOrder: 2 },
      { id: 'game_x', code: 'luoke', name: '洛克王国', status: 'ACTIVE', rowVersion: 1, sortOrder: 3 },
      { id: 'game_dwrg', code: 'dwrg', name: '第五人格', status: 'DISABLED', rowVersion: 3, sortOrder: 5, iconUrl: '/assets/games/dwrg.png' },
    ]
    const { games, skipped } = toLinkedGames(rows)
    expect(games.map((game) => game.code)).toEqual(['wzry', 'hpjy', 'dwrg'])
    expect(skipped).toEqual(['luoke'])
    expect(games[2]).toMatchObject({ status: 'DISABLED', iconUrl: '/assets/games/dwrg.png' })
  })

  it('flattens publish sections into attributes', () => {
    const sections: AdminGoodsDetail['sections'] = [
      { sectionKey: 's1', fields: [{ fieldKey: 'accountNo', value: 'demo***1' }, { fieldKey: 'region', displayValue: '安卓 QQ' }, {}, { fieldKey: '', value: 'x' }] },
      { sectionKey: 's2', fields: [{ fieldKey: 'nobleLevel', value: 'V8' }] },
    ]
    expect(flattenSections(sections)).toEqual({ accountNo: 'demo***1', region: '安卓 QQ', nobleLevel: 'V8' })
  })

  it('maps a goods detail into a contract LinkedGoods with safe defaults', () => {
    const detail: AdminGoodsDetail = {
      id: 'goods_1', goodsNo: 'DGSP1', title: '王者荣耀｜测试号', priceFen: 26800,
      description: '描述', productStatus: 'ON_SALE', auditStatus: 'APPROVED', rowVersion: 2,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
      game: { id: 'game_wzry', code: 'wzry', name: '王者荣耀' },
      seller: { sellerRef: 's1', displayName: '演示卖家' },
      sections: [{ fields: [{ fieldKey: 'nobleLevel', value: 'V5' }] }],
      media: [{ assetId: 'm1', url: '/assets/goods/a.svg' }, { assetId: undefined, url: undefined }],
      orderLock: { locked: false },
    }
    const goods = toLinkedGoods(detail, 'wzry', 'fallback', '兜底卖家')
    expect(goods).toMatchObject({
      id: 'goods_1', goodsNo: 'DGSP1', gameCode: 'wzry', sellerId: 's1', sellerName: '演示卖家',
      title: '王者荣耀｜测试号', priceFen: 26800, images: ['/assets/goods/a.svg'], mediaIds: ['m1'],
      attributes: { nobleLevel: 'V5' }, productStatus: 'ON_SALE', auditStatus: 'APPROVED',
      rowVersion: 2, source: 'BASELINE', locked: false,
    })
  })

  it('falls back to unknown-safe defaults and rejects unsupported games', () => {
    const sparse: AdminGoodsDetail = { id: 'g', goodsNo: 'N', title: 'T', priceFen: 0, game: { code: 'unknown' } }
    expect(toLinkedGoods(sparse, 'wzry', 'f', 'f')).toBeNull()
    const noGame: AdminGoodsDetail = { id: 'g2', goodsNo: 'N2', title: 'T2', priceFen: 100 }
    const mapped = toLinkedGoods(noGame, 'wzry', 'f', '兜底')
    expect(mapped).toMatchObject({ gameCode: 'wzry', sellerName: '兜底', productStatus: 'OFF_SHELF', auditStatus: 'NOT_SUBMITTED', rowVersion: 1, images: [] })
  })
})
