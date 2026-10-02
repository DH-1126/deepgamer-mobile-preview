import { describe, expect, it } from 'vitest'
import { createRestoredGoodsApi, createRestoredGoodsPersistence } from './restoredGoodsApi'
import { RestoredHttpError, type RestoredEnvelope } from './restoredLinkedTransport'

const goods = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, goodsNo: `DG-${id}`, game: { id: 'game-1', code: 'wzry', name: '王者荣耀' }, sellerRef: 'seller-1',
  title: '合成商品', description: '合成商品详情', priceFen: 1200, currency: 'CNY', productStatus: 'OFF_SHELF', auditStatus: 'NOT_SUBMITTED', currentAudit: null,
  cover: null, images: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [],
  rowVersion: 1, contentRevision: 1, capabilities: { canEdit: true, canSubmit: true, canOffShelf: false, disabledReason: null },
  createdAt: '2026-09-23T10:00:00.000Z', updatedAt: '2026-09-23T10:00:00.000Z', ...overrides,
})

describe('restored goods API', () => {
  it('accepts an empty description from create, read, and list responses', async () => {
    const transport = {
      async read<T>(path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        const payload = path === '/client/goods/goods-empty' ? goods('goods-empty', { description: '' }) : [goods('goods-empty', { description: '' })]
        return { data: parse(payload), ...(Array.isArray(payload) ? { meta: { page: 1, pageSize: 50, total: 1 } } : {}) }
      },
      async write<T>(_path: string, _body: unknown, _key: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        return { data: parse(goods('goods-empty', { description: '' })) }
      },
    }
    const api = createRestoredGoodsApi(transport as never)
    const input = { gameCode: 'wzry', title: '合成商品', description: '', priceFen: 1200, coverMediaId: null, imageMediaIds: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [], reason: '保存空描述草稿' }
    await expect(api.createDraft(input, 'create-empty-description')).resolves.toMatchObject({ description: '' })
    await expect(api.read('goods-empty')).resolves.toMatchObject({ description: '' })
    await expect(api.listAll()).resolves.toEqual([expect.objectContaining({ description: '' })])
  })

  it('reads the standard data[] + meta envelope through every owned page', async () => {
    const paths: string[] = []
    const transport = {
      async read<T>(path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        paths.push(path)
        const page = Number(new URL(`http://test${path}`).searchParams.get('page'))
        const rows = page === 1 ? [goods('goods-1'), goods('goods-2')] : [goods('goods-3')]
        return { data: parse(rows), meta: { page, pageSize: 2, total: 3 } }
      },
      async write() { throw new Error('unexpected write') },
      async readPublishedGameConfig() { throw new Error('unexpected public read') },
    }
    expect((await createRestoredGoodsApi(transport as never).listAll()).map(item => item.id)).toEqual(['goods-1', 'goods-2', 'goods-3'])
    expect(paths).toEqual(['/client/goods?page=1&pageSize=50', '/client/goods?page=2&pageSize=50'])
  })

  it('reads active catalog games from the client envelope without management fields', async () => {
    const transport = {
      async read<T>(_path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        return { data: parse([{ id: 'game-1', code: 'wzry', name: '王者荣耀', status: 'ACTIVE', rowVersion: 1, sortOrder: 10, iconUrl: null }]), meta: { page: 1, pageSize: 50, total: 1 } }
      },
    }
    expect(await createRestoredGoodsApi(transport as never).listGames()).toEqual([{ id: 'game-1', code: 'wzry', name: '王者荣耀', status: 'ACTIVE', rowVersion: 1, sortOrder: 10, iconUrl: null }])
  })

  it('uses the exact POST draft path and caller-owned stable keys for create, edit, submit and off-shelf', async () => {
    const calls: Array<{ path: string; body: unknown; key: string }> = []
    const transport = {
      async read() { throw new Error('unexpected read') },
      async readPublishedGameConfig() { throw new Error('unexpected public read') },
      async write<T>(path: string, body: unknown, key: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        calls.push({ path, body, key })
        return { data: parse(path.endsWith('audit-submissions') ? {
          auditId: 'audit-1', submissionNo: 1, status: 'PENDING', submittedAt: '2026-09-23T10:00:00.000Z', auditRowVersion: 1,
          snapshotAvailability: 'AVAILABLE', snapshot: { id: 'snapshot-1', goodsId: 'goods-1', contentRevision: 2, purpose: 'AUDIT_SUBMISSION', content: {}, attributeRefs: [], schemaHash: 'schema-1', createdBy: null, createdAt: '2026-09-23T10:00:00.000Z' },
        } : goods('goods-1', { rowVersion: 2, contentRevision: 2 })) }
      },
    }
    const api = createRestoredGoodsApi(transport as never)
    const draft = { gameCode: 'wzry', title: '合成商品', description: '合成商品详情', priceFen: 1200, coverMediaId: null, imageMediaIds: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [], reason: '保存合成草稿' }
    await api.createDraft(draft, 'goods-create-stable-key')
    await api.updateDraft('goods-1', { ...draft, rowVersion: 1, contentRevision: 1 }, 'goods-update-stable-key')
    await api.submit('goods-1', { rowVersion: 2, contentRevision: 2, reason: '提交合成审核' }, 'goods-submit-stable-key')
    await api.offShelf('goods-1', { rowVersion: 2, reason: '主动下架合成商品' }, 'goods-off-shelf-key')
    expect(calls.map(call => [call.path, call.key])).toEqual([
      ['/client/goods', 'goods-create-stable-key'],
      ['/client/goods/goods-1/draft', 'goods-update-stable-key'],
      ['/client/goods/goods-1/audit-submissions', 'goods-submit-stable-key'],
      ['/client/goods/goods-1/off-shelf', 'goods-off-shelf-key'],
    ])
  })

  it('rejects malformed owned DTOs rather than inventing row or audit defaults', async () => {
    const transport = { async read<T>(_path: string, parse: (value: unknown) => T) { return { data: parse([{ ...goods('goods-1'), currentAudit: { status: 'APPROVED' } }]), meta: { page: 1, pageSize: 50, total: 1 } } } }
    await expect(createRestoredGoodsApi(transport as never).listAll()).rejects.toThrow(/本人商品数据不符合契约/)
  })

  it('retains a created goods id after submit failure and does not create the draft again on retry', async () => {
    let creates = 0
    const created = goods('goods-retained')
    const api = {
      async createDraft() { creates++; return created },
      async updateDraft() { throw new Error('unexpected update') },
    }
    const persistence = createRestoredGoodsPersistence(api as never)
    const input = { gameCode: 'wzry', title: '合成商品', description: '合成详情', priceFen: 1200, coverMediaId: null, imageMediaIds: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [], reason: '保存草稿' }
    expect((await persistence.save(input, 'goods-create-stable-key')).id).toBe('goods-retained')
    await expect(Promise.reject(new Error('送审失败'))).rejects.toThrow('送审失败')
    expect((await persistence.save(input, 'goods-create-stable-key')).id).toBe('goods-retained')
    expect(creates).toBe(1)
  })

  it('does not patch or advance content revision when only the operation reason changes before submit retry', async () => {
    const calls: string[] = []
    const created = goods('goods-same-content', { rowVersion: 3, contentRevision: 2 })
    const api = {
      async createDraft() { calls.push('create'); return created },
      async updateDraft() { calls.push('update'); return goods('goods-same-content', { rowVersion: 4, contentRevision: 3 }) },
    }
    const persistence = createRestoredGoodsPersistence(api as never)
    const content = { gameCode: 'wzry', title: '合成商品', description: '', priceFen: 1200, coverMediaId: null, imageMediaIds: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [] }
    const first = await persistence.save({ ...content, reason: '卖家创建本地商品草稿' }, 'create-key')
    const beforeSubmitRetry = await persistence.save({ ...content, reason: '卖家更新本地商品草稿' }, 'edit-key')
    expect(calls).toEqual(['create'])
    expect({ id: beforeSubmitRetry.id, rowVersion: beforeSubmitRetry.rowVersion, contentRevision: beforeSubmitRetry.contentRevision }).toEqual({ id: first.id, rowVersion: 3, contentRevision: 2 })
  })

  it('locks an unknown create to its original payload and retries it with the original key before edits', async () => {
    const calls: Array<{ title: string; key: string }> = []
    const created = goods('goods-recovered')
    const api = {
      async createDraft(input: { title: string }, key: string) {
        calls.push({ title: input.title, key })
        if (calls.length === 1) throw new RestoredHttpError(0, 'TIMEOUT', '创建结果未知', 'UNKNOWN')
        return created
      },
      async updateDraft() { throw new Error('unexpected update') },
    }
    const persistence = createRestoredGoodsPersistence(api as never)
    const original = { gameCode: 'wzry', title: '原始标题', description: '合成详情', priceFen: 1200, coverMediaId: null, imageMediaIds: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [], reason: '保存草稿' }
    await expect(persistence.save(original, 'original-create-key')).rejects.toMatchObject({ outcome: 'UNKNOWN' })
    await expect(persistence.save({ ...original, title: '修改后的标题' }, 'changed-create-key')).rejects.toThrow(/上次创建结果未知/)
    expect(calls).toEqual([{ title: '原始标题', key: 'original-create-key' }])
    expect((await persistence.save(original, 'replacement-key')).id).toBe('goods-recovered')
    expect(calls).toEqual([
      { title: '原始标题', key: 'original-create-key' },
      { title: '原始标题', key: 'original-create-key' },
    ])
  })
})
