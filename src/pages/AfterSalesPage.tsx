import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight, Image as ImageIcon, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AFTERSALE_TABS, countAfterSales, filterAfterSales, getAfterSaleStatusLabel, isAfterSaleTab, type AfterSaleTab } from '../components/afterSalesModel'
import { AfterSaleMaterialPicker as MaterialPicker } from '../components/AfterSaleMaterialPicker'
import { assetPath } from '../components/assetPath'
import { formatOrderMoney } from '../components/orderModel'
import { Button, Dialog, Heading, PageHeader, SearchField, StatusBadge, Tabs, TextAreaField, Toast } from '../components/ui'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { resolveAftersalesDetailNodeId } from '../data/aftersalesPageSpecs'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { afterSaleRepository } from '../repository/afterSaleRepository'
import { orderRepository } from '../repository/orderRepository'
import type { AfterSaleApplicationInput, AfterSaleKind, AfterSaleRecord, AfterSaleStatus } from '../types/aftersale'
import type { OrderRecord } from '../types/order'
import '../styles/aftersales-v2.css'

const AFTERSALE_KINDS: ReadonlyArray<{ value: AfterSaleKind; title: string; detail: string }> = [
  { value: 'negotiated_refund', title: '协商退款', detail: '双方协商，按证据判断退款' },
  { value: 'account_issue', title: '账号异常', detail: '登录、换号、换绑或安全提示异常' },
  { value: 'account_recovery', title: '找回申诉', detail: '账号被找回，按包赔规则判定' },
]

function AfterSaleTopBar({ title, side, nodeId }: { title: string; side?: ReactNode; nodeId: string }) {
  const navigate = useNavigate()
  return <><DesignPromptTrigger nodeId={nodeId} className="aftersales-v2-status" /><PageHeader className="aftersales-v2-topbar" bordered={false} title={title} left={<button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={20} aria-hidden="true" /></button>} right={side} /></>
}

function useAfterSalesData() {
  const [records, setRecords] = useState<AfterSaleRecord[]>(() => {
    try { return afterSaleRepository.list() } catch { return [] }
  })
  const refresh = useCallback(() => { try { setRecords(afterSaleRepository.list()) } catch { setRecords([]) } }, [])
  useEffect(() => afterSaleRepository.subscribe(refresh), [refresh])
  return { records, refresh }
}

function AfterSaleEmpty({ query, error = false, onRetry }: { query: string; error?: boolean; onRetry?: () => void }) {
  return <section className={`aftersales-v2-empty ${error ? 'error' : ''}`}><span aria-hidden="true">{error ? '!' : '售'}</span><Heading as="h2" variant="result">{error ? '售后记录加载失败' : query ? '没有匹配的售后订单' : '暂无售后记录'}</Heading><p>{error ? '这是本地异常演示，移除 scenario 参数即可恢复。' : query ? '请检查订单编号或尝试其他关键词。' : '当前状态下没有需要处理的售后订单。'}</p>{onRetry && <button type="button" onClick={onRetry}>重新加载</button>}</section>
}

function AfterSaleProduct({ record, showPrice = true }: { record: AfterSaleRecord; showPrice?: boolean }) {
  return <div className="aftersales-v2-product"><img src={record.thumbnail} alt={record.gameName} /><span><b>{record.productTitle}</b><small>{record.gameName} · {record.server}</small><em>订单号 {record.orderId}</em></span>{showPrice && <strong>{formatOrderMoney(record.refundAmountCents)}</strong>}<ChevronRight size={16} aria-hidden="true" /></div>
}

function AfterSaleCard({ record, onWithdraw }: { record: AfterSaleRecord; onWithdraw: (id: string) => void }) {
  const action = record.status === 'supplement' ? '补充材料' : record.status === 'rejected' || record.status === 'completed' || record.status === 'refunding' ? '查看详情' : '查看进度'
  const statusTone = record.status === 'completed' || record.status === 'refunding' ? 'success' : record.status === 'rejected' ? 'danger' : record.status === 'withdrawn' ? 'neutral' : 'warning'
  return <article className={`aftersales-v2-card status-${record.status}`}>
    <header><span><small>售后单号 {record.id}</small></span><StatusBadge tone={statusTone}>{getAfterSaleStatusLabel(record.status)}</StatusBadge></header>
    <Link to={`/aftersales/${record.id}`}><AfterSaleProduct record={record} /><div className="aftersales-v2-kind-row"><span>{record.reason}</span><em>买入订单</em></div>
      {record.status === 'supplement' && <div className="aftersales-v2-card-callout"><b>平台需要你补充协商记录</b><small>{record.statusMessage}</small></div>}
      {record.status === 'pending_review' && <div className="aftersales-v2-card-progress"><span className="done">已提交申请</span><span className="active">客服审核中</span><span>处理结果</span></div>}
      {record.status === 'completed' && <div className="aftersales-v2-card-result"><span>处理结果 · {record.resultLabel ?? '售后已关闭'}</span><b>{record.refundAmountCents > 0 ? `已退款 ${formatOrderMoney(record.refundAmountCents)}` : '已处理'}</b></div>}
    </Link>
    <footer><p>{record.status === 'supplement' ? '提交后重新进入平台核查' : `${record.updatedAt.slice(5)} 更新`}</p>{record.status === 'pending_review' ? <button type="button" onClick={() => onWithdraw(record.id)}>撤销申请</button> : <Link to={`/aftersales/${record.id}`}>{action}</Link>}</footer>
  </article>
}

export function AfterSalesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { records, refresh } = useAfterSalesData()
  const [feedback, setFeedback] = useState('')
  const query = params.get('query') ?? ''
  const [draftQuery, setDraftQuery] = useState(query)
  const rawStatus = params.get('status')
  const status: AfterSaleTab = isAfterSaleTab(rawStatus) ? rawStatus : 'all'
  const scenario = params.get('scenario')
  const visible = useMemo(() => scenario === 'empty' ? [] : filterAfterSales(records, status, query), [query, records, scenario, status])
  const update = (key: 'query' | 'status', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  useEffect(() => setDraftQuery(query), [query])
  const submitSearch = () => update('query', draftQuery.trim())
  const retry = () => { const next = new URLSearchParams(params); next.delete('scenario'); setParams(next, { replace: true }); refresh() }
  const withdraw = (id: string) => { setFeedback(afterSaleRepository.withdraw(id) ? '售后申请已撤销，可在详情中重新申请' : '当前状态无法撤销'); refresh() }
  return <main className="aftersales-v2-page">
    <header className="aftersales-v2-header"><DesignPromptTrigger nodeId="aftersales:list" className="aftersales-v2-status" /><div className="aftersales-v2-title"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={19} aria-hidden="true" /></button><Heading as="h1" variant="page">订单</Heading><div className="aftersales-v2-search-layout" role="search"><SearchField className="aftersales-v2-search-field" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} onClear={() => setDraftQuery('')} onSearch={submitSearch} placeholder="搜索订单" aria-label="搜索售后单号、订单编号、商品或游戏" maxLength={80} /></div></div>
      <Tabs variant="underline" className="aftersales-v2-domain-tabs-ui" label="订单类型" panelId="aftersales-status-panel" value="aftersales" onValueChange={(value) => navigate(value === 'buyer' ? '/orders?role=buyer' : value === 'seller' ? '/orders?role=seller' : '/aftersales')} items={[{ value: 'buyer', label: '买入' }, { value: 'seller', label: '卖出' }, { value: 'aftersales', label: '售后', count: records.length }]} />
      <Tabs className="aftersales-v2-status-tabs" label="售后状态筛选" panelId="aftersales-status-panel" value={status} onValueChange={(value) => update('status', value)} items={AFTERSALE_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: countAfterSales(records, tab.value) }))} />
    </header>
    <div className="aftersales-v2-scroll" id="aftersales-status-panel" role="tabpanel">{scenario === 'error' ? <AfterSaleEmpty query="" error onRetry={retry} /> : visible.length ? visible.map((record) => <AfterSaleCard key={record.id} record={record} onWithdraw={withdraw} />) : <AfterSaleEmpty query={query} />}{visible.length > 0 && <p className="aftersales-v2-list-note">售后 Tab 沿用同一订单号，不改变原订单的履约状态；最终状态以售后详情为准。</p>}</div><Toast message={feedback} onDismiss={() => setFeedback('')} />
  </main>
}

function ApplyOrderCard({ order }: { order: OrderRecord }) {
  return <section className="aftersales-apply-order"><small>关联订单</small><Link to={`/orders/${order.id}`}><img src={order.thumbnail} alt={order.gameName} /><span><b>{order.productTitle}</b><small>订单号 {order.id}</small></span><strong>{formatOrderMoney(order.goodsAmountCents)}</strong><ChevronRight size={16} /></Link></section>
}

export function AfterSaleApplyPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const orderId = params.get('orderId') ?? ''
  const [order] = useState(() => orderRepository.get(orderId))
  const [kind, setKind] = useState<AfterSaleKind>('negotiated_refund')
  const [description, setDescription] = useState('')
  const [materialNames, setMaterialNames] = useState<string[]>([])
  const [fileError, setFileError] = useState('')
  const [materialsBlocked, setMaterialsBlocked] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const active = order ? afterSaleRepository.findActiveByOrder(order.id) : undefined
  if (!order) return <main className="aftersales-v2-page"><AfterSaleTopBar title="申请客服介入" nodeId="aftersales:apply" /><AfterSaleEmpty query="" /></main>
  const submit = () => {
    const selected = AFTERSALE_KINDS.find((item) => item.value === kind)!
    const input: AfterSaleApplicationInput = { kind, reason: selected.title, description, materialNames }
    const created = afterSaleRepository.create(order, input)
    setConfirmOpen(false)
    if (!created) { setFormError('保存失败，请检查本地存储空间后重试。'); return }
    navigate(`/aftersales/${created.id}`, { replace: true })
  }
  const review = () => {
    if (materialsBlocked) { setFormError('请等待材料上传完成，或重试失败的材料。'); return }
    if (active) { navigate(`/aftersales/${active.id}`); return }
    if (description.trim().length < 10) { setFormError('请至少输入 10 个字的问题描述。'); return }
    if (materialNames.length === 0) { setFormError('请上传至少 1 张与问题相关的材料。'); return }
    setFormError('')
    setConfirmOpen(true)
  }
  return <main className="aftersales-v2-page aftersales-apply-page"><AfterSaleTopBar title="申请客服介入" nodeId="aftersales:apply" /><div className="aftersales-v2-detail-scroll">
    <section className="aftersales-apply-alert"><span><b>异常</b><em>当前问题</em></span><Heading as="h2" variant="result">{order.status === 'completed' ? '已完成订单申请售后' : order.status === 'binding' ? '卖家已超时未换绑' : '订单履约遇到问题'}</Heading><p>请描述实际情况并提交相关材料，平台客服将基于订单和材料进行核查。</p><div><ShieldCheck size={14} aria-hidden="true" />{order.status === 'completed' ? '订单已完成，售后处理结果以平台核查为准。' : <>你的 {formatOrderMoney(order.totalAmountCents)} 仍在平台托管，不会自动放款。</>}</div></section>
    <ApplyOrderCard order={order} />
    {active && <section className="aftersales-active-note" role="status"><b>该订单已有进行中的售后申请</b><p>请进入现有售后详情补充材料或查看审核进度。</p><Link to={`/aftersales/${active.id}`}>查看售后详情</Link></section>}
    <fieldset className="aftersales-kind-field" disabled={Boolean(active)}><legend>售后类型 <em>*</em></legend>{AFTERSALE_KINDS.map((item) => <label className={kind === item.value ? 'selected' : ''} key={item.value}><input type="radio" name="aftersale-kind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value)} /><i>{kind === item.value && <span />}</i><span><b>{item.title}</b><small>{item.detail}</small></span></label>)}</fieldset>
    <TextAreaField className="aftersales-description-field" label="问题描述 *" disabled={Boolean(active)} value={description} maxLength={500} showCount hint="如实描述有助于平台更快核查" onChange={(event) => setDescription(event.target.value)} placeholder="请描述问题发生时间、具体情况，以及希望平台协助处理的内容" />
    <MaterialPicker disabled={Boolean(active)} onStatusChange={setMaterialsBlocked} names={materialNames} onChange={(names, error) => { setMaterialNames(names); setFileError(error) }} error={fileError} />
    {formError && <p className="aftersales-form-error" role="alert">{formError}</p>}
  </div><footer className="aftersales-apply-footer"><small>{active ? '已有进行中的售后申请' : '提交后平台将开始核查，可在「售后」查看处理进度'}</small><Button type="button" disabled={!active && materialsBlocked} onClick={review}>{active ? '查看现有申请' : '提交申请'}</Button></footer>
    <Dialog open={confirmOpen} title="确认提交售后申请？" onClose={closeConfirm} showClose={false} className="aftersales-confirm-dialog" actions={<><Button variant="outline" onClick={closeConfirm}>再看看</Button><Button onClick={submit}>确认提交</Button></>}><div className="aftersales-confirm-copy"><p>请确认问题描述和材料无误，提交后平台客服将开始审核。</p><dl><div><dt>售后类型</dt><dd>{AFTERSALE_KINDS.find((item) => item.value === kind)?.title}</dd></div><div><dt>已上传材料</dt><dd>{materialNames.length}张</dd></div><div><dt>关联订单</dt><dd>{order.id.replace(/^OD/, '')}</dd></div></dl></div></Dialog>
  </main>
}

function statusPresentation(record: AfterSaleRecord) {
  if (record.status === 'pending_review') return { eyebrow: '售后处理中', tag: '等平台', title: '待客服审核', detail: record.reviewStage === 'resubmitted' ? '补充材料已提交，平台正在重新审核。' : '售后申请已提交，等待客服审核。', tone: 'pending' }
  if (record.status === 'supplement') return { eyebrow: '售后处理中', tag: '该你了', title: '待补充资料', detail: '请根据客服说明补充文字信息或相关材料，提交后平台会继续审核。', tone: 'pending' }
  if (record.status === 'platform_processing') return { eyebrow: '售后处理中', tag: '等平台', title: '平台处理中', detail: '平台正在处理本次售后申请，处理完成后会同步结果。', tone: 'pending' }
  if (record.status === 'rejected') return { eyebrow: '售后结果', tag: '已关闭', title: '已驳回', detail: '客服已驳回本次售后申请。如仍有新的证据，可重新申请。', tone: 'rejected' }
  if (record.status === 'refunding') return { eyebrow: '售后结果', tag: '已完成', title: '已退款', detail: '售后退款已完成，本次售后已关闭。', tone: 'completed' }
  if (record.status === 'withdrawn') return { eyebrow: '售后结果', tag: '已关闭', title: '已撤销', detail: '你已撤销本次售后申请，可在需要时重新申请。', tone: 'withdrawn' }
  return { eyebrow: '售后结果', tag: '已完成', title: '已处理', detail: '售后问题已经处理完毕，本次售后已关闭。', tone: 'completed' }
}

function AfterSaleHero({ record }: { record: AfterSaleRecord }) {
  const view = statusPresentation(record)
  return <section className={`aftersales-status-hero tone-${view.tone}`}><span><b>{view.eyebrow}</b><em>{view.tag}</em></span><Heading as="h2" variant="hero">{view.title}</Heading><p>{view.detail}</p>{['pending_review', 'platform_processing'].includes(record.status) && <div className="aftersales-status-progress"><span className="done">已提交</span><span className={record.status === 'pending_review' ? 'active' : 'done'}>{record.status === 'pending_review' ? '客服审核中' : '审核通过'}</span><span className={record.status === 'platform_processing' ? 'active' : ''}>平台处理中</span></div>}</section>
}

function AfterSaleDetailsBody({ record }: { record: AfterSaleRecord }) {
  return <>
    {record.status !== 'supplement' && <section className="aftersales-result-card"><Heading as="h2" variant="section">{record.status === 'completed' || record.status === 'refunding' || record.status === 'rejected' ? '最终处理结果' : '当前处理结果'} <em>{record.resultLabel ?? getAfterSaleStatusLabel(record.status)}</em></Heading><p>{record.statusMessage}</p><dl><div><dt>{record.status === 'pending_review' ? '提交时间' : '处理时间'}</dt><dd>{record.updatedAt.slice(5)}</dd></div>{record.status === 'rejected' && <div><dt>关闭时间</dt><dd>{record.updatedAt.slice(5)}</dd></div>}</dl></section>}
    <section className="aftersales-type-row"><b>售后类型</b><span>{record.reason}</span></section>
    <section className="aftersales-current-materials"><Heading as="h2" variant="section">当前售后材料</Heading><p>{record.description}</p><div>{(record.materialNames ?? []).map((name) => <span key={name}><ImageIcon size={17} aria-hidden="true" /><small>{name}</small></span>)}</div>{record.supplements?.map((item) => <article key={item.submittedAt}><header>本次补充 <em>已提交</em></header><p>{item.note}</p></article>)}</section>
    <section className="aftersales-related-order"><small>关联订单</small><Link to={`/orders/${record.orderId}`}><AfterSaleProduct record={record} /></Link></section>
  </>
}

function SupplementForm({ record, onSubmitted }: { record: AfterSaleRecord; onSubmitted: () => void }) {
  const [params] = useSearchParams()
  const [materialsBlocked, setMaterialsBlocked] = useState(params.get('scenario') === 'upload-failed')
  const [note, setNote] = useState('')
  const [names, setNames] = useState<string[]>([])
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const close = useCallback(() => setConfirmOpen(false), [])
  const valid = note.trim().length >= 5 && names.length > 0 && !materialsBlocked
  const submit = () => { if (!valid) return; if (!afterSaleRepository.supplement(record.id, note, names)) { setError('保存失败或售后状态已变化，请重试。'); setConfirmOpen(false); return }; setConfirmOpen(false); onSubmitted() }
  return <><section className="aftersales-result-card supplement"><Heading as="h2" variant="section">当前处理结果 <em>处理方案 · 要求补证</em></Heading><div className="aftersales-result-callout"><b>请补充协商与超时证明</b><p>{record.statusMessage}</p></div><small>客服处理时间 <time>{record.updatedAt.slice(5)}</time></small></section><section className="aftersales-update-materials"><Heading as="h2" variant="section">更新售后材料</Heading><TextAreaField label="补充说明 *" value={note} maxLength={500} showCount onChange={(event) => setNote(event.target.value)} placeholder="根据平台要求补充相关情况…" /><MaterialPicker failurePreview={params.get('scenario') === 'upload-failed'} onStatusChange={setMaterialsBlocked} names={names} onChange={(next, message) => { setNames(next); setError(message) }} error={error} /></section><section className="aftersales-current-materials muted"><Heading as="h2" variant="section">当前售后材料 <small>已提交</small></Heading><p>{record.description}</p><div>{(record.materialNames ?? []).map((name) => <span key={name}><ImageIcon size={17} /><small>{name}</small></span>)}</div></section><section className="aftersales-related-order"><small>关联订单</small><Link to={`/orders/${record.orderId}`}><AfterSaleProduct record={record} /></Link></section><footer className="aftersales-detail-footer"><Button type="button" disabled={!valid} onClick={() => setConfirmOpen(true)}>提交材料</Button></footer><Dialog open={confirmOpen} title="确认提交补充材料？" onClose={close} showClose={false} className="aftersales-confirm-dialog" actions={<><Button variant="outline" onClick={close}>再看看</Button><Button onClick={submit}>确认提交</Button></>}><div className="aftersales-confirm-copy"><p>请确认补充内容无误，提交后平台将继续审核。</p><dl><div><dt>补充说明</dt><dd>已填写</dd></div><div><dt>补充材料</dt><dd>{names.length}张</dd></div></dl></div></Dialog></>
}

export function AfterSaleDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { records, refresh } = useAfterSalesData()
  const [feedback, setFeedback] = useState('')
  const record = records.find((item) => item.id === id)
  if (!record) return <main className="aftersales-v2-page"><AfterSaleTopBar title="售后详情" nodeId="aftersales:detail-review" /><AfterSaleEmpty query="" /></main>
  const reopen = () => { if (afterSaleRepository.reopen(record.id)) { refresh(); setFeedback('售后申请已重新提交') } else setFeedback('当前状态无法重新申请') }
  const withdraw = () => { if (afterSaleRepository.withdraw(record.id)) { refresh(); setFeedback('售后申请已撤销') } else setFeedback('当前状态无法撤销') }
  return <main className={`aftersales-v2-page aftersales-detail-page status-${record.status}`}><AfterSaleTopBar title="售后详情" side={<small>{record.id}</small>} nodeId={resolveAftersalesDetailNodeId(record.status)} /><div className="aftersales-v2-detail-scroll"><AfterSaleHero record={record} />
    {['pending_review', 'platform_processing', 'refunding'].includes(record.status) && <section className="aftersales-escrow-note"><ShieldCheck size={15} aria-hidden="true" />{record.status === 'refunding' ? '托管资金已解除并退回，卖家未收到该笔货款。' : `${formatOrderMoney(record.refundAmountCents)} 保持平台托管，不会自动放款。`}</section>}
    {record.status === 'refunding' && <section className="aftersales-refund-card"><span>退款状态 <b>已退款</b></span><small>退款金额</small><strong>{formatOrderMoney(record.refundAmountCents)}</strong><em>{record.refundMethod ?? '原路退回支付方式'}</em><time>退款时间　{record.updatedAt.slice(5)}</time></section>}
    {record.status === 'supplement' ? <SupplementForm record={record} onSubmitted={() => { refresh(); setFeedback('补充材料已提交，重新进入客服审核') }} /> : <AfterSaleDetailsBody record={record} />}
    {record.status === 'rejected' && <section className="aftersales-reject-tip">补齐驳回说明中缺少的证明后再提交，可提高通过率。</section>}
    {record.status !== 'supplement' && <div className="aftersales-detail-actions">{record.status === 'pending_review' ? <><button type="button" onClick={withdraw}>撤销申请</button><Link className="primary" to={SUPPORT_CONVERSATION_ROUTE}>联系客服</Link></> : ['rejected', 'withdrawn', 'completed'].includes(record.status) ? <><Link to={SUPPORT_CONVERSATION_ROUTE}>联系客服</Link><button type="button" className="primary" onClick={reopen}>重新申请</button></> : <><button type="button" onClick={() => navigate('/aftersales')}>返回售后</button><Link className="primary" to={SUPPORT_CONVERSATION_ROUTE}>联系客服</Link></>}</div>}
  </div><Toast message={feedback} onDismiss={() => setFeedback('')} /></main>
}

export function getAfterSaleSteps(status: AfterSaleStatus) {
  const base = [{ label: '提交售后申请', detail: '平台已收到申请和相关说明', state: 'done' }]
  if (status === 'pending_review') return [...base, { label: '客服审核', detail: '正在核对订单和申请材料', state: 'current' }, { label: '处理结果', detail: '等待审核结论', state: 'upcoming' }]
  if (status === 'supplement') return [...base, { label: '补充材料', detail: '等待你补充必要截图或说明', state: 'current' }, { label: '客服审核', detail: '材料补齐后继续处理', state: 'upcoming' }]
  if (status === 'platform_processing') return [...base, { label: '审核通过', detail: '申请材料已通过审核', state: 'done' }, { label: '平台处理', detail: '等待处理结果', state: 'current' }]
  if (status === 'refunding' || status === 'completed') return [...base, { label: '客服审核', detail: '售后方案已确认', state: 'done' }, { label: '处理完成', detail: '本次售后已经关闭', state: 'done' }]
  return [...base, { label: getAfterSaleStatusLabel(status), detail: status === 'withdrawn' ? '申请由你主动撤销' : '现有材料未通过审核', state: 'error' }]
}
