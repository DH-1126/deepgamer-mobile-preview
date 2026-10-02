import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import { createRestoredRecycleController, getRestoredRecycleControllerForTransport } from './restoredRecycleController'

const detail = { gameCode: 'wzry', gameName: '王者荣耀', fieldTemplateVersion: 3, fieldSchemaHash: 'a'.repeat(64), available: true, blockedReason: null, attachmentsAvailable: true, fields: [{ fieldKey: 'rank', label: '段位', valueType: 'single' as const, required: true, options: [{ label: '王者', value: 'king' }] }], recyclers: [{ recyclerId: 'shop-1', displayName: '店铺一', eligible: true, blockedReason: null }, { recyclerId: 'shop-2', displayName: '店铺二', eligible: true, blockedReason: null }] }
const uploaded = (mediaId = 'recycle-media-1') => ({ mediaId, mimeType: 'image/png' as const, sizeBytes: 10, width: 1, height: 1, contentUrl: `/api/v1/client/recycle/media/${mediaId}/content`, createdAt: '2026-09-24T00:59:00.000Z' })
const result = (recyclerId: string, attachments: ReturnType<typeof uploaded>[] = []) => ({ id: `consult-${recyclerId}`, clientSubmissionId: 'submission-123', gameCode: 'wzry', profileVersion: 1 as const, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], fieldTemplateVersion: 3, fieldSchemaHash: 'a'.repeat(64), recyclerId, conversationId: `conversation-${recyclerId}`, status: 'SENT' as const, attachments: attachments.map(item => ({ ...item, contentUrl: `/api/v1/client/recycle/consultations/consult-${recyclerId}/media/${item.mediaId}/content` })), createdAt: '2026-09-24T01:00:00.000Z' })
function setup(overrides: Record<string, unknown> = {}) {
  const api = { listCatalog: vi.fn().mockResolvedValue([]), readGame: vi.fn().mockResolvedValue(detail), uploadMedia: vi.fn().mockImplementation((_file: File) => Promise.resolve(uploaded())), createConsultation: vi.fn().mockImplementation((body: { recyclerId: string; attachmentMediaIds?: string[] }) => Promise.resolve(result(body.recyclerId, (body.attachmentMediaIds ?? []).map(uploaded)))), findTarget: vi.fn(), ...overrides }
  const controller = createRestoredRecycleController(api as never, () => 'submission-123')
  return { api, controller }
}

describe('restored recycle consultation controller', () => {
  it.each(['uploaded', 'failed', 'unknown', 'confirmation', 'frozen'] as const)('preserves %s image drafts and operation keys when catalog refresh is requested', async state => {
    const upload = vi.fn().mockResolvedValue(uploaded())
    if (state === 'failed') upload.mockRejectedValueOnce(new RestoredHttpError(400, 'INVALID_IMAGE', '图片无效'))
    if (state === 'unknown') upload.mockRejectedValueOnce(new RestoredHttpError(0, 'TIMEOUT', '未知', 'UNKNOWN'))
    const { controller, api } = setup({ uploadMedia: upload })
    await controller.loadCatalog()
    await controller.selectGame('wzry')
    await controller.addAttachments([new File([new Uint8Array([1])], 'draft.png', { type: 'image/png' })])
    controller.setValue('rank', 'king')
    controller.toggleRecycler('shop-1')
    if (state === 'confirmation' || state === 'frozen') expect(controller.requestConfirmation()).toBe(true)
    if (state === 'frozen') await controller.confirmAndSubmit()
    const before = controller.getSnapshot()
    await controller.loadCatalog()
    expect(controller.getSnapshot()).toBe(before)
    expect(api.listCatalog).toHaveBeenCalledTimes(1)
    if (state === 'failed' || state === 'unknown') {
      await controller.retryAttachment(before.attachments[0].localId)
      expect(upload.mock.calls[1][1]).toBe(upload.mock.calls[0][1])
      expect(controller.getSnapshot().attachments[0].state).toBe('uploaded')
    }
  })

  it.each(['values', 'merchant'] as const)('preserves %s before any image has been selected, but permits an empty draft to refresh', async state => {
    const { controller, api } = setup()
    await controller.selectGame('wzry')
    if (state === 'values') controller.setValue('rank', 'king')
    else controller.toggleRecycler('shop-1')
    const before = controller.getSnapshot()
    await controller.loadCatalog()
    expect(controller.getSnapshot()).toBe(before)
    expect(api.listCatalog).not.toHaveBeenCalled()
    if (state === 'values') controller.setValue('rank', undefined)
    else controller.toggleRecycler('shop-1')
    await controller.loadCatalog()
    expect(api.listCatalog).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().detail).toBeNull()
  })

  it('starts with no merchant or answer and validates the frozen template exactly', async () => {
    const { controller, api } = setup()
    await controller.selectGame('wzry')
    expect(controller.getSnapshot().selectedRecyclerIds).toEqual([])
    expect(controller.getSnapshot().values).toEqual({})
    expect(controller.requestConfirmation()).toBe(false)
    controller.setValue('rank', 'king')
    expect(controller.requestConfirmation()).toBe(false)
    controller.toggleRecycler('shop-1')
    expect(controller.requestConfirmation()).toBe(true)
    expect(controller.getSnapshot().confirmation?.selectedRecyclerIds).toEqual(['shop-1'])
    expect(controller.getSnapshot().confirmation?.profileVersion).toBe(1)
    expect(api.createConsultation).not.toHaveBeenCalled()
  })

  it('rejects required whitespace text answers', async () => {
    const { controller } = setup({ readGame: vi.fn().mockResolvedValue({ ...detail, fields: [{ fieldKey: 'attr:account_note', label: '账号备注', valueType: 'text', required: true, options: [] }] }) })
    await controller.selectGame('wzry')
    controller.setValue('attr:account_note', '   ')
    controller.toggleRecycler('shop-1')
    expect(controller.requestConfirmation()).toBe(false)
    expect(controller.getSnapshot().error).toContain('账号备注')
  })

  it('blocks confirmation while uploading and freezes ordered media ids into every merchant request', async () => {
    let finishSecond!: (value: ReturnType<typeof uploaded>) => void
    const upload = vi.fn().mockResolvedValueOnce(uploaded('media-1')).mockReturnValueOnce(new Promise(resolve => { finishSecond = resolve }))
    const { controller, api } = setup({ uploadMedia: upload })
    await controller.selectGame('wzry')
    const files = [new File([new Uint8Array([1])], 'one.png', { type: 'image/png' }), new File([new Uint8Array([2])], 'two.png', { type: 'image/png' })]
    const pending = controller.addAttachments(files)
    controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1'); controller.toggleRecycler('shop-2')
    expect(controller.requestConfirmation()).toBe(false)
    expect(controller.getSnapshot().error).toContain('上传')
    finishSecond(uploaded('media-2')); await pending
    expect(controller.requestConfirmation()).toBe(true)
    expect(controller.getSnapshot().confirmation?.attachmentMediaIds).toEqual(['media-1', 'media-2'])
    await controller.confirmAndSubmit()
    expect(api.createConsultation.mock.calls.map(call => call[0].attachmentMediaIds)).toEqual([['media-1', 'media-2'], ['media-1', 'media-2']])
    const localId = controller.getSnapshot().attachments[0].localId
    controller.removeAttachment(localId)
    expect(controller.getSnapshot().attachments).toHaveLength(2)
  })

  it('validates the 15-image limit before uploading any file', async () => {
    const { controller, api } = setup()
    await controller.selectGame('wzry')
    const files = Array.from({ length: 16 }, (_, index) => new File([new Uint8Array([index])], `${index}.png`, { type: 'image/png' }))
    await controller.addAttachments(files)
    expect(controller.getSnapshot().error).toContain('15')
    expect(controller.getSnapshot().attachments).toEqual([])
    expect(api.uploadMedia).not.toHaveBeenCalled()
  })

  it('keeps one upload key across an unknown retry and lets the user remove a failed draft', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')).mockResolvedValueOnce(uploaded())
    const { controller } = setup({ uploadMedia: upload })
    await controller.selectGame('wzry')
    await controller.addAttachments([new File([new Uint8Array([1])], 'one.png', { type: 'image/png' })])
    expect(controller.getSnapshot().attachments[0].state).toBe('unknown')
    const firstKey = upload.mock.calls[0][1]
    await controller.retryAttachment(controller.getSnapshot().attachments[0].localId)
    expect(upload.mock.calls[1][1]).toBe(firstKey)
    expect(controller.getSnapshot().attachments[0].state).toBe('uploaded')
    controller.removeAttachment(controller.getSnapshot().attachments[0].localId)
    expect(controller.getSnapshot().attachments).toEqual([])
  })

  it('classifies a definite upload failure without reporting a false success', async () => {
    const { controller } = setup({ uploadMedia: vi.fn().mockRejectedValue(new RestoredHttpError(400, 'MEDIA_INVALID', '图片字节无效')) })
    await controller.selectGame('wzry')
    await controller.addAttachments([new File([new Uint8Array([1])], 'one.png', { type: 'image/png' })])
    expect(controller.getSnapshot().attachments[0]).toMatchObject({ state: 'failed', media: null })
    expect(controller.getSnapshot().attachments[0].error).toContain('上传失败')
  })

  it('isolates a late media response after switching games or suspending an unmounted page', async () => {
    let finish!: (value: ReturnType<typeof uploaded>) => void
    const { controller } = setup({ uploadMedia: vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve })) })
    await controller.selectGame('wzry')
    const pending = controller.addAttachments([new File([new Uint8Array([1])], 'one.png', { type: 'image/png' })])
    controller.pauseMediaUploads()
    expect(controller.getSnapshot().attachments[0].state).toBe('unknown')
    finish(uploaded()); await pending
    expect(controller.getSnapshot().attachments[0].state).toBe('unknown')
    await controller.selectGame('peace')
    expect(controller.getSnapshot().attachments).toEqual([])
  })

  it('freezes one payload and merchant list, reports partial results, never resends success', async () => {
    const { controller, api } = setup({ createConsultation: vi.fn().mockResolvedValueOnce(result('shop-1')).mockRejectedValueOnce(new RestoredHttpError(400, 'NO', '拒绝')) })
    await controller.selectGame('wzry')
    controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1'); controller.toggleRecycler('shop-2')
    expect(controller.requestConfirmation()).toBe(true)
    await controller.confirmAndSubmit()
    expect(controller.getSnapshot().targets.map(target => target.state)).toEqual(['success', 'failed'])
    controller.setValue('rank', 'wrong'); controller.toggleRecycler('shop-1')
    expect(controller.getSnapshot().values.rank).toBe('king')
    expect(api.createConsultation).toHaveBeenCalledTimes(2)
    expect(api.createConsultation.mock.calls[0][0].selectedRecyclerIds).toEqual(['shop-1', 'shop-2'])
    expect(api.createConsultation.mock.calls[1][0].selectedRecyclerIds).toEqual(['shop-1', 'shop-2'])
  })

  it('queries an unknown outcome and waits for explicit retry of identical operation after 404', async () => {
    const create = vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')).mockResolvedValueOnce(result('shop-1'))
    const find = vi.fn().mockRejectedValue(new RestoredHttpError(404, 'NOT_FOUND', '未找到'))
    const { controller } = setup({ createConsultation: create, findTarget: find })
    await controller.selectGame('wzry'); controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1')
    controller.requestConfirmation(); await controller.confirmAndSubmit()
    expect(find).toHaveBeenCalledWith('submission-123', 'shop-1', expect.anything())
    expect(create).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().targets[0].state).toBe('unknown')
    await controller.retryTarget('shop-1')
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0])
    expect(create.mock.calls[1][1]).toBe(create.mock.calls[0][1])
    expect(controller.getSnapshot().targets[0].state).toBe('success')
  })

  it('does not POST on a lookup failure followed by a lookup 404 in the same action', async () => {
    const create = vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')).mockResolvedValueOnce(result('shop-1'))
    const find = vi.fn().mockRejectedValueOnce(new RestoredHttpError(503, 'LOOKUP_FAILED', '查询失败')).mockRejectedValueOnce(new RestoredHttpError(404, 'NOT_FOUND', '未找到'))
    const { controller } = setup({ createConsultation: create, findTarget: find })
    await controller.selectGame('wzry'); controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1')
    controller.requestConfirmation(); await controller.confirmAndSubmit()
    expect(controller.getSnapshot().targets[0].retryable).toBe(false)
    await controller.checkUnknownTarget('shop-1')
    expect(create).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().targets[0].retryable).toBe(true)
    await controller.retryTarget('shop-1')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('drops old game responses after switching games or disconnect', async () => {
    let finish!: (value: typeof detail) => void
    const { controller } = setup({ readGame: vi.fn().mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...detail, gameCode: 'peace' }) })
    const old = controller.selectGame('wzry'); await controller.selectGame('peace'); finish(detail); await old
    expect(controller.getSnapshot().detail?.gameCode).toBe('peace')
    controller.disconnect()
    expect(controller.getSnapshot().detail).toBeNull()
  })

  it('keeps an unresolved original submission while a new round is requested', async () => {
    const { controller } = setup({ createConsultation: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')), findTarget: vi.fn().mockRejectedValue(new RestoredHttpError(404, 'NOT_FOUND', '未找到')) })
    await controller.selectGame('wzry'); controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1')
    controller.requestConfirmation(); await controller.confirmAndSubmit()
    controller.startNew()
    expect(controller.getSnapshot().targets[0].state).toBe('unknown')
    expect(controller.getSnapshot().frozen).toBe(true)
    controller.disconnect()
    expect(controller.getSnapshot().targets[0].state).toBe('unknown')
  })

  it('omits optional whitespace fields from the frozen server payload', async () => {
    const { controller, api } = setup({ readGame: vi.fn().mockResolvedValue({ ...detail, fields: [...detail.fields, { fieldKey: 'attr:optional_note', label: '备注', valueType: 'text', required: false, options: [] }] }) })
    await controller.selectGame('wzry')
    controller.setValue('rank', 'king'); controller.setValue('attr:optional_note', '   '); controller.toggleRecycler('shop-1')
    controller.requestConfirmation(); await controller.confirmAndSubmit()
    expect(api.createConsultation.mock.calls[0][0].values).toEqual({ rank: 'king' })
  })

  it('reuses the original batch for the same transport and isolates another actor transport', () => {
    const transportA = { read: vi.fn(), write: vi.fn() } as never
    const transportB = { read: vi.fn(), write: vi.fn() } as never
    expect(getRestoredRecycleControllerForTransport(transportA)).toBe(getRestoredRecycleControllerForTransport(transportA))
    expect(getRestoredRecycleControllerForTransport(transportB)).not.toBe(getRestoredRecycleControllerForTransport(transportA))
  })

  it('restores an unresolved batch after routed-page remount within one transport', async () => {
    const read = vi.fn().mockImplementation((path: string) => Promise.resolve({ data: path === '/client/recycle/catalog' ? [{ gameCode: 'wzry', gameName: '王者荣耀', available: true, blockedReason: null, eligibleRecyclerCount: 2 }] : detail }))
    const write = vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN'))
    const transport = { read, write } as never
    const before = getRestoredRecycleControllerForTransport(transport)
    await before.loadCatalog(); await before.selectGame('wzry'); before.setValue('rank', 'king'); before.toggleRecycler('shop-1')
    before.requestConfirmation()
    const pending = before.confirmAndSubmit()
    await pending
    const after = getRestoredRecycleControllerForTransport(transport)
    expect(after.getSnapshot().targets[0].state).toBe('unknown')
    expect(after.getSnapshot().targets[0].body.selectedRecyclerIds).toEqual(['shop-1'])
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('lets a user explicitly end a definite failure and begin a fresh selection', async () => {
    const { controller } = setup({ createConsultation: vi.fn().mockRejectedValue(new RestoredHttpError(409, 'RECYCLE_TEMPLATE_STALE', '模板已更新')) })
    await controller.selectGame('wzry'); controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1')
    controller.requestConfirmation(); await controller.confirmAndSubmit()
    expect(controller.getSnapshot().targets[0].state).toBe('failed')
    controller.startNew()
    expect(controller.getSnapshot().selectedRecyclerIds).toEqual([])
    expect(controller.getSnapshot().frozen).toBe(false)
  })

  it('rejects an original-result lookup whose profile differs from the frozen submission', async () => {
    const { controller } = setup({ createConsultation: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')), findTarget: vi.fn().mockResolvedValue({ ...result('shop-1'), profileFields: [{ fieldKey: 'rank', label: '段位', value: 'bronze', displayValue: '青铜' }] }) })
    await controller.selectGame('wzry'); controller.setValue('rank', 'king'); controller.toggleRecycler('shop-1')
    controller.requestConfirmation(); await controller.confirmAndSubmit()
    expect(controller.getSnapshot().targets[0].state).toBe('unknown')
    expect(controller.getSnapshot().targets[0].result).toBeNull()
  })
})
