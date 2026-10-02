import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import { createRestoredRecycleRevisionController, getRestoredRecycleRevisionControllerForTransport } from './restoredRecycleRevisionController'

const hash = 'a'.repeat(64)
const revision = (revisionId = 'revision-2', revisionNumber = 2) => ({ revisionId, requestId: 'request-1', revisionNumber, profileVersion: revisionNumber, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], attachments: [], createdAt: '2026-09-28T02:00:00.000Z' })
const context = { requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true as const, baseRevisionId: 'revision-1', fieldTemplateVersion: 3, fieldSchemaHash: hash, fields: [{ sourceRefType: 'attr' as const, sourceRefKey: 'rank', fieldKey: 'rank', label: '段位', valueType: 'single', uiType: 'select', order: 0, required: true, options: [{ label: '王者', value: 'king' }], multiValues: [] }], values: { rank: 'king' }, attachments: [], consultations: [{ consultationId: 'consult-1', recyclerId: 'shop-1', recyclerName: '店铺一', conversationId: 'conversation-1', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' }, { consultationId: 'consult-2', recyclerId: 'shop-2', recyclerName: '店铺二', conversationId: 'conversation-2', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' }] }
const list = { consultationId: 'consult-1', requestId: 'request-1', canEdit: true, revisions: [{ ...revision('revision-1', 1), deliveredAt: '2026-09-27T02:00:00.000Z' }] }
const baseApi = () => ({
  listRevisions: vi.fn().mockResolvedValue(list), readRevision: vi.fn().mockResolvedValue(revision('revision-1', 1)), readEditContext: vi.fn().mockResolvedValue(context),
  saveRevision: vi.fn().mockResolvedValue({ clientSaveId: 'save-0001', unchanged: false, revision: revision() }),
  findSaveOperation: vi.fn(), deliverRevision: vi.fn(), findTargetOperation: vi.fn(), uploadMedia: vi.fn(),
})

describe('restored recycle revision controller', () => {
  it('does not turn the old consultation URL into an implicit latest-version detail', async () => {
    const api = baseApi()
    const controller = createRestoredRecycleRevisionController('consult-1', api as never)
    await controller.start()
    expect(controller.getSnapshot().selectedRevision).toBeNull()
    expect(api.readRevision).not.toHaveBeenCalled()
    controller.stop()
  })

  it('keeps only the old v1 page readable for the explicit legacy-only code, but clears v2 data for relationship damage', async () => {
    const legacyApi = baseApi()
    legacyApi.listRevisions.mockRejectedValue(new RestoredHttpError(409, 'RECYCLE_PROFILE_LEGACY_ONLY', '旧资料'))
    const legacy = createRestoredRecycleRevisionController('consult-1', legacyApi as never)
    await legacy.start()
    expect(legacy.getSnapshot()).toMatchObject({ accessLost: false, canEdit: false, revisions: [], selectedRevision: null, error: expect.stringContaining('缺少可编辑的历史模板') })
    legacy.stop()

    const damagedApi = baseApi()
    damagedApi.listRevisions.mockResolvedValueOnce(list).mockRejectedValueOnce(new RestoredHttpError(409, 'RECYCLE_CONSULTATION_RELATION_INVALID', '关系损坏'))
    const damaged = createRestoredRecycleRevisionController('consult-1', damagedApi as never)
    await damaged.start(); await damaged.refresh()
    expect(damaged.getSnapshot()).toMatchObject({ accessLost: true, revisions: [], selectedRevision: null, editContext: null, values: {}, attachments: [] })
  })

  it('keeps one consultation controller in transport scope so route leave cannot lose an initiated operation key', () => {
    const transport = {} as never
    const first = getRestoredRecycleRevisionControllerForTransport(transport, 'consult-1')
    expect(getRestoredRecycleRevisionControllerForTransport(transport, 'consult-1')).toBe(first)
    expect(getRestoredRecycleRevisionControllerForTransport(transport, 'consult-2')).not.toBe(first)
  })

  it('reuses the revision editor for an owner request and reloads every owner-visible version without a consultation', async () => {
    const module = await import('./restoredRecycleRevisionController') as typeof import('./restoredRecycleRevisionController') & { getRestoredRecycleRequestRevisionControllerForTransport?: (transport: never, requestId: string) => ReturnType<typeof createRestoredRecycleRevisionController> }
    expect(typeof module.getRestoredRecycleRequestRevisionControllerForTransport).toBe('function')
    if (!module.getRestoredRecycleRequestRevisionControllerForTransport) return
    const responses: Record<string, unknown> = {
      'GET /client/recycle/profile-requests/request-1/revisions': { requestId: 'request-1', canEdit: true, revisions: [revision('revision-1', 1), revision('revision-2', 2)] },
      'GET /client/recycle/profile-requests/request-1/edit-context': { ...context, baseRevisionId: 'revision-2', fields: [{ ...context.fields[0], valueType: 'ENUM', uiType: 'select' }], consultations: [] },
    }
    const transport = {
      read: vi.fn(async (path: string, parse: (input: unknown) => unknown) => ({ data: parse(responses[`GET ${path}`]) })),
      write: vi.fn(),
    }
    const controller = module.getRestoredRecycleRequestRevisionControllerForTransport(transport as never, 'request-1')
    expect(module.getRestoredRecycleRequestRevisionControllerForTransport(transport as never, 'request-1')).toBe(controller)
    await controller.start('revision-1')
    await controller.beginEdit()
    expect(controller.getSnapshot()).toMatchObject({ canEdit: true, selectedRevision: { revisionId: 'revision-1' }, editing: true, editContext: { requestId: 'request-1' }, selectedConsultationIds: [] })
    expect(controller.getSnapshot().revisions.map(item => item.revisionId)).toEqual(['revision-1', 'revision-2'])
    expect(transport.read.mock.calls.map(call => call[0])).not.toContain('/client/recycle/consultations/request-1/revisions')
  })

  it('keeps five-second polling visible while preserving an active edit draft, and pauses while hidden', async () => {
    const tasks: Array<{ delay: number; run: () => void; cancelled: boolean }> = []
    const schedule = (run: () => void, delay: number) => { const task = { delay, run, cancelled: false }; tasks.push(task); return () => { task.cancelled = true } }
    const api = baseApi()
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001', { schedule })
    await controller.start(); await controller.beginEdit(); controller.setValue('rank', 'diamond')
    api.readEditContext.mockResolvedValue({ ...context, consultations: [...context.consultations, { consultationId: 'consult-3', recyclerId: 'shop-3', recyclerName: '店铺三', conversationId: 'conversation-3', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-28T03:00:00.000Z' }] })
    expect(tasks.at(-1)?.delay).toBe(5_000)
    expect(tasks.at(-1)?.cancelled).toBe(false)
    if (!tasks.at(-1)?.cancelled) tasks.at(-1)?.run()
    await Promise.resolve(); await Promise.resolve()
    expect(controller.getSnapshot().values).toEqual({ rank: 'diamond' })
    expect(controller.getSnapshot().editContext?.consultations.map(item => item.consultationId)).toEqual(['consult-1', 'consult-2', 'consult-3'])
    await controller.setVisible(false)
    const calls = api.listRevisions.mock.calls.length
    const last = tasks.at(-1); if (last && !last.cancelled) last.run()
    await Promise.resolve()
    expect(api.listRevisions).toHaveBeenCalledTimes(calls)
    controller.stop()
  })

  it('loads an explicit version, enters owner edit with zero recipients and never writes on load or leave', async () => {
    const api = baseApi()
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start('revision-1')
    await controller.beginEdit()
    expect(controller.getSnapshot()).toMatchObject({ selectedRevision: { revisionId: 'revision-1' }, editing: true, selectedConsultationIds: [], values: { rank: 'king' } })
    controller.stop()
    expect(api.saveRevision).not.toHaveBeenCalled()
    expect(api.deliverRevision).not.toHaveBeenCalled()
  })

  it('saves without delivery and exposes an explicit saved-not-sent state', async () => {
    const api = baseApi()
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit(); await controller.save()
    expect(api.saveRevision).toHaveBeenCalledTimes(1)
    expect(api.deliverRevision).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ savedRevision: { revisionId: 'revision-2' }, saveState: 'saved', selectedConsultationIds: [] })
  })

  it.each(['direct unchanged save', 'unknown save operation recovery'] as const)('preserves this consultation delivery time for an existing revision after %s', async mode => {
    const api = baseApi()
    const deliveredAt = '2026-09-28T01:30:00.000Z'
    api.listRevisions.mockResolvedValue({ ...list, revisions: [{ ...revision('revision-2', 2), deliveredAt }] })
    const result = { clientSaveId: 'save-0001', unchanged: true, revision: revision('revision-2', 2) }
    if (mode === 'direct unchanged save') api.saveRevision.mockResolvedValue(result)
    else {
      api.saveRevision.mockRejectedValue(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN'))
      api.findSaveOperation.mockResolvedValue(result)
    }
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit(); await controller.save()
    expect(controller.getSnapshot().revisions.find(item => item.revisionId === 'revision-2')?.deliveredAt).toBe(deliveredAt)
  })

  it('marks only a genuinely new saved revision as not yet delivered to this consultation', async () => {
    const api = baseApi()
    const deliveredAt = '2026-09-28T01:30:00.000Z'
    api.listRevisions.mockResolvedValue({ ...list, revisions: [{ ...revision('revision-2', 2), deliveredAt }] })
    api.readEditContext.mockResolvedValue({ ...context, baseRevisionId: 'revision-2' })
    api.saveRevision.mockResolvedValue({ clientSaveId: 'save-0001', unchanged: false, revision: revision('revision-3', 3) })
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit(); await controller.save()
    expect(controller.getSnapshot().revisions.find(item => item.revisionId === 'revision-3')?.deliveredAt).toBeNull()
    expect(controller.getSnapshot().revisions.find(item => item.revisionId === 'revision-2')?.deliveredAt).toBe(deliveredAt)
  })

  it('keeps the edit draft and original save operation key when the base revision is stale', async () => {
    const api = baseApi()
    api.readEditContext.mockResolvedValue({ ...context, fields: [{ ...context.fields[0], options: [...context.fields[0].options, { label: '钻石', value: 'diamond' }] }] })
    api.saveRevision
      .mockRejectedValueOnce(new RestoredHttpError(409, 'RECYCLE_PROFILE_BASE_REVISION_STALE', '资料已有新版本，请刷新后重试'))
      .mockResolvedValueOnce({ clientSaveId: 'save-0001', unchanged: false, revision: revision() })
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit(); controller.setValue('rank', 'diamond'); await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ accessLost: false, editing: true, values: { rank: 'diamond' }, saveState: 'idle', error: '资料已有新版本，请刷新后重试' })
    expect(controller.getSnapshot().revisions).not.toEqual([])
    await controller.save()
    expect(api.saveRevision.mock.calls[1][1].clientSaveId).toBe(api.saveRevision.mock.calls[0][1].clientSaveId)
    expect(api.saveRevision.mock.calls[1][2]).toBe(api.saveRevision.mock.calls[0][2])
  })

  it('queries an unknown save with the same clientSaveId before allowing the same-key retry', async () => {
    const api = baseApi()
    api.saveRevision.mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN')).mockResolvedValueOnce({ clientSaveId: 'save-0001', unchanged: false, revision: revision() })
    api.findSaveOperation.mockRejectedValueOnce(new RestoredHttpError(404, 'NOT_FOUND', '未执行'))
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit(); await controller.save()
    expect(api.findSaveOperation).toHaveBeenCalledWith('request-1', 'save-0001', expect.any(AbortSignal))
    expect(controller.getSnapshot()).toMatchObject({ saveState: 'unknown', saveRetryable: true })
    controller.cancelEdit()
    expect(controller.getSnapshot()).toMatchObject({ editing: true, saveState: 'unknown' })
    await controller.retrySave()
    expect(api.saveRevision.mock.calls[0][2]).toBe(api.saveRevision.mock.calls[1][2])
    expect(api.saveRevision.mock.calls[1][1].clientSaveId).toBe('save-0001')
  })

  it('adds and removes valid draft images with the existing strict media rules', async () => {
    const api = baseApi()
    api.uploadMedia.mockResolvedValue({ mediaId: 'media-new', mimeType: 'image/png', sizeBytes: 3, width: 1, height: 1, contentUrl: '/api/v1/client/recycle/media/media-new/content', createdAt: '2026-09-28T02:00:00.000Z' })
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit()
    await controller.addAttachments([new File(['png'], 'new.png', { type: 'image/png' })])
    expect(controller.getSnapshot().attachments).toMatchObject([{ fileName: 'new.png', state: 'uploaded', media: { mediaId: 'media-new' } }])
    controller.removeAttachment(controller.getSnapshot().attachments[0].localId)
    expect(controller.getSnapshot().attachments).toEqual([])
    await controller.addAttachments([new File([new Uint8Array(1_048_576)], 'too-large.png', { type: 'image/png' })])
    expect(controller.getSnapshot().error).toContain('小于 1MB')
  })

  it('freezes the confirmed revision and names, does not resend successes, and queries unknown before retry', async () => {
    const api = baseApi()
    api.deliverRevision
      .mockResolvedValueOnce({ clientConfirmationId: 'confirm-0001', revisionId: 'revision-2', selectedConsultationIds: ['consult-1', 'consult-2'], consultationId: 'consult-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' })
      .mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN'))
      .mockResolvedValueOnce({ clientConfirmationId: 'confirm-0001', revisionId: 'revision-2', selectedConsultationIds: ['consult-1', 'consult-2'], consultationId: 'consult-2', deliveryId: 'delivery-2', messageId: 'message-2', deliveredAt: '2026-09-28T03:01:00.000Z' })
    api.findTargetOperation.mockRejectedValueOnce(new RestoredHttpError(404, 'NOT_FOUND', '未执行'))
    const ids = ['save-0001', 'confirm-0001']
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => ids.shift()!)
    await controller.start(); await controller.beginEdit(); await controller.save()
    controller.toggleConsultation('consult-1'); controller.toggleConsultation('consult-2')
    expect(controller.requestDeliveryConfirmation()).toBe(true)
    expect(controller.getSnapshot().confirmation).toMatchObject({ revisionId: 'revision-2', revisionNumber: 2, selectedConsultationNames: ['店铺一', '店铺二'] })
    await controller.confirmDelivery()
    expect(api.findTargetOperation).toHaveBeenCalledWith('revision-2', 'consult-2', 'confirm-0001', ['consult-1', 'consult-2'], expect.any(AbortSignal))
    expect(controller.getSnapshot().targets.map(target => target.state)).toEqual(['success', 'unknown'])
    await controller.retryTarget('consult-2')
    expect(api.deliverRevision).toHaveBeenCalledTimes(3)
    expect(api.deliverRevision.mock.calls.filter(call => call[1] === 'consult-1')).toHaveLength(1)
  })

  it.each([
    ['RECYCLE_CONVERSATION_CLOSED', '已关闭咨询不能更新资料'],
    ['RECYCLE_RECIPIENT_CHANGED', '回收商主体已变化，不能将原确认资料发送给新主体'],
  ])('keeps an earlier recipient success and the full draft when a later recipient returns %s', async (code, detail) => {
    const api = baseApi()
    api.deliverRevision
      .mockResolvedValueOnce({ clientConfirmationId: 'confirm-0001', revisionId: 'revision-2', selectedConsultationIds: ['consult-1', 'consult-2'], consultationId: 'consult-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' })
      .mockRejectedValueOnce(new RestoredHttpError(409, code, detail))
      .mockResolvedValueOnce({ clientConfirmationId: 'confirm-0001', revisionId: 'revision-2', selectedConsultationIds: ['consult-1', 'consult-2'], consultationId: 'consult-2', deliveryId: 'delivery-2', messageId: 'message-2', deliveredAt: '2026-09-28T03:01:00.000Z' })
    const ids = ['save-0001', 'confirm-0001']
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => ids.shift()!)
    await controller.start(); await controller.beginEdit(); await controller.save()
    controller.toggleConsultation('consult-1'); controller.toggleConsultation('consult-2'); controller.requestDeliveryConfirmation()
    await controller.confirmDelivery()
    expect(controller.getSnapshot()).toMatchObject({
      accessLost: false, editing: true, values: { rank: 'king' }, savedRevision: { revisionId: 'revision-2' },
      targets: [{ consultationId: 'consult-1', state: 'success' }, { consultationId: 'consult-2', state: 'failed', error: detail }],
    })
    const firstFailedCall = api.deliverRevision.mock.calls[1]
    await controller.retryTarget('consult-2')
    const retriedCall = api.deliverRevision.mock.calls[2]
    expect(retriedCall[2]).toEqual(firstFailedCall[2])
    expect(retriedCall[3]).toBe(firstFailedCall[3])
    expect(api.deliverRevision.mock.calls.filter(call => call[1] === 'consult-1')).toHaveLength(1)
  })

  it('ends a fully settled partial failure locally without resending or hiding the saved revision from the list', async () => {
    const api = baseApi()
    api.deliverRevision
      .mockResolvedValueOnce({ clientConfirmationId: 'confirm-0001', revisionId: 'revision-2', selectedConsultationIds: ['consult-1', 'consult-2'], consultationId: 'consult-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' })
      .mockRejectedValueOnce(new RestoredHttpError(409, 'RECYCLE_CONVERSATION_CLOSED', '已关闭咨询不能更新资料'))
    const ids = ['save-0001', 'confirm-0001']
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => ids.shift()!)
    await controller.start(); await controller.beginEdit(); await controller.save()
    controller.toggleConsultation('consult-1'); controller.toggleConsultation('consult-2'); controller.requestDeliveryConfirmation()
    await controller.confirmDelivery()
    expect(controller.getSnapshot().targets.map(target => target.state)).toEqual(['success', 'failed'])
    expect(controller.getSnapshot().revisions.map(item => item.revisionId)).toContain('revision-2')
    const sends = api.deliverRevision.mock.calls.length

    controller.cancelEdit()

    expect(controller.getSnapshot()).toMatchObject({ editing: false, editContext: null, values: {}, attachments: [], targets: [], savedRevision: null })
    expect(controller.getSnapshot().revisions.map(item => item.revisionId)).toContain('revision-2')
    expect(api.deliverRevision).toHaveBeenCalledTimes(sends)
  })

  it('preserves drafts as stale on network failure but clears every value and media URL on lost access, ignoring late responses', async () => {
    let rejectRefresh!: (error: unknown) => void
    const api = baseApi()
    api.listRevisions.mockResolvedValueOnce(list).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRefresh = reject }))
    const controller = createRestoredRecycleRevisionController('consult-1', api as never, () => 'save-0001')
    await controller.start(); await controller.beginEdit(); controller.setValue('rank', 'diamond')
    const refresh = controller.refresh()
    rejectRefresh(new Error('断网'))
    await refresh
    expect(controller.getSnapshot()).toMatchObject({ values: { rank: 'diamond' }, stale: true })
    api.listRevisions.mockRejectedValueOnce(new RestoredHttpError(403, 'FORBIDDEN', '无权查看'))
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ revisions: [], selectedRevision: null, editContext: null, values: {}, attachments: [], accessLost: true })
  })

  // W02：未决保存命令跨硬刷新恢复（方案 B：仅命令标识入存储，无资料内容/令牌）。
  describe('w02 pending save recovery', () => {
    const memoryStorage = () => {
      const map = new Map<string, string>()
      return Object.assign({
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => { map.set(k, v) },
        removeItem: (k: string) => { map.delete(k) },
      }, { _map: map })
    }
    const recordKey = 'deepgamer:recycle-command:v1:buyer-1:save:consult-1'

    it('restores an unresolved save command after a hard refresh and reconciles via the original key', async () => {
      const storage = memoryStorage()
      const failApi = baseApi()
      failApi.saveRevision.mockRejectedValue(new RestoredHttpError(0, 'NETWORK_LOST', '提交后网络中断', 'UNKNOWN'))
      const first = createRestoredRecycleRevisionController('consult-1', failApi as never, () => 'save-0001', { storage, identity: 'buyer-1' })
      await first.start()
      await first.beginEdit()
      await first.save()
      expect(first.getSnapshot().saveState).toBe('unknown')
      expect(storage.getItem(recordKey)).toBeTruthy()

      // 模拟硬刷新：同存储 + 同主体新建控制器；服务端原操作查询返回已成功。
      const refreshedApi = baseApi()
      refreshedApi.findSaveOperation.mockResolvedValue({ clientSaveId: 'save-0001', unchanged: false, revision: revision('revision-2', 2) })
      const second = createRestoredRecycleRevisionController('consult-1', refreshedApi as never, () => 'save-0002', { storage, identity: 'buyer-1' })
      await second.start()
      await second.checkUnknownSave()
      expect(second.getSnapshot().saveState).toBe('saved')
      expect(refreshedApi.saveRevision).not.toHaveBeenCalled()
      expect(second.getSnapshot().savedRevision?.revisionId).toBe('revision-2')
      expect(storage.getItem(recordKey)).toBeNull()
      second.stop()
    })

    it('keeps the pending record queryable when the original operation is confirmed not executed', async () => {
      const storage = memoryStorage()
      const failApi = baseApi()
      failApi.saveRevision.mockRejectedValue(new RestoredHttpError(0, 'NETWORK_LOST', '提交后网络中断', 'UNKNOWN'))
      const first = createRestoredRecycleRevisionController('consult-1', failApi as never, () => 'save-0001', { storage, identity: 'buyer-1' })
      await first.start(); await first.beginEdit(); await first.save()
      expect(first.getSnapshot().saveState).toBe('unknown')
      const refreshedApi = baseApi()
      refreshedApi.findSaveOperation.mockRejectedValue(new RestoredHttpError(404, 'OPERATION_NOT_FOUND', '原操作不存在'))
      const second = createRestoredRecycleRevisionController('consult-1', refreshedApi as never, () => 'save-0002', { storage, identity: 'buyer-1' })
      await second.start()
      await second.checkUnknownSave()
      // 确认未执行：记录保留、可再查；恢复型尝试不提供重发入口（防误发空内容）。
      expect(second.getSnapshot()).toMatchObject({ saveState: 'unknown', saveRetryable: false })
      second.stop()
    })

    it('does not advertise retry for a restored attempt confirmed not executed, and retrySave stays a no-op', async () => {
      const storage = memoryStorage()
      const failApi = baseApi()
      failApi.saveRevision.mockRejectedValue(new RestoredHttpError(0, 'NETWORK_LOST', '提交后网络中断', 'UNKNOWN'))
      const first = createRestoredRecycleRevisionController('consult-1', failApi as never, () => 'save-0001', { storage, identity: 'buyer-1' })
      await first.start(); await first.beginEdit(); await first.save()
      expect(first.getSnapshot().saveState).toBe('unknown')
      first.stop()

      // 独立复核 P2 回归：硬刷新恢复 + 确认未执行 → 不得提供重发入口，retrySave 必须空操作。
      const refreshedApi = baseApi()
      refreshedApi.findSaveOperation.mockRejectedValue(new RestoredHttpError(404, 'OPERATION_NOT_FOUND', '原操作不存在'))
      const second = createRestoredRecycleRevisionController('consult-1', refreshedApi as never, () => 'save-0002', { storage, identity: 'buyer-1' })
      await second.start()
      expect(second.getSnapshot()).toMatchObject({ saveState: 'unknown', saveRetryable: false })
      await second.retrySave()
      expect(refreshedApi.saveRevision).not.toHaveBeenCalled()
      expect(second.getSnapshot().saveState).toBe('unknown')
      second.stop()
    })

    it('discards corrupted or expired pending records without breaking start', async () => {
      const storage = memoryStorage()
      storage.setItem(recordKey, '{corrupted-json')
      const api1 = baseApi()
      const corrupted = createRestoredRecycleRevisionController('consult-1', api1 as never, () => 'save-0001', { storage, identity: 'buyer-1' })
      await corrupted.start()
      expect(corrupted.getSnapshot().saveState).not.toBe('unknown')
      corrupted.stop()

      const expired = JSON.stringify({ kind: 'save', identity: 'buyer-1', requestId: 'request-x', idempotencyKey: 'k-x', clientSaveId: 'cs-x', revisionId: 'revision-1', savedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
      storage.setItem(recordKey, expired)
      const api2 = baseApi()
      const stale = createRestoredRecycleRevisionController('consult-1', api2 as never, () => 'save-0002', { storage, identity: 'buyer-1' })
      await stale.start()
      expect(stale.getSnapshot().saveState).not.toBe('unknown')
      stale.stop()
    })

    it('never restores a pending record written by a different identity', async () => {
      const storage = memoryStorage()
      const seederApi = baseApi()
      seederApi.saveRevision.mockRejectedValue(new RestoredHttpError(0, 'NETWORK_LOST', '提交后网络中断', 'UNKNOWN'))
      const seeder = createRestoredRecycleRevisionController('consult-1', seederApi as never, () => 'save-0001', { storage, identity: 'buyer-1' })
      await seeder.start(); await seeder.beginEdit(); await seeder.save()
      expect(seeder.getSnapshot().saveState).toBe('unknown')
      // buyer-2 的新实例不得恢复 buyer-1 的未决命令。
      const other = createRestoredRecycleRevisionController('consult-1', baseApi() as never, () => 'save-0002', { storage, identity: 'buyer-2' })
      await other.start()
      expect(other.getSnapshot().saveState).not.toBe('unknown')
      other.stop()
      seeder.stop()
    })

    // W02：定向投递中途刷新——未决逐商条目恢复为 unknown 并按原键对账。
    it('restores pending delivery targets after a hard refresh and reconciles each via the original key', async () => {
      const storage = memoryStorage()
      // 先让保存进入 unknown 并对账成功，得到 savedRevision（复用 T1 流程）。
      const setupApi = baseApi()
      setupApi.saveRevision.mockRejectedValueOnce(new RestoredHttpError(0, 'NETWORK_LOST', '网络', 'UNKNOWN'))
      setupApi.findSaveOperation.mockResolvedValue({ clientSaveId: 'save-0001', unchanged: false, revision: revision('revision-2', 2) })
      const setup = createRestoredRecycleRevisionController('consult-1', setupApi as never, () => 'save-0001', { storage, identity: 'buyer-1' })
      await setup.start(); await setup.beginEdit(); await setup.save(); await setup.checkUnknownSave()
      expect(setup.getSnapshot().savedRevision?.revisionId).toBe('revision-2')
      // 确认定向投递：选定 consult-1，发送结果未知（中断），consult-2 未发送。
      setup.toggleConsultation('consult-1')
      setup.requestDeliveryConfirmation()
      setupApi.deliverRevision.mockRejectedValueOnce(new RestoredHttpError(0, 'NETWORK_LOST', '网络', 'UNKNOWN'))
      await setup.confirmDelivery()
      expect(setup.getSnapshot().targets.map(t => t.state)).toEqual(['unknown'])
      setup.stop()

      // 模拟硬刷新：新实例恢复未决投递条目 → 逐商原键对账（consult-1 已成功）。
      const refreshedApi = baseApi()
      refreshedApi.readRevision.mockResolvedValue(revision('revision-2', 2))
      // 从持久化记录里取真实生成的 clientConfirmationId，保证对账结果一致。
      const storedRecord = JSON.parse(storage.getItem(recordKey.replace('save:consult-1', 'delivery:consult-1'))!)
      const confirmationId = storedRecord.entries[0].clientConfirmationId as string
      refreshedApi.findTargetOperation.mockImplementation((_revisionId: string, consultationId: string) => {
        if (consultationId === 'consult-1') return Promise.resolve({ revisionId: 'revision-2', consultationId, clientConfirmationId: confirmationId, selectedConsultationIds: ['consult-1'], deliveredAt: '2026-09-30T00:00:00.000Z' })
        return Promise.reject(new RestoredHttpError(404, 'OPERATION_NOT_FOUND', '原操作不存在'))
      })
      const second = createRestoredRecycleRevisionController('consult-1', refreshedApi as never, () => 'save-0003', { storage, identity: 'buyer-1' })
      await second.start()
      await second.checkUnknownTarget('consult-1')
      const states = second.getSnapshot().targets.map(t => ({ id: t.consultationId, state: t.state }))
      expect(states).toContainEqual({ id: 'consult-1', state: 'success' })
      // 对账成功的条目必须同步从持久化记录移除（否则残留至过期并被反复重建）。
      expect(storage.getItem(recordKey.replace('save:consult-1', 'delivery:consult-1'))).toBeNull()
      second.stop()
    })

    // W02-a 回归：transport 工厂必须把 storage+identity 透传给控制器；
    // 漏传会让硬刷新恢复整体空转（2026-09-30 实测缺口，页面层注入前恢复从未生效）。
    it('forwards identity and storage through the transport factory so a fresh transport recovers the pending save', async () => {
      const storage = memoryStorage()
      const savedResult = { clientSaveId: 'save-0001', unchanged: false, revision: revision('revision-2', 2) }
      const makeTransport = (operationsResult: unknown) => ({
        read: vi.fn(async (path: string, parse: (value: unknown) => unknown) => {
          if (path.startsWith('/client/recycle/requests/request-1/revision-operations/')) {
            if (!operationsResult) throw new RestoredHttpError(404, 'OPERATION_NOT_FOUND', '原操作不存在')
            const clientSaveId = path.split('/').at(-1)!
            return { data: parse({ ...savedResult, clientSaveId }) }
          }
          const body = responses[`GET ${path}`]
          if (body === undefined) throw new RestoredHttpError(404, 'STUB_PATH_MISSING', `未桩定的路径：${path}`)
          return { data: parse(body) }
        }),
        write: vi.fn(async () => { throw new RestoredHttpError(0, 'NETWORK_LOST', '提交后网络中断', 'UNKNOWN') }),
      })
      const responses: Record<string, unknown> = {
        'GET /client/recycle/consultations/consult-1/revisions': list,
        // 真实解析器要求原始契约枚举（ENUM+select 归一化为 single），不能喂已归一化的控制器 fixture。
        'GET /client/recycle/consultations/consult-1/profile-edit-context': { ...context, fields: [{ ...context.fields[0], valueType: 'ENUM', uiType: 'select' }] },
      }

      const first = getRestoredRecycleRevisionControllerForTransport(makeTransport(null) as never, 'consult-1', { storage, identity: 'buyer-1' })
      await first.start(); await first.beginEdit(); await first.save()
      expect(first.getSnapshot().saveState).toBe('unknown')
      expect(storage.getItem(recordKey)).toBeTruthy()
      first.stop()

      // 硬刷新：新 transport → 工厂新控制器，凭同一 storage+identity 恢复并对账成功。
      const refreshed = getRestoredRecycleRevisionControllerForTransport(makeTransport(true) as never, 'consult-1', { storage, identity: 'buyer-1' })
      await refreshed.start()
      expect(refreshed.getSnapshot()).toMatchObject({ saveState: 'saved', savedRevision: { revisionId: 'revision-2' } })
      expect(refreshed.getSnapshot().saveRetryable).toBe(false)
      expect(storage.getItem(recordKey)).toBeNull()
      refreshed.stop()
    })
  })
})
