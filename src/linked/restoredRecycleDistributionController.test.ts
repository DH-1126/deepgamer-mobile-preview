import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import type { RecycleSnapshot } from './restoredRecycleController'

const hash = 'a'.repeat(64)
const detail = {
  gameCode: 'wzry', gameName: '王者荣耀', fieldTemplateVersion: 3, fieldSchemaHash: hash, available: true, blockedReason: null, attachmentsAvailable: true,
  fields: [{ fieldKey: 'rank', label: '段位', valueType: 'single' as const, required: true, options: [{ label: '王者', value: 'king' }] }],
  recyclers: [
    { recyclerId: 'shop-old', displayName: '已有商家', eligible: true, blockedReason: null },
    { recyclerId: 'shop-1', displayName: '新商家甲', eligible: true, blockedReason: null },
    { recyclerId: 'shop-2', displayName: '新商家乙', eligible: true, blockedReason: null },
  ],
}
const revision = (id = 'revision-1', version = 1) => ({
  revisionId: id, requestId: 'request-1', revisionNumber: version, profileVersion: version, gameCode: 'wzry', fieldTemplateVersion: 3,
  fieldSchemaHash: hash, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], attachments: [], createdAt: '2026-09-28T02:00:00.000Z',
})
const summary = { requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', latestRevisionId: 'revision-1', latestProfileVersion: 1, createdAt: '2026-09-28T02:00:00.000Z' }
const createResult = { clientRequestId: 'request-command-0001', created: true, request: summary, revision: revision() }
const context = {
  requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true as const, baseRevisionId: 'revision-1', fieldTemplateVersion: 3,
  fieldSchemaHash: hash, fields: [], values: {}, attachments: [], consultations: [{ consultationId: 'consult-old', recyclerId: 'shop-old', recyclerName: '已有商家', conversationId: 'conversation-old', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-28T02:30:00.000Z' }],
}
const formSnapshot: RecycleSnapshot = {
  catalog: [], detail, loading: false, error: null, values: { rank: 'king' }, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false,
}

describe('saved recycle request controller', () => {
  it('keeps an unchanged snapshot referentially stable for useSyncExternalStore consumers', async () => {
    const { createRestoredRecycleRequestController } = await import('./restoredRecycleDistributionController')
    const form = { getSnapshot: () => formSnapshot, subscribe: () => () => undefined, startNew: vi.fn() }
    const api = { listRequests: vi.fn().mockResolvedValue([]), createRequest: vi.fn(), findRequestOperation: vi.fn() }
    const controller = createRestoredRecycleRequestController(form as never, api as never)
    const first = controller.getSnapshot()
    expect(controller.getSnapshot()).toBe(first)
  })

  it('recovers an uncertain save with the original command and clears the form after success', async () => {
    const module = await import('./restoredRecycleDistributionController').catch(() => ({} as Record<string, unknown>))
    expect(typeof module.createRestoredRecycleRequestController).toBe('function')
    if (typeof module.createRestoredRecycleRequestController !== 'function') return
    let snapshot = formSnapshot
    const startNew = vi.fn(() => { snapshot = { ...formSnapshot, detail: null, values: {}, attachments: [] } })
    const form = { getSnapshot: () => snapshot, subscribe: () => () => undefined, startNew }
    const api = {
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN')),
      findRequestOperation: vi.fn().mockResolvedValue(createResult),
    }
    const controller = module.createRestoredRecycleRequestController(form as never, api as never, () => 'request-command-0001')
    await controller.start()
    await controller.saveRequest()
    expect(api.createRequest).toHaveBeenCalledTimes(1)
    expect(api.findRequestOperation).toHaveBeenCalledWith('request-command-0001', expect.any(AbortSignal))
    expect(controller.getSnapshot()).toMatchObject({ saveState: 'saved', savedRequest: summary, requests: [summary] })
    expect(startNew).toHaveBeenCalledTimes(1)
    expect(snapshot).toMatchObject({ detail: null, values: {}, attachments: [] })
  })

  it('keeps the original request body and key when lookup proves the operation did not run', async () => {
    const { createRestoredRecycleRequestController } = await import('./restoredRecycleDistributionController')
    const form = { getSnapshot: () => formSnapshot, subscribe: () => () => undefined, startNew: vi.fn() }
    const api = {
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')).mockResolvedValueOnce(createResult),
      findRequestOperation: vi.fn().mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_PROFILE_REQUEST_OPERATION_NOT_FOUND', '未找到')),
    }
    const controller = createRestoredRecycleRequestController(form as never, api as never, () => 'request-command-0001')
    await controller.start(); await controller.saveRequest()
    expect(controller.getSnapshot()).toMatchObject({ saveState: 'unknown', saveRetryable: true })
    await controller.retrySave()
    expect(api.createRequest.mock.calls[1].slice(0, 2)).toEqual(api.createRequest.mock.calls[0].slice(0, 2))
    expect(controller.getSnapshot().saveState).toBe('saved')
  })

  it('turns an in-flight save into query-only unknown when its route unmounts', async () => {
    const { createRestoredRecycleRequestController } = await import('./restoredRecycleDistributionController')
    const form = { getSnapshot: () => formSnapshot, subscribe: () => () => undefined, startNew: vi.fn() }
    const api = {
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn((_body, _key, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '未知', 'UNKNOWN')), { once: true }))),
      findRequestOperation: vi.fn(),
    }
    const controller = createRestoredRecycleRequestController(form as never, api as never, () => 'request-command-0001')
    await controller.start()
    const saving = controller.saveRequest(); await Promise.resolve()
    expect(controller.getSnapshot().saveState).toBe('saving')
    controller.stop(); await saving
    expect(controller.getSnapshot()).toMatchObject({ saveState: 'unknown', saveRetryable: false, error: expect.stringContaining('查询原操作') })
    await controller.start()
    expect(controller.getSnapshot().saveState).toBe('unknown')
  })

  it('coalesces rapid repeated checks of the same unknown save operation', async () => {
    const { createRestoredRecycleRequestController } = await import('./restoredRecycleDistributionController')
    const form = { getSnapshot: () => formSnapshot, subscribe: () => () => undefined, startNew: vi.fn() }
    let resolveLookup!: (value: typeof createResult) => void
    const lookup = new Promise<typeof createResult>(resolve => { resolveLookup = resolve })
    const api = {
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')),
      findRequestOperation: vi.fn().mockRejectedValueOnce(new RestoredHttpError(500, 'RECYCLE_PROFILE_REQUEST_LOOKUP_FAILED', '查询失败')).mockImplementation(() => lookup),
    }
    const controller = createRestoredRecycleRequestController(form as never, api as never, () => 'request-command-0001')
    await controller.start(); await controller.saveRequest()
    expect(controller.getSnapshot().saveState).toBe('unknown')

    const first = controller.checkUnknownSave()
    const second = controller.checkUnknownSave()
    expect(api.findRequestOperation).toHaveBeenCalledTimes(2)
    resolveLookup(createResult); await Promise.all([first, second])
    expect(controller.getSnapshot()).toMatchObject({ saveState: 'saved', savedRequest: summary, error: null })
  })
})

describe('new recycler distribution controller', () => {
  it('keeps unavailable non-existing merchants visible but never selectable', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const unavailableDetail = { ...detail, recyclers: detail.recyclers.map(item => item.recyclerId === 'shop-2' ? { ...item, eligible: false, blockedReason: 'GAME_RELATION_DISABLED' } : item) }
    const api = { readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]) }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(unavailableDetail) } as never)
    await controller.start()
    expect(controller.getSnapshot().availableRecyclers).toMatchObject([{ recyclerId: 'shop-1', eligible: true }, { recyclerId: 'shop-2', eligible: false, blockedReason: 'GAME_RELATION_DISABLED' }])
    controller.toggleRecycler('shop-2')
    expect(controller.getSnapshot().selectedRecyclerIds).toEqual([])
  })

  it('defaults to zero new merchants and freezes the chosen version, names and count before writing', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const api = { readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]) }
    const catalog = { readGame: vi.fn().mockResolvedValue(detail) }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, catalog as never, () => 'distribution-0001')
    await controller.start()
    expect(controller.getSnapshot()).toMatchObject({ selectedRecyclerIds: [], availableRecyclers: [{ recyclerId: 'shop-1' }, { recyclerId: 'shop-2' }] })
    controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.toggleRecycler('shop-2')
    expect(controller.requestConfirmation()).toBe(true)
    expect(controller.getSnapshot().confirmation).toEqual({ revisionId: 'revision-1', profileVersion: 1, selectedRecyclerIds: ['shop-1', 'shop-2'], selectedRecyclerNames: ['新商家甲', '新商家乙'] })
  })

  it('queries an uncertain confirmation before same-key retry and never resends a successful target', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const pendingTarget = (recyclerId: string, recyclerName: string) => ({ recyclerId, recyclerName, status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null })
    const successTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'SUCCESS' as const, consultationId: 'consult-1', conversationId: 'conversation-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z', errorCode: null, errorMessage: null }
    const failedTarget = { recyclerId: 'shop-2', recyclerName: '新商家乙', status: 'FAILED' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: 'RECYCLE_RECYCLER_UNAVAILABLE', errorMessage: '回收商暂不可用' }
    const distribution = { clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1', 'shop-2'], targets: [pendingTarget('shop-1', '新商家甲'), pendingTarget('shop-2', '新商家乙')], createdAt: '2026-09-28T02:30:00.000Z' }
    const api = {
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')).mockResolvedValueOnce(distribution),
      findDistribution: vi.fn().mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_PROFILE_DISTRIBUTION_NOT_FOUND', '未找到')),
      executeTarget: vi.fn().mockResolvedValueOnce(successTarget).mockResolvedValueOnce(failedTarget).mockResolvedValueOnce({ ...failedTarget, status: 'SUCCESS', consultationId: 'consult-2', conversationId: 'conversation-2', deliveryId: 'delivery-2', messageId: 'message-2', deliveredAt: '2026-09-28T03:01:00.000Z', errorCode: null, errorMessage: null }),
      findTarget: vi.fn(),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.toggleRecycler('shop-2'); controller.requestConfirmation()
    await controller.confirmDistribution()
    expect(controller.getSnapshot()).toMatchObject({ confirmationState: 'unknown', confirmationRetryable: true, targets: [] })
    await controller.retryConfirmation()
    expect(api.confirmDistribution.mock.calls[1].slice(0, 3)).toEqual(api.confirmDistribution.mock.calls[0].slice(0, 3))
    expect(controller.getSnapshot().targets).toMatchObject([{ recyclerId: 'shop-1', status: 'SUCCESS' }, { recyclerId: 'shop-2', status: 'FAILED' }])
    await controller.retryTarget('shop-2')
    expect(api.executeTarget.mock.calls.map(call => call[2])).toEqual(['shop-1', 'shop-2', 'shop-2'])
    expect(api.executeTarget.mock.calls[2][0]).toBe('revision-1')
    expect(api.executeTarget.mock.calls[2][1]).toBe('distribution-0001')
    expect(api.executeTarget.mock.calls[2][3]).not.toBe(api.executeTarget.mock.calls[1][3])
    expect(controller.getSnapshot().targets).toMatchObject([{ recyclerId: 'shop-1', status: 'SUCCESS' }, { recyclerId: 'shop-2', status: 'SUCCESS' }])
  })

  it('queries an unknown target and retries a recovered pending target with a new transport key', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const pendingTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null }
    const distribution = { clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [pendingTarget], createdAt: '2026-09-28T02:30:00.000Z' }
    const successTarget = { ...pendingTarget, status: 'SUCCESS' as const, consultationId: 'consult-1', conversationId: 'conversation-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' }
    const api = {
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockResolvedValue(distribution), findDistribution: vi.fn(),
      executeTarget: vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')).mockResolvedValueOnce(successTarget),
      findTarget: vi.fn().mockResolvedValueOnce(pendingTarget),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.requestConfirmation()
    await controller.confirmDistribution()
    expect(api.findTarget).toHaveBeenCalledWith('revision-1', 'distribution-0001', 'shop-1', expect.any(AbortSignal))
    expect(controller.getSnapshot().targets[0]).toMatchObject({ state: 'UNKNOWN', retryable: true })
    const originalKey = api.executeTarget.mock.calls[0][3]
    await controller.retryTarget('shop-1')
    expect(api.executeTarget.mock.calls[1].slice(0, 3)).toEqual(['revision-1', 'distribution-0001', 'shop-1'])
    expect(api.executeTarget.mock.calls[1][3]).not.toBe(originalKey)
  })

  it('does not turn a missing frozen target into a retryable new command', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const pendingTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null }
    const distribution = { clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [pendingTarget], createdAt: '2026-09-28T02:30:00.000Z' }
    const api = {
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockResolvedValue(distribution), findDistribution: vi.fn(),
      executeTarget: vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')),
      findTarget: vi.fn().mockRejectedValueOnce(new RestoredHttpError(404, 'RECYCLE_PROFILE_DISTRIBUTION_TARGET_NOT_FOUND', '未找到')),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.requestConfirmation()
    await controller.confirmDistribution()
    expect(controller.getSnapshot().targets[0]).toMatchObject({ state: 'UNKNOWN', retryable: false })
    await controller.retryTarget('shop-1')
    expect(api.executeTarget).toHaveBeenCalledTimes(1)
  })

  it('refreshes the frozen context after resolved targets finish so a successful merchant cannot be selected again', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const pendingTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null }
    const successTarget = { ...pendingTarget, status: 'SUCCESS' as const, consultationId: 'consult-1', conversationId: 'conversation-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' }
    const refreshedContext = { ...context, consultations: [...context.consultations, { consultationId: 'consult-1', recyclerId: 'shop-1', recyclerName: '新商家甲', conversationId: 'conversation-1', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-28T03:00:00.000Z' }] }
    const api = {
      readRequestContext: vi.fn().mockResolvedValueOnce(context).mockResolvedValueOnce(refreshedContext), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockResolvedValue({ clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [pendingTarget], createdAt: '2026-09-28T02:30:00.000Z' }),
      findDistribution: vi.fn(), executeTarget: vi.fn().mockResolvedValue(successTarget), findTarget: vi.fn(),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.requestConfirmation(); await controller.confirmDistribution()
    expect(controller.getSnapshot().targets[0].state).toBe('SUCCESS')
    await controller.finish()
    expect(api.readRequestContext).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot().availableRecyclers.map(item => item.recyclerId)).toEqual(['shop-2'])
  })

  it('uses distinct transport keys for long target ids with the same prefix', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const firstId = `${'merchant-common-prefix-'.repeat(4)}a`.slice(0, 100)
    const secondId = `${'merchant-common-prefix-'.repeat(4)}b`.slice(0, 100)
    const longDetail = { ...detail, recyclers: [{ recyclerId: firstId, displayName: '商家甲', eligible: true, blockedReason: null }, { recyclerId: secondId, displayName: '商家乙', eligible: true, blockedReason: null }] }
    const target = (recyclerId: string, recyclerName: string) => ({ recyclerId, recyclerName, status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null })
    const distributionId = 'd'.repeat(80)
    const api = {
      readRequestContext: vi.fn().mockResolvedValue({ ...context, consultations: [] }), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockResolvedValue({ clientDistributionId: distributionId, requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: [firstId, secondId], targets: [target(firstId, '商家甲'), target(secondId, '商家乙')], createdAt: '2026-09-28T02:30:00.000Z' }),
      findDistribution: vi.fn(), executeTarget: vi.fn(async (_revisionId, _distributionId, recyclerId, _key: string) => ({ ...target(recyclerId, recyclerId === firstId ? '商家甲' : '商家乙'), status: 'FAILED' as const, errorCode: 'RECYCLE_RECYCLER_UNAVAILABLE', errorMessage: '暂不可用' })), findTarget: vi.fn(),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(longDetail) } as never, () => distributionId)
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler(firstId); controller.toggleRecycler(secondId); controller.requestConfirmation(); await controller.confirmDistribution()
    expect(api.executeTarget.mock.calls[0][3]).not.toBe(api.executeTarget.mock.calls[1][3])
  })

  it('converts route-aborted confirmation and target writes into query-only unknown states', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const aborting = (_revisionId: string, _body: unknown, _key: string, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '未知', 'UNKNOWN')), { once: true }))
    const confirmationApi = { readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]), confirmDistribution: vi.fn(aborting), findDistribution: vi.fn(), executeTarget: vi.fn(), findTarget: vi.fn() }
    const confirmationController = createRestoredRecycleNewMerchantController('request-1', confirmationApi as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await confirmationController.start(); confirmationController.selectRevision('revision-1'); confirmationController.toggleRecycler('shop-1'); confirmationController.requestConfirmation()
    const confirming = confirmationController.confirmDistribution(); await Promise.resolve(); confirmationController.stop(); await confirming
    expect(confirmationController.getSnapshot()).toMatchObject({ busy: false, confirmationState: 'unknown', confirmationRetryable: false, error: expect.stringContaining('查询原分发') })

    const pendingTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null }
    const targetApi = {
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockResolvedValue({ clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [pendingTarget], createdAt: '2026-09-28T02:30:00.000Z' }), findDistribution: vi.fn(),
      executeTarget: vi.fn((_revisionId, _distributionId, _recyclerId, _key, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '未知', 'UNKNOWN')), { once: true }))), findTarget: vi.fn(),
    }
    const targetController = createRestoredRecycleNewMerchantController('request-1', targetApi as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await targetController.start(); targetController.selectRevision('revision-1'); targetController.toggleRecycler('shop-1'); targetController.requestConfirmation()
    const distributing = targetController.confirmDistribution(); await Promise.resolve(); await Promise.resolve(); targetController.stop(); await distributing
    expect(targetController.getSnapshot()).toMatchObject({ busy: false, targets: [{ recyclerId: 'shop-1', state: 'UNKNOWN', retryable: false, localError: expect.stringContaining('查询原目标') }] })
  })

  it('clears busy when the route unmounts during an unknown confirmation lookup', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const failedTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'FAILED' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: 'RECYCLE_RECYCLER_UNAVAILABLE', errorMessage: '暂不可用' }
    const distribution = { clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [failedTarget], createdAt: '2026-09-28T02:30:00.000Z' }
    const abortingLookup = (_revisionId: string, _distributionId: string, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '未知', 'UNKNOWN')), { once: true }))
    const api = {
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')),
      findDistribution: vi.fn().mockRejectedValueOnce(new RestoredHttpError(404, 'RECYCLE_PROFILE_DISTRIBUTION_NOT_FOUND', '未找到')).mockImplementationOnce(abortingLookup).mockResolvedValueOnce(distribution),
      executeTarget: vi.fn(), findTarget: vi.fn(),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.requestConfirmation(); await controller.confirmDistribution()
    expect(controller.getSnapshot()).toMatchObject({ confirmationState: 'unknown', busy: false })

    const lookup = controller.checkUnknownConfirmation(); await Promise.resolve()
    expect(controller.getSnapshot().busy).toBe(true)
    controller.stop(); await lookup
    expect(controller.getSnapshot()).toMatchObject({ confirmationState: 'unknown', confirmationRetryable: false, busy: false, error: expect.stringContaining('查询原分发') })

    await controller.start(); await controller.checkUnknownConfirmation()
    expect(controller.getSnapshot()).toMatchObject({ confirmationState: 'confirmed', busy: false, targets: [{ recyclerId: 'shop-1', state: 'FAILED' }] })
  })

  it('clears busy when the route unmounts during an unknown target lookup', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const pendingTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null }
    const successTarget = { ...pendingTarget, status: 'SUCCESS' as const, consultationId: 'consult-1', conversationId: 'conversation-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' }
    const distribution = { clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [pendingTarget], createdAt: '2026-09-28T02:30:00.000Z' }
    const abortingLookup = (_revisionId: string, _distributionId: string, _recyclerId: string, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '未知', 'UNKNOWN')), { once: true }))
    const api = {
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockResolvedValue(distribution), findDistribution: vi.fn(),
      executeTarget: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')),
      findTarget: vi.fn().mockResolvedValueOnce(pendingTarget).mockImplementationOnce(abortingLookup).mockResolvedValueOnce(successTarget),
    }
    const controller = createRestoredRecycleNewMerchantController('request-1', api as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001')
    await controller.start(); controller.selectRevision('revision-1'); controller.toggleRecycler('shop-1'); controller.requestConfirmation(); await controller.confirmDistribution()
    expect(controller.getSnapshot()).toMatchObject({ busy: false, targets: [{ recyclerId: 'shop-1', state: 'UNKNOWN' }] })

    const lookup = controller.checkUnknownTarget('shop-1'); await Promise.resolve()
    expect(controller.getSnapshot().busy).toBe(true)
    controller.stop(); await lookup
    expect(controller.getSnapshot()).toMatchObject({ busy: false, targets: [{ recyclerId: 'shop-1', state: 'UNKNOWN', retryable: false, localError: expect.stringContaining('查询原目标') }] })

    await controller.start(); await controller.checkUnknownTarget('shop-1')
    expect(controller.getSnapshot()).toMatchObject({ busy: false, targets: [{ recyclerId: 'shop-1', state: 'SUCCESS' }] })
  })
})

// W02：回收申请与新商家分发的未决命令跨硬刷新恢复（主体隔离的最小标识持久化）。
describe('w02 pending recycle command recovery', () => {
  const memoryStorage = () => {
    const map = new Map<string, string>()
    return Object.assign({
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v) },
      removeItem: (k: string) => { map.delete(k) },
    }, { _map: map })
  }
  const pendingTarget = { recyclerId: 'shop-1', recyclerName: '新商家甲', status: 'PENDING' as const, consultationId: null, conversationId: null, deliveryId: null, messageId: null, deliveredAt: null, errorCode: null, errorMessage: null }
  const successTarget = { ...pendingTarget, status: 'SUCCESS' as const, consultationId: 'consult-1', conversationId: 'conversation-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' }
  const distribution = { clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'], targets: [pendingTarget], createdAt: '2026-09-28T02:30:00.000Z' }

  it('restores an unresolved request save by identity and reconciles via the original clientRequestId', async () => {
    const { createRestoredRecycleRequestController } = await import('./restoredRecycleDistributionController')
    const storage = memoryStorage()
    const recordKey = 'deepgamer:recycle-command:v1:buyer-1:request-save'
    let snapshot = formSnapshot
    const startNew = vi.fn(() => { snapshot = { ...formSnapshot, detail: null, values: {}, attachments: [] } })
    const form = { getSnapshot: () => snapshot, subscribe: () => () => undefined, startNew }
    const makeApi = () => ({
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN')),
      findRequestOperation: vi.fn().mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_PROFILE_REQUEST_OPERATION_NOT_FOUND', '未找到')),
    })

    const first = createRestoredRecycleRequestController(form as never, makeApi() as never, () => 'request-command-0001', { storage, identity: 'buyer-1' })
    await first.start(); await first.saveRequest()
    expect(first.getSnapshot().saveState).toBe('unknown')
    expect(storage.getItem(recordKey)).toBeTruthy()

    // 硬刷新：同存储 + 同主体，凭原 clientRequestId 对账成功并清除记录，绝不新建命令。
    const refreshedApi = makeApi()
    refreshedApi.findRequestOperation.mockResolvedValue(createResult)
    const refreshed = createRestoredRecycleRequestController(form as never, refreshedApi as never, () => 'request-command-0002', { storage, identity: 'buyer-1' })
    await refreshed.start()
    expect(refreshed.getSnapshot()).toMatchObject({ saveState: 'saved', savedRequest: summary })
    expect(refreshedApi.createRequest).not.toHaveBeenCalled()
    expect(storage.getItem(recordKey)).toBeNull()

    // 其他主体不得读取或恢复前一主体的未决命令。
    const otherApi = makeApi()
    const other = createRestoredRecycleRequestController(form as never, otherApi as never, () => 'request-command-0003', { storage, identity: 'buyer-2' })
    await other.start()
    expect(other.getSnapshot().saveState).not.toBe('unknown')
    expect(otherApi.findRequestOperation).not.toHaveBeenCalled()
  })

  it('does not advertise retry for a restored request save confirmed not executed', async () => {
    const { createRestoredRecycleRequestController } = await import('./restoredRecycleDistributionController')
    const storage = memoryStorage()
    const recordKey = 'deepgamer:recycle-command:v1:buyer-1:request-save'
    let snapshot = formSnapshot
    const form = { getSnapshot: () => snapshot, subscribe: () => () => undefined, startNew: vi.fn(() => { snapshot = { ...formSnapshot, detail: null, values: {}, attachments: [] } }) }
    const failApi = {
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN')),
      findRequestOperation: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN')),
    }
    const first = createRestoredRecycleRequestController(form as never, failApi as never, () => 'request-command-9001', { storage, identity: 'buyer-1' })
    await first.start(); await first.saveRequest()
    expect(first.getSnapshot().saveState).toBe('unknown')
    first.stop()

    // 独立复核残留项回归：恢复型尝试确认未执行 → 不提供重发入口（镜像 P2 修复）。
    const refreshedApi = {
      listRequests: vi.fn().mockResolvedValue([]),
      createRequest: vi.fn(),
      findRequestOperation: vi.fn().mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_PROFILE_REQUEST_OPERATION_NOT_FOUND', '未找到')),
    }
    const second = createRestoredRecycleRequestController(form as never, refreshedApi as never, () => 'request-command-9002', { storage, identity: 'buyer-1' })
    await second.start()
    expect(second.getSnapshot()).toMatchObject({ saveState: 'unknown', saveRetryable: false })
    await second.retrySave()
    expect(refreshedApi.createRequest).not.toHaveBeenCalled()
    expect(storage.getItem(recordKey)).toBeTruthy()
    second.stop()
  })

  it('restores an unresolved merchant distribution by identity, executes recovered pending targets and clears the record', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const storage = memoryStorage()
    const recordKey = 'deepgamer:recycle-command:v1:buyer-1:distribution:confirm:request-1'
    const makeApi = (foundDistribution?: typeof distribution) => ({
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')),
      findDistribution: foundDistribution ? vi.fn().mockResolvedValue(foundDistribution) : vi.fn().mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_PROFILE_DISTRIBUTION_NOT_FOUND', '未找到')),
      executeTarget: vi.fn().mockResolvedValue(successTarget),
      findTarget: vi.fn(),
    })

    const first = createRestoredRecycleNewMerchantController('request-1', makeApi() as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001', { storage, identity: 'buyer-1' })
    await first.start(); first.selectRevision('revision-1'); first.toggleRecycler('shop-1'); first.requestConfirmation()
    await first.confirmDistribution()
    expect(first.getSnapshot()).toMatchObject({ confirmationState: 'unknown', confirmationRetryable: true })
    expect(storage.getItem(recordKey)).toBeTruthy()

    // 硬刷新：对账找到已确认分发 → 恢复的 PENDING 目标真实执行 → 全部落定后清除记录。
    const refreshedApi = makeApi(distribution)
    const refreshed = createRestoredRecycleNewMerchantController('request-1', refreshedApi as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0002', { storage, identity: 'buyer-1' })
    await refreshed.start()
    expect(refreshed.getSnapshot()).toMatchObject({ confirmationState: 'confirmed', targets: [{ recyclerId: 'shop-1', state: 'SUCCESS' }] })
    expect(refreshedApi.confirmDistribution).not.toHaveBeenCalled()
    expect(refreshedApi.executeTarget).toHaveBeenCalledWith('revision-1', 'distribution-0001', 'shop-1', expect.any(String), expect.any(AbortSignal))
    expect(storage.getItem(recordKey)).toBeNull()

    // 其他主体的同请求页面不得恢复该分发记录。
    const otherApi = makeApi()
    const other = createRestoredRecycleNewMerchantController('request-1', otherApi as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0003', { storage, identity: 'buyer-2' })
    await other.start()
    expect(other.getSnapshot().confirmationState).not.toBe('unknown')
    expect(otherApi.findDistribution).not.toHaveBeenCalled()
  })

  it('keeps the distribution record while a recovered target stays frozen-unknown and clears it once retry settles', async () => {
    const { createRestoredRecycleNewMerchantController } = await import('./restoredRecycleDistributionController')
    const storage = memoryStorage()
    const recordKey = 'deepgamer:recycle-command:v1:buyer-1:distribution:confirm:request-1'
    const frozenTarget = { ...pendingTarget }
    const frozenDistribution = { ...distribution, targets: [frozenTarget] }
    const makeApi = (opts: { found?: typeof distribution; frozenExecute?: boolean } = {}) => ({
      readRequestContext: vi.fn().mockResolvedValue(context), listRequestRevisions: vi.fn().mockResolvedValue([revision()]),
      confirmDistribution: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN')),
      findDistribution: opts.found ? vi.fn().mockResolvedValue(opts.found) : vi.fn().mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_PROFILE_DISTRIBUTION_NOT_FOUND', '未找到')),
      // 冻结名单场景：执行未知 → 对账发现目标仍在冻结待处理 → UNKNOWN+retryable。
      executeTarget: opts.frozenExecute
        ? vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_REQUEST_TIMEOUT', '未知', 'UNKNOWN'))
        : vi.fn().mockResolvedValue(successTarget),
      findTarget: vi.fn().mockResolvedValue(frozenTarget),
    })

    // makeId 与夹具 clientDistributionId('distribution-0001') 对齐，保证恢复对账一致。
    const first = createRestoredRecycleNewMerchantController('request-1', makeApi() as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0001', { storage, identity: 'buyer-1' })
    await first.start(); first.selectRevision('revision-1'); first.toggleRecycler('shop-1'); first.requestConfirmation()
    await first.confirmDistribution()
    expect(first.getSnapshot()).toMatchObject({ confirmationState: 'unknown', confirmationRetryable: true })
    expect(storage.getItem(recordKey)).toBeTruthy()
    first.stop()

    // 硬刷新恢复：对账到已确认分发，但目标执行停在冻结 UNKNOWN+retryable → 记录必须保留（重试入口仍在）。
    const refreshedApi = makeApi({ found: distribution, frozenExecute: true })
    const refreshed = createRestoredRecycleNewMerchantController('request-1', refreshedApi as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0002', { storage, identity: 'buyer-1' })
    await refreshed.start()
    expect(refreshed.getSnapshot()).toMatchObject({ confirmationState: 'confirmed', targets: [{ recyclerId: 'shop-1', state: 'UNKNOWN', retryable: true }] })
    expect(storage.getItem(recordKey)).toBeTruthy()
    refreshed.stop()

    // 再次恢复后重试：目标落定 SUCCESS → 全部落定才清记录。
    const retryApi = makeApi({ found: distribution })
    const retried = createRestoredRecycleNewMerchantController('request-1', retryApi as never, { readGame: vi.fn().mockResolvedValue(detail) } as never, () => 'distribution-0003', { storage, identity: 'buyer-1' })
    await retried.start()
    await retried.retryTarget('shop-1')
    expect(retried.getSnapshot()).toMatchObject({ targets: [{ recyclerId: 'shop-1', state: 'SUCCESS' }] })
    expect(storage.getItem(recordKey)).toBeNull()
    retried.stop()
  })
})
