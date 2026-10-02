import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { RestoredRecycleNewMerchantSnapshot } from '../linked/restoredRecycleDistributionController'
import type { RecycleSnapshot } from '../linked/restoredRecycleController'
import { RestoredRecycleNewMerchantView, RestoredRecycleRequestHomeView } from './RestoredRecycleRequestPages'

const hash = 'a'.repeat(64)
const form: RecycleSnapshot = {
  catalog: [{ gameCode: 'wzry', gameName: '王者荣耀', available: true, blockedReason: null, eligibleRecyclerCount: 2 }],
  detail: { gameCode: 'wzry', gameName: '王者荣耀', fieldTemplateVersion: 3, fieldSchemaHash: hash, available: true, blockedReason: null, attachmentsAvailable: true, fields: [{ fieldKey: 'rank', label: '段位', valueType: 'single', required: true, options: [{ label: '王者', value: 'king' }] }], recyclers: [] },
  loading: false, error: null, values: { rank: 'king' }, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false,
}
const request = { requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', latestRevisionId: 'revision-2', latestProfileVersion: 2, createdAt: '2026-09-28T02:00:00.000Z' }

describe('saved recycle request pages', () => {
  it('warns against refresh or close while save and distribution commands are unresolved', async () => {
    const module = await import('./RestoredRecycleRequestPages') as typeof import('./RestoredRecycleRequestPages') & { shouldProtectRecycleUnload?: (request: { saveState: string } | null, revision: { saveState: string; targets: { state: string }[] } | null, distribution: { confirmationState: string; targets: { state: string }[] } | null) => boolean }
    expect(typeof module.shouldProtectRecycleUnload).toBe('function')
    if (!module.shouldProtectRecycleUnload) return
    expect(module.shouldProtectRecycleUnload({ saveState: 'saving' }, null, null)).toBe(true)
    expect(module.shouldProtectRecycleUnload({ saveState: 'unknown' }, null, null)).toBe(true)
    expect(module.shouldProtectRecycleUnload(null, { saveState: 'saved', targets: [{ state: 'unknown' }] }, null)).toBe(true)
    expect(module.shouldProtectRecycleUnload(null, null, { confirmationState: 'confirmed', targets: [{ state: 'SENDING' }] })).toBe(true)
    expect(module.shouldProtectRecycleUnload({ saveState: 'saved' }, { saveState: 'saved', targets: [{ state: 'success' }] }, { confirmationState: 'confirmed', targets: [{ state: 'SUCCESS' }] })).toBe(false)

    const savingHtml = renderToStaticMarkup(<StaticRouter location="/recycle"><RestoredRecycleRequestHomeView snapshot={{ form, requests: [], loadingRequests: false, error: null, accessLost: false, saveState: 'saving', saveRetryable: false, savedRequest: null }} onGameChange={vi.fn()} onValueChange={vi.fn()} onAttachmentsAdd={vi.fn()} onAttachmentRemove={vi.fn()} onAttachmentRetry={vi.fn()} onSave={vi.fn()} onCheckUnknownSave={vi.fn()} onRetrySave={vi.fn()} onNewRequest={vi.fn()} onRefresh={vi.fn()} /></StaticRouter>)
    expect(savingHtml).toContain('结果尚未确认，请先查询原操作，暂勿刷新或关闭页面')
  })

  it('renders save-only entry and owner request list without any recycler selection or send action', async () => {
    const html = renderToStaticMarkup(<StaticRouter location="/recycle"><RestoredRecycleRequestHomeView snapshot={{ form, requests: [request], loadingRequests: false, error: null, accessLost: false, saveState: 'idle', saveRetryable: false, savedRequest: null }} onGameChange={vi.fn()} onValueChange={vi.fn()} onAttachmentsAdd={vi.fn()} onAttachmentRemove={vi.fn()} onAttachmentRetry={vi.fn()} onSave={vi.fn()} onCheckUnknownSave={vi.fn()} onRetrySave={vi.fn()} onNewRequest={vi.fn()} onRefresh={vi.fn()} /></StaticRouter>)
    expect(html).toContain('保存资料，稍后选择回收商')
    expect(html).toContain('保存不会创建咨询群、发送消息或授权商家读取')
    expect(html).toContain('我已保存的回收请求')
    expect(html).toContain('href="/recycle/requests/request-1"')
    expect(html).toContain('最新资料版本 v2')
    expect(html).not.toMatch(/<h2[^>]*>选择回收商<\/h2>/)
    expect(html).not.toContain('确认并逐商提交')
  })

  it('shows frozen new-merchant confirmation and independent resolved result links', async () => {
    const snapshot: RestoredRecycleNewMerchantSnapshot = {
      loading: false, error: null, accessLost: false, context: null,
      revisions: [{ revisionId: 'revision-2', requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [], attachments: [], createdAt: '2026-09-28T02:00:00.000Z' }],
      selectedRevisionId: 'revision-2', availableRecyclers: [{ recyclerId: 'shop-1', displayName: '新商家甲', eligible: true, blockedReason: null }, { recyclerId: 'shop-2', displayName: '新商家乙', eligible: true, blockedReason: null }], selectedRecyclerIds: ['shop-1', 'shop-2'],
      confirmation: { revisionId: 'revision-2', profileVersion: 2, selectedRecyclerIds: ['shop-1', 'shop-2'], selectedRecyclerNames: ['新商家甲', '新商家乙'] }, confirmationState: 'idle', confirmationRetryable: false, busy: false,
      targets: [],
    }
    const callbacks = { onSelectRevision: vi.fn(), onRecyclerToggle: vi.fn(), onRequestConfirmation: vi.fn(), onCancelConfirmation: vi.fn(), onConfirm: vi.fn(), onCheckUnknownConfirmation: vi.fn(), onRetryConfirmation: vi.fn(), onCheckUnknownTarget: vi.fn(), onRetryTarget: vi.fn(), onFinish: vi.fn(), onRefresh: vi.fn() }
    const confirmHtml = renderToStaticMarkup(<StaticRouter location="/recycle/requests/request-1"><RestoredRecycleNewMerchantView snapshot={snapshot} {...callbacks} /></StaticRouter>)
    expect(confirmHtml).toContain('确认首次分发资料版本 v2')
    expect(confirmHtml).toContain('共 2 家')
    expect(confirmHtml).toContain('新商家甲')
    expect(confirmHtml).toContain('新商家乙')

    const resultHtml = renderToStaticMarkup(<StaticRouter location="/recycle/requests/request-1"><RestoredRecycleNewMerchantView snapshot={{ ...snapshot, confirmation: null, confirmationState: 'confirmed', targets: [{ recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'SUCCESS', state: 'SUCCESS', consultationId: 'consult-1', conversationId: 'conversation-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z', errorCode: null, errorMessage: null, retryable: false, localError: null, key: 'target-key-1' }, { recyclerId: 'shop-2', recyclerName: '新商家乙', status: 'FAILED', state: 'FAILED', consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: 'RECYCLE_RECYCLER_UNAVAILABLE', errorMessage: '暂不可用', retryable: true, localError: '暂不可用', key: 'target-key-2' }] }} {...callbacks} /></StaticRouter>)
    expect(resultHtml).toContain('href="/recycle/consultations/consult-1?revision=revision-2"')
    expect(resultHtml).toContain('href="/im/conversation-1"')
    expect(resultHtml).toContain('重试原分发操作')
    expect(resultHtml).toMatch(/<button[^>]*>结束本次分发<\/button>/)
  })

  it('keeps unknown confirmation query-only until the server proves the original command did not run', async () => {
    const base: RestoredRecycleNewMerchantSnapshot = { loading: false, error: '原结果待查询', accessLost: false, context: null, revisions: [], selectedRevisionId: '', availableRecyclers: [], selectedRecyclerIds: [], confirmation: null, confirmationState: 'unknown', confirmationRetryable: false, targets: [], busy: false }
    const callbacks = { onSelectRevision: vi.fn(), onRecyclerToggle: vi.fn(), onRequestConfirmation: vi.fn(), onCancelConfirmation: vi.fn(), onConfirm: vi.fn(), onCheckUnknownConfirmation: vi.fn(), onRetryConfirmation: vi.fn(), onCheckUnknownTarget: vi.fn(), onRetryTarget: vi.fn(), onFinish: vi.fn(), onRefresh: vi.fn() }
    const queryOnly = renderToStaticMarkup(<StaticRouter location="/"><RestoredRecycleNewMerchantView snapshot={base} {...callbacks} /></StaticRouter>)
    expect(queryOnly).toContain('查询原分发结果')
    expect(queryOnly).not.toContain('重试原分发确认')
    const retryable = renderToStaticMarkup(<StaticRouter location="/"><RestoredRecycleNewMerchantView snapshot={{ ...base, confirmationRetryable: true }} {...callbacks} /></StaticRouter>)
    expect(retryable).toContain('重试原分发确认')
  })

  it('shows an unavailable new merchant disabled with a safe Chinese reason', () => {
    const snapshot: RestoredRecycleNewMerchantSnapshot = { loading: false, error: null, accessLost: false, context: null, revisions: [], selectedRevisionId: '', availableRecyclers: [{ recyclerId: 'shop-2', displayName: '新商家乙', eligible: false, blockedReason: 'GAME_RELATION_DISABLED' }], selectedRecyclerIds: [], confirmation: null, confirmationState: 'idle', confirmationRetryable: false, targets: [], busy: false }
    const callbacks = { onSelectRevision: vi.fn(), onRecyclerToggle: vi.fn(), onRequestConfirmation: vi.fn(), onCancelConfirmation: vi.fn(), onConfirm: vi.fn(), onCheckUnknownConfirmation: vi.fn(), onRetryConfirmation: vi.fn(), onCheckUnknownTarget: vi.fn(), onRetryTarget: vi.fn(), onFinish: vi.fn(), onRefresh: vi.fn() }
    const html = renderToStaticMarkup(<StaticRouter location="/"><RestoredRecycleNewMerchantView snapshot={snapshot} {...callbacks} /></StaticRouter>)
    expect(html).toContain('新商家乙')
    expect(html).toContain('回收商暂不接收此游戏')
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*disabled=""/)
    expect(html).not.toContain('GAME_RELATION_DISABLED')
  })
})
