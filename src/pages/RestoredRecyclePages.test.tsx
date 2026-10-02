import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { RecycleSnapshot } from '../linked/restoredRecycleController'
import { RestoredRecycleConsultationView, RestoredRecycleView } from './RestoredRecyclePages'
import { RestoredRecycleRevisionView } from './RestoredRecyclePages'
import type { RestoredRecycleRevisionSnapshot } from '../linked/restoredRecycleRevisionController'
import { createRestoredRecycleRevisionController } from '../linked/restoredRecycleRevisionController'
import { createRestoredRecycleRevisionApi } from '../linked/restoredRecycleRevisionApi'

const hash = 'a'.repeat(64)
const base: RecycleSnapshot = { catalog: [{ gameCode: 'wzry', gameName: '王者荣耀', available: true, blockedReason: null, eligibleRecyclerCount: 2 }], detail: { gameCode: 'wzry', gameName: '王者荣耀', fieldTemplateVersion: 3, fieldSchemaHash: hash, fields: [{ fieldKey: 'rank', label: '段位', valueType: 'single', required: true, options: [{ label: '王者', value: 'king' }] }], available: true, blockedReason: null, attachmentsAvailable: true, recyclers: [{ recyclerId: 'shop-1', displayName: '店铺一', eligible: true, blockedReason: null }, { recyclerId: 'shop-2', displayName: '店铺二', eligible: true, blockedReason: null }] }, loading: false, error: null, values: {}, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false }
const callbacks = { onGameChange: vi.fn(), onValueChange: vi.fn(), onAttachmentsAdd: vi.fn(), onAttachmentRemove: vi.fn(), onAttachmentRetry: vi.fn(), onRecyclerToggle: vi.fn(), onRequestConfirmation: vi.fn(), onConfirm: vi.fn(), onCancelConfirmation: vi.fn(), onRetry: vi.fn(), onCheckUnknown: vi.fn(), onStartNew: vi.fn(), onRefresh: vi.fn() }
const render = (snapshot: RecycleSnapshot) => renderToStaticMarkup(<StaticRouter location="/recycle"><RestoredRecycleView snapshot={snapshot} {...callbacks} /></StaticRouter>)
const revisionCallbacks = { onSelectRevision: vi.fn(), onBeginEdit: vi.fn(), onCancelEdit: vi.fn(), onValueChange: vi.fn(), onAttachmentsAdd: vi.fn(), onAttachmentRemove: vi.fn(), onAttachmentRetry: vi.fn(), onSave: vi.fn(), onCheckUnknownSave: vi.fn(), onRetrySave: vi.fn(), onConsultationToggle: vi.fn(), onRequestDeliveryConfirmation: vi.fn(), onCancelDeliveryConfirmation: vi.fn(), onConfirmDelivery: vi.fn(), onCheckUnknownTarget: vi.fn(), onRetryTarget: vi.fn() }
const renderRevision = (snapshot: RestoredRecycleRevisionSnapshot) => renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1?revision=revision-2"><RestoredRecycleRevisionView snapshot={snapshot} {...revisionCallbacks} /></StaticRouter>)

describe('restored recycle pages', () => {
  it('maps the real frozen edit-context field shapes through the API and controller into all four inputs', async () => {
    const rawContext = {
      requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true,
      baseRevisionId: 'revision-1', fieldTemplateVersion: 3, fieldSchemaHash: hash,
      fields: [
        { sourceRefType: 'attr', sourceRefKey: 'account_note', fieldKey: 'attr:account_note', label: '账号说明', valueType: 'STRING', uiType: 'input', order: 0, required: true, options: [], multiValues: [] },
        { sourceRefType: 'attr', sourceRefKey: 'account_level', fieldKey: 'attr:account_level', label: '账号等级', valueType: 'NUMBER', uiType: 'number', order: 1, required: true, options: [], multiValues: [] },
        { sourceRefType: 'attr', sourceRefKey: 'account_region', fieldKey: 'attr:account_region', label: '账号大区', valueType: 'ENUM', uiType: 'select', order: 2, required: true, options: [{ label: '北区', value: 'north' }, { label: '南区', value: 'south' }], multiValues: [] },
        { sourceRefType: 'attr_group', sourceRefKey: 'rare_items', fieldKey: 'attr_group:rare_items', label: '稀有物品', valueType: 'ENUM', uiType: 'checkbox', order: 3, required: false, options: [{ label: '限定', value: 'limited' }, { label: '稀世', value: 'rare' }], multiValues: [] },
      ],
      values: { 'attr:account_note': '合成初版资料', 'attr:account_level': 12, 'attr:account_region': 'north', 'attr_group:rare_items': ['limited'] },
      attachments: [], consultations: [{ consultationId: 'consult-1', recyclerId: 'shop-1', recyclerName: '店铺一', conversationId: 'conversation-1', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' }],
    }
    const revision = { revisionId: 'revision-1', requestId: 'request-1', revisionNumber: 1, profileVersion: 1, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [], attachments: [], createdAt: '2026-09-27T02:00:00.000Z' }
    const responses: Record<string, unknown> = {
      'GET /client/recycle/consultations/consult-1/revisions': { consultationId: 'consult-1', requestId: 'request-1', canEdit: true, revisions: [{ ...revision, deliveredAt: '2026-09-27T02:00:00.000Z' }] },
      'GET /client/recycle/consultations/consult-1/revisions/revision-1': revision,
      'GET /client/recycle/consultations/consult-1/profile-edit-context': rawContext,
    }
    const transport = {
      read: vi.fn(async (path: string, parse: (value: unknown) => unknown) => ({ data: parse(responses[`GET ${path}`]) })),
      write: vi.fn(),
    }
    const controller = createRestoredRecycleRevisionController('consult-1', createRestoredRecycleRevisionApi(transport as never), () => 'save-0001', { schedule: () => () => undefined })
    await controller.start('revision-1')
    await controller.beginEdit()
    expect(controller.getSnapshot().editContext?.fields.map(field => field.valueType)).toEqual(['text', 'number', 'single', 'multiple'])
    const html = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1?revision=revision-1"><RestoredRecycleRevisionView snapshot={controller.getSnapshot()} onSelectRevision={vi.fn()} onBeginEdit={vi.fn()} onCancelEdit={vi.fn()} onValueChange={vi.fn()} onAttachmentsAdd={vi.fn()} onAttachmentRemove={vi.fn()} onAttachmentRetry={vi.fn()} onSave={vi.fn()} onCheckUnknownSave={vi.fn()} onRetrySave={vi.fn()} onConsultationToggle={vi.fn()} onRequestDeliveryConfirmation={vi.fn()} onCancelDeliveryConfirmation={vi.fn()} onConfirmDelivery={vi.fn()} onCheckUnknownTarget={vi.fn()} onRetryTarget={vi.fn()} /></StaticRouter>)
    expect(html).toContain('value="合成初版资料"')
    expect(html).toContain('type="number"')
    expect(html).toContain('<option value="north" selected="">北区</option>')
    expect(html).toContain('<input type="checkbox" checked=""/><span>限定</span>')
    expect(html).not.toContain('回收资料配置暂不支持')
    controller.stop()
  })

  it('renders explicit versions, keeps recipients empty, and separates save from delivery confirmation', () => {
    const snapshot: RestoredRecycleRevisionSnapshot = {
      loading: false, stale: false, error: null, accessLost: false, revisions: [{ revisionId: 'revision-2', requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], attachments: [], createdAt: '2026-09-28T02:00:00.000Z', deliveredAt: null }], canEdit: true, selectedRevision: { revisionId: 'revision-2', requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], attachments: [], createdAt: '2026-09-28T02:00:00.000Z' }, editing: true,
      editContext: { requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true, baseRevisionId: 'revision-1', fieldTemplateVersion: 3, fieldSchemaHash: hash, fields: [{ sourceRefType: 'attr', sourceRefKey: 'rank', fieldKey: 'rank', label: '段位', valueType: 'single', uiType: 'select', order: 0, required: true, options: [{ label: '王者', value: 'king' }], multiValues: [] }], values: { rank: 'king' }, attachments: [], consultations: [{ consultationId: 'consult-1', recyclerId: 'shop-1', recyclerName: '店铺一', conversationId: 'conversation-1', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' }] },
      values: { rank: 'king' }, attachments: [], selectedConsultationIds: [], savedRevision: { revisionId: 'revision-2', requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], attachments: [], createdAt: '2026-09-28T02:00:00.000Z' }, saveState: 'saved', saveRetryable: false, confirmation: null, targets: [], busy: false,
    }
    const html = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1?revision=revision-2"><RestoredRecycleRevisionView snapshot={snapshot} onSelectRevision={vi.fn()} onBeginEdit={vi.fn()} onCancelEdit={vi.fn()} onValueChange={vi.fn()} onAttachmentsAdd={vi.fn()} onAttachmentRemove={vi.fn()} onAttachmentRetry={vi.fn()} onSave={vi.fn()} onCheckUnknownSave={vi.fn()} onRetrySave={vi.fn()} onConsultationToggle={vi.fn()} onRequestDeliveryConfirmation={vi.fn()} onCancelDeliveryConfirmation={vi.fn()} onConfirmDelivery={vi.fn()} onCheckUnknownTarget={vi.fn()} onRetryTarget={vi.fn()} /></StaticRouter>)
    expect(html).toContain('版本 v2')
    expect(html).toContain('请选择资料版本')
    expect(html).toContain('已保存，尚未发送')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>保存新版本<\/button>/)
    expect(html).toContain('已选择 0 家')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>核对发送名单<\/button>/)
    expect(html).toContain('href="/recycle/consultations/consult-1?revision=revision-2"')
    expect(html).not.toContain('latest')

    const ownerHtml = renderToStaticMarkup(<StaticRouter location="/recycle/requests/request-1?revision=revision-2"><RestoredRecycleRevisionView versionLabelScope="request" snapshot={snapshot} onSelectRevision={vi.fn()} onBeginEdit={vi.fn()} onCancelEdit={vi.fn()} onValueChange={vi.fn()} onAttachmentsAdd={vi.fn()} onAttachmentRemove={vi.fn()} onAttachmentRetry={vi.fn()} onSave={vi.fn()} onCheckUnknownSave={vi.fn()} onRetrySave={vi.fn()} onConsultationToggle={vi.fn()} onRequestDeliveryConfirmation={vi.fn()} onCancelDeliveryConfirmation={vi.fn()} onConfirmDelivery={vi.fn()} onCheckUnknownTarget={vi.fn()} onRetryTarget={vi.fn()} /></StaticRouter>)
    expect(ownerHtml).toContain('版本 v2（已保存）')
    expect(ownerHtml).not.toContain('版本 v2（尚未发送）')
    expect(html).toContain('版本 v2（尚未发送）')
  })

  it('reconciles saved copy, prior-delivery labels, and the finish action with per-recipient delivery progress', () => {
    const savedRevision = { revisionId: 'revision-2', requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [], attachments: [], createdAt: '2026-09-28T02:00:00.000Z' }
    const body = { clientConfirmationId: 'confirm-0001', selectedConsultationIds: ['consult-1', 'consult-2'] }
    const partial: RestoredRecycleRevisionSnapshot = {
      loading: false, stale: false, error: null, accessLost: false, revisions: [], canEdit: true, selectedRevision: null, editing: true,
      editContext: { requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true, baseRevisionId: 'revision-2', fieldTemplateVersion: 3, fieldSchemaHash: hash, fields: [], values: {}, attachments: [], consultations: [
        { consultationId: 'consult-1', recyclerId: 'shop-1', recyclerName: '店铺一', conversationId: 'conversation-1', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' },
        { consultationId: 'consult-2', recyclerId: 'shop-2', recyclerName: '店铺二', conversationId: 'conversation-2', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' },
      ] },
      values: {}, attachments: [], selectedConsultationIds: ['consult-1', 'consult-2'], savedRevision, saveState: 'saved', saveRetryable: false, confirmation: null, busy: false,
      targets: [
        { consultationId: 'consult-1', recyclerName: '店铺一', conversationId: 'conversation-1', state: 'success', retryable: false, error: null, key: 'target-key-1', body, result: { ...body, revisionId: 'revision-2', consultationId: 'consult-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' } },
        { consultationId: 'consult-2', recyclerName: '店铺二', conversationId: 'conversation-2', state: 'unknown', retryable: false, error: '原结果待查询', key: 'target-key-2', body, result: null },
      ],
    }
    const partialHtml = renderRevision(partial)
    expect(partialHtml).toContain('已保存 · 已发送 1/2 家，请查看逐家结果 · 版本 v2')
    expect(partialHtml).not.toContain('已保存，尚未发送')
    expect(partialHtml).toContain('编辑时已收到 revision-1')
    expect(partialHtml).not.toContain('当前已收到')
    expect(partialHtml).toMatch(/<button[^>]*disabled=""[^>]*>放弃本次编辑<\/button>/)
    expect(partialHtml).not.toContain('结束失败项并结束本次更新')

    const completeHtml = renderRevision({ ...partial, targets: partial.targets.map(target => ({ ...target, state: 'success' as const })) })
    expect(completeHtml).toMatch(/<button[^>]*>结束本次更新<\/button>/)
    expect(completeHtml).not.toContain('放弃本次编辑')

    const failedHtml = renderRevision({ ...partial, targets: partial.targets.map((target, index) => index === 0 ? target : ({ ...target, state: 'failed' as const, retryable: true, error: '已关闭咨询不能更新资料' })) })
    expect(failedHtml).toMatch(/<button[^>]*>结束失败项并结束本次更新<\/button>/)
    expect(failedHtml).not.toMatch(/<button[^>]*disabled=""[^>]*>结束失败项并结束本次更新<\/button>/)

    for (const state of ['pending', 'sending'] as const) {
      const unresolvedHtml = renderRevision({ ...partial, targets: partial.targets.map((target, index) => index === 0 ? target : ({ ...target, state })) })
      expect(unresolvedHtml).toMatch(/<button[^>]*disabled=""[^>]*>放弃本次编辑<\/button>/)
      expect(unresolvedHtml).not.toContain('结束失败项并结束本次更新')
    }

    const unsavedHtml = renderRevision({ ...partial, savedRevision: null, saveState: 'idle', targets: [], selectedConsultationIds: [] })
    expect(unsavedHtml).toMatch(/<button[^>]*>放弃本次编辑<\/button>/)
    expect(unsavedHtml).not.toContain('结束本次更新')
  })

  it.each(['uploaded', 'failed', 'unknown'] as const)('does not offer destructive configuration refresh for a %s image draft', state => {
    const html = render({ ...base, attachments: [{ localId: 'draft-1', file: new File(['x'], 'draft.png', { type: 'image/png' }), fileName: 'draft.png', key: 'stable-key', state, error: state === 'uploaded' ? null : '原上传待重试', media: null }] })
    const refresh = html.match(/<button[^>]*aria-label="刷新回收配置"[^>]*>/u)?.[0]
    expect(refresh).toContain('disabled=""')
    expect(html).toContain('避免清空草稿')
  })

  it('explains known unavailable merchant reasons in Chinese and keeps unknown codes private', () => {
    const cases = [
      ['RECYCLER_DISABLED', '回收商暂停合作'],
      ['RECYCLER_DIRECTORY_DISABLED', '回收商当前未开放咨询'],
      ['GAME_RELATION_DISABLED', '回收商暂不接收此游戏'],
      ['NOT_ACCEPTING_NOW', '回收商当前暂停接单'],
      ['SELF_RECYCLER', '不能向自己的回收商发起咨询'],
      ['FUTURE_CODE', '暂不可咨询'],
    ]
    for (const [reason, label] of cases) {
      const html = render({ ...base, detail: { ...base.detail!, recyclers: [{ recyclerId: 'shop-3', displayName: '店铺三', eligible: false, blockedReason: reason }] } })
      expect(html).toContain(label)
      expect(html).not.toContain(reason)
      expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*disabled=""/)
    }
  })
  it('shows an empty selection, blank answer and the exact attachment limits', () => {
    const html = render(base)
    expect(html).toContain('已选择 0 家')
    expect(html).toContain('value=""')
    expect(html).toContain('上传资料图片')
    expect(html).toContain('JPG、PNG、WebP')
    expect(html).toContain('每张严格小于 1MB，最多 15 张')
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
    expect(html).toContain('multiple=""')
    expect(html).not.toContain('尚未接入')
    expect(html).toContain('data-ui="PageHeader"')
    expect(html).toContain('data-ui="SelectField"')
    expect(html).toContain('data-ui="Button"')
    expect(html).not.toContain('10%')
  })

  it('describes a disabled media directory as temporarily unavailable rather than unnecessary', () => {
    const html = render({ ...base, detail: { ...base.detail!, attachmentsAvailable: false } })
    expect(html).toContain('当前服务暂未开放资料图片上传，可先提交文字资料')
    expect(html).not.toContain('无需上传资料图片')
  })

  it('shows uploading failed and unknown drafts, supports removal and disables review', () => {
    const file = new File([new Uint8Array([1])], 'one.png', { type: 'image/png' })
    const draft = (localId: string, state: 'uploading' | 'failed' | 'unknown') => ({ localId, file, fileName: `${localId}.png`, key: `key-${localId}`, state, error: state === 'uploading' ? null : state === 'failed' ? '上传失败' : '上传结果未知', media: null })
    const html = render({ ...base, selectedRecyclerIds: ['shop-1'], attachments: [draft('one', 'uploading'), draft('two', 'failed'), draft('three', 'unknown')] })
    for (const text of ['上传中', '上传失败', '上传结果未知', '删除草稿图片', '重试上传原操作']) expect(html).toContain(text)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>核对资料与回收商<\/button>/)
    expect(html).toMatch(/<button[^>]*aria-label="刷新回收配置"[^>]*disabled=""/)
  })

  it('shows the full confirmation version and all selected merchants before a write', () => {
    const html = render({ ...base, values: { rank: 'king' }, selectedRecyclerIds: ['shop-1', 'shop-2'], confirmation: { profileVersion: 1, clientSubmissionId: 'submission-123', gameCode: 'wzry', gameName: '王者荣耀', fieldTemplateVersion: 3, fieldSchemaHash: hash, fields: [{ fieldKey: 'rank', label: '段位', displayValue: '王者' }], attachmentMediaIds: ['media-1'], attachments: [{ mediaId: 'media-1', fileName: 'one.png', contentUrl: '/api/v1/client/recycle/media/media-1/content' }], selectedRecyclerIds: ['shop-1', 'shop-2'], selectedRecyclerNames: ['店铺一', '店铺二'] } })
    for (const text of ['确认资料版本 v1', '店铺一', '店铺二', '段位', '王者', '确认并逐商提交']) expect(html).toContain(text)
    expect(html).toContain('返回编辑')
    expect(html).not.toContain('aria-modal="true"')
  })

  it('shows server results and separate retries for partial failure or unknown status', () => {
    const body = { clientSubmissionId: 'submission-123', gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, selectedRecyclerIds: ['shop-1', 'shop-2'], recyclerId: 'shop-1', values: { rank: 'king' }, attachmentMediaIds: [] }
    const result = { id: 'consult-1', clientSubmissionId: 'submission-123', gameCode: 'wzry', profileVersion: 1 as const, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1', conversationId: 'conversation-1', status: 'SENT' as const, attachments: [], createdAt: '2026-09-24T01:00:00.000Z' }
    const html = render({ ...base, frozen: true, targets: [{ recyclerId: 'shop-1', displayName: '店铺一', state: 'success', retryable: false, error: null, result, key: 'key-1', body }, { recyclerId: 'shop-2', displayName: '店铺二', state: 'unknown', retryable: true, error: '结果未知', result: null, key: 'key-2', body: { ...body, recyclerId: 'shop-2' } }] })
    expect(html).toContain('/recycle/consultations/consult-1')
    expect(html).toContain('conversation-1')
    expect(html).toContain('重试原操作')
    expect(html.match(/重试原操作/g)).toHaveLength(1)
    expect(html).toContain('开始新一轮咨询')
    expect(html).toContain('请先确认本轮结果未知的回收商')
  })

  it('renders the server snapshot and conversation link in consultation detail', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1"><RestoredRecycleConsultationView consultation={{ id: 'consult-1', clientSubmissionId: 'submission-123', gameCode: 'wzry', profileVersion: 1, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1', conversationId: 'conversation-1', status: 'SENT', attachments: [], createdAt: '2026-09-24T01:00:00.000Z' }} loading={false} error={null} onRefresh={vi.fn()} /></StaticRouter>)
    for (const text of ['consult-1', 'submission-123', 'shop-1', '段位', '王者', '资料版本 v1', '状态 SENT']) expect(html).toContain(text)
    expect(html).toContain('href="/im/conversation-1"')
    expect(html).toContain('资料图片')
    expect(html).toContain('无')
    expect(html).not.toContain('尚未接入')
  })

  it('shows the real request and revision identity for a new merchant initial profile', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1"><RestoredRecycleConsultationView consultation={{ id: 'consult-1', clientSubmissionId: 'submission-123', requestId: 'request-1', revisionId: 'revision-2', gameCode: 'wzry', profileVersion: 2, profileFields: [], fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1', conversationId: 'conversation-1', status: 'SENT', attachments: [], createdAt: '2026-09-24T01:00:00.000Z', deliveredAt: '2026-09-28T03:00:00.000Z' }} loading={false} error={null} onRefresh={vi.fn()} /></StaticRouter>)
    expect(html).toContain('请求 ID')
    expect(html).toContain('request-1')
    expect(html).toContain('资料版本 ID')
    expect(html).toContain('revision-2')
    expect(html).toContain('资料版本 v2')
  })

  it('offers the owner a request-distribution link without exposing it in the merchant view', () => {
    const consultation = { id: 'consult-1', clientSubmissionId: 'submission-123', requestId: 'request-1', revisionId: 'revision-2', gameCode: 'wzry', profileVersion: 2, profileFields: [], fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1', conversationId: 'conversation-1', status: 'SENT' as const, attachments: [], createdAt: '2026-09-24T01:00:00.000Z' }
    const OwnerAwareView = RestoredRecycleConsultationView as (props: Parameters<typeof RestoredRecycleConsultationView>[0] & { ownerRequestHref?: string }) => ReturnType<typeof RestoredRecycleConsultationView>
    const ownerHtml = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1"><OwnerAwareView consultation={consultation} loading={false} error={null} ownerRequestHref="/recycle/requests/request-1?revision=revision-2" onRefresh={vi.fn()} /></StaticRouter>)
    const merchantHtml = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1"><RestoredRecycleConsultationView consultation={consultation} loading={false} error={null} onRefresh={vi.fn()} /></StaticRouter>)
    expect(ownerHtml).toContain('href="/recycle/requests/request-1?revision=revision-2"')
    expect(ownerHtml).toContain('管理本请求与新商家分发')
    expect(merchantHtml).not.toContain('/recycle/requests/request-1')
  })

  it('renders only the protected consultation attachment URL with retry-capable previews', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1"><RestoredRecycleConsultationView consultation={{ id: 'consult-1', clientSubmissionId: 'submission-123', gameCode: 'wzry', profileVersion: 1, profileFields: [], fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1', conversationId: 'conversation-1', status: 'SENT', attachments: [{ mediaId: 'media-1', mimeType: 'image/png', sizeBytes: 100, width: 10, height: 20, contentUrl: '/api/v1/client/recycle/consultations/consult-1/media/media-1/content', createdAt: '2026-09-24T00:59:00.000Z' }], createdAt: '2026-09-24T01:00:00.000Z' }} loading={false} error={null} onRefresh={vi.fn()} /></StaticRouter>)
    expect(html).toContain('src="/api/v1/client/recycle/consultations/consult-1/media/media-1/content"')
    expect(html).toContain('alt="回收资料图片 1"')
    expect(html).toContain('aria-label="放大查看回收资料图片 1"')
    expect(html).toContain('图片由当前会话授权读取')
  })

  it('does not retain profile values or image URLs after an explicit safety revocation', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/recycle/consultations/consult-1"><RestoredRecycleConsultationView consultation={null} loading={false} error="该资料已因安全原因停用，请重新填写" onRefresh={vi.fn()} /></StaticRouter>)
    expect(html).toContain('该资料已因安全原因停用，请重新填写')
    expect(html).not.toContain('王者')
    expect(html).not.toContain('/media/')
  })
})
