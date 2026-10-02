import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RestoredGoodsListView, coreFieldKind, createRestoredAttemptKeys, createRestoredPollBackoff, createRestoredSubmissionKeys, isRestoredGoodsWriteBlocked, parseRestoredPriceFen } from './RestoredGoodsPages'
import type { RestoredOwnedGoods } from '../linked/restoredGoodsApi'

const rejected: RestoredOwnedGoods = {
  id: 'goods-1', goodsNo: 'DG-1', game: { id: 'game-1', code: 'wzry', name: '王者荣耀' }, sellerRef: 'seller-1',
  title: '合成商品', description: '合成商品详情', priceFen: 120001, currency: 'CNY', productStatus: 'OFF_SHELF', auditStatus: 'REJECTED',
  currentAudit: { auditId: 'audit-1', submittedContentRevision: 1, status: 'REJECTED', rowVersion: 2, reviewReason: '请补齐截图', submittedAt: '2026-09-23T10:00:00.000Z', decidedAt: '2026-09-23T11:00:00.000Z', snapshotId: 'snapshot-1' },
  cover: null, images: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [],
  rowVersion: 2, contentRevision: 1, capabilities: { canEdit: true, canSubmit: true, canOffShelf: false, disabledReason: null },
  createdAt: '2026-09-23T10:00:00.000Z', updatedAt: '2026-09-23T11:00:00.000Z',
}

describe('restored goods pages', () => {
  it('keeps a draft key only while its attempt is unresolved and separates create from edit', () => {
    let sequence = 0
    const attempts = createRestoredAttemptKeys(kind => `${kind}-key-${++sequence}`)
    const firstCreate = attempts.acquire('create', 'content-a')
    expect(attempts.acquire('create', 'content-a')).toBe(firstCreate)
    attempts.settle('create', 'content-a', 'SUCCESS')
    const firstEdit = attempts.acquire('edit', 'content-b')
    attempts.settle('edit', 'content-b', 'SUCCESS')
    const returnedToA = attempts.acquire('edit', 'content-a')
    expect(returnedToA).not.toBe(firstCreate)
    expect(returnedToA).not.toBe(firstEdit)
    attempts.settle('edit', 'content-a', 'UNKNOWN')
    expect(attempts.acquire('edit', 'content-a')).toBe(returnedToA)
  })

  it('reuses one submit key for the same goods content revision until submission succeeds', () => {
    let sequence = 0
    const submissions = createRestoredSubmissionKeys(() => `submit-key-${++sequence}`)
    const first = submissions.acquire('goods-1', 2)
    expect(submissions.acquire('goods-1', 2)).toBe(first)
    expect(submissions.acquire('goods-1', 3)).not.toBe(first)
    submissions.succeeded('goods-1', 2)
    expect(submissions.acquire('goods-1', 2)).not.toBe(first)
  })

  it('blocks every publish write while the retained seller capability is stale', () => {
    expect(isRestoredGoodsWriteBlocked({ loading: false, busy: false, sellerCanPublish: true, sellerError: '卖家状态刷新失败', workingCanEdit: true })).toBe(true)
    expect(isRestoredGoodsWriteBlocked({ loading: false, busy: false, sellerCanPublish: true, sellerError: null, workingCanEdit: true })).toBe(false)
  })

  it('retries list polling after failures at 5, 10, 20, then 30 seconds', () => {
    const backoff = createRestoredPollBackoff()
    expect(backoff.current()).toBe(5_000)
    backoff.failed(); expect(backoff.current()).toBe(5_000)
    backoff.failed(); expect(backoff.current()).toBe(10_000)
    backoff.failed(); expect(backoff.current()).toBe(20_000)
    backoff.failed(); expect(backoff.current()).toBe(30_000)
    backoff.failed(); expect(backoff.current()).toBe(30_000)
    backoff.succeeded(); expect(backoff.current()).toBe(5_000)
  })

  it('parses integer cents without floating point price drift', () => {
    expect(parseRestoredPriceFen('1200.01')).toBe(120001)
    expect(parseRestoredPriceFen('0')).toBeNull()
    expect(parseRestoredPriceFen('1.001')).toBeNull()
    expect(parseRestoredPriceFen('900719925474099.99')).toBeNull()
  })

  it('shows the real current audit reason and only offers edit when the server capability allows it', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/my-goods"><RestoredGoodsListView goods={[rejected]} loading={false} staleError={null} busyId="" confirmId="" onConfirm={vi.fn()} onCancelConfirm={vi.fn()} /></StaticRouter>)
    expect(html).toContain('审核拒绝')
    expect(html).toContain('请补齐截图')
    expect(html).toContain('/publish?goodsId=goods-1')
    expect(html).toContain('data-restored-goods-primary-action="true"')
  })

  it('never treats an ATTRIBUTE or GROUP machine key as a core GOODS_FIELD', () => {
    expect(coreFieldKind({ sourceType: 'ATTRIBUTE', sourceKey: 'title' } as never)).toBeNull()
    expect(coreFieldKind({ sourceType: 'GOODS_FIELD', sourceKey: 'title' } as never)).toBe('title')
  })

  it('keeps stale list rows visible but removes all writes until a refresh succeeds', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/my-goods"><RestoredGoodsListView goods={[rejected]} loading={false} staleError="当前显示上次数据（可能已过期）" busyId="" confirmId="" onConfirm={vi.fn()} onCancelConfirm={vi.fn()} /></StaticRouter>)
    expect(html).toContain('可能已过期')
    expect(html).not.toContain('/publish?goodsId=goods-1')
    expect(html).not.toContain('确认下架')
  })

  it('does not link an approved item to the public detail route that restored mode has not mounted', () => {
    const item = { ...rejected, productStatus: 'ON_SALE' as const, auditStatus: 'APPROVED' as const, currentAudit: { ...rejected.currentAudit!, status: 'APPROVED' as const, reviewReason: null }, capabilities: { canEdit: false, canSubmit: false, canOffShelf: true, disabledReason: '商品必须先下架才能编辑' } }
    const html = renderToStaticMarkup(<StaticRouter location="/my-goods"><RestoredGoodsListView goods={[item]} loading={false} staleError={null} busyId="" confirmId="" onConfirm={vi.fn()} onCancelConfirm={vi.fn()} /></StaticRouter>)
    expect(html).not.toContain('/goods/goods-1')
    expect(html).toContain('公开详情待接入')
    expect(html).toContain('data-restored-goods-off-shelf-trigger="true"')
  })
})
