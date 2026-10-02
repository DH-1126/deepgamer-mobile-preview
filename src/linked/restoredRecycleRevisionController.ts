import { RestoredHttpError } from './restoredLinkedTransport'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRecycleMediaKeyRegistry, RECYCLE_MEDIA_MAX_COUNT, validateRestoredRecycleMediaFile, type RestoredRecycleMedia } from './restoredRecycleMedia'
import { clearRecycleCommand, loadRecycleCommand, storeRecycleCommand, type RecycleCommandStorage } from './recycleCommandPersistence'
import { createRestoredRecycleRevisionApi, type RecycleProfileEditContext, type RecycleProfileRevision, type RecycleProfileRevisionListItem, type RecycleRevisionSave, type RecycleRevisionTarget, type RecycleRevisionTargetResult, type RecycleRevisionValue, type RestoredRecycleRevisionApi } from './restoredRecycleRevisionApi'
import { createRestoredRecycleDistributionApi } from './restoredRecycleDistributionApi'

export type RecycleRevisionDraftAttachment = {
  localId: string
  file: File | null
  fileName: string
  key: string
  state: 'uploading' | 'uploaded' | 'failed' | 'unknown'
  error: string | null
  media: RestoredRecycleMedia
}
export type RecycleRevisionDeliveryConfirmation = { revisionId: string; revisionNumber: number; selectedConsultationIds: string[]; selectedConsultationNames: string[] }
export type RecycleRevisionTargetState = {
  consultationId: string
  recyclerName: string
  conversationId: string
  state: 'pending' | 'sending' | 'success' | 'failed' | 'unknown'
  retryable: boolean
  error: string | null
  key: string
  body: RecycleRevisionTarget
  result: RecycleRevisionTargetResult | null
}
export type RestoredRecycleRevisionSnapshot = {
  loading: boolean
  stale: boolean
  error: string | null
  accessLost: boolean
  revisions: RecycleProfileRevisionListItem[]
  canEdit: boolean
  selectedRevision: RecycleProfileRevision | null
  editing: boolean
  editContext: RecycleProfileEditContext | null
  values: Record<string, RecycleRevisionValue>
  attachments: RecycleRevisionDraftAttachment[]
  selectedConsultationIds: string[]
  savedRevision: RecycleProfileRevision | null
  saveState: 'idle' | 'saving' | 'unknown' | 'saved'
  saveRetryable: boolean
  confirmation: RecycleRevisionDeliveryConfirmation | null
  targets: RecycleRevisionTargetState[]
  busy: boolean
}

type Schedule = (run: () => void, delay: number) => () => void
type SaveAttempt = { requestId: string; body: RecycleRevisionSave; key: string; fingerprint: string }
type RevisionReadAccess = {
  list(signal?: AbortSignal): Promise<{ canEdit: boolean; revisions: RecycleProfileRevisionListItem[] }>
  read(revisionId: string, signal?: AbortSignal): Promise<RecycleProfileRevision>
  context(signal?: AbortSignal): Promise<RecycleProfileEditContext>
}
const initial = (): RestoredRecycleRevisionSnapshot => ({ loading: true, stale: false, error: null, accessLost: false, revisions: [], canEdit: false, selectedRevision: null, editing: false, editContext: null, values: {}, attachments: [], selectedConsultationIds: [], savedRevision: null, saveState: 'idle', saveRetryable: false, confirmation: null, targets: [], busy: false })
const message = (error: unknown) => error instanceof Error && error.message ? error.message : '回收资料版本请求失败'
const defaultSchedule: Schedule = (run, delay) => { const timer = setTimeout(run, delay); return () => clearTimeout(timer) }
const supportedField = (valueType: string) => ['text', 'number', 'single', 'multiple'].includes(valueType)
const hasValue = (value: RecycleRevisionValue | undefined) => value !== undefined && (typeof value !== 'string' || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0)
const settledTarget = (target: RecycleRevisionTargetState) => target.state === 'success' || target.state === 'failed'
const legacyOnly = (error: unknown) => error instanceof RestoredHttpError && error.status === 409 && error.code === 'RECYCLE_PROFILE_LEGACY_ONLY'
const legacyOnlyText = '原请求缺少可编辑的历史模板，当前仅可查看旧版 v1 资料，不能从当前配置伪造修订。'
const destructiveConflictCodes = new Set(['RECYCLE_PROFILE_REVOKED', 'RECYCLE_CONSULTATION_RELATION_INVALID'])
const accessFailure = (error: unknown) => error instanceof RestoredHttpError
  && ([401, 403, 404].includes(error.status) || (error.status === 409 && destructiveConflictCodes.has(error.code)))

export function createRestoredRecycleRevisionController(
  consultationId: string,
  api: RestoredRecycleRevisionApi,
  makeId: () => string = () => `recycle-revision-${globalThis.crypto.randomUUID()}`,
  options: { schedule?: Schedule; access?: RevisionReadAccess; storage?: RecycleCommandStorage; identity?: string } = {},
) {
  // W02：未决保存命令的最小标识持久化（仅 requestId/clientSaveId/幂等键，不含资料内容）。
  const commandStorage = options.storage
  const commandIdentity = options.identity
  const saveSlot = () => `save:${consultationId}`
  const deliverySlot = () => `delivery:${consultationId}`
  type PendingDeliveryEntry = NonNullable<import('./recycleCommandPersistence').RecycleCommandRecord['entries']>[number]
  let snapshot = initial()
  let active = false
  let visible = true
  let generation = 0
  let mediaGeneration = 0
  let mediaSequence = 0
  let selectedRevisionId: string | undefined
  let readRequest: AbortController | undefined
  let operationRequest: AbortController | undefined
  let cancelTimer: (() => void) | undefined
  let saveAttempt: SaveAttempt | null = null
  let saveFingerprint = ''
  const listeners = new Set<() => void>()
  const mediaRequests = new Map<string, AbortController>()
  const mediaKeys = createRecycleMediaKeyRegistry('client-recycle-revision-media')
  const scheduleTask = options.schedule ?? defaultSchedule
  const readAccess: RevisionReadAccess = options.access ?? {
    list: signal => api.listRevisions(consultationId, signal),
    read: (revisionId, signal) => api.readRevision(consultationId, revisionId, signal),
    context: signal => api.readEditContext(consultationId, signal),
  }
  const publish = (next: RestoredRecycleRevisionSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const patch = (value: Partial<RestoredRecycleRevisionSnapshot>) => publish({ ...snapshot, ...value })
  const clearTimer = () => { cancelTimer?.(); cancelTimer = undefined }
  const schedule = () => { clearTimer(); if (active && visible && !snapshot.busy) cancelTimer = scheduleTask(() => { void refresh() }, 5_000) }
  const current = (token: number) => active && token === generation
  const abortMedia = () => { mediaGeneration += 1; mediaRequests.forEach(request => request.abort()); mediaRequests.clear() }
  const clearForAccessLoss = (error: unknown) => {
    generation += 1; readRequest?.abort(); operationRequest?.abort(); readRequest = undefined; operationRequest = undefined; abortMedia(); clearTimer(); saveAttempt = null; saveFingerprint = ''
    publish({ ...initial(), loading: false, error: message(error), accessLost: true })
  }
  const failOperation = (error: unknown) => {
    if (accessFailure(error)) { clearForAccessLoss(error); return true }
    return false
  }

  async function refresh(requestedRevisionId = selectedRevisionId) {
    if (!active || !visible || snapshot.busy) return
    const token = ++generation
    clearTimer(); readRequest?.abort(); const request = new AbortController(); readRequest = request
    if (snapshot.revisions.length === 0) patch({ loading: true, error: null, stale: false })
    try {
      const list = await readAccess.list(request.signal)
      if (!current(token)) return
      const refreshedContext = snapshot.editing && snapshot.editContext ? await readAccess.context(request.signal) : null
      if (!current(token)) return
      const revisionId = requestedRevisionId ?? selectedRevisionId
      let selected = snapshot.selectedRevision
      if (!snapshot.editing && revisionId) selected = await readAccess.read(revisionId, request.signal)
      if (!current(token)) return
      selectedRevisionId = revisionId
      patch({ revisions: list.revisions, canEdit: list.canEdit, selectedRevision: selected, editContext: refreshedContext && snapshot.editContext ? { ...snapshot.editContext, consultations: refreshedContext.consultations } : snapshot.editContext, loading: false, stale: false, error: null, accessLost: false })
      schedule()
    } catch (error) {
      if (!current(token)) return
      if (legacyOnly(error)) {
        publish({ ...initial(), loading: false, error: legacyOnlyText, accessLost: false })
        schedule()
        return
      }
      if (accessFailure(error)) { clearForAccessLoss(error); return }
      patch({ loading: false, stale: snapshot.revisions.length > 0 || snapshot.editing, error: snapshot.revisions.length > 0 || snapshot.editing ? `刷新失败，当前显示可能已过期：${message(error)}` : message(error) })
      schedule()
    } finally { if (readRequest === request) readRequest = undefined }
  }

  async function selectRevision(revisionId: string) {
    if (!active || snapshot.editing || snapshot.busy || !revisionId) return
    selectedRevisionId = revisionId
    await refresh(revisionId)
  }

  async function beginEdit() {
    if (!active || !snapshot.canEdit || snapshot.busy) return
    const token = ++generation
    clearTimer(); readRequest?.abort(); const request = new AbortController(); readRequest = request
    patch({ busy: true, error: null })
    try {
      const context = await readAccess.context(request.signal)
      if (!current(token)) return
      if (context.fields.length === 0 || context.fields.some(field => !supportedField(field.valueType))) {
        patch({ busy: false, editing: false, error: '原请求缺少可编辑的历史模板，当前仅可查看已保存版本。' })
        schedule(); return
      }
      saveAttempt = null; saveFingerprint = ''
      patch({ busy: false, editing: true, editContext: context, values: { ...context.values }, attachments: context.attachments.map((media, index) => ({ localId: `existing-${media.mediaId}-${index}`, file: null, fileName: `已保存图片 ${index + 1}`, key: '', state: 'uploaded', error: null, media })), selectedConsultationIds: [], savedRevision: null, saveState: 'idle', saveRetryable: false, confirmation: null, targets: [], stale: false, error: null })
      schedule()
    } catch (error) {
      if (!current(token)) return
      if (legacyOnly(error)) { patch({ busy: false, editing: false, editContext: null, values: {}, attachments: [], error: legacyOnlyText }); schedule(); return }
      if (failOperation(error)) return
      patch({ busy: false, error: message(error), stale: snapshot.revisions.length > 0 })
      schedule()
    } finally { if (readRequest === request) readRequest = undefined }
  }

  function invalidateSavedState() {
    saveAttempt = null; saveFingerprint = ''
    patch({ savedRevision: null, saveState: 'idle', saveRetryable: false, selectedConsultationIds: [], confirmation: null, targets: [], error: null })
  }
  function setValue(fieldKey: string, value: RecycleRevisionValue | undefined) {
    if (!snapshot.editing || snapshot.busy || snapshot.targets.length > 0 || !snapshot.editContext?.fields.some(field => field.fieldKey === fieldKey)) return
    const values = { ...snapshot.values }
    if (!hasValue(value)) delete values[fieldKey]
    else values[fieldKey] = value!
    patch({ values }); invalidateSavedState()
  }

  function updateAttachment(localId: string, value: Partial<RecycleRevisionDraftAttachment>, token: number) {
    if (token !== mediaGeneration || !active) return
    patch({ attachments: snapshot.attachments.map(item => item.localId === localId ? { ...item, ...value } : item) })
  }
  async function uploadAttachment(item: RecycleRevisionDraftAttachment, token: number) {
    if (!item.file) return
    const request = new AbortController(); mediaRequests.set(item.localId, request)
    updateAttachment(item.localId, { state: 'uploading', error: null }, token)
    try {
      const media = await api.uploadMedia(item.file, item.key, request.signal)
      updateAttachment(item.localId, { state: 'uploaded', error: null, media }, token)
    } catch (error) {
      if (token !== mediaGeneration || !active) return
      const unknown = error instanceof RestoredHttpError && error.outcome === 'UNKNOWN'
      updateAttachment(item.localId, { state: unknown ? 'unknown' : 'failed', error: unknown ? '上传结果未知，可使用原操作重试' : `上传失败：${message(error)}` }, token)
    } finally { if (mediaRequests.get(item.localId) === request) mediaRequests.delete(item.localId) }
  }
  async function addAttachments(files: File[]) {
    if (!snapshot.editing || snapshot.busy || snapshot.targets.length > 0 || files.length === 0) return
    if (snapshot.attachments.length + files.length > RECYCLE_MEDIA_MAX_COUNT) { patch({ error: `每份回收资料最多上传 ${RECYCLE_MEDIA_MAX_COUNT} 张图片` }); return }
    for (const file of files) { const problem = validateRestoredRecycleMediaFile(file); if (problem) { patch({ error: problem }); return } }
    invalidateSavedState()
    const token = mediaGeneration
    const additions = files.map(file => ({ localId: `revision-media-${Date.now()}-${++mediaSequence}`, file, fileName: file.name, key: mediaKeys.keyFor(file), state: 'uploading' as const, error: null, media: { mediaId: '', mimeType: file.type as RestoredRecycleMedia['mimeType'], sizeBytes: file.size, width: null, height: null, contentUrl: '', createdAt: new Date(0).toISOString() } }))
    patch({ attachments: [...snapshot.attachments, ...additions], error: null })
    await Promise.all(additions.map(item => uploadAttachment(item, token)))
  }
  async function retryAttachment(localId: string) {
    const item = snapshot.attachments.find(attachment => attachment.localId === localId)
    if (!snapshot.editing || snapshot.busy || !item?.file || !['failed', 'unknown'].includes(item.state)) return
    await uploadAttachment(item, mediaGeneration)
  }
  function removeAttachment(localId: string) {
    if (!snapshot.editing || snapshot.busy || snapshot.targets.length > 0) return
    mediaRequests.get(localId)?.abort(); mediaRequests.delete(localId)
    patch({ attachments: snapshot.attachments.filter(item => item.localId !== localId) }); invalidateSavedState()
  }

  function validateDraft() {
    const context = snapshot.editContext
    if (!context) return '编辑上下文尚未加载'
    if (Object.keys(snapshot.values).some(key => !context.fields.some(field => field.fieldKey === key))) return '资料包含未知字段，请重新加载'
    for (const field of context.fields) {
      const value = snapshot.values[field.fieldKey]
      if (!hasValue(value)) { if (field.required) return `请填写${field.label}`; continue }
      const options = new Set(field.options.map(option => option.value))
      if (field.valueType === 'text' && typeof value !== 'string') return `${field.label}格式错误`
      if (field.valueType === 'number' && !(typeof value === 'number' && Number.isFinite(value))) return `${field.label}须为数字`
      if (field.valueType === 'single' && !(typeof value === 'string' && options.has(value))) return `${field.label}选项无效`
      if (field.valueType === 'multiple' && !(Array.isArray(value) && value.every(item => options.has(item)) && new Set(value).size === value.length)) return `${field.label}选项无效`
    }
    if (snapshot.attachments.some(item => item.state !== 'uploaded' || !item.media.mediaId)) return '请先完成、重试或删除未完成的图片上传'
    return null
  }
  const contentFingerprint = () => JSON.stringify({ baseRevisionId: snapshot.editContext?.baseRevisionId, values: snapshot.values, attachmentMediaIds: snapshot.attachments.map(item => item.media.mediaId) })
  function applySaved(result: Awaited<ReturnType<RestoredRecycleRevisionApi['saveRevision']>>) {
    if (!saveAttempt || result.clientSaveId !== saveAttempt.body.clientSaveId) throw new RestoredHttpError(0, 'CLIENT_RECYCLE_SAVE_RESULT_MISMATCH', '保存结果与原操作不匹配', 'UNKNOWN')
    const revision = result.revision
    const nextContext = snapshot.editContext ? { ...snapshot.editContext, baseRevisionId: revision.revisionId, values: { ...snapshot.values }, attachments: revision.attachments } : null
    const existing = snapshot.revisions.find(item => item.revisionId === revision.revisionId)
    const listItem: RecycleProfileRevisionListItem = { ...revision, deliveredAt: existing?.deliveredAt ?? null }
    patch({ editContext: nextContext, savedRevision: revision, saveState: 'saved', saveRetryable: false, selectedConsultationIds: [], confirmation: null, targets: [], busy: false, stale: false, error: null, revisions: [listItem, ...snapshot.revisions.filter(item => item.revisionId !== revision.revisionId)] })
    clearRecycleCommand(commandStorage, commandIdentity, saveSlot())
    saveAttempt = null
  }
  async function runSave(attempt: SaveAttempt) {
    const token = generation
    operationRequest?.abort(); const request = new AbortController(); operationRequest = request
    // W02：命令发出前先持久化最小标识，硬刷新/关闭后可凭原键向服务端核实结果。
    storeRecycleCommand(commandStorage, commandIdentity, saveSlot(), {
      kind: "save", identity: commandIdentity ?? "", requestId: attempt.requestId,
      idempotencyKey: attempt.key, clientSaveId: attempt.body.clientSaveId,
      revisionId: attempt.body.baseRevisionId, savedAt: "",
    })
    patch({ busy: true, saveState: 'saving', saveRetryable: false, error: null })
    try {
      const result = await api.saveRevision(attempt.requestId, attempt.body, attempt.key, request.signal)
      if (current(token)) applySaved(result)
    } catch (error) {
      if (!current(token)) return
      if (failOperation(error)) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        try {
          const found = await api.findSaveOperation(attempt.requestId, attempt.body.clientSaveId, request.signal)
          if (current(token)) applySaved(found)
        } catch (lookupError) {
          if (!current(token)) return
          if (!(lookupError instanceof RestoredHttpError && lookupError.status === 404) && failOperation(lookupError)) return
          // 恢复型尝试（硬刷新恢复）没有原始资料内容，404 只保留查询通道，不提供重发入口。
          const restored = Boolean(attempt.fingerprint.startsWith('restored:'))
          const notRun = lookupError instanceof RestoredHttpError && lookupError.status === 404
          patch({ busy: false, saveState: 'unknown', saveRetryable: notRun && !restored, stale: true, error: notRun ? (restored ? '原保存操作确认未执行。该操作来自恢复前会话，为防误发空资料不提供重发，请重新填写后保存。' : '原保存操作确认未执行，可使用原操作重试。') : `原保存结果查询失败：${message(lookupError)}` })
        }
      } else patch({ busy: false, saveState: 'idle', error: message(error) })
    } finally { if (operationRequest === request) operationRequest = undefined; schedule() }
  }
  async function save() {
    if (!active || !snapshot.editing || snapshot.busy) return
    const problem = validateDraft(); if (problem) { patch({ error: problem }); return }
    const fingerprint = contentFingerprint()
    if (!saveAttempt || saveAttempt.fingerprint !== fingerprint) {
      const clientSaveId = makeId()
      const body = { clientSaveId, baseRevisionId: snapshot.editContext!.baseRevisionId, values: { ...snapshot.values }, attachmentMediaIds: snapshot.attachments.map(item => item.media.mediaId) }
      saveAttempt = { requestId: snapshot.editContext!.requestId, body, key: `client-recycle-save-${clientSaveId}`.slice(0, 100), fingerprint }
      saveFingerprint = fingerprint
    }
    await runSave(saveAttempt)
  }
  async function checkUnknownSave() {
    if (!active || snapshot.busy || snapshot.saveState !== 'unknown' || !saveAttempt) return
    const token = generation; const request = new AbortController(); operationRequest = request; patch({ busy: true, error: null })
    try { const result = await api.findSaveOperation(saveAttempt.requestId, saveAttempt.body.clientSaveId, request.signal); if (current(token)) applySaved(result) }
    catch (error) {
      if (!current(token)) return
      if (!(error instanceof RestoredHttpError && error.status === 404) && failOperation(error)) return
      const restored = Boolean(saveAttempt?.fingerprint.startsWith('restored:'))
      const notRun = error instanceof RestoredHttpError && error.status === 404
      patch({ busy: false, saveRetryable: notRun && !restored, stale: true, error: notRun ? (restored ? '原保存操作确认未执行。该操作来自恢复前会话，为防误发空资料不提供重发，请重新填写后保存。' : '原保存操作确认未执行，可使用原操作重试。') : `原保存结果查询失败：${message(error)}` })
    }
    finally { if (operationRequest === request) operationRequest = undefined; schedule() }
  }
  async function retrySave() { if (snapshot.saveState === 'unknown' && snapshot.saveRetryable && saveAttempt && saveFingerprint === saveAttempt.fingerprint) await runSave(saveAttempt) }

  function toggleConsultation(targetId: string) {
    if (!snapshot.savedRevision || snapshot.busy || !snapshot.editContext?.consultations.some(item => item.consultationId === targetId)) return
    patch({ selectedConsultationIds: snapshot.selectedConsultationIds.includes(targetId) ? snapshot.selectedConsultationIds.filter(id => id !== targetId) : [...snapshot.selectedConsultationIds, targetId], confirmation: null, error: null })
  }
  function requestDeliveryConfirmation() {
    const revision = snapshot.savedRevision, context = snapshot.editContext
    if (!revision || !context || snapshot.selectedConsultationIds.length === 0 || snapshot.busy) return false
    const selected = snapshot.selectedConsultationIds.map(id => context.consultations.find(item => item.consultationId === id)).filter(Boolean) as RecycleProfileEditContext['consultations']
    if (selected.length !== snapshot.selectedConsultationIds.length) { patch({ error: '发送名单已变化，请重新选择' }); return false }
    patch({ confirmation: { revisionId: revision.revisionId, revisionNumber: revision.revisionNumber, selectedConsultationIds: [...snapshot.selectedConsultationIds], selectedConsultationNames: selected.map(item => item.recyclerName) }, error: null })
    return true
  }
  function updateTarget(targetId: string, value: Partial<RecycleRevisionTargetState>) { patch({ targets: snapshot.targets.map(target => target.consultationId === targetId ? { ...target, ...value } : target) }) }
  // 逐商落定（直发成功或原操作对账成功）都要从持久化记录移除该条目。
  function settleDeliveryEntry(targetId: string) {
    const pendingDelivery = loadRecycleCommand(commandStorage, commandIdentity, deliverySlot())
    if (pendingDelivery?.entries) {
      const rest = pendingDelivery.entries.filter(item => item.consultationId !== targetId)
      if (rest.length) storeRecycleCommand(commandStorage, commandIdentity, deliverySlot(), { ...pendingDelivery, entries: rest })
      else clearRecycleCommand(commandStorage, commandIdentity, deliverySlot())
    }
  }
  function verifiedTarget(target: RecycleRevisionTargetState, result: RecycleRevisionTargetResult) {
    if (result.revisionId !== snapshot.savedRevision?.revisionId || result.consultationId !== target.consultationId || result.clientConfirmationId !== target.body.clientConfirmationId || JSON.stringify(result.selectedConsultationIds) !== JSON.stringify(target.body.selectedConsultationIds)) throw new RestoredHttpError(0, 'CLIENT_RECYCLE_TARGET_RESULT_MISMATCH', '发送结果与已确认名单不一致', 'UNKNOWN')
    return result
  }
  async function lookupUnknownTarget(target: RecycleRevisionTargetState, token: number, request: AbortController) {
    try {
      const found = verifiedTarget(target, await api.findTargetOperation(snapshot.savedRevision!.revisionId, target.consultationId, target.body.clientConfirmationId, target.body.selectedConsultationIds, request.signal))
      if (current(token)) {
        updateTarget(target.consultationId, { state: 'success', retryable: false, error: null, result: found })
        settleDeliveryEntry(target.consultationId)
      }
    } catch (error) {
      if (!current(token)) return
      if (!(error instanceof RestoredHttpError && error.status === 404) && failOperation(error)) return
      updateTarget(target.consultationId, { state: 'unknown', retryable: error instanceof RestoredHttpError && error.status === 404, error: error instanceof RestoredHttpError && error.status === 404 ? '原发送操作确认未执行，可使用原操作重试。' : `原发送结果查询失败：${message(error)}` })
    }
  }
  async function sendTarget(targetId: string, token: number, request: AbortController) {
    const target = snapshot.targets.find(item => item.consultationId === targetId)
    if (!target || !current(token) || target.state === 'success') return
    updateTarget(targetId, { state: 'sending', error: null })
    try {
      const result = verifiedTarget(target, await api.deliverRevision(snapshot.savedRevision!.revisionId, targetId, target.body, target.key, request.signal))
      if (current(token)) {
        updateTarget(targetId, { state: 'success', retryable: false, error: null, result })
        settleDeliveryEntry(targetId)
      }
    } catch (error) {
      if (!current(token)) return
      if (failOperation(error)) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') await lookupUnknownTarget(target, token, request)
      else updateTarget(targetId, { state: 'failed', retryable: true, error: message(error) })
    }
  }
  async function confirmDelivery() {
    const confirmation = snapshot.confirmation, context = snapshot.editContext, revision = snapshot.savedRevision
    if (!confirmation || !context || !revision || snapshot.busy) return
    const clientConfirmationId = makeId()
    const body = { clientConfirmationId, selectedConsultationIds: [...confirmation.selectedConsultationIds] }
    const targets = confirmation.selectedConsultationIds.map((targetId, index) => {
      const target = context.consultations.find(item => item.consultationId === targetId)!
      return { consultationId: targetId, recyclerName: target.recyclerName, conversationId: target.conversationId, state: 'pending' as const, retryable: false, error: null, key: `client-recycle-target-${clientConfirmationId}-${index + 1}`.slice(0, 100), body, result: null }
    })
    // W02：定向投递确认后持久化逐商条目（仅 ID 与展示名），逐商成功即移除。
    storeRecycleCommand(commandStorage, commandIdentity, deliverySlot(), {
      kind: "target", identity: commandIdentity ?? "", requestId: "", idempotencyKey: "",
      revisionId: revision.revisionId, savedAt: "",
      entries: targets.map(target => ({
        consultationId: target.consultationId, recyclerName: target.recyclerName,
        conversationId: target.conversationId, revisionId: revision.revisionId,
        clientConfirmationId, key: target.key, selectedConsultationIds: [...body.selectedConsultationIds],
      })),
    })
    const token = generation; operationRequest?.abort(); const request = new AbortController(); operationRequest = request
    patch({ busy: true, confirmation: null, targets, error: null })
    for (const target of targets) { if (!current(token)) break; await sendTarget(target.consultationId, token, request) }
    if (current(token)) patch({ busy: false })
    if (operationRequest === request) operationRequest = undefined
    schedule()
  }
  async function checkUnknownTarget(targetId: string) {
    const target = snapshot.targets.find(item => item.consultationId === targetId)
    if (!target || target.state !== 'unknown' || snapshot.busy) return
    const token = generation; const request = new AbortController(); operationRequest = request; patch({ busy: true }); updateTarget(targetId, { state: 'sending', error: null })
    await lookupUnknownTarget(target, token, request)
    if (current(token)) patch({ busy: false })
    if (operationRequest === request) operationRequest = undefined
  }
  async function retryTarget(targetId: string) {
    const target = snapshot.targets.find(item => item.consultationId === targetId)
    if (!target || snapshot.busy || !(target.state === 'failed' || (target.state === 'unknown' && target.retryable))) return
    const token = generation; const request = new AbortController(); operationRequest = request; patch({ busy: true })
    await sendTarget(targetId, token, request)
    if (current(token)) patch({ busy: false })
    if (operationRequest === request) operationRequest = undefined
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
    async start(revisionId?: string) {
      if (active) return; active = true; selectedRevisionId = revisionId; await refresh(revisionId)
      // W02：恢复上次未决的保存命令（硬刷新/关闭重开后），凭原键向服务端核实结果。
      const pending = loadRecycleCommand(commandStorage, commandIdentity, saveSlot())
      if (pending && snapshot.saveState !== 'saved') {
        saveAttempt = {
          requestId: pending.requestId,
          body: { clientSaveId: pending.clientSaveId ?? '', baseRevisionId: pending.revisionId ?? snapshot.editContext?.baseRevisionId ?? '', values: {}, attachmentMediaIds: [] },
          key: pending.idempotencyKey,
          fingerprint: `restored:${pending.savedAt}`,
        }
        // 指纹与当前草稿不一致 → retrySave 不会盲目重发空资料；只走原操作查询通道。
        patch({ saveState: 'unknown', saveRetryable: false, stale: true, error: '检测到未确认的保存操作，正在向服务器核实结果…' })
        await checkUnknownSave()
      }
      // W02：恢复未决的定向投递条目（硬刷新/关闭重开后），选中记录中的版本并逐商凭原键核实。
      const delivery = loadRecycleCommand(commandStorage, commandIdentity, deliverySlot())
      if (delivery?.entries?.length) {
        const recordedRevisionId = delivery.entries[0]!.revisionId
        await refresh(recordedRevisionId)
        if (snapshot.selectedRevision?.revisionId === recordedRevisionId && snapshot.targets.length === 0) {
          const rebuilt = delivery.entries.map(entry => ({
            consultationId: entry.consultationId, recyclerName: entry.recyclerName,
            conversationId: entry.conversationId, state: 'unknown' as const, retryable: false,
            error: null, key: entry.key,
            body: { clientConfirmationId: entry.clientConfirmationId, selectedConsultationIds: [...entry.selectedConsultationIds] },
            result: null,
          }))
          // 恢复语义：记录中的 revisionId 即已保存的版本，回填 savedRevision 供对账一致性校验使用。
          patch({ targets: rebuilt, savedRevision: snapshot.selectedRevision, busy: false })
          for (const target of rebuilt) { if (!current(generation)) break; await checkUnknownTarget(target.consultationId) }
        }
      }
    },
    refresh, selectRevision, beginEdit, setValue, addAttachments, retryAttachment, removeAttachment, save, checkUnknownSave, retrySave, toggleConsultation, requestDeliveryConfirmation, confirmDelivery, checkUnknownTarget, retryTarget,
    cancelDeliveryConfirmation() { if (!snapshot.busy) patch({ confirmation: null }) },
    cancelEdit() { if (!snapshot.busy && snapshot.saveState !== 'unknown' && snapshot.targets.every(settledTarget)) { abortMedia(); saveAttempt = null; saveFingerprint = ''; patch({ editing: false, editContext: null, values: {}, attachments: [], selectedConsultationIds: [], savedRevision: null, saveState: 'idle', saveRetryable: false, confirmation: null, targets: [], error: null }); schedule() } },
    async setVisible(next: boolean) {
      if (visible === next) return
      visible = next; clearTimer()
      if (!next) { readRequest?.abort(); readRequest = undefined; return }
      await refresh()
    },
    stop() {
      active = false; generation += 1; clearTimer(); readRequest?.abort(); operationRequest?.abort(); readRequest = undefined; operationRequest = undefined; abortMedia(); saveAttempt = null; saveFingerprint = ''; publish(initial()); listeners.clear()
    },
  }
}

const transportControllers = new WeakMap<ReturnType<typeof createRestoredLinkedTransport>, Map<string, ReturnType<typeof createRestoredRecycleRevisionController>>>()

/** Keep operation IDs and unknown outcomes bound to the current actor transport across route unmounts. */
export function getRestoredRecycleRevisionControllerForTransport(
  transport: ReturnType<typeof createRestoredLinkedTransport>,
  consultationId: string,
  options: { storage?: RecycleCommandStorage; identity?: string } = {},
) {
  let consultations = transportControllers.get(transport)
  if (!consultations) { consultations = new Map(); transportControllers.set(transport, consultations) }
  let controller = consultations.get(consultationId)
  if (!controller) { controller = createRestoredRecycleRevisionController(consultationId, createRestoredRecycleRevisionApi(transport), undefined, { storage: options.storage ?? globalThis.localStorage ?? undefined, identity: options.identity }); consultations.set(consultationId, controller) }
  return controller
}

const requestRevisionControllers = new WeakMap<ReturnType<typeof createRestoredLinkedTransport>, Map<string, ReturnType<typeof createRestoredRecycleRevisionController>>>()

/** Owner request pages use the same save/unknown/directed-update state machine with request-scoped reads. */
export function getRestoredRecycleRequestRevisionControllerForTransport(
  transport: ReturnType<typeof createRestoredLinkedTransport>,
  requestId: string,
  options: { storage?: RecycleCommandStorage; identity?: string } = {},
) {
  let requests = requestRevisionControllers.get(transport)
  if (!requests) { requests = new Map(); requestRevisionControllers.set(transport, requests) }
  let controller = requests.get(requestId)
  if (!controller) {
    const revisionApi = createRestoredRecycleRevisionApi(transport)
    const distributionApi = createRestoredRecycleDistributionApi(transport)
    let ownerRevisions: RecycleProfileRevision[] = []
    const load = async (signal?: AbortSignal) => {
      ownerRevisions = await distributionApi.listRequestRevisions(requestId, signal)
      return ownerRevisions
    }
    controller = createRestoredRecycleRevisionController(requestId, revisionApi, undefined, { storage: options.storage ?? globalThis.localStorage ?? undefined, identity: options.identity, access: {
      async list(signal) { return { canEdit: true, revisions: (await load(signal)).map(revision => ({ ...revision, deliveredAt: null })) } },
      async read(revisionId, signal) {
        const revisions = ownerRevisions.some(item => item.revisionId === revisionId) ? ownerRevisions : await load(signal)
        const revision = revisions.find(item => item.revisionId === revisionId)
        if (!revision) throw new RestoredHttpError(404, 'RECYCLE_PROFILE_REVISION_NOT_FOUND', '资料版本不存在')
        return revision
      },
      context: signal => distributionApi.readRequestContext(requestId, signal),
    } })
    requests.set(requestId, controller)
  }
  return controller
}
