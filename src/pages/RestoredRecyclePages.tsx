import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button, Dialog, Heading, IconButton, PageHeader, SelectField, Spinner, SurfaceCard, TextField } from '../components/ui'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { createRestoredRecycleApi, type RecycleConsultation, type RecycleField, type RecycleValue } from '../linked/restoredRecycleApi'
import { createRestoredRecycleProfileController } from '../linked/restoredRecycleProfileController'
import type { RecycleProfileDisplay } from '../linked/restoredRecycleProfileController'
import { createRestoredRecycleDistributionApi } from '../linked/restoredRecycleDistributionApi'
import { getRestoredRecycleControllerForTransport, recycleCatalogRefreshBlocked, type RecycleDraftAttachment, type RecycleSnapshot } from '../linked/restoredRecycleController'
import type { RecycleRevisionField, RecycleRevisionValue } from '../linked/restoredRecycleRevisionApi'
import { getRestoredRecycleRevisionControllerForTransport, type RecycleRevisionDraftAttachment, type RestoredRecycleRevisionSnapshot } from '../linked/restoredRecycleRevisionController'
import type { RestoredRecycleMedia } from '../linked/restoredRecycleMedia'
import '../styles/restored-recycle.css'

type Callbacks = {
  onGameChange: (gameCode: string) => void
  onValueChange: (fieldKey: string, value: RecycleValue | undefined) => void
  onAttachmentsAdd: (files: File[]) => void
  onAttachmentRemove: (localId: string) => void
  onAttachmentRetry: (localId: string) => void
  onRecyclerToggle: (recyclerId: string) => void
  onRequestConfirmation: () => void
  onConfirm: () => void
  onCancelConfirmation: () => void
  onRetry: (recyclerId: string) => void
  onCheckUnknown: (recyclerId: string) => void
  onStartNew: () => void
  onRefresh: () => void
}

export function ProtectedRecycleImage({ media, alt }: { media: Pick<RestoredRecycleMedia, 'mediaId' | 'contentUrl'>; alt: string }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  useEffect(() => {
    setPreviewOpen(false)
    setFailed(false)
    setAttempt(0)
  }, [media.mediaId])
  if (failed) return <div className="restored-recycle-image-error" role="alert"><p>图片预览加载失败，请检查会话后重试。</p><Button size="sm" variant="outline" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>重试预览</Button></div>
  return <>
    <button type="button" className="restored-recycle-image-trigger" aria-label={`放大查看${alt}`} onClick={() => setPreviewOpen(true)}>
      <img key={`${media.mediaId}-${attempt}`} src={media.contentUrl} alt={alt} onError={() => setFailed(true)} />
    </button>
    <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${alt}预览`} closeOnBackdrop={false} className="restored-recycle-image-dialog">
      <img src={media.contentUrl} alt={`${alt}放大预览`} onError={() => { setPreviewOpen(false); setFailed(true) }} />
    </Dialog>
  </>
}

export function DraftAttachments({ attachments, frozen, onAdd, onRemove, onRetry }: { attachments: RecycleDraftAttachment[]; frozen: boolean; onAdd: (files: File[]) => void; onRemove: (localId: string) => void; onRetry: (localId: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const uploading = attachments.some(item => item.state === 'uploading')
  return <section className="restored-recycle-attachments" aria-busy={uploading}>
    <div><Heading as="h3" variant="subsection">资料图片</Heading><small>{attachments.length} / 15</small></div>
    <p>JPG、PNG、WebP；每张严格小于 1MB，最多 15 张。</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={frozen || attachments.length >= 15} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) onAdd(files) }} />
    <Button type="button" variant="outline" disabled={frozen || attachments.length >= 15} onClick={() => input.current?.click()}>上传资料图片</Button>
    {attachments.length > 0 && <ul>{attachments.map((item, index) => <li key={item.localId}>
      {item.media && <ProtectedRecycleImage media={item.media} alt={`草稿资料图片 ${index + 1}`} />}
      <span><b>{item.fileName}</b><small role={item.error ? 'alert' : 'status'}>{item.state === 'uploading' ? '上传中' : item.state === 'uploaded' ? '已上传' : item.error || (item.state === 'unknown' ? '上传结果未知' : '上传失败')}</small></span>
      {(item.state === 'failed' || item.state === 'unknown') && <Button size="sm" variant="outline" onClick={() => onRetry(item.localId)}>重试上传原操作</Button>}
      {!frozen && <Button size="sm" variant="secondary" onClick={() => onRemove(item.localId)}>删除草稿图片</Button>}
    </li>)}</ul>}
  </section>
}

const recyclerBlockedLabels: Record<string, string> = {
  RECYCLER_DISABLED: '回收商暂停合作',
  RECYCLER_DIRECTORY_DISABLED: '回收商当前未开放咨询',
  GAME_RELATION_DISABLED: '回收商暂不接收此游戏',
  NOT_ACCEPTING_NOW: '回收商当前暂停接单',
  SELF_RECYCLER: '不能向自己的回收商发起咨询',
}

export function recyclerBlockedLabel(reason: string | null) {
  return reason && Object.hasOwn(recyclerBlockedLabels, reason) ? recyclerBlockedLabels[reason] : '暂不可咨询'
}

type EditableRecycleField = Pick<RecycleField, 'fieldKey' | 'label' | 'valueType' | 'required' | 'options'> | Pick<RecycleRevisionField, 'fieldKey' | 'label' | 'valueType' | 'required' | 'options'>

export function RecycleAnswer({ field, answer, frozen, onChange }: { field: EditableRecycleField; answer: RecycleValue | RecycleRevisionValue | undefined; frozen: boolean; onChange: (value: RecycleValue | RecycleRevisionValue | undefined) => void }) {
  const label = `${field.label}${field.required ? ' *' : ''}`
  if (field.valueType === 'text') return <TextField label={label} value={typeof answer === 'string' ? answer : ''} disabled={frozen} onChange={event => onChange(event.target.value)} placeholder={`填写${field.label}`} />
  if (field.valueType === 'number') return <TextField label={label} type="number" inputMode="decimal" value={typeof answer === 'number' ? answer : ''} disabled={frozen} onChange={event => onChange(event.target.value === '' ? undefined : Number(event.target.value))} placeholder={`填写${field.label}`} />
  if (field.valueType === 'single') return <SelectField label={label} value={typeof answer === 'string' ? answer : ''} disabled={frozen} onChange={event => onChange(event.target.value || undefined)} options={[{ value: '', label: '请选择', disabled: true }, ...field.options]} />
  if (field.valueType === 'multiple') return <fieldset className="restored-recycle-multiple" disabled={frozen}><legend>{label}</legend>{field.options.map(option => <label key={option.value}><input type="checkbox" checked={Array.isArray(answer) && answer.includes(option.value)} onChange={event => {
    const current = Array.isArray(answer) ? answer : []
    onChange(event.target.checked ? [...current, option.value] : current.filter(item => item !== option.value))
  }} /><span>{option.label}</span></label>)}</fieldset>
  return <p role="alert">回收资料配置暂不支持，请稍后再试</p>
}

export function RestoredRecycleView({ snapshot, onGameChange, onValueChange, onAttachmentsAdd, onAttachmentRemove, onAttachmentRetry, onRecyclerToggle, onRequestConfirmation, onConfirm, onCancelConfirmation, onRetry, onCheckUnknown, onStartNew, onRefresh }: { snapshot: RecycleSnapshot } & Callbacks) {
  const { catalog, detail, values, attachments, selectedRecyclerIds, confirmation, targets, frozen, error, loading } = snapshot
  const unavailable = Boolean(detail && (!detail.available || detail.fields.length === 0))
  const attachmentPending = attachments.some(item => item.state !== 'uploaded')
  const refreshBlocked = recycleCatalogRefreshBlocked(snapshot)
  return <main className="restored-recycle-page">
    <PageHeader title="账号回收咨询" left={<Link className="restored-recycle-back" to="/profile" aria-label="返回我的"><ArrowLeft size={20} /></Link>} right={<IconButton label="刷新回收配置" disabled={refreshBlocked} onClick={onRefresh}><RefreshCw size={18} /></IconButton>} />
    <div className="restored-recycle-content">
      <p className="restored-recycle-intro">填写一次账号资料，再自行选择要咨询的回收商。每家会形成独立咨询与消息会话。</p>
      {refreshBlocked && !loading && !frozen && <p className="restored-recycle-hint">为避免清空草稿，填写或上传资料后暂不能刷新配置；请先完成本轮咨询，或清空所填资料、图片与回收商选择。</p>}
      {loading && <p role="status"><Spinner decorative />正在读取回收配置…</p>}
      {error && <p className="restored-recycle-error" role="alert">{error}</p>}
      {catalog && catalog.length === 0 && <SurfaceCard><Heading as="h2" variant="section">暂无可选回收游戏</Heading><p>请稍后刷新。</p></SurfaceCard>}
      {catalog && catalog.length > 0 && <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">选择游戏</Heading>
        <SelectField label="回收游戏" value={detail?.gameCode ?? ''} disabled={frozen || loading} onChange={event => onGameChange(event.target.value)} options={[{ value: '', label: '请选择游戏', disabled: true }, ...catalog.map(game => ({ value: game.gameCode, label: `${game.gameName}${game.available ? '' : '（暂不可用）'}` }))]} />
      </SurfaceCard>}
      {detail && <>
        {unavailable ? <SurfaceCard><p role="alert">{detail.blockedReason || '此游戏的回收资料配置暂不可用'}</p></SurfaceCard> : <>
          <SurfaceCard className="restored-recycle-section" aria-label="填写账号资料">
            <Heading as="h2" variant="section">账号资料</Heading>
            <p>资料版本 v1 · 模板版本 {detail.fieldTemplateVersion}</p>
            <div className="restored-recycle-fields">{detail.fields.map(field => <RecycleAnswer key={field.fieldKey} field={field} answer={values[field.fieldKey]} frozen={frozen} onChange={value => onValueChange(field.fieldKey, value)} />)}</div>
            {detail.attachmentsAvailable ? <DraftAttachments attachments={attachments} frozen={frozen} onAdd={onAttachmentsAdd} onRemove={onAttachmentRemove} onRetry={onAttachmentRetry} /> : <p className="restored-recycle-hint">当前服务暂未开放资料图片上传，可先提交文字资料</p>}
          </SurfaceCard>
          <SurfaceCard className="restored-recycle-section" aria-label="选择回收商">
            <Heading as="h2" variant="section">选择回收商</Heading>
            <p aria-live="polite">已选择 {selectedRecyclerIds.length} 家</p>
            {detail.recyclers.length === 0 ? <p>暂无可咨询的回收商</p> : <ul className="restored-recycle-merchants">{detail.recyclers.map(recycler => <li key={recycler.recyclerId}><label><input type="checkbox" checked={selectedRecyclerIds.includes(recycler.recyclerId)} disabled={frozen || !recycler.eligible} onChange={() => onRecyclerToggle(recycler.recyclerId)} /><span><b>{recycler.displayName}</b><small>回收商 ID：{recycler.recyclerId}</small>{!recycler.eligible && <small>{recyclerBlockedLabel(recycler.blockedReason)}</small>}</span></label></li>)}</ul>}
          </SurfaceCard>
          {!frozen && !confirmation && <Button className="restored-recycle-primary" fullWidth disabled={loading || selectedRecyclerIds.length === 0 || attachmentPending} onClick={onRequestConfirmation}>核对资料与回收商</Button>}
        </>}
      </>}
      {confirmation && !frozen && <SurfaceCard className="restored-recycle-confirm" role="region" aria-label="确认回收咨询">
        <Heading as="h2" variant="section">确认资料版本 v1</Heading>
        <p>{confirmation.gameName} · 模板版本 {confirmation.fieldTemplateVersion}</p>
        <dl>{confirmation.fields.map(field => <div key={field.fieldKey}><dt>{field.label}</dt><dd>{field.displayValue}</dd></div>)}</dl>
        <Heading as="h3" variant="section">资料图片</Heading>
        {confirmation.attachments.length === 0 ? <p>无</p> : <div className="restored-recycle-gallery">{confirmation.attachments.map((item, index) => <ProtectedRecycleImage key={item.mediaId} media={item} alt={`待发送资料图片 ${index + 1}`} />)}</div>}
        <Heading as="h3" variant="section">将发送给以下 {confirmation.selectedRecyclerIds.length} 家回收商</Heading>
        <ul>{confirmation.selectedRecyclerIds.map((id, index) => <li key={id}>{confirmation.selectedRecyclerNames[index]}（{id}）</li>)}</ul>
        <p>确认后资料与回收商名单将冻结，逐商独立提交。</p>
        <div className="restored-recycle-confirm-actions"><Button variant="secondary" onClick={onCancelConfirmation}>返回编辑</Button><Button className="restored-recycle-primary" onClick={onConfirm}>确认并逐商提交</Button></div>
      </SurfaceCard>}
      {frozen && <SurfaceCard className="restored-recycle-section" aria-label="咨询提交结果">
        <Heading as="h2" variant="section">逐商提交结果</Heading>
        <ul className="restored-recycle-results">{targets.map(target => <li key={target.recyclerId}>
          <b>{target.displayName}（{target.recyclerId}）</b>
          {target.state === 'success' && target.result ? <><p>已发送 · 咨询 {target.result.id} · 会话 {target.result.conversationId}</p><Link to={`/recycle/consultations/${encodeURIComponent(target.result.id)}`}>查看咨询资料</Link></> : <><p role={target.error ? 'alert' : 'status'}>{target.error || (target.state === 'pending' ? '等待提交' : target.state === 'sending' ? '正在确认结果…' : '提交失败')}</p>{target.state === 'failed' && <Button size="sm" variant="outline" onClick={() => onRetry(target.recyclerId)}>重试原操作</Button>}{target.state === 'unknown' && <Button size="sm" variant="outline" onClick={() => target.retryable ? onRetry(target.recyclerId) : onCheckUnknown(target.recyclerId)}>{target.retryable ? '重试原操作' : '查询原操作结果'}</Button>}</>}
        </li>)}</ul>
        {targets.some(target => ['pending', 'sending', 'unknown'].includes(target.state)) && <p>请先确认本轮结果未知的回收商，再开始新一轮咨询。</p>}
        {targets.some(target => target.state === 'failed') && <p>结束失败项后，原提交将不再从此页面重试；已发送的咨询仍可在消息中查看。</p>}
        <Button variant="secondary" fullWidth disabled={targets.some(target => ['pending', 'sending', 'unknown'].includes(target.state))} onClick={onStartNew}>{targets.some(target => target.state === 'failed') ? '结束失败项并开始新一轮' : '开始新一轮咨询'}</Button>
      </SurfaceCard>}
    </div>
  </main>
}

export function RestoredRecyclePage() {
  const { transport } = useRestoredClient()
  const controller = useMemo(() => transport ? getRestoredRecycleControllerForTransport(transport) : null, [transport])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), controller?.getSnapshot ?? (() => emptySnapshot), controller?.getSnapshot ?? (() => emptySnapshot))
  useEffect(() => { if (controller && controller.getSnapshot().catalog === null && !controller.getSnapshot().loading) void controller.loadCatalog() }, [controller])
  useEffect(() => () => controller?.pauseMediaUploads(), [controller])
  if (!controller) return <main className="restored-recycle-page"><PageHeader title="账号回收咨询" /><p role="alert">本地联动未连接，请重新连接</p></main>
  return <RestoredRecycleView snapshot={snapshot} onGameChange={code => { void controller.selectGame(code) }} onValueChange={controller.setValue} onAttachmentsAdd={files => { void controller.addAttachments(files) }} onAttachmentRemove={controller.removeAttachment} onAttachmentRetry={id => { void controller.retryAttachment(id) }} onRecyclerToggle={controller.toggleRecycler} onRequestConfirmation={() => { controller.requestConfirmation() }} onConfirm={() => { void controller.confirmAndSubmit() }} onCancelConfirmation={controller.cancelConfirmation} onRetry={id => { void controller.retryTarget(id) }} onCheckUnknown={id => { void controller.checkUnknownTarget(id) }} onStartNew={controller.startNew} onRefresh={() => { void controller.loadCatalog() }} />
}

const emptySnapshot: RecycleSnapshot = { catalog: null, detail: null, loading: true, error: null, values: {}, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false }

export function RestoredRecycleConsultationView({ consultation, loading, error, ownerRequestHref, onRefresh }: { consultation: RecycleProfileDisplay | null; loading: boolean; error: string | null; ownerRequestHref?: string; onRefresh: () => void }) {
  return <main className="restored-recycle-page">
    <PageHeader title="回收咨询资料" left={<Link className="restored-recycle-back" to="/message?tab=recycle" aria-label="返回回收消息"><ArrowLeft size={20} /></Link>} right={<IconButton label="刷新咨询资料" disabled={loading} onClick={onRefresh}><RefreshCw size={18} /></IconButton>} />
    <div className="restored-recycle-content">
      {loading && !consultation && <p role="status"><Spinner decorative />正在加载咨询资料…</p>}
      {error && <p className="restored-recycle-error" role="alert">{error}</p>}
      {consultation && <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">已发送的账号资料</Heading>
        <p>资料版本 v{consultation.profileVersion} · 状态 {consultation.status}</p>
        <dl className="restored-recycle-detail-list">
          <div><dt>咨询 ID</dt><dd>{consultation.id}</dd></div>
          <div><dt>提交批次 ID</dt><dd>{consultation.clientSubmissionId}</dd></div>
          {consultation.requestId && <div><dt>请求 ID</dt><dd>{consultation.requestId}</dd></div>}
          {consultation.revisionId && <div><dt>资料版本 ID</dt><dd>{consultation.revisionId}</dd></div>}
          <div><dt>游戏</dt><dd>{consultation.gameCode}</dd></div>
          <div><dt>回收商 ID</dt><dd>{consultation.recyclerId}</dd></div>
          <div><dt>模板版本</dt><dd>{consultation.fieldTemplateVersion}</dd></div>
          <div><dt>模板摘要</dt><dd className="restored-recycle-long">{consultation.fieldSchemaHash}</dd></div>
          <div><dt>会话 ID</dt><dd>{consultation.conversationId}</dd></div>
          <div><dt>创建时间</dt><dd>{consultation.createdAt}</dd></div>
          {consultation.profileFields.map(field => <div key={field.fieldKey}><dt>{field.label}（{field.fieldKey}）</dt><dd>{field.displayValue}</dd></div>)}
        </dl>
        <Heading as="h3" variant="section">资料图片</Heading>
        {consultation.attachments.length === 0 ? <p>无</p> : <><div className="restored-recycle-gallery">{consultation.attachments.map((item, index) => <ProtectedRecycleImage key={item.mediaId} media={item} alt={`回收资料图片 ${index + 1}`} />)}</div><p className="restored-recycle-hint">图片由当前会话授权读取，加载失败时可重试预览。</p></>}
        {ownerRequestHref && <Link className="restored-recycle-action" to={ownerRequestHref}>管理本请求与新商家分发</Link>}
        <Link className="restored-recycle-action" to={`/im/${encodeURIComponent(consultation.conversationId)}`}>进入消息会话</Link>
      </SurfaceCard>}
    </div>
  </main>
}

export function RestoredRecycleConsultationPage() {
  const { consultationId = '' } = useParams<{ consultationId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedRevisionId = searchParams.get('revision') || undefined
  const { transport, connection } = useRestoredClient()
  const identity = connection?.actor.managementId
  const api = useMemo(() => transport ? createRestoredRecycleApi(transport) : null, [transport])
  const distributionApi = useMemo(() => transport ? createRestoredRecycleDistributionApi(transport) : null, [transport])
  const controller = useMemo(() => api && distributionApi && consultationId ? createRestoredRecycleProfileController(consultationId, { readConsultation: api.readConsultation, readInitialProfile: distributionApi.readInitialProfile }) : null, [api, distributionApi, consultationId])
  const revisionController = useMemo(() => transport && consultationId ? getRestoredRecycleRevisionControllerForTransport(transport, consultationId, { identity }) : null, [transport, consultationId, identity])
  const disconnected = useMemo(() => ({ consultation: null, loading: false, error: '本地联动未连接，请重新连接', stale: false }), [])
  const state = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), controller?.getSnapshot ?? (() => disconnected), controller?.getSnapshot ?? (() => disconnected))
  const disconnectedRevisions = useMemo<RestoredRecycleRevisionSnapshot>(() => ({ loading: false, stale: false, error: '本地联动未连接，请重新连接', accessLost: false, revisions: [], canEdit: false, selectedRevision: null, editing: false, editContext: null, values: {}, attachments: [], selectedConsultationIds: [], savedRevision: null, saveState: 'idle', saveRetryable: false, confirmation: null, targets: [], busy: false }), [])
  const revisionState = useSyncExternalStore(revisionController?.subscribe ?? (() => () => {}), revisionController?.getSnapshot ?? (() => disconnectedRevisions), revisionController?.getSnapshot ?? (() => disconnectedRevisions))
  useEffect(() => {
    if (!controller) return undefined
    const syncVisibility = () => { void controller.setVisible(document.visibilityState === 'visible') }
    void controller.setVisible(document.visibilityState === 'visible'); void controller.start()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => { document.removeEventListener('visibilitychange', syncVisibility); controller.stop() }
  }, [controller])
  useEffect(() => {
    if (!revisionController) return undefined
    const syncVisibility = () => { void revisionController.setVisible(document.visibilityState === 'visible') }
    void revisionController.setVisible(document.visibilityState === 'visible'); void revisionController.start(requestedRevisionId)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => { document.removeEventListener('visibilitychange', syncVisibility); void revisionController.setVisible(false) }
  }, [revisionController])
  useEffect(() => { if (revisionController && requestedRevisionId && !revisionState.editing && revisionState.selectedRevision?.revisionId !== requestedRevisionId) void revisionController.selectRevision(requestedRevisionId) }, [requestedRevisionId, revisionController, revisionState.editing, revisionState.selectedRevision?.revisionId])
  const selectRevision = (revisionId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('revision', revisionId)
    setSearchParams(next, { replace: true })
    void revisionController?.selectRevision(revisionId)
  }
  const ownerRequestId = revisionState.canEdit ? state.consultation?.requestId || revisionState.revisions[0]?.requestId : undefined
  const ownerRevisionId = state.consultation?.revisionId || revisionState.selectedRevision?.revisionId
  const ownerRequestHref = ownerRequestId ? `/recycle/requests/${encodeURIComponent(ownerRequestId)}${ownerRevisionId ? `?revision=${encodeURIComponent(ownerRevisionId)}` : ''}` : undefined
  return <>
    <RestoredRecycleConsultationView {...state} ownerRequestHref={ownerRequestHref} onRefresh={() => { void controller?.refresh(); void revisionController?.refresh() }} />
    <RestoredRecycleRevisionView snapshot={revisionState} onSelectRevision={selectRevision} onBeginEdit={() => { void revisionController?.beginEdit() }} onCancelEdit={() => revisionController?.cancelEdit()} onValueChange={(key, value) => revisionController?.setValue(key, value)} onAttachmentsAdd={files => { void revisionController?.addAttachments(files) }} onAttachmentRemove={id => revisionController?.removeAttachment(id)} onAttachmentRetry={id => { void revisionController?.retryAttachment(id) }} onSave={() => { void revisionController?.save() }} onCheckUnknownSave={() => { void revisionController?.checkUnknownSave() }} onRetrySave={() => { void revisionController?.retrySave() }} onConsultationToggle={id => revisionController?.toggleConsultation(id)} onRequestDeliveryConfirmation={() => revisionController?.requestDeliveryConfirmation()} onCancelDeliveryConfirmation={() => revisionController?.cancelDeliveryConfirmation()} onConfirmDelivery={() => { void revisionController?.confirmDelivery() }} onCheckUnknownTarget={id => { void revisionController?.checkUnknownTarget(id) }} onRetryTarget={id => { void revisionController?.retryTarget(id) }} />
  </>
}

type RevisionViewCallbacks = {
  onSelectRevision: (revisionId: string) => void
  onBeginEdit: () => void
  onCancelEdit: () => void
  onValueChange: (fieldKey: string, value: RecycleRevisionValue | undefined) => void
  onAttachmentsAdd: (files: File[]) => void
  onAttachmentRemove: (localId: string) => void
  onAttachmentRetry: (localId: string) => void
  onSave: () => void
  onCheckUnknownSave: () => void
  onRetrySave: () => void
  onConsultationToggle: (consultationId: string) => void
  onRequestDeliveryConfirmation: () => void
  onCancelDeliveryConfirmation: () => void
  onConfirmDelivery: () => void
  onCheckUnknownTarget: (consultationId: string) => void
  onRetryTarget: (consultationId: string) => void
}

function RevisionDraftAttachments({ attachments, frozen, onAdd, onRemove, onRetry }: { attachments: RecycleRevisionDraftAttachment[]; frozen: boolean; onAdd: (files: File[]) => void; onRemove: (id: string) => void; onRetry: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return <section className="restored-recycle-attachments" aria-busy={attachments.some(item => item.state === 'uploading')}>
    <div><Heading as="h3" variant="subsection">资料图片</Heading><small>{attachments.length} / 15</small></div>
    <p>JPG、PNG、WebP；每张严格小于 1MB，最多 15 张。</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={frozen || attachments.length >= 15} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) onAdd(files) }} />
    <Button type="button" variant="outline" disabled={frozen || attachments.length >= 15} onClick={() => input.current?.click()}>新增草稿图片</Button>
    {attachments.length > 0 && <ul>{attachments.map((item, index) => <li key={item.localId}>
      {item.media.mediaId && item.media.contentUrl && <ProtectedRecycleImage media={item.media} alt={`版本草稿图片 ${index + 1}`} />}
      <span><b>{item.fileName}</b><small role={item.error ? 'alert' : 'status'}>{item.state === 'uploading' ? '上传中' : item.state === 'uploaded' ? '已加入草稿' : item.error || '上传未完成'}</small></span>
      {(item.state === 'failed' || item.state === 'unknown') && <Button size="sm" variant="outline" onClick={() => onRetry(item.localId)}>重试上传原操作</Button>}
      {!frozen && <Button size="sm" variant="secondary" onClick={() => onRemove(item.localId)}>删除草稿图片</Button>}
    </li>)}</ul>}
  </section>
}

export function RestoredRecycleRevisionView({ snapshot, versionLabelScope = 'consultation', onSelectRevision, onBeginEdit, onCancelEdit, onValueChange, onAttachmentsAdd, onAttachmentRemove, onAttachmentRetry, onSave, onCheckUnknownSave, onRetrySave, onConsultationToggle, onRequestDeliveryConfirmation, onCancelDeliveryConfirmation, onConfirmDelivery, onCheckUnknownTarget, onRetryTarget }: { snapshot: RestoredRecycleRevisionSnapshot; versionLabelScope?: 'consultation' | 'request' } & RevisionViewCallbacks) {
  const location = useLocation()
  const { loading, stale, error, accessLost, revisions, canEdit, selectedRevision, editing, editContext, values, attachments, selectedConsultationIds, savedRevision, saveState, saveRetryable, confirmation, targets, busy } = snapshot
  const successfulTargetCount = targets.filter(target => target.state === 'success').length
  const deliveryFinished = targets.length > 0 && successfulTargetCount === targets.length
  const targetsSettled = targets.length > 0 && targets.every(target => target.state === 'success' || target.state === 'failed')
  const settledWithFailures = targetsSettled && targets.some(target => target.state === 'failed')
  return <section className="restored-recycle-version-shell" aria-label="回收资料版本">
    <div className="restored-recycle-content">
      <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">资料版本</Heading>
        {loading && revisions.length === 0 && <p role="status"><Spinner decorative />正在加载资料版本…</p>}
        {error && <p className="restored-recycle-error" role="alert">{error}</p>}
        {stale && !accessLost && <p className="restored-recycle-hint">网络异常，当前草稿与展示数据已保留，但可能已过期。</p>}
        {!loading && revisions.length === 0 && !accessLost && <p>尚无已保存的新版本。</p>}
        {revisions.length > 0 && <SelectField label="选择具体版本" value={selectedRevision?.revisionId ?? ''} disabled={editing || busy} onChange={event => onSelectRevision(event.target.value)} options={[{ value: '', label: '请选择资料版本', disabled: true }, ...revisions.map(item => ({ value: item.revisionId, label: `版本 v${item.revisionNumber}${versionLabelScope === 'request' ? '（已保存）' : item.deliveredAt ? '（已发送给本咨询）' : '（尚未发送）'}` }))]} />}
        {revisions.length > 0 && <nav aria-label="资料版本直达链接"><ul className="restored-recycle-version-links">{revisions.map(item => <li key={item.revisionId}><Link to={`${location.pathname}?revision=${encodeURIComponent(item.revisionId)}`} aria-current={selectedRevision?.revisionId === item.revisionId ? 'page' : undefined} aria-disabled={editing || busy} onClick={event => { if (editing || busy) event.preventDefault() }}>版本 v{item.revisionNumber}</Link></li>)}</ul></nav>}
        {selectedRevision && !editing && <div className="restored-recycle-version-detail">
          <p><b>版本 v{selectedRevision.revisionNumber}</b> · {selectedRevision.createdAt}</p>
          <dl className="restored-recycle-detail-list">{selectedRevision.profileFields.map(field => <div key={field.fieldKey}><dt>{field.label}</dt><dd>{field.displayValue}</dd></div>)}</dl>
          <Heading as="h3" variant="subsection">版本图片</Heading>
          {selectedRevision.attachments.length === 0 ? <p>无</p> : <div className="restored-recycle-gallery">{selectedRevision.attachments.map((item, index) => <ProtectedRecycleImage key={item.mediaId} media={item} alt={`版本 v${selectedRevision.revisionNumber} 资料图片 ${index + 1}`} />)}</div>}
        </div>}
        {canEdit && !editing && <Button type="button" fullWidth disabled={busy} onClick={onBeginEdit}>基于原模板编辑新版本</Button>}
      </SurfaceCard>

      {editing && editContext && <SurfaceCard className="restored-recycle-section" aria-label="编辑资料新版本">
        <Heading as="h2" variant="section">编辑新版本</Heading>
        <p className="restored-recycle-hint">使用原请求的历史模板（模板版本 {editContext.fieldTemplateVersion}），不会套用当前配置。</p>
        <div className="restored-recycle-fields">{editContext.fields.map(field => <RecycleAnswer key={field.fieldKey} field={field} answer={values[field.fieldKey]} frozen={busy || saveState === 'unknown' || targets.length > 0} onChange={value => onValueChange(field.fieldKey, value)} />)}</div>
        <RevisionDraftAttachments attachments={attachments} frozen={busy || saveState === 'unknown' || targets.length > 0} onAdd={onAttachmentsAdd} onRemove={onAttachmentRemove} onRetry={onAttachmentRetry} />
        <div className="restored-recycle-confirm-actions"><Button variant="secondary" disabled={busy || saveState === 'unknown' || targets.some(target => target.state !== 'success' && target.state !== 'failed')} onClick={onCancelEdit}>{settledWithFailures ? '结束失败项并结束本次更新' : deliveryFinished ? '结束本次更新' : '放弃本次编辑'}</Button><Button disabled={busy || saveState === 'saved' || targets.length > 0 || attachments.some(item => item.state !== 'uploaded')} onClick={onSave}>{saveState === 'saving' ? '正在保存…' : '保存新版本'}</Button></div>
        {saveState === 'unknown' && <div className="restored-recycle-unknown" role="status"><p>保存结果未知，必须先查询原操作，不会自动重发。</p><Button variant="outline" onClick={onCheckUnknownSave} disabled={busy}>查询原保存结果</Button>{saveRetryable && <Button variant="outline" onClick={onRetrySave} disabled={busy}>重试原保存操作</Button>}</div>}
        {saveState === 'saved' && savedRevision && <p className="restored-recycle-saved" role="status">{targets.length === 0 ? '已保存，尚未发送' : `已保存 · 已发送 ${successfulTargetCount}/${targets.length} 家，请查看逐家结果`} · 版本 v{savedRevision.revisionNumber}</p>}
      </SurfaceCard>}

      {editing && editContext && savedRevision && <SurfaceCard className="restored-recycle-section" aria-label="选择已有咨询">
        <Heading as="h2" variant="section">选择本次更新的已有咨询</Heading>
        <p aria-live="polite">已选择 {selectedConsultationIds.length} 家</p>
        <p className="restored-recycle-hint">默认不选任何咨询；仅可选择该请求之前已成功咨询的回收商。</p>
        <ul className="restored-recycle-merchants">{editContext.consultations.map(item => <li key={item.consultationId}><label><input type="checkbox" checked={selectedConsultationIds.includes(item.consultationId)} disabled={busy || targets.length > 0} onChange={() => onConsultationToggle(item.consultationId)} /><span><b>{item.recyclerName}</b><small>咨询 ID：{item.consultationId}</small><small>编辑时已收到 {item.deliveredRevisionId}</small></span></label></li>)}</ul>
        {!confirmation && targets.length === 0 && <Button fullWidth disabled={busy || selectedConsultationIds.length === 0} onClick={onRequestDeliveryConfirmation}>核对发送名单</Button>}
      </SurfaceCard>}

      {confirmation && <SurfaceCard className="restored-recycle-confirm" aria-label="确认版本发送">
        <Heading as="h2" variant="section">确认发送版本 v{confirmation.revisionNumber}</Heading>
        <p>本批次将固定发送以下名单：</p>
        <ul>{confirmation.selectedConsultationNames.map((name, index) => <li key={confirmation.selectedConsultationIds[index]}>{name}（{confirmation.selectedConsultationIds[index]}）</li>)}</ul>
        <div className="restored-recycle-confirm-actions"><Button variant="secondary" disabled={busy} onClick={onCancelDeliveryConfirmation}>返回选择</Button><Button disabled={busy} onClick={onConfirmDelivery}>确认并逐家发送</Button></div>
      </SurfaceCard>}

      {targets.length > 0 && <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">逐家发送结果</Heading>
        <ul className="restored-recycle-results">{targets.map(target => <li key={target.consultationId}><b>{target.recyclerName}</b><p role="status">{target.state === 'success' ? '已发送' : target.state === 'sending' ? '处理中…' : target.state === 'failed' ? `发送失败：${target.error}` : target.state === 'unknown' ? `结果未知：${target.error}` : '等待发送'}</p>{target.result && <><small>消息 ID：{target.result.messageId}</small><Link to={`/im/${encodeURIComponent(target.conversationId)}`}>进入消息会话</Link></>}{target.state === 'unknown' && !target.retryable && <Button size="sm" variant="outline" onClick={() => onCheckUnknownTarget(target.consultationId)}>查询原发送结果</Button>}{(target.state === 'failed' || (target.state === 'unknown' && target.retryable)) && <Button size="sm" variant="outline" onClick={() => onRetryTarget(target.consultationId)}>重试原发送操作</Button>}</li>)}</ul>
      </SurfaceCard>}
    </div>
  </section>
}
