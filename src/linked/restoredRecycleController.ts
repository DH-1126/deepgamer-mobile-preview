import { RestoredHttpError } from './restoredLinkedTransport'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRestoredRecycleApi } from './restoredRecycleApi'
import type { RecycleCatalogItem, RecycleConsultation, RecycleCreate, RecycleGameDetail, RecycleValue, RestoredRecycleApi } from './restoredRecycleApi'
import { createRecycleMediaKeyRegistry, RECYCLE_MEDIA_MAX_COUNT, validateRestoredRecycleMediaFile, type RestoredRecycleMedia } from './restoredRecycleMedia'

export type RecycleTargetState = 'pending' | 'sending' | 'success' | 'failed' | 'unknown'
export type RecycleTarget = { recyclerId: string; displayName: string; state: RecycleTargetState; retryable: boolean; error: string | null; result: RecycleConsultation | null; key: string; body: RecycleCreate }
export type RecycleDraftAttachmentState = 'uploading' | 'uploaded' | 'failed' | 'unknown'
export type RecycleDraftAttachment = { localId: string; file: File; fileName: string; key: string; state: RecycleDraftAttachmentState; error: string | null; media: RestoredRecycleMedia | null }
export type RecycleConfirmation = { profileVersion: 1; clientSubmissionId: string; gameCode: string; gameName: string; fieldTemplateVersion: number; fieldSchemaHash: string; fields: { fieldKey: string; label: string; displayValue: string }[]; attachmentMediaIds: string[]; attachments: { mediaId: string; fileName: string; contentUrl: string }[]; selectedRecyclerIds: string[]; selectedRecyclerNames: string[] }
export type RecycleSnapshot = { catalog: RecycleCatalogItem[] | null; detail: RecycleGameDetail | null; loading: boolean; error: string | null; values: Record<string, RecycleValue>; attachments: RecycleDraftAttachment[]; selectedRecyclerIds: string[]; confirmation: RecycleConfirmation | null; targets: RecycleTarget[]; frozen: boolean }
const initial = (): RecycleSnapshot => ({ catalog: null, detail: null, loading: false, error: null, values: {}, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false })
const message = (error: unknown) => error instanceof Error ? error.message : '回收咨询请求失败'
const hasValue = (value: RecycleValue | undefined) => value !== undefined && (typeof value !== 'string' || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0)

export function recycleCatalogRefreshBlocked(snapshot: RecycleSnapshot): boolean {
  return snapshot.loading || snapshot.frozen || snapshot.confirmation !== null || snapshot.targets.length > 0
    || Object.keys(snapshot.values).length > 0 || snapshot.selectedRecyclerIds.length > 0 || snapshot.attachments.length > 0
}

export function validateRecycleProfileAnswers(detail: RecycleGameDetail, values: Record<string, RecycleValue>): string | null {
  if (!detail.available) return detail.blockedReason || '此游戏暂不支持回收咨询'
  if (detail.fields.length === 0 || detail.fields.some(field => !['text', 'number', 'single', 'multiple'].includes(field.valueType))) return '回收资料配置暂不支持，请稍后再试'
  if (Object.keys(values).some(key => !detail.fields.some(field => field.fieldKey === key))) return '回收资料包含未知字段，请重新填写'
  for (const field of detail.fields) {
    const answer = values[field.fieldKey]
    if (!hasValue(answer)) { if (field.required) return `请填写${field.label}`; continue }
    const options = new Set(field.options.map(option => option.value))
    if (field.valueType === 'text' && typeof answer !== 'string') return `${field.label}格式错误`
    if (field.valueType === 'number' && !(typeof answer === 'number' && Number.isFinite(answer))) return `${field.label}须为数字`
    if (field.valueType === 'single' && !(typeof answer === 'string' && options.has(answer))) return `${field.label}选项无效`
    if (field.valueType === 'multiple' && !(Array.isArray(answer) && answer.every(item => options.has(item)) && new Set(answer).size === answer.length)) return `${field.label}选项无效`
  }
  return null
}

export function validateRecycleAnswers(detail: RecycleGameDetail, values: Record<string, RecycleValue>, selectedRecyclerIds: string[]): string | null {
  const profileProblem = validateRecycleProfileAnswers(detail, values)
  if (profileProblem) return profileProblem
  if (selectedRecyclerIds.length === 0) return '请先选择至少一家回收商'
  if (selectedRecyclerIds.length > 100 || new Set(selectedRecyclerIds).size !== selectedRecyclerIds.length || selectedRecyclerIds.some(id => !detail.recyclers.some(recycler => recycler.recyclerId === id && recycler.eligible))) return '所选回收商已不可用，请重新选择'
  return null
}

export function createRestoredRecycleController(api: RestoredRecycleApi, makeId: () => string = () => `recycle-${globalThis.crypto.randomUUID()}`) {
  let snapshot = initial()
  let generation = 0
  let pending: AbortController | null = null
  let mediaGeneration = 0
  let mediaSequence = 0
  const mediaKeys = createRecycleMediaKeyRegistry('client-recycle-media')
  const mediaRequests = new Map<string, AbortController>()
  const listeners = new Set<() => void>()
  const publish = (next: RecycleSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const abort = () => { pending?.abort(); pending = null }
  const abortMedia = () => { mediaGeneration++; mediaRequests.forEach(request => request.abort()); mediaRequests.clear() }
  const current = (token: number) => token === generation
  const patch = (value: Partial<RecycleSnapshot>) => publish({ ...snapshot, ...value })

  async function loadCatalog() {
    // Refresh is a catalog operation, not consent to discard draft data or unknown-operation keys.
    if (recycleCatalogRefreshBlocked(snapshot)) return
    const token = ++generation; abort(); abortMedia(); const request = new AbortController(); pending = request
    patch({ catalog: null, detail: null, loading: true, error: null, values: {}, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false })
    try { const catalog = await api.listCatalog(request.signal); if (current(token)) patch({ catalog, loading: false }) }
    catch (error) { if (current(token)) patch({ loading: false, error: message(error) }) }
  }

  async function selectGame(gameCode: string) {
    if (snapshot.frozen) return
    const token = ++generation; abort(); abortMedia(); const request = new AbortController(); pending = request
    patch({ detail: null, loading: true, error: null, values: {}, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [] })
    if (!gameCode) { patch({ loading: false }); return }
    try { const detail = await api.readGame(gameCode, request.signal); if (current(token)) patch({ detail, loading: false }) }
    catch (error) { if (current(token)) patch({ loading: false, error: message(error) }) }
  }

  function setValue(fieldKey: string, value: RecycleValue | undefined) {
    if (snapshot.frozen || !snapshot.detail?.fields.some(field => field.fieldKey === fieldKey)) return
    const values = { ...snapshot.values }
    if (value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) delete values[fieldKey]
    else values[fieldKey] = value
    patch({ values, confirmation: null, error: null })
  }
  function toggleRecycler(recyclerId: string) {
    if (snapshot.frozen || !snapshot.detail?.recyclers.some(recycler => recycler.recyclerId === recyclerId && recycler.eligible)) return
    patch({ selectedRecyclerIds: snapshot.selectedRecyclerIds.includes(recyclerId) ? snapshot.selectedRecyclerIds.filter(id => id !== recyclerId) : [...snapshot.selectedRecyclerIds, recyclerId], confirmation: null, error: null })
  }

  function updateAttachment(localId: string, value: Partial<RecycleDraftAttachment>, token: number) {
    if (token !== mediaGeneration) return
    patch({ attachments: snapshot.attachments.map(item => item.localId === localId ? { ...item, ...value } : item) })
  }

  async function uploadAttachment(item: RecycleDraftAttachment, token: number) {
    const request = new AbortController()
    mediaRequests.set(item.localId, request)
    updateAttachment(item.localId, { state: 'uploading', error: null }, token)
    try {
      const media = await api.uploadMedia(item.file, item.key, request.signal)
      updateAttachment(item.localId, { state: 'uploaded', error: null, media }, token)
    } catch (error) {
      if (token !== mediaGeneration) return
      const unknown = error instanceof RestoredHttpError && error.outcome === 'UNKNOWN'
      updateAttachment(item.localId, { state: unknown ? 'unknown' : 'failed', error: unknown ? '上传结果未知，可使用原操作重试' : `上传失败：${message(error)}`, media: null }, token)
    } finally {
      if (mediaRequests.get(item.localId) === request) mediaRequests.delete(item.localId)
    }
  }

  async function addAttachments(files: File[]) {
    if (snapshot.frozen || !snapshot.detail?.attachmentsAvailable || files.length === 0) return
    if (snapshot.attachments.length + files.length > RECYCLE_MEDIA_MAX_COUNT) { patch({ error: `每份回收资料最多上传 ${RECYCLE_MEDIA_MAX_COUNT} 张图片` }); return }
    for (const file of files) {
      const problem = validateRestoredRecycleMediaFile(file)
      if (problem) { patch({ error: problem }); return }
    }
    const token = mediaGeneration
    const additions = files.map(file => {
      const suffix = `${Date.now()}-${++mediaSequence}`
      return { localId: `draft-media-${suffix}`, file, fileName: file.name, key: mediaKeys.keyFor(file), state: 'uploading' as const, error: null, media: null }
    })
    patch({ attachments: [...snapshot.attachments, ...additions], confirmation: null, error: null })
    await Promise.all(additions.map(item => uploadAttachment(item, token)))
  }

  async function retryAttachment(localId: string) {
    const item = snapshot.attachments.find(attachment => attachment.localId === localId)
    if (snapshot.frozen || !item || !['failed', 'unknown'].includes(item.state)) return
    await uploadAttachment(item, mediaGeneration)
  }

  function removeAttachment(localId: string) {
    if (snapshot.frozen) return
    mediaRequests.get(localId)?.abort(); mediaRequests.delete(localId)
    patch({ attachments: snapshot.attachments.filter(item => item.localId !== localId), confirmation: null, error: null })
  }

  function pauseMediaUploads() {
    const uploading = snapshot.attachments.filter(item => item.state === 'uploading')
    if (uploading.length === 0) return
    abortMedia()
    patch({ attachments: snapshot.attachments.map(item => item.state === 'uploading' ? { ...item, state: 'unknown', error: '页面已离开，上传结果未知，可使用原操作重试' } : item) })
  }

  function requestConfirmation() {
    const detail = snapshot.detail
    if (!detail || snapshot.frozen) return false
    const error = validateRecycleAnswers(detail, snapshot.values, snapshot.selectedRecyclerIds)
    if (error) { patch({ error, confirmation: null }); return false }
    if (snapshot.attachments.some(item => item.state !== 'uploaded' || !item.media)) { patch({ error: '请先完成、重试或删除未完成的图片上传', confirmation: null }); return false }
    const names = snapshot.selectedRecyclerIds.map(id => detail.recyclers.find(recycler => recycler.recyclerId === id)!.displayName)
    const fields = detail.fields.filter(field => hasValue(snapshot.values[field.fieldKey])).map(field => {
      const answer = snapshot.values[field.fieldKey]
      const displayValue = Array.isArray(answer) ? answer.map(value => field.options.find(option => option.value === value)?.label ?? value).join('、') : field.valueType === 'single' ? field.options.find(option => option.value === answer)?.label ?? String(answer) : String(answer)
      return { fieldKey: field.fieldKey, label: field.label, displayValue }
    })
    const attachments = snapshot.attachments.map(item => ({ mediaId: item.media!.mediaId, fileName: item.fileName, contentUrl: item.media!.contentUrl }))
    patch({ error: null, confirmation: { profileVersion: 1, clientSubmissionId: makeId(), gameCode: detail.gameCode, gameName: detail.gameName, fieldTemplateVersion: detail.fieldTemplateVersion, fieldSchemaHash: detail.fieldSchemaHash, fields, attachmentMediaIds: attachments.map(item => item.mediaId), attachments, selectedRecyclerIds: [...snapshot.selectedRecyclerIds], selectedRecyclerNames: names } })
    return true
  }

  function updateTarget(recyclerId: string, value: Partial<RecycleTarget>) {
    patch({ targets: snapshot.targets.map(target => target.recyclerId === recyclerId ? { ...target, ...value } : target) })
  }

  function verifiedResult(target: RecycleTarget, result: RecycleConsultation): RecycleConsultation {
    const body = target.body
    const attachmentMediaIds = body.attachmentMediaIds ?? []
    if (result.clientSubmissionId !== body.clientSubmissionId || result.gameCode !== body.gameCode || result.recyclerId !== body.recyclerId || result.fieldTemplateVersion !== body.fieldTemplateVersion || result.fieldSchemaHash !== body.fieldSchemaHash || result.profileVersion !== 1 || result.status !== 'SENT' || result.profileFields.length !== Object.keys(body.values).length || result.profileFields.some(field => !Object.hasOwn(body.values, field.fieldKey) || JSON.stringify(field.value) !== JSON.stringify(body.values[field.fieldKey])) || result.attachments.length !== attachmentMediaIds.length || result.attachments.some((item, index) => item.mediaId !== attachmentMediaIds[index])) {
      throw new RestoredHttpError(0, 'CLIENT_RECYCLE_RESULT_MISMATCH', '原咨询结果与已确认资料不一致', 'UNKNOWN')
    }
    return result
  }

  async function checkUnknownTarget(recyclerId: string) {
    const token = generation
    const target = snapshot.targets.find(item => item.recyclerId === recyclerId)
    if (!target || target.state !== 'unknown' || target.retryable) return
    updateTarget(recyclerId, { state: 'sending', error: null })
    try {
      const found = verifiedResult(target, await api.findTarget(target.body.clientSubmissionId, recyclerId, pending?.signal))
      if (current(token)) updateTarget(recyclerId, { state: 'success', error: null, result: found })
    } catch (error) {
      if (!current(token)) return
      updateTarget(recyclerId, { state: 'unknown', retryable: error instanceof RestoredHttpError && error.status === 404, error: error instanceof RestoredHttpError && error.status === 404 ? '原操作结果暂未找到，请明确重试原操作' : `原操作结果查询失败：${message(error)}` })
    }
  }

  async function sendTarget(recyclerId: string, token: number) {
    const target = snapshot.targets.find(item => item.recyclerId === recyclerId)
    if (!target || !current(token) || target.state === 'success') return
    updateTarget(recyclerId, { state: 'sending', error: null })
    try {
      const result = verifiedResult(target, await api.createConsultation(target.body, target.key, pending?.signal))
      if (current(token)) updateTarget(recyclerId, { state: 'success', error: null, result })
    } catch (error) {
      if (!current(token)) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        try {
          const found = verifiedResult(target, await api.findTarget(target.body.clientSubmissionId, recyclerId, pending?.signal))
          if (current(token)) updateTarget(recyclerId, { state: 'success', retryable: false, error: null, result: found })
        } catch (lookupError) {
          if (current(token)) updateTarget(recyclerId, { state: 'unknown', retryable: lookupError instanceof RestoredHttpError && lookupError.status === 404, error: lookupError instanceof RestoredHttpError && lookupError.status === 404 ? '原操作结果暂未找到，请明确重试原操作' : `原操作结果查询失败：${message(lookupError)}` })
        }
      } else updateTarget(recyclerId, { state: 'failed', error: message(error) })
    }
  }

  async function confirmAndSubmit() {
    const confirmation = snapshot.confirmation, detail = snapshot.detail
    if (!confirmation || !detail || snapshot.frozen) return
    const values = Object.fromEntries(Object.entries(snapshot.values).filter(([, value]) => hasValue(value)))
    const selectedRecyclerIds = [...confirmation.selectedRecyclerIds]
    const targets = selectedRecyclerIds.map((recyclerId, index) => ({
      recyclerId, displayName: confirmation.selectedRecyclerNames[index], state: 'pending' as const, retryable: false, error: null, result: null,
      key: `client-recycle-${confirmation.clientSubmissionId}-${index + 1}`.slice(0, 100),
      body: { clientSubmissionId: confirmation.clientSubmissionId, gameCode: confirmation.gameCode, fieldTemplateVersion: confirmation.fieldTemplateVersion, fieldSchemaHash: confirmation.fieldSchemaHash, selectedRecyclerIds, recyclerId, values, attachmentMediaIds: [...confirmation.attachmentMediaIds] } as RecycleCreate,
    }))
    const token = ++generation; abort(); pending = new AbortController()
    patch({ frozen: true, confirmation: null, targets })
    for (const target of targets) { if (!current(token)) break; await sendTarget(target.recyclerId, token) }
  }

  async function retryTarget(recyclerId: string) {
    const target = snapshot.targets.find(item => item.recyclerId === recyclerId)
    if (!snapshot.frozen || !target || !(target.state === 'failed' || (target.state === 'unknown' && target.retryable))) return
    await sendTarget(recyclerId, generation)
  }

  return { getSnapshot: () => snapshot, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }, loadCatalog, selectGame, setValue, toggleRecycler, addAttachments, retryAttachment, removeAttachment, pauseMediaUploads, requestConfirmation, confirmAndSubmit, checkUnknownTarget, retryTarget,
    cancelConfirmation() { if (!snapshot.frozen) patch({ confirmation: null }) },
    startNew() { if (snapshot.frozen && snapshot.targets.some(target => ['pending', 'sending', 'unknown'].includes(target.state))) return; ++generation; abort(); abortMedia(); publish({ ...initial(), catalog: snapshot.catalog }) },
    disconnect() {
      ++generation; abort(); abortMedia()
      if (snapshot.frozen) patch({ targets: snapshot.targets.map(target => target.state === 'pending' || target.state === 'sending' ? { ...target, state: 'unknown', retryable: false, error: '操作已中断，请先查询原操作结果' } : target) })
      else publish(initial())
      listeners.clear()
    },
  }
}

const transportControllers = new WeakMap<ReturnType<typeof createRestoredLinkedTransport>, ReturnType<typeof createRestoredRecycleController>>()
/** A routed page may unmount while merchant B is still pending; keep its original operation in the actor's transport scope. */
export function getRestoredRecycleControllerForTransport(transport: ReturnType<typeof createRestoredLinkedTransport>) {
  let controller = transportControllers.get(transport)
  if (!controller) { controller = createRestoredRecycleController(createRestoredRecycleApi(transport)); transportControllers.set(transport, controller) }
  return controller
}
