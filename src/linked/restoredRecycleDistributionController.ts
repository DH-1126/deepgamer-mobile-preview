import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRestoredRecycleApi, type RestoredRecycleApi } from './restoredRecycleApi'
import { getRestoredRecycleControllerForTransport, validateRecycleProfileAnswers, type RecycleSnapshot } from './restoredRecycleController'
import {
  createRestoredRecycleDistributionApi,
  type RecycleDistribution,
  type RecycleDistributionConfirmation,
  type RecycleDistributionTarget,
  type RecycleProfileRequestCreate,
  type RecycleProfileRequestSummary,
  type RestoredRecycleDistributionApi,
} from './restoredRecycleDistributionApi'
import { clearRecycleCommand, loadRecycleCommand, storeRecycleCommand, type RecycleCommandStorage } from './recycleCommandPersistence'
import type { RecycleProfileEditContext, RecycleProfileRevision } from './restoredRecycleRevisionApi'

type FormController = {
  getSnapshot(): RecycleSnapshot
  subscribe(listener: () => void): () => void
  startNew(): void
}
type RequestApi = Pick<RestoredRecycleDistributionApi, 'listRequests' | 'createRequest' | 'findRequestOperation'>
type RequestAttempt = { body: RecycleProfileRequestCreate; key: string; fingerprint: string }
export type RestoredRecycleRequestSnapshot = {
  form: RecycleSnapshot
  requests: RecycleProfileRequestSummary[]
  loadingRequests: boolean
  error: string | null
  accessLost: boolean
  saveState: 'idle' | 'saving' | 'unknown' | 'saved'
  saveRetryable: boolean
  savedRequest: RecycleProfileRequestSummary | null
}

const message = (error: unknown) => error instanceof Error && error.message ? error.message : '回收资料请求失败'
const accessFailure = (error: unknown) => error instanceof RestoredHttpError && [401, 403].includes(error.status)

export function createRestoredRecycleRequestController(
  form: FormController,
  api: RequestApi,
  makeId: () => string = () => `recycle-request-${globalThis.crypto.randomUUID()}`,
  options: { storage?: RecycleCommandStorage; identity?: string } = {},
) {
  const commandStorage = options.storage
  const commandIdentity = options.identity
  const requestSlot = 'request-save'
  let snapshot: RestoredRecycleRequestSnapshot = { form: form.getSnapshot(), requests: [], loadingRequests: false, error: null, accessLost: false, saveState: 'idle', saveRetryable: false, savedRequest: null }
  let active = false
  let generation = 0
  let pending: AbortController | undefined
  let attempt: RequestAttempt | null = null
  let releaseForm: (() => void) | undefined
  const listeners = new Set<() => void>()
  const publish = (next: RestoredRecycleRequestSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const patch = (value: Partial<RestoredRecycleRequestSnapshot>) => publish({ ...snapshot, ...value })
  const clearAccess = (error: unknown) => {
    generation += 1; pending?.abort(); pending = undefined; attempt = null; form.startNew()
    publish({ ...snapshot, form: form.getSnapshot(), requests: [], loadingRequests: false, error: message(error), accessLost: true, saveState: 'idle', saveRetryable: false, savedRequest: null })
  }

  async function refreshRequests() {
    if (!active) return
    const token = ++generation; pending?.abort(); const request = new AbortController(); pending = request
    patch({ loadingRequests: true, error: null })
    try {
      const requests = await api.listRequests(request.signal)
      if (active && token === generation) patch({ requests, loadingRequests: false, accessLost: false })
    } catch (error) {
      if (!active || token !== generation) return
      if (accessFailure(error)) clearAccess(error)
      else patch({ loadingRequests: false, error: message(error) })
    } finally { if (pending === request) pending = undefined }
  }

  function applySaved(result: Awaited<ReturnType<RequestApi['createRequest']>>) {
    if (!attempt || result.clientRequestId !== attempt.body.clientRequestId) throw new RestoredHttpError(0, 'CLIENT_RECYCLE_REQUEST_RESULT_MISMATCH', '保存结果与原操作不一致', 'UNKNOWN')
    form.startNew()
    patch({ form: form.getSnapshot(), requests: [result.request, ...snapshot.requests.filter(item => item.requestId !== result.request.requestId)], saveState: 'saved', saveRetryable: false, savedRequest: result.request, error: null, accessLost: false })
    attempt = null
  }

  async function runSave(currentAttempt: RequestAttempt) {
    const token = generation; pending?.abort(); const request = new AbortController(); pending = request
    storeRecycleCommand(commandStorage, commandIdentity, requestSlot, {
      kind: 'save', identity: commandIdentity ?? '', requestId: currentAttempt.body.clientRequestId,
      idempotencyKey: currentAttempt.key, clientSaveId: currentAttempt.body.clientRequestId, savedAt: '',
    })
    patch({ saveState: 'saving', saveRetryable: false, error: null })
    try {
      const result = await api.createRequest(currentAttempt.body, currentAttempt.key, request.signal)
      if (active && token === generation) { applySaved(result); clearRecycleCommand(commandStorage, commandIdentity, requestSlot) }
    } catch (error) {
      if (!active || token !== generation) return
      if (accessFailure(error)) { clearAccess(error); return }
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        try {
          const result = await api.findRequestOperation(currentAttempt.body.clientRequestId, request.signal)
          if (active && token === generation) { applySaved(result); clearRecycleCommand(commandStorage, commandIdentity, requestSlot) }
        } catch (lookupError) {
          if (!active || token !== generation) return
          if (accessFailure(lookupError)) { clearAccess(lookupError); return }
          // 恢复型尝试（硬刷新恢复）没有原始资料内容，404 只保留查询通道，不提供重发入口。
          const restored = Boolean(attempt?.fingerprint.startsWith('restored:'))
          const notRun = lookupError instanceof RestoredHttpError && lookupError.status === 404
          patch({ saveState: 'unknown', saveRetryable: notRun && !restored, error: notRun ? (restored ? '原保存操作确认未执行。该操作来自恢复前会话，为防误发空资料不提供重发，请重新填写后保存。' : '原保存操作确认未执行，可使用原操作重试。') : `原保存结果查询失败：${message(lookupError)}` })
        }
      } else patch({ saveState: 'idle', error: message(error) })
    } finally { if (pending === request) pending = undefined }
  }

  async function saveRequest() {
    if (!active || snapshot.saveState === 'saving' || snapshot.saveState === 'unknown') return
    const formSnapshot = form.getSnapshot(); const detail = formSnapshot.detail
    if (!detail) { patch({ error: '请先选择回收游戏' }); return }
    const problem = validateRecycleProfileAnswers(detail, formSnapshot.values)
    if (problem) { patch({ error: problem }); return }
    if (formSnapshot.attachments.some(item => item.state !== 'uploaded' || !item.media)) { patch({ error: '请先完成、重试或删除未完成的图片上传' }); return }
    const fingerprint = JSON.stringify({ gameCode: detail.gameCode, fieldTemplateVersion: detail.fieldTemplateVersion, fieldSchemaHash: detail.fieldSchemaHash, values: formSnapshot.values, attachmentMediaIds: formSnapshot.attachments.map(item => item.media!.mediaId) })
    if (!attempt || attempt.fingerprint !== fingerprint) {
      const clientRequestId = makeId()
      attempt = { fingerprint, key: `client-recycle-request-${clientRequestId}`.slice(0, 100), body: { clientRequestId, gameCode: detail.gameCode, fieldTemplateVersion: detail.fieldTemplateVersion, fieldSchemaHash: detail.fieldSchemaHash, values: { ...formSnapshot.values }, attachmentMediaIds: formSnapshot.attachments.map(item => item.media!.mediaId) } }
    }
    await runSave(attempt)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
    async start() {
      if (active) return; active = true; releaseForm = form.subscribe(() => patch({ form: form.getSnapshot() })); await refreshRequests()
      // W02：恢复上次未决的申请命令（硬刷新/关闭重开后），凭 clientRequestId 向服务端核实结果。
      const pending = loadRecycleCommand(commandStorage, commandIdentity, requestSlot)
      if (pending) {
        attempt = { fingerprint: `restored:${pending.savedAt}`, key: pending.idempotencyKey, body: { clientRequestId: pending.clientSaveId } } as unknown as RequestAttempt
        patch({ saveState: 'unknown', saveRetryable: false, error: '检测到未确认的申请操作，正在向服务器核实结果…' })
        try {
          if (!pending.clientSaveId) throw new Error('no clientRequestId')
          const result = await api.findRequestOperation(pending.clientSaveId, new AbortController().signal)
          if (active) {
            applySaved(result)
            clearRecycleCommand(commandStorage, commandIdentity, requestSlot)
          }
        } catch { /* 核实失败保持 unknown 态 */ }
      }
    },
    refreshRequests,
    saveRequest,
    async checkUnknownSave() {
      if (!active || snapshot.saveState !== 'unknown' || !attempt || pending) return
      const token = generation; const request = new AbortController(); pending = request; patch({ error: null })
      try { const result = await api.findRequestOperation(attempt.body.clientRequestId, request.signal); if (active && token === generation) applySaved(result) }
      catch (error) {
        if (!active || token !== generation) return
        if (accessFailure(error)) { clearAccess(error); return }
        const restored = Boolean(attempt?.fingerprint.startsWith('restored:'))
        const notRun = error instanceof RestoredHttpError && error.status === 404
        patch({ saveRetryable: notRun && !restored, error: notRun ? (restored ? '原保存操作确认未执行。该操作来自恢复前会话，为防误发空资料不提供重发，请重新填写后保存。' : '原保存操作确认未执行，可使用原操作重试。') : `原保存结果查询失败：${message(error)}` })
      }
      finally { if (pending === request) pending = undefined }
    },
    async retrySave() { if (active && snapshot.saveState === 'unknown' && snapshot.saveRetryable && attempt) await runSave(attempt) },
    newRequest() { attempt = null; form.startNew(); patch({ form: form.getSnapshot(), saveState: 'idle', saveRetryable: false, savedRequest: null, error: null }) },
    stop() {
      if (snapshot.saveState === 'saving' && attempt) patch({ saveState: 'unknown', saveRetryable: false, error: '保存页面已离开，结果尚未确认；返回后请先查询原操作。' })
      active = false; generation += 1; pending?.abort(); pending = undefined; releaseForm?.(); releaseForm = undefined; listeners.clear()
    },
  }
}

export type NewMerchant = { recyclerId: string; displayName: string; eligible: boolean; blockedReason: string | null }
export type NewMerchantConfirmation = { revisionId: string; profileVersion: number; selectedRecyclerIds: string[]; selectedRecyclerNames: string[] }
export type NewMerchantTargetState = RecycleDistributionTarget & { state: 'PENDING' | 'SENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN'; retryable: boolean; localError: string | null; key: string }
export type RestoredRecycleNewMerchantSnapshot = {
  loading: boolean
  error: string | null
  accessLost: boolean
  context: RecycleProfileEditContext | null
  revisions: RecycleProfileRevision[]
  selectedRevisionId: string
  availableRecyclers: NewMerchant[]
  selectedRecyclerIds: string[]
  confirmation: NewMerchantConfirmation | null
  confirmationState: 'idle' | 'confirming' | 'unknown' | 'confirmed'
  confirmationRetryable: boolean
  targets: NewMerchantTargetState[]
  busy: boolean
}
type DistributionAttempt = { revisionId: string; body: RecycleDistributionConfirmation; key: string }
const initialDistribution = (): RestoredRecycleNewMerchantSnapshot => ({ loading: true, error: null, accessLost: false, context: null, revisions: [], selectedRevisionId: '', availableRecyclers: [], selectedRecyclerIds: [], confirmation: null, confirmationState: 'idle', confirmationRetryable: false, targets: [], busy: false })

export function createRestoredRecycleNewMerchantController(
  requestId: string,
  api: Pick<RestoredRecycleDistributionApi, 'readRequestContext' | 'listRequestRevisions' | 'confirmDistribution' | 'findDistribution' | 'executeTarget' | 'findTarget'>,
  catalogApi: Pick<RestoredRecycleApi, 'readGame'>,
  makeId: () => string = () => `recycle-distribution-${globalThis.crypto.randomUUID()}`,
  options: { storage?: RecycleCommandStorage; identity?: string } = {},
) {
  // W02：命令标识按「主体 + 请求」双维隔离存储，切主体或跨请求都不串。
  const commandSlot = `distribution:confirm:${requestId}`
  const commandIdentity = options.identity
  let snapshot = initialDistribution()
  let active = false
  let generation = 0
  let pending: AbortController | undefined
  let attempt: DistributionAttempt | null = null
  let unknownConfirmationLookup = false
  let unknownTargetLookup: string | null = null
  let targetKeySequence = 0
  let targetRetrySequence = 0
  const targetKeys = new Map<string, string>()
  const listeners = new Set<() => void>()
  const publish = (next: RestoredRecycleNewMerchantSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const patch = (value: Partial<RestoredRecycleNewMerchantSnapshot>) => publish({ ...snapshot, ...value })
  const current = (token: number) => active && token === generation
  const clearAccess = (error: unknown) => { generation += 1; pending?.abort(); pending = undefined; attempt = null; publish({ ...initialDistribution(), loading: false, accessLost: true, error: message(error) }) }

  async function refresh() {
    if (!active || snapshot.busy || snapshot.confirmationState === 'unknown') return
    const token = ++generation; pending?.abort(); const request = new AbortController(); pending = request
    patch({ loading: true, error: null })
    try {
      const [context, revisions] = await Promise.all([api.readRequestContext(requestId, request.signal), api.listRequestRevisions(requestId, request.signal)])
      const detail = await catalogApi.readGame(context.gameCode, request.signal)
      if (!current(token)) return
      const existing = new Set(context.consultations.map(item => item.recyclerId))
      const availableRecyclers = detail.recyclers.filter(item => !existing.has(item.recyclerId))
      const selectedRevisionId = revisions.some(item => item.revisionId === snapshot.selectedRevisionId) ? snapshot.selectedRevisionId : ''
      patch({ context, revisions, availableRecyclers, selectedRevisionId, selectedRecyclerIds: [], confirmation: null, loading: false, error: null, accessLost: false })
    } catch (error) {
      if (!current(token)) return
      if (accessFailure(error)) clearAccess(error)
      else patch({ loading: false, error: message(error) })
    } finally { if (pending === request) pending = undefined }
  }

  function updateTarget(recyclerId: string, value: Partial<NewMerchantTargetState>) { patch({ targets: snapshot.targets.map(target => target.recyclerId === recyclerId ? { ...target, ...value } : target) }) }
  const targetKey = (distributionId: string, recyclerId: string) => {
    const businessTarget = JSON.stringify([distributionId, recyclerId])
    let key = targetKeys.get(businessTarget)
    if (!key) { key = `client-recycle-target-${++targetKeySequence}-${makeId()}`.slice(0, 100); targetKeys.set(businessTarget, key) }
    return key
  }
  function toState(target: RecycleDistributionTarget, distributionId: string): NewMerchantTargetState {
    return { ...target, state: target.status, retryable: target.status === 'FAILED', localError: target.errorMessage, key: targetKey(distributionId, target.recyclerId) }
  }
  async function lookupTarget(target: NewMerchantTargetState, token: number, request: AbortController) {
    if (!attempt) return
    try {
      const result = await api.findTarget(attempt.revisionId, attempt.body.clientDistributionId, target.recyclerId, request.signal)
      if (current(token)) {
        const recovered = toState(result, attempt.body.clientDistributionId)
        updateTarget(target.recyclerId, result.status === 'PENDING' ? { ...recovered, state: 'UNKNOWN', retryable: true, localError: '原目标仍在已冻结名单中待处理，可使用新传输键重试同一业务目标。' } : recovered)
      }
    } catch (error) {
      if (!current(token)) return
      if (accessFailure(error)) { clearAccess(error); return }
      const missing = error instanceof RestoredHttpError && error.status === 404
      updateTarget(target.recyclerId, { state: 'UNKNOWN', retryable: false, localError: missing ? '已冻结名单中找不到原目标，不能新建命令，请刷新后联系客服。' : `原目标结果查询失败：${message(error)}` })
    }
  }
  async function executeTarget(recyclerId: string, token: number, request: AbortController) {
    const target = snapshot.targets.find(item => item.recyclerId === recyclerId)
    if (!attempt || !target || !current(token) || target.state === 'SUCCESS') return
    updateTarget(recyclerId, { state: 'SENDING', retryable: false, localError: null })
    try {
      const result = await api.executeTarget(attempt.revisionId, attempt.body.clientDistributionId, recyclerId, target.key, request.signal)
      if (current(token)) updateTarget(recyclerId, toState(result, attempt.body.clientDistributionId))
    } catch (error) {
      if (!current(token)) return
      if (accessFailure(error)) { clearAccess(error); return }
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') await lookupTarget(target, token, request)
      else updateTarget(recyclerId, { state: 'FAILED', retryable: true, localError: message(error), errorCode: error instanceof RestoredHttpError ? error.code : 'CLIENT_FAILED', errorMessage: message(error) })
    }
  }
  async function applyDistribution(distribution: RecycleDistribution, token: number, request: AbortController) {
    if (!attempt || distribution.requestId !== requestId || distribution.revisionId !== attempt.revisionId || distribution.clientDistributionId !== attempt.body.clientDistributionId) throw new RestoredHttpError(0, 'CLIENT_RECYCLE_DISTRIBUTION_RESULT_MISMATCH', '分发结果与已确认批次不一致', 'UNKNOWN')
    patch({ confirmation: null, confirmationState: 'confirmed', confirmationRetryable: false, targets: distribution.targets.map(target => toState(target, distribution.clientDistributionId)), busy: true, error: null })
    for (const target of distribution.targets) if (target.status === 'PENDING' && current(token)) await executeTarget(target.recyclerId, token, request)
    if (current(token)) {
      patch({ busy: false })
      // 独立复核延期项：有目标停在 UNKNOWN（冻结待新键重试）时保留记录，
      // 硬刷新后仍可凭 clientDistributionId 重建目标行；全部落定才清。
      if (snapshot.targets.every(target => target.state === 'SUCCESS' || target.state === 'FAILED'))
        clearRecycleCommand(options.storage, commandIdentity, commandSlot)
    }
  }
  // 任一目标经重试落定后调用：全部落定即清记录。
  function clearDistributionRecordIfSettled() {
    if (snapshot.targets.length > 0 && snapshot.targets.every(target => target.state === 'SUCCESS' || target.state === 'FAILED'))
      clearRecycleCommand(options.storage, commandIdentity, commandSlot)
  }
  async function runConfirmation(currentAttempt: DistributionAttempt) {
    const token = generation; pending?.abort(); const request = new AbortController(); pending = request
    patch({ busy: true, confirmationState: 'confirming', confirmationRetryable: false, error: null })
    try {
      const result = await api.confirmDistribution(currentAttempt.revisionId, currentAttempt.body, currentAttempt.key, request.signal)
      if (current(token)) await applyDistribution(result, token, request)
    } catch (error) {
      if (!current(token)) return
      if (accessFailure(error)) { clearAccess(error); return }
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        try {
          const result = await api.findDistribution(currentAttempt.revisionId, currentAttempt.body.clientDistributionId, request.signal)
          if (current(token)) await applyDistribution(result, token, request)
        } catch (lookupError) {
          if (!current(token)) return
          if (accessFailure(lookupError)) { clearAccess(lookupError); return }
          const notRun = lookupError instanceof RestoredHttpError && lookupError.status === 404
          patch({ busy: false, confirmationState: 'unknown', confirmationRetryable: notRun, error: notRun ? '原分发确认未执行，可使用原操作重试。' : `原分发结果查询失败：${message(lookupError)}` })
        }
      } else patch({ busy: false, confirmationState: 'idle', error: message(error) })
    } finally { if (pending === request) pending = undefined }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
    async start() {
      if (active) return; active = true; await refresh()
      // W02：恢复上次未决的分发确认（硬刷新/关闭重开后），凭 clientDistributionId 对账。
      const pending = loadRecycleCommand(options.storage, commandIdentity, commandSlot)
      if (pending) {
        attempt = { revisionId: pending.revisionId, body: { clientDistributionId: pending.clientConfirmationId } } as unknown as DistributionAttempt
        patch({ confirmationState: 'unknown', confirmationRetryable: false, error: '检测到未确认的分发确认，正在向服务器核实结果…' })
        try {
          if (!pending.revisionId || !pending.clientConfirmationId) throw new Error('记录缺少标识')
          const result = await api.findDistribution(pending.revisionId, pending.clientConfirmationId, new AbortController().signal)
          // 恢复出的分发可能仍含 PENDING 目标，需真实信号量执行逐商投递，不能传 undefined。
          if (active) await applyDistribution(result, generation, new AbortController())
        } catch { /* 对账失败保持 unknown 态，可重试 */ }
      }
    },
    refresh,
    selectRevision(revisionId: string) { if (!snapshot.busy && snapshot.targets.length === 0 && snapshot.revisions.some(item => item.revisionId === revisionId)) patch({ selectedRevisionId: revisionId, selectedRecyclerIds: [], confirmation: null, error: null }) },
    toggleRecycler(recyclerId: string) { if (!snapshot.busy && snapshot.targets.length === 0 && snapshot.availableRecyclers.some(item => item.recyclerId === recyclerId && item.eligible)) patch({ selectedRecyclerIds: snapshot.selectedRecyclerIds.includes(recyclerId) ? snapshot.selectedRecyclerIds.filter(id => id !== recyclerId) : [...snapshot.selectedRecyclerIds, recyclerId], confirmation: null, error: null }) },
    requestConfirmation() {
      const revision = snapshot.revisions.find(item => item.revisionId === snapshot.selectedRevisionId)
      if (!revision || snapshot.selectedRecyclerIds.length === 0 || snapshot.busy || snapshot.targets.length > 0) return false
      const merchants = snapshot.selectedRecyclerIds.map(id => snapshot.availableRecyclers.find(item => item.recyclerId === id && item.eligible)).filter(Boolean) as NewMerchant[]
      if (merchants.length !== snapshot.selectedRecyclerIds.length) { patch({ error: '新商家名单已变化，请重新选择' }); return false }
      patch({ confirmation: { revisionId: revision.revisionId, profileVersion: revision.profileVersion, selectedRecyclerIds: [...snapshot.selectedRecyclerIds], selectedRecyclerNames: merchants.map(item => item.displayName) }, error: null })
      return true
    },
    cancelConfirmation() { if (!snapshot.busy && snapshot.confirmationState !== 'unknown') patch({ confirmation: null }) },
    async confirmDistribution() {
      if (!snapshot.confirmation || snapshot.busy || snapshot.confirmationState === 'unknown') return
      const clientDistributionId = makeId()
      const confirmRevision = snapshot.confirmation.revisionId
      // W02：确认前持久化最小标识（硬刷新/关闭重开后凭 clientDistributionId 对账）。
      storeRecycleCommand(options.storage, commandIdentity, commandSlot, {
        kind: 'merchant-apply', identity: commandIdentity ?? '', requestId,
        idempotencyKey: `client-recycle-distribution-${clientDistributionId}`.slice(0, 100),
        revisionId: confirmRevision, clientConfirmationId: clientDistributionId, savedAt: '',
      })
      attempt = { revisionId: snapshot.confirmation.revisionId, body: { clientDistributionId, selectedRecyclerIds: [...snapshot.confirmation.selectedRecyclerIds] }, key: `client-recycle-distribution-${clientDistributionId}`.slice(0, 100) }
      await runConfirmation(attempt)
    },
    async checkUnknownConfirmation() {
      if (!attempt || snapshot.confirmationState !== 'unknown' || snapshot.busy) return
      const token = generation; const request = new AbortController(); pending = request; unknownConfirmationLookup = true; patch({ busy: true, error: null })
      try { const result = await api.findDistribution(attempt.revisionId, attempt.body.clientDistributionId, request.signal); if (current(token)) await applyDistribution(result, token, request) }
      catch (error) { if (!current(token)) return; if (accessFailure(error)) clearAccess(error); else { const notRun = error instanceof RestoredHttpError && error.status === 404; patch({ busy: false, confirmationRetryable: notRun, error: notRun ? '原分发确认未执行，可使用原操作重试。' : `原分发结果查询失败：${message(error)}` }) } }
      finally { unknownConfirmationLookup = false; if (pending === request) pending = undefined }
    },
    async retryConfirmation() { if (attempt && snapshot.confirmationState === 'unknown' && snapshot.confirmationRetryable && !snapshot.busy) await runConfirmation(attempt) },
    async checkUnknownTarget(recyclerId: string) {
      const target = snapshot.targets.find(item => item.recyclerId === recyclerId)
      if (!target || target.state !== 'UNKNOWN' || snapshot.busy) return
      const token = generation; const request = new AbortController(); pending = request; unknownTargetLookup = recyclerId; patch({ busy: true })
      try { await lookupTarget(target, token, request); if (current(token)) patch({ busy: false }) }
      finally { if (unknownTargetLookup === recyclerId) unknownTargetLookup = null; if (pending === request) pending = undefined }
    },
    async retryTarget(recyclerId: string) { const target = snapshot.targets.find(item => item.recyclerId === recyclerId); if (!target || snapshot.busy || !(target.state === 'FAILED' || (target.state === 'UNKNOWN' && target.retryable))) return; updateTarget(recyclerId, { key: `client-recycle-target-retry-${++targetRetrySequence}-${makeId()}`.slice(0, 100) }); const token = generation; const request = new AbortController(); pending = request; patch({ busy: true }); await executeTarget(recyclerId, token, request); if (current(token)) { patch({ busy: false }); clearDistributionRecordIfSettled() } if (pending === request) pending = undefined },
    async finish() {
      if (!(snapshot.targets.length > 0 && snapshot.targets.every(item => item.state === 'SUCCESS' || item.state === 'FAILED'))) return false
      attempt = null; targetKeys.clear(); patch({ selectedRecyclerIds: [], confirmation: null, confirmationState: 'idle', confirmationRetryable: false, targets: [], busy: false, error: null })
      await refresh(); return true
    },
    stop() {
      const confirmationInFlight = Boolean(snapshot.confirmationState === 'confirming' && attempt)
      const targetInFlight = snapshot.targets.some(target => target.state === 'PENDING' || target.state === 'SENDING')
      const confirmationNeedsRecovery = confirmationInFlight || unknownConfirmationLookup
      const targetNeedsRecovery = targetInFlight || unknownTargetLookup !== null
      if (confirmationNeedsRecovery || targetNeedsRecovery) publish({
        ...snapshot,
        busy: false,
        confirmationState: confirmationNeedsRecovery ? 'unknown' : snapshot.confirmationState,
        confirmationRetryable: false,
        targets: snapshot.targets.map(target => target.state === 'PENDING' || target.state === 'SENDING' || target.recyclerId === unknownTargetLookup ? { ...target, state: 'UNKNOWN', retryable: false, localError: '分发页面已离开，结果尚未确认；返回后请先查询原目标。' } : target),
        error: confirmationNeedsRecovery ? '分发确认页面已离开，结果尚未确认；返回后请先查询原分发。' : snapshot.error,
      })
      unknownConfirmationLookup = false; unknownTargetLookup = null
      active = false; generation += 1; pending?.abort(); pending = undefined; listeners.clear()
    },
  }
}

const requestControllers = new WeakMap<ReturnType<typeof createRestoredLinkedTransport>, ReturnType<typeof createRestoredRecycleRequestController>>()
export function getRestoredRecycleRequestControllerForTransport(
  transport: ReturnType<typeof createRestoredLinkedTransport>,
  options: { storage?: RecycleCommandStorage; identity?: string } = {},
) {
  let controller = requestControllers.get(transport)
  if (!controller) {
    controller = createRestoredRecycleRequestController(getRestoredRecycleControllerForTransport(transport), createRestoredRecycleDistributionApi(transport), undefined, { storage: options.storage ?? window.localStorage, identity: options.identity })
    requestControllers.set(transport, controller)
  }
  return controller
}

const distributionControllers = new WeakMap<ReturnType<typeof createRestoredLinkedTransport>, Map<string, ReturnType<typeof createRestoredRecycleNewMerchantController>>>()
export function getRestoredRecycleNewMerchantControllerForTransport(
  transport: ReturnType<typeof createRestoredLinkedTransport>,
  requestId: string,
  options: { storage?: RecycleCommandStorage; identity?: string } = {},
) {
  let requests = distributionControllers.get(transport)
  if (!requests) { requests = new Map(); distributionControllers.set(transport, requests) }
  let controller = requests.get(requestId)
  if (!controller) {
    controller = createRestoredRecycleNewMerchantController(requestId, createRestoredRecycleDistributionApi(transport), createRestoredRecycleApi(transport), undefined, { storage: options.storage ?? window.localStorage, identity: options.identity })
    requests.set(requestId, controller)
  }
  return controller
}
