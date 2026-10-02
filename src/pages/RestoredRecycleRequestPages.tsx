import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, Heading, IconButton, PageHeader, SelectField, Spinner, SurfaceCard } from '../components/ui'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { getRestoredRecycleControllerForTransport } from '../linked/restoredRecycleController'
import {
  getRestoredRecycleNewMerchantControllerForTransport,
  getRestoredRecycleRequestControllerForTransport,
  type RestoredRecycleNewMerchantSnapshot,
  type RestoredRecycleRequestSnapshot,
} from '../linked/restoredRecycleDistributionController'
import { getRestoredRecycleRequestRevisionControllerForTransport, type RestoredRecycleRevisionSnapshot } from '../linked/restoredRecycleRevisionController'
import type { RecycleRevisionValue } from '../linked/restoredRecycleRevisionApi'
import { DraftAttachments, RecycleAnswer, recyclerBlockedLabel, RestoredRecycleRevisionView } from './RestoredRecyclePages'
import '../styles/restored-recycle.css'

type HomeCallbacks = {
  onGameChange: (gameCode: string) => void
  onValueChange: (fieldKey: string, value: RecycleRevisionValue | undefined) => void
  onAttachmentsAdd: (files: File[]) => void
  onAttachmentRemove: (localId: string) => void
  onAttachmentRetry: (localId: string) => void
  onSave: () => void
  onCheckUnknownSave: () => void
  onRetrySave: () => void
  onNewRequest: () => void
  onRefresh: () => void
}

type PendingRequestState = Pick<RestoredRecycleRequestSnapshot, 'saveState'>
type PendingRevisionState = Pick<RestoredRecycleRevisionSnapshot, 'saveState' | 'targets'>
type PendingDistributionState = Pick<RestoredRecycleNewMerchantSnapshot, 'confirmationState' | 'targets'>

export function shouldProtectRecycleUnload(request: PendingRequestState | null, revision: PendingRevisionState | null, distribution: PendingDistributionState | null) {
  const unresolved = (state: string) => ['pending', 'sending', 'unknown'].includes(state.toLowerCase())
  return Boolean(request && ['saving', 'unknown'].includes(request.saveState))
    || Boolean(revision && (['saving', 'unknown'].includes(revision.saveState) || revision.targets.some(target => unresolved(target.state))))
    || Boolean(distribution && (['confirming', 'unknown'].includes(distribution.confirmationState) || distribution.targets.some(target => unresolved(target.state))))
}

function useRecycleUnloadProtection(active: boolean) {
  useEffect(() => {
    if (!active) return undefined
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [active])
}

export function RestoredRecycleRequestHomeView({ snapshot, onGameChange, onValueChange, onAttachmentsAdd, onAttachmentRemove, onAttachmentRetry, onSave, onCheckUnknownSave, onRetrySave, onNewRequest, onRefresh }: { snapshot: RestoredRecycleRequestSnapshot } & HomeCallbacks) {
  const { form, requests, loadingRequests, error, accessLost, saveState, saveRetryable, savedRequest } = snapshot
  const busy = form.loading || loadingRequests || saveState === 'saving'
  return <main className="restored-recycle-page">
    <PageHeader title="保存回收资料" left={<Link className="restored-recycle-back" to="/profile" aria-label="返回我的"><ArrowLeft size={20} /></Link>} right={<IconButton label="刷新本人回收请求" disabled={busy || saveState === 'unknown'} onClick={onRefresh}><RefreshCw size={18} /></IconButton>} />
    <div className="restored-recycle-content">
      <p className="restored-recycle-intro">先选择游戏并填写账号资料。保存不代表发送，稍后进入请求详情再明确选择回收商。</p>
      <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">填写并保存</Heading>
        <p className="restored-recycle-hint">保存不会创建咨询群、发送消息或授权商家读取。</p>
        {form.loading && <p role="status"><Spinner decorative />正在读取回收配置…</p>}
        {(error || form.error) && <p className="restored-recycle-error" role="alert">{error || form.error}</p>}
        {accessLost && <p className="restored-recycle-hint">当前身份已失效，端上资料和操作状态已清除。</p>}
        {form.catalog && form.catalog.length === 0 && <p>暂无可选回收游戏，请稍后刷新。</p>}
        {form.catalog && form.catalog.length > 0 && <SelectField label="回收游戏" value={form.detail?.gameCode ?? ''} disabled={busy || saveState === 'unknown'} onChange={event => onGameChange(event.target.value)} options={[{ value: '', label: '请选择游戏', disabled: true }, ...form.catalog.map(game => ({ value: game.gameCode, label: `${game.gameName}${game.available ? '' : '（暂不可用）'}` }))]} />}
        {form.detail && (!form.detail.available || form.detail.fields.length === 0) && <p role="alert">{form.detail.blockedReason || '此游戏的回收资料配置暂不可用'}</p>}
        {form.detail?.available && form.detail.fields.length > 0 && <>
          <p>资料版本 v1 · 模板版本 {form.detail.fieldTemplateVersion}</p>
          <div className="restored-recycle-fields">{form.detail.fields.map(field => <RecycleAnswer key={field.fieldKey} field={field} answer={form.values[field.fieldKey]} frozen={busy || saveState === 'unknown'} onChange={value => onValueChange(field.fieldKey, value)} />)}</div>
          {form.detail.attachmentsAvailable ? <DraftAttachments attachments={form.attachments} frozen={busy || saveState === 'unknown'} onAdd={onAttachmentsAdd} onRemove={onAttachmentRemove} onRetry={onAttachmentRetry} /> : <p className="restored-recycle-hint">当前服务暂未开放资料图片上传，可先保存文字资料</p>}
          <Button fullWidth disabled={busy || saveState === 'unknown' || form.attachments.some(item => item.state !== 'uploaded')} onClick={onSave}>{saveState === 'saving' ? '正在保存…' : '保存资料，稍后选择回收商'}</Button>
        </>}
        {saveState === 'saving' && <p className="restored-recycle-hint" role="status">结果尚未确认，请先查询原操作，暂勿刷新或关闭页面。</p>}
        {saveState === 'unknown' && <div className="restored-recycle-unknown" role="status"><p>保存结果尚未确认，必须先查询原操作，暂勿刷新或关闭页面；不会自动重发。</p><Button variant="outline" disabled={busy} onClick={onCheckUnknownSave}>查询原保存结果</Button>{saveRetryable && <Button variant="outline" disabled={busy} onClick={onRetrySave}>重试原保存操作</Button>}</div>}
        {saveState === 'saved' && savedRequest && <div className="restored-recycle-saved" role="status"><p>资料已保存，尚未选择或发送给任何商家。</p><Link className="restored-recycle-action" to={`/recycle/requests/${encodeURIComponent(savedRequest.requestId)}`}>打开请求并选择回收商</Link><Button variant="secondary" onClick={onNewRequest}>填写另一个账号</Button></div>}
      </SurfaceCard>

      <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">我已保存的回收请求</Heading>
        {loadingRequests && requests.length === 0 && <p role="status"><Spinner decorative />正在读取已保存请求…</p>}
        {!loadingRequests && requests.length === 0 ? <p>尚无已保存的回收请求。</p> : <ul className="restored-recycle-request-list">{requests.map(item => <li key={item.requestId}><div><b>{item.gameCode}</b><small>最新资料版本 v{item.latestProfileVersion}</small><small>{item.createdAt}</small></div><Link to={`/recycle/requests/${encodeURIComponent(item.requestId)}`}>打开请求</Link></li>)}</ul>}
      </SurfaceCard>
    </div>
  </main>
}

export function RestoredRecycleRequestPage() {
  const { transport, connection } = useRestoredClient()
  const identity = connection?.actor.managementId
  const formController = useMemo(() => transport ? getRestoredRecycleControllerForTransport(transport) : null, [transport])
  // W02：把服务端会话主体注入命令持久化，硬刷新后凭同一主体恢复未决命令。
  const controller = useMemo(() => transport ? getRestoredRecycleRequestControllerForTransport(transport, { identity }) : null, [transport, identity])
  const disconnected = useMemo<RestoredRecycleRequestSnapshot>(() => ({ form: { catalog: null, detail: null, loading: false, error: null, values: {}, attachments: [], selectedRecyclerIds: [], confirmation: null, targets: [], frozen: false }, requests: [], loadingRequests: false, error: '本地联动未连接，请重新连接', accessLost: false, saveState: 'idle', saveRetryable: false, savedRequest: null }), [])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => undefined), controller?.getSnapshot ?? (() => disconnected), controller?.getSnapshot ?? (() => disconnected))
  useRecycleUnloadProtection(shouldProtectRecycleUnload(snapshot, null, null))
  useEffect(() => { if (!controller) return undefined; void controller.start(); return () => controller.stop() }, [controller])
  useEffect(() => { if (formController && formController.getSnapshot().catalog === null && !formController.getSnapshot().loading) void formController.loadCatalog(); return () => formController?.pauseMediaUploads() }, [formController])
  if (!controller || !formController) return <RestoredRecycleRequestHomeView snapshot={disconnected} onGameChange={() => undefined} onValueChange={() => undefined} onAttachmentsAdd={() => undefined} onAttachmentRemove={() => undefined} onAttachmentRetry={() => undefined} onSave={() => undefined} onCheckUnknownSave={() => undefined} onRetrySave={() => undefined} onNewRequest={() => undefined} onRefresh={() => undefined} />
  return <RestoredRecycleRequestHomeView snapshot={snapshot} onGameChange={code => { void formController.selectGame(code) }} onValueChange={formController.setValue} onAttachmentsAdd={files => { void formController.addAttachments(files) }} onAttachmentRemove={formController.removeAttachment} onAttachmentRetry={id => { void formController.retryAttachment(id) }} onSave={() => { void controller.saveRequest() }} onCheckUnknownSave={() => { void controller.checkUnknownSave() }} onRetrySave={() => { void controller.retrySave() }} onNewRequest={controller.newRequest} onRefresh={() => { void controller.refreshRequests(); if (formController.getSnapshot().catalog === null) void formController.loadCatalog() }} />
}

type MerchantCallbacks = {
  onSelectRevision: (revisionId: string) => void
  onRecyclerToggle: (recyclerId: string) => void
  onRequestConfirmation: () => void
  onCancelConfirmation: () => void
  onConfirm: () => void
  onCheckUnknownConfirmation: () => void
  onRetryConfirmation: () => void
  onCheckUnknownTarget: (recyclerId: string) => void
  onRetryTarget: (recyclerId: string) => void
  onFinish: () => void
  onRefresh: () => void
}

export function RestoredRecycleNewMerchantView({ snapshot, onSelectRevision, onRecyclerToggle, onRequestConfirmation, onCancelConfirmation, onConfirm, onCheckUnknownConfirmation, onRetryConfirmation, onCheckUnknownTarget, onRetryTarget, onFinish, onRefresh }: { snapshot: RestoredRecycleNewMerchantSnapshot } & MerchantCallbacks) {
  const { loading, error, accessLost, revisions, selectedRevisionId, availableRecyclers, selectedRecyclerIds, confirmation, confirmationState, confirmationRetryable, targets, busy } = snapshot
  const resolved = targets.length > 0 && targets.every(item => item.state === 'SUCCESS' || item.state === 'FAILED')
  const reviewButton = useRef<HTMLButtonElement>(null)
  const cancelConfirmationButton = useRef<HTMLButtonElement>(null)
  const restoreReviewFocus = useRef(false)
  useEffect(() => {
    if (confirmation) cancelConfirmationButton.current?.focus()
    else if (restoreReviewFocus.current) { restoreReviewFocus.current = false; reviewButton.current?.focus() }
  }, [confirmation])
  return <section className="restored-recycle-version-shell" aria-label="分发给新回收商">
    <div className="restored-recycle-content">
      <SurfaceCard className="restored-recycle-section">
        <div className="restored-recycle-section-heading"><Heading as="h2" variant="section">分发给新回收商</Heading><IconButton label="刷新新商家与版本" disabled={busy || confirmationState === 'unknown' || targets.length > 0} onClick={onRefresh}><RefreshCw size={18} /></IconButton></div>
        <p className="restored-recycle-hint">默认不选任何商家；保存版本本身不会发送。已有咨询请使用上方的定向更新。</p>
        {loading && revisions.length === 0 && <p role="status"><Spinner decorative />正在读取请求与新商家…</p>}
        {error && <p className="restored-recycle-error" role="alert">{error}</p>}
        {accessLost && <p>当前身份已失去该请求的读写权限，已清除页面中的资料。</p>}
        {revisions.length > 0 && <SelectField label="选择要分发的已保存版本" value={selectedRevisionId} disabled={busy || targets.length > 0 || confirmationState === 'unknown'} onChange={event => onSelectRevision(event.target.value)} options={[{ value: '', label: '请选择资料版本', disabled: true }, ...revisions.map(item => ({ value: item.revisionId, label: `资料版本 v${item.profileVersion}` }))]} />}
        <p aria-live="polite">已选择 {selectedRecyclerIds.length} 家新商家</p>
        {availableRecyclers.length === 0 && !loading ? <p>暂无可首次分发的新回收商。</p> : <ul className="restored-recycle-merchants">{availableRecyclers.map(item => <li key={item.recyclerId}><label><input type="checkbox" checked={selectedRecyclerIds.includes(item.recyclerId)} disabled={busy || targets.length > 0 || confirmationState === 'unknown' || !item.eligible} onChange={() => onRecyclerToggle(item.recyclerId)} /><span><b>{item.displayName}</b><small>{item.recyclerId}</small>{!item.eligible && <small>{recyclerBlockedLabel(item.blockedReason)}</small>}</span></label></li>)}</ul>}
        {!confirmation && targets.length === 0 && confirmationState !== 'unknown' && <Button ref={reviewButton} fullWidth disabled={busy || !selectedRevisionId || selectedRecyclerIds.length === 0} onClick={onRequestConfirmation}>核对版本与新商家名单</Button>}
      </SurfaceCard>

      {confirmation && <SurfaceCard className="restored-recycle-confirm" aria-label="确认首次分发">
        <Heading as="h2" variant="section">确认首次分发资料版本 v{confirmation.profileVersion}</Heading>
        <p>共 {confirmation.selectedRecyclerIds.length} 家；确认后名单与资料版本将固定，并逐家执行。</p>
        <ul>{confirmation.selectedRecyclerNames.map((name, index) => <li key={confirmation.selectedRecyclerIds[index]}>{name}（{confirmation.selectedRecyclerIds[index]}）</li>)}</ul>
        <div className="restored-recycle-confirm-actions"><Button ref={cancelConfirmationButton} variant="secondary" disabled={busy} onClick={() => { restoreReviewFocus.current = true; onCancelConfirmation() }}>返回选择</Button><Button disabled={busy} onClick={onConfirm}>确认并逐家分发</Button></div>
      </SurfaceCard>}

      {confirmationState === 'unknown' && <SurfaceCard className="restored-recycle-section restored-recycle-unknown" role="status"><Heading as="h2" variant="section">分发确认结果未知</Heading><p>必须先查询原分发批次，不会用新操作号重新确认。</p><Button variant="outline" disabled={busy} onClick={onCheckUnknownConfirmation}>查询原分发结果</Button>{confirmationRetryable && <Button variant="outline" disabled={busy} onClick={onRetryConfirmation}>重试原分发确认</Button>}</SurfaceCard>}

      {targets.length > 0 && <SurfaceCard className="restored-recycle-section">
        <Heading as="h2" variant="section">逐家分发结果</Heading>
        <ul className="restored-recycle-results">{targets.map(target => <li key={target.recyclerId}><b>{target.recyclerName}</b><p role="status">{target.state === 'SUCCESS' ? '已分发' : target.state === 'SENDING' ? '处理中…' : target.state === 'FAILED' ? `分发失败：${target.localError || target.errorMessage}` : target.state === 'UNKNOWN' ? `结果未知：${target.localError}` : '等待分发'}</p>{target.consultationId && <Link to={`/recycle/consultations/${encodeURIComponent(target.consultationId)}?revision=${encodeURIComponent(selectedRevisionId)}`}>查看该商家收到的资料</Link>}{target.conversationId && <Link to={`/im/${encodeURIComponent(target.conversationId)}`}>进入消息会话</Link>}{target.state === 'UNKNOWN' && !target.retryable && <Button size="sm" variant="outline" onClick={() => onCheckUnknownTarget(target.recyclerId)}>查询原目标结果</Button>}{(target.state === 'FAILED' || (target.state === 'UNKNOWN' && target.retryable)) && <Button size="sm" variant="outline" onClick={() => onRetryTarget(target.recyclerId)}>重试原分发操作</Button>}</li>)}</ul>
        <Button fullWidth variant="secondary" disabled={!resolved || busy} onClick={onFinish}>结束本次分发</Button>
      </SurfaceCard>}
    </div>
  </section>
}

const disconnectedRevisions: RestoredRecycleRevisionSnapshot = { loading: false, stale: false, error: '本地联动未连接，请重新连接', accessLost: false, revisions: [], canEdit: false, selectedRevision: null, editing: false, editContext: null, values: {}, attachments: [], selectedConsultationIds: [], savedRevision: null, saveState: 'idle', saveRetryable: false, confirmation: null, targets: [], busy: false }
const disconnectedDistribution: RestoredRecycleNewMerchantSnapshot = { loading: false, error: '本地联动未连接，请重新连接', accessLost: false, context: null, revisions: [], selectedRevisionId: '', availableRecyclers: [], selectedRecyclerIds: [], confirmation: null, confirmationState: 'idle', confirmationRetryable: false, targets: [], busy: false }

export function RestoredRecycleOwnerRequestPage() {
  const { requestId = '' } = useParams<{ requestId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedRevisionId = searchParams.get('revision') || undefined
  const { transport, connection } = useRestoredClient()
  const identity = connection?.actor.managementId
  const revisionController = useMemo(() => transport && requestId ? getRestoredRecycleRequestRevisionControllerForTransport(transport, requestId, { identity }) : null, [transport, requestId, identity])
  const distributionController = useMemo(() => transport && requestId ? getRestoredRecycleNewMerchantControllerForTransport(transport, requestId, { identity }) : null, [transport, requestId, identity])
  const revisionState = useSyncExternalStore(revisionController?.subscribe ?? (() => () => undefined), revisionController?.getSnapshot ?? (() => disconnectedRevisions), revisionController?.getSnapshot ?? (() => disconnectedRevisions))
  const distributionState = useSyncExternalStore(distributionController?.subscribe ?? (() => () => undefined), distributionController?.getSnapshot ?? (() => disconnectedDistribution), distributionController?.getSnapshot ?? (() => disconnectedDistribution))
  const pendingCommand = shouldProtectRecycleUnload(null, revisionState, distributionState)
  useRecycleUnloadProtection(pendingCommand)
  useEffect(() => { if (!revisionController) return undefined; void revisionController.setVisible(true); void revisionController.start(requestedRevisionId); return () => { void revisionController.setVisible(false) } }, [revisionController])
  useEffect(() => { if (!distributionController) return undefined; void distributionController.start(); return () => distributionController.stop() }, [distributionController])
  useEffect(() => { if (revisionController && requestedRevisionId && !revisionState.editing && revisionState.selectedRevision?.revisionId !== requestedRevisionId) void revisionController.selectRevision(requestedRevisionId); distributionController?.selectRevision(requestedRevisionId ?? '') }, [requestedRevisionId, revisionController, distributionController, revisionState.editing, revisionState.selectedRevision?.revisionId, distributionState.revisions.length])
  useEffect(() => { if (revisionState.savedRevision) void distributionController?.refresh() }, [revisionState.savedRevision?.revisionId])
  const selectRevision = (revisionId: string) => {
    const next = new URLSearchParams(searchParams); next.set('revision', revisionId); setSearchParams(next, { replace: true })
    void revisionController?.selectRevision(revisionId); distributionController?.selectRevision(revisionId)
  }
  return <main className="restored-recycle-page">
    <PageHeader title="已保存回收请求" left={<Link className="restored-recycle-back" to="/recycle" aria-label="返回已保存请求"><ArrowLeft size={20} /></Link>} />
    {pendingCommand && <p className="restored-recycle-error" role="status">结果尚未确认，请先查询原操作，暂勿刷新或关闭页面。</p>}
    <RestoredRecycleRevisionView versionLabelScope="request" snapshot={revisionState} onSelectRevision={selectRevision} onBeginEdit={() => { void revisionController?.beginEdit() }} onCancelEdit={() => revisionController?.cancelEdit()} onValueChange={(key, value) => revisionController?.setValue(key, value)} onAttachmentsAdd={files => { void revisionController?.addAttachments(files) }} onAttachmentRemove={id => revisionController?.removeAttachment(id)} onAttachmentRetry={id => { void revisionController?.retryAttachment(id) }} onSave={() => { void revisionController?.save() }} onCheckUnknownSave={() => { void revisionController?.checkUnknownSave() }} onRetrySave={() => { void revisionController?.retrySave() }} onConsultationToggle={id => revisionController?.toggleConsultation(id)} onRequestDeliveryConfirmation={() => revisionController?.requestDeliveryConfirmation()} onCancelDeliveryConfirmation={() => revisionController?.cancelDeliveryConfirmation()} onConfirmDelivery={() => { void revisionController?.confirmDelivery() }} onCheckUnknownTarget={id => { void revisionController?.checkUnknownTarget(id) }} onRetryTarget={id => { void revisionController?.retryTarget(id) }} />
    <RestoredRecycleNewMerchantView snapshot={distributionState} onSelectRevision={selectRevision} onRecyclerToggle={id => distributionController?.toggleRecycler(id)} onRequestConfirmation={() => distributionController?.requestConfirmation()} onCancelConfirmation={() => distributionController?.cancelConfirmation()} onConfirm={() => { void distributionController?.confirmDistribution() }} onCheckUnknownConfirmation={() => { void distributionController?.checkUnknownConfirmation() }} onRetryConfirmation={() => { void distributionController?.retryConfirmation() }} onCheckUnknownTarget={id => { void distributionController?.checkUnknownTarget(id) }} onRetryTarget={id => { void distributionController?.retryTarget(id) }} onFinish={() => { void (async () => { if (await distributionController?.finish()) await revisionController?.refresh() })() }} onRefresh={() => { void revisionController?.refresh(); void distributionController?.refresh() }} />
  </main>
}
