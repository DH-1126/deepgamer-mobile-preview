import { describe, expect, it } from 'vitest'
import { countMeaningfulLinkedAttributes, getLinkedPublishSnapshotFields, hasMeaningfulLinkedAttribute, isPublicGoods, toCatalogProduct, toProductDetail, type LinkedGame, type LinkedGoods } from './linkedData'

const game: LinkedGame = { id: 'game-wzry', code: 'wzry', name: '王者荣耀', status: 'ACTIVE', rowVersion: 1, iconUrl: null, sortOrder: 1 }
const goods: LinkedGoods = {
  id: 'goods-1', goodsNo: 'DG-1', gameCode: 'wzry', sellerId: 'linked_seller_001', sellerName: '联动演示卖家',
  title: '联动测试商品', priceFen: 128099, description: '第一行\n第二行', images: ['data:image/png;base64,AA=='], mediaIds: ['media-1'],
  attributes: { platform: '安卓QQ', rank: '荣耀王者', heroCount: 108, tags: ['V10'], ignoredObject: { unsafe: true } },
  productStatus: 'ON_SALE', auditStatus: 'APPROVED', rowVersion: 2, auditVersion: 1, auditCaseId: 'audit-1', submissionNo: 1,
  reviewReason: '', createdAt: '2026-09-11T00:00:00.000Z', updatedAt: '2026-09-11T01:00:00.000Z', submittedAt: '2026-09-11T00:00:00.000Z', locked: false, source: 'SELF_SERVICE',
}

describe('linked user projections', () => {
  it('only exposes approved on-sale goods in the public catalog', () => {
    expect(isPublicGoods(goods)).toBe(true)
    expect(isPublicGoods({ ...goods, auditStatus: 'REJECTED' })).toBe(false)
    expect(isPublicGoods({ ...goods, productStatus: 'OFF_SHELF' })).toBe(false)
  })

  it('converts integer fen to yuan and drops unsupported nested attributes', () => {
    const product = toCatalogProduct(goods)
    expect(product).toMatchObject({ id: 'goods-1', price: 1280.99, platform: '安卓QQ', heroCount: 108 })
    expect(product.attributeValues).not.toHaveProperty('ignoredObject')
    const detail = toProductDetail({ ...goods, productStatus: 'OFF_SHELF' }, game)
    expect(detail).toMatchObject({ productCode: 'DG-1', price: 1280.99, status: 'off_shelf', description: ['第一行', '第二行'] })
  })

  it('does not count blank strings but preserves false and zero as supplied values', () => {
    const attributes = { platform: '   ', negotiable: false, skinCount: 0, missing: null }
    expect(hasMeaningfulLinkedAttribute(attributes, 'platform')).toBe(false)
    expect(hasMeaningfulLinkedAttribute(attributes, 'negotiable')).toBe(true)
    expect(hasMeaningfulLinkedAttribute(attributes, 'skinCount')).toBe(true)
    expect(hasMeaningfulLinkedAttribute(attributes, 'missing')).toBe(false)
    expect(countMeaningfulLinkedAttributes(attributes, ['platform', 'negotiable', 'skinCount', 'missing'])).toBe(2)
  })

  it('projects frozen publish labels and display values without exposing enum IDs as detail text', () => {
    const publishSnapshot = {
      versionId: 'publish-1', baseConfigVersionId: 'base-1', schemaHash: 'hash-1', sections: [{
        sectionKey: 'account', title: '账号资料', sortOrder: 1, fields: [
          { fieldKey: 'os-field', logicalKey: 'operating_system', sourceId: 'os', label: '设备系统', valueType: 'ENUM' as const, uiType: 'SELECT' as const, required: true, sortOrder: 1, provided: true, value: 'option-ios', displayValue: 'iOS' },
          { fieldKey: 'count-field', logicalKey: 'costume_count', sourceId: 'count', label: '时装数量', valueType: 'NUMBER' as const, uiType: 'NUMBER' as const, required: false, sortOrder: 2, provided: false, value: null, displayValue: '未提供' },
        ],
      }],
    }
    const detail = toProductDetail({ ...goods, attributes: { operating_system: 'option-ios' }, publishSnapshot }, game)
    expect(detail.summary).toEqual([{ label: '设备系统', value: 'iOS' }])
    expect(detail.linkedPublishSnapshot).toEqual(publishSnapshot)
    expect(getLinkedPublishSnapshotFields(detail.linkedPublishSnapshot).map((field) => field.displayValue)).toEqual(['iOS', '未提供'])
  })
})
