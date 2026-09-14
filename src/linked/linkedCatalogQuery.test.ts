import { describe, expect, it } from 'vitest'
import type { LinkedGoods, LinkedState } from '../../../双端演示/src/contract'
import { getLinkedPublishForm, submittedPublishData } from '../../../双端演示/src/publish-config'
import { getLinkedSearchProjection } from '../../../双端演示/src/search-config'
import { createLinkedSeed } from '../../../双端演示/src/seed'
import { queryLinkedCatalogProducts } from './linkedCatalogQuery'
import { buildLinkedSearchRequest } from './linkedSearchModel'

const goods = (overrides: Partial<LinkedGoods>): LinkedGoods => ({
  id: 'goods-1', goodsNo: 'DG-1', gameCode: 'dwrg', sellerId: 'seller-1', sellerName: '卖家', title: '第五人格 iOS 账号', description: '演示商品',
  priceFen: 10000, images: [], mediaIds: [], attributes: {}, productStatus: 'ON_SALE', auditStatus: 'APPROVED', rowVersion: 1, auditVersion: 1,
  auditCaseId: 'audit-1', submissionNo: 1, reviewReason: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  submittedAt: '2026-01-01T00:00:00.000Z', locked: false, source: 'SELF_SERVICE', ...overrides,
})

const state = (items: LinkedGoods[]): LinkedState => ({
  sessionId: 'session-1', revision: 1,
  seller: { id: 'seller-1' } as LinkedState['seller'],
  games: [{ id: 'game-dwrg', code: 'dwrg', name: '第五人格', status: 'ACTIVE', rowVersion: 1, iconUrl: null, sortOrder: 1 }],
  goods: items, media: {}, titleConfigs: [], publishConfigs: [], detailConfigs: [], searchConfigs: [],
})

describe('linked catalog query', () => {
  it('keeps baseline goods visible without dynamic clauses even when SEARCH is missing', () => {
    expect(queryLinkedCatalogProducts(state([goods({})]), { gameCode: 'dwrg', keyword: '', minPrice: '', maxPrice: '', sort: 'default' })).toHaveLength(1)
  })

  it('composes ordinary keyword, exact fen price, and sorting without fixed product fallbacks', () => {
    const result = queryLinkedCatalogProducts(state([
      goods({ id: 'low', priceFen: 0, title: '零元演示' }),
      goods({ id: 'high', priceFen: 1550, title: 'iOS 高价演示' }),
      goods({ id: 'outside', priceFen: 9999, title: 'iOS 超出' }),
    ]), { gameCode: 'dwrg', keyword: 'iOS', minPrice: '0', maxPrice: '20', sort: 'price_desc' })
    expect(result.map((item) => item.id)).toEqual(['high'])
  })

  it('does not expose off-shelf or disabled-game goods', () => {
    expect(queryLinkedCatalogProducts(state([goods({ productStatus: 'OFF_SHELF' })]), { gameCode: 'dwrg', keyword: '', minPrice: '', maxPrice: '', sort: 'default' })).toEqual([])
    const disabled = state([goods({})]); disabled.games[0].status = 'DISABLED'
    expect(queryLinkedCatalogProducts(disabled, { gameCode: 'dwrg', keyword: '', minPrice: '', maxPrice: '', sort: 'default' })).toEqual([])
  })

  it('matches the real dwrg snapshot at the zero boundary and rejects missing facts/raw attributes', () => {
    const linked = { ...createLinkedSeed(), sessionId: 'mobile-search-session', revision: 1, media: {}, seller: { id: 'seller-1' } } as LinkedState
    const publishForm = getLinkedPublishForm(linked, 'dwrg')
    const fields = publishForm.sections.flatMap((section) => section.fields)
    const enumeration = fields.find((field) => field.valueType === 'ENUM')!
    const number = fields.find((field) => field.valueType === 'NUMBER')!
    const submitted = submittedPublishData(linked, 'dwrg', {
      publishVersionId: publishForm.versionId,
      publishSchemaHash: publishForm.schemaHash,
      formValues: { [enumeration.fieldKey]: enumeration.options[0]!.id, [number.fieldKey]: 0 },
    })
    const exact = goods({ id: 'exact-zero', attributes: submitted.attributes ?? {}, publishSnapshot: submitted.publishSnapshot })
    const rawOnly = goods({ id: 'raw-only', attributes: { [enumeration.logicalKey]: enumeration.options[0]!.id, [number.logicalKey]: 0 } })
    linked.goods = [exact, rawOnly]

    const search = getLinkedSearchProjection(linked, 'dwrg')
    const enumSearch = search.fields.find((field) => field.logicalKey === enumeration.logicalKey)!
    const numberSearch = search.fields.find((field) => field.logicalKey === number.logicalKey)!
    const built = buildLinkedSearchRequest(search, {
      [enumSearch.id]: { optionId: enumeration.options[0]!.id },
      [numberSearch.id]: { min: '0', max: '0' },
    })
    expect(built.issues).toEqual([])
    expect(queryLinkedCatalogProducts(linked, { gameCode: 'dwrg', keyword: '', minPrice: '', maxPrice: '', sort: 'default', searchRequest: built.request }).map((item) => item.id)).toEqual(['exact-zero'])
  })
})
