import { describe, expect, it } from 'vitest'
import { createSellerApplicationRepository, LEGACY_SELLER_APPLICATION_STORAGE_KEY, SELLER_APPLICATION_STORAGE_KEY, type SellerApplicationStorage } from './sellerApplicationRepository'

function storageFixture(seed?: string) {
  const values = new Map<string, string>()
  if (seed) values.set(SELLER_APPLICATION_STORAGE_KEY, seed)
  const storage: SellerApplicationStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
  return { storage, values }
}

describe('sellerApplicationRepository', () => {
  it('持久化时只保留白名单中的非敏感流程字段', () => {
    const fixture = storageFixture()
    const repository = createSellerApplicationRepository(fixture.storage)
    repository.save({ status: 'under_review', subject: 'personal', takeoutOrderMediaId: 'media-1', submittedAt: 123, realName: '不应保存' } as never)
    expect(JSON.parse(fixture.values.get(SELLER_APPLICATION_STORAGE_KEY) ?? '{}')).toEqual({ status: 'under_review', subject: 'personal', takeoutOrderMediaId: 'media-1', submittedAt: 123 })
  })

  it('损坏或越权快照回退到未开始状态', () => {
    const malformed = createSellerApplicationRepository(storageFixture('{oops').storage)
    const sensitive = createSellerApplicationRepository(storageFixture(JSON.stringify({ status: 'approved', subject: 'other', citizenId: 'secret' })).storage)
    expect(malformed.getSnapshot()).toEqual({ status: 'not_started', subject: null })
    expect(sensitive.getSnapshot()).toEqual({ status: 'not_started', subject: null })
  })

  it('企业主体保留经营实体类型并可清除', () => {
    const fixture = storageFixture()
    const repository = createSellerApplicationRepository(fixture.storage)
    repository.save({ status: 'active', subject: 'business', entityType: 'individual' })
    expect(repository.getSnapshot()).toEqual({ status: 'active', subject: 'business', entityType: 'individual' })
    expect(repository.clear()).toBe(true)
    expect(repository.getSnapshot()).toEqual({ status: 'not_started', subject: null })
  })

  it('兼容读取旧版外卖订单媒体凭证快照', () => {
    const fixture = storageFixture()
    fixture.values.set(LEGACY_SELLER_APPLICATION_STORAGE_KEY, JSON.stringify({ status: 'under_review', subject: 'personal', takeoutOrderMediaId: 'local_takeout_legacy' }))
    expect(createSellerApplicationRepository(fixture.storage).getSnapshot()).toEqual({ status: 'under_review', subject: 'personal', takeoutOrderMediaId: 'local_takeout_legacy' })
  })
})
